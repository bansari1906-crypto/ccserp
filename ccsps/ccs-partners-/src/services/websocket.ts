/**
 * Real-time WebSocket Service for CCS Connect ERP (Canonical App)
 * Connects to Django Channels via Redis channel layer.
 */

export type RealtimeStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

export interface ErpEvent {
  type: string;
  event: string;
  payload: any;
  timestamp: string;
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 25;
  private baseDelay = 1000;
  private maxDelay = 10000;
  private isManualClose = false;
  private subscribers: Map<string, Set<(payload: any, event: ErpEvent) => void>> = new Map();
  private statusListeners: Set<(status: RealtimeStatus) => void> = new Set();
  private seenEvents: Set<string> = new Set();
  public status: RealtimeStatus = 'DISCONNECTED';

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return (
      localStorage.getItem('access_token') ||
      localStorage.getItem('ccs_access_token') ||
      localStorage.getItem('token')
    );
  }

  public getWsUrl(): string | null {
    const token = this.getAuthToken();
    if (!token) return null;

    const envWs = (import.meta as any).env?.VITE_WS_URL;
    if (envWs) {
      const custom = envWs.replace(/^wss?:\/\//, '');
      const proto = envWs.startsWith('ws://') ? 'ws:' : 'wss:';
      return `${proto}//${custom}/ws/events/?token=${encodeURIComponent(token)}`;
    }

    const isNativeApp =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'capacitor:' ||
        Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
        (window.location.hostname === 'localhost' && !(import.meta as any).env?.DEV));

    const isHostingerDomain =
      typeof window !== 'undefined' &&
      (window.location.hostname.includes('chitracropsciencepartners.com') ||
        window.location.hostname.includes('hostingerapp.com'));

    if (isNativeApp) {
      return `wss://chitracropsciencepartners.com/ws/events/?token=${encodeURIComponent(token)}`;
    }

    if (isHostingerDomain) {
      return `wss://chitracropsciencepartners.com/ws/events/?token=${encodeURIComponent(token)}`;
    }

    if ((import.meta as any).env?.DEV) {
      return `ws://127.0.0.1:8000/ws/events/?token=${encodeURIComponent(token)}`;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/events/?token=${encodeURIComponent(token)}`;
  }

  private setStatus(newStatus: RealtimeStatus) {
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

  public connect() {
    if (typeof window === 'undefined') return;

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
        console.log('[Realtime WS] Connected to live ERP bus.');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ErpEvent;
          this.handleIncomingEvent(data);
        } catch (e) {
          console.warn('[Realtime WS] Failed to parse message:', e);
        }
      };

      this.socket.onclose = () => {
        this.socket = null;
        this.setStatus('DISCONNECTED');
        if (!this.isManualClose) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = (err) => {
        console.debug('[Realtime WS] Socket notice (ERP continues via REST):', err);
      };
    } catch (err) {
      console.warn('[Realtime WS] Connection initialization error:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
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

  private handleIncomingEvent(data: ErpEvent) {
    if (!data) return;
    const eventName = data.event || data.type;
    if (!eventName) return;

    // Deduplicate
    const key = `${eventName}_${data.timestamp}_${JSON.stringify(data.payload || {})}`;
    if (this.seenEvents.has(key)) return;
    this.seenEvents.add(key);
    if (this.seenEvents.size > 200) {
      const first = this.seenEvents.values().next().value;
      if (first) this.seenEvents.delete(first);
    }

    console.log(`[Realtime WS] Incoming Event: ${eventName}`, data.payload);

    // Dispatch DOM event for decoupled listeners
    try {
      window.dispatchEvent(new CustomEvent('erp:event', { detail: data }));
      window.dispatchEvent(new CustomEvent(`erp:${eventName}`, { detail: data }));
    } catch {}

    // Direct subscriber callbacks
    const callbacks = this.subscribers.get(eventName);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data.payload, data);
        } catch (e) {
          console.error('[Realtime WS] Callback error:', e);
        }
      });
    }

    const wildcard = this.subscribers.get('*');
    if (wildcard) {
      wildcard.forEach((cb) => {
        try {
          cb(data.payload, data);
        } catch (e) {
          console.error('[Realtime WS] Wildcard callback error:', e);
        }
      });
    }
  }

  public subscribe(
    eventType: string | string[],
    callback: (payload: any, event: ErpEvent) => void
  ): () => void {
    const types = Array.isArray(eventType) ? eventType : [eventType];
    types.forEach((type) => {
      if (!this.subscribers.has(type)) {
        this.subscribers.set(type, new Set());
      }
      this.subscribers.get(type)!.add(callback);
    });

    if (!this.socket && this.getAuthToken()) {
      this.connect();
    }

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

  public onStatusChange(callback: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public disconnect() {
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
