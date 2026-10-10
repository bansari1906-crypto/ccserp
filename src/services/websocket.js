/**
 * Real-time WebSocket Service for CCS Connect ERP
 * Connects to Django Channels via Redis channel layers.
 * 
 * Features:
 * - Automatic reconnection with backoff
 * - Event deduplication
 * - Custom DOM events + programmatic subscription
 * - Safe fallback (never interrupts standard REST API operations)
 */

class WebSocketService {
  constructor() {
    this.socket = null;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20;
    this.baseDelay = 1000;
    this.maxDelay = 10000;
    this.isManualClose = false;
    this.subscribers = new Map(); // eventType -> Set of callbacks
    this.statusListeners = new Set();
    this.seenEvents = new Set(); // For deduplication
    this.status = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING
  }

  getWsUrl() {
    const token = localStorage.getItem('access_token');
    if (!token) return null;

    if (import.meta.env.VITE_WS_URL) {
      const custom = import.meta.env.VITE_WS_URL.replace(/^wss?:\/\//, '');
      const proto = import.meta.env.VITE_WS_URL.startsWith('ws://') ? 'ws:' : 'wss:';
      return `${proto}//${custom}/ws/events/?token=${encodeURIComponent(token)}`;
    }

    const isNativeApp = typeof window !== 'undefined' && (
      window.location.protocol === 'capacitor:' || 
      Boolean(window.Capacitor?.isNativePlatform?.()) ||
      (window.location.hostname === 'localhost' && !import.meta.env.DEV)
    );

    if (isNativeApp) {
      return `wss://chitracropsciencepartners.com/ws/events/?token=${encodeURIComponent(token)}`;
    }

    if (import.meta.env.DEV) {
      return `ws://127.0.0.1:8000/ws/events/?token=${encodeURIComponent(token)}`;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/events/?token=${encodeURIComponent(token)}`;
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.warn('[Realtime WS] Listener error:', e);
        }
      });
    }
  }

  connect() {
    if (typeof window === 'undefined') return;

    // If already connected or connecting, skip
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = this.getWsUrl();
    if (!wsUrl) {
      this.setStatus('DISCONNECTED');
      return;
    }

    this.isManualClose = false;
    this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('CONNECTED');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data);
        } catch (e) {
          console.warn('[Realtime WS] Failed to parse message:', e);
        }
      };

      this.socket.onclose = (event) => {
        this.socket = null;
        if (!this.isManualClose) {
          this.setStatus('DISCONNECTED');
          this.scheduleReconnect();
        } else {
          this.setStatus('DISCONNECTED');
        }
      };

      this.socket.onerror = (err) => {
        // Safe handling - will trigger onclose which schedules reconnect
        console.debug('[Realtime WS] Socket error encountered (ERP will continue via REST):', err);
      };
    } catch (err) {
      console.warn('[Realtime WS] Connection initialization failed:', err);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimeout || this.isManualClose) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.debug('[Realtime WS] Reached max reconnect attempts. Retrying later.');
      this.setStatus('DISCONNECTED');
      return;
    }

    const delay = Math.min(this.baseDelay * Math.pow(1.5, this.reconnectAttempts), this.maxDelay);
    this.reconnectAttempts += 1;
    this.setStatus('RECONNECTING');

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  handleIncomingEvent(data) {
    if (!data || !data.type) return;

    // Deduplication check
    const eventKey = `${data.type}_${data.event_id || data.timestamp || ''}_${JSON.stringify(data.payload || {})}`;
    if (this.seenEvents.has(eventKey)) {
      return;
    }
    this.seenEvents.add(eventKey);
    // Keep deduplication set compact
    if (this.seenEvents.size > 200) {
      const first = this.seenEvents.values().next().value;
      this.seenEvents.delete(first);
    }

    // 1. Dispatch custom DOM event
    try {
      window.dispatchEvent(new CustomEvent('erp:event', { detail: data }));
      window.dispatchEvent(new CustomEvent(`erp:${data.type}`, { detail: data }));
    } catch (e) {
      console.warn('[Realtime WS] DOM dispatch error:', e);
    }

    // 2. Notify programmatic subscribers
    const typeSubscribers = this.subscribers.get(data.type);
    if (typeSubscribers) {
      typeSubscribers.forEach((cb) => {
        try {
          cb(data.payload, data);
        } catch (e) {
          console.warn('[Realtime WS] Subscriber callback error:', e);
        }
      });
    }

    const wildcardSubscribers = this.subscribers.get('*');
    if (wildcardSubscribers) {
      wildcardSubscribers.forEach((cb) => {
        try {
          cb(data.payload, data);
        } catch (e) {
          console.warn('[Realtime WS] Wildcard callback error:', e);
        }
      });
    }
  }

  subscribe(eventType, callback) {
    const types = Array.isArray(eventType) ? eventType : [eventType];
    types.forEach((type) => {
      if (!this.subscribers.has(type)) {
        this.subscribers.set(type, new Set());
      }
      this.subscribers.get(type).add(callback);
    });

    // Make sure we are connected if a token is present
    if (!this.socket && localStorage.getItem('access_token')) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      types.forEach((type) => {
        const set = this.subscribers.get(type);
        if (set) {
          set.delete(callback);
          if (set.size === 0) {
            this.subscribers.delete(type);
          }
        }
      });
    };
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  disconnect() {
    this.isManualClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('DISCONNECTED');
  }
}

export const realtimeService = new WebSocketService();
export default realtimeService;
