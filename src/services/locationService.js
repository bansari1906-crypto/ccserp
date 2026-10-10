import { Geolocation } from '@capacitor/geolocation';

const isCapacitorNative = () => {
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
};

/**
 * Check location permission status.
 * Returns: 'granted' | 'denied' | 'prompt' | 'unknown'
 */
export const checkLocationPermission = async () => {
  if (isCapacitorNative()) {
    try {
      const status = await Geolocation.checkPermissions();
      return status.location || 'unknown';
    } catch (err) {
      console.warn('Capacitor checkPermissions error:', err);
    }
  }

  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      const p = await navigator.permissions.query({ name: 'geolocation' });
      return p.state; // 'granted', 'denied', 'prompt'
    } catch {
      // Ignore
    }
  }

  return 'prompt';
};

/**
 * Request runtime location permission from the device.
 */
export const requestLocationPermission = async () => {
  if (isCapacitorNative()) {
    try {
      const status = await Geolocation.requestPermissions({ permissions: ['location'] });
      return status.location || 'unknown';
    } catch (err) {
      console.warn('Capacitor requestPermissions error:', err);
    }
  }
  return 'prompt';
};

/**
 * Obtain REAL GPS position from device hardware.
 * NEVER returns mock or hardcoded coordinates.
 * Throws clear, user-friendly errors on failure.
 */
export const getCurrentGpsPosition = async (options = {}) => {
  const timeoutMs = options.timeout || 15000;
  const enableHighAccuracy = options.enableHighAccuracy !== false;

  // 1. If native Capacitor environment, use Geolocation plugin
  if (isCapacitorNative()) {
    try {
      // First ensure permission
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (req.location === 'denied') {
          const err = new Error('Location permission was denied. Please allow Location access in Android Settings to proceed.');
          err.code = 'PERMISSION_DENIED';
          throw err;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 0
      });

      if (!position || !position.coords) {
        throw new Error('No GPS coordinate data received from device.');
      }

      const { latitude, longitude, accuracy } = position.coords;

      // Validate non-null and realistic coordinates
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Invalid GPS coordinates acquired from sensor.');
      }

      return {
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        accuracy: Math.round(accuracy || 0),
        timestamp: position.timestamp || Date.now(),
        formattedLocation: `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E (±${Math.round(accuracy || 0)}m)`
      };
    } catch (capErr) {
      console.warn('Capacitor geolocation attempt error:', capErr);
      const msg = capErr?.message?.toLowerCase() || '';

      if (msg.includes('disabled') || msg.includes('location service') || msg.includes('location unavailable')) {
        const e = new Error('Device GPS / Location service is turned off. Please turn ON Location in your phone swipe-down menu or Settings.');
        e.code = 'GPS_DISABLED';
        throw e;
      }
      if (msg.includes('denied')) {
        const e = new Error('Location permission was denied. Please grant Location permission to CCS Connect.');
        e.code = 'PERMISSION_DENIED';
        throw e;
      }
      if (msg.includes('timeout') || msg.includes('timed out')) {
        const e = new Error('GPS signal acquisition timed out. Please ensure you have a clear view of the sky and try again.');
        e.code = 'TIMEOUT';
        throw e;
      }
      // Re-throw if already formatted
      if (capErr.code) throw capErr;
    }
  }

  // 2. Standard Web / HTML5 Geolocation API
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const e = new Error('Geolocation is not supported by this device.');
    e.code = 'NOT_SUPPORTED';
    throw e;
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          reject(new Error('Invalid GPS coordinates obtained from browser.'));
          return;
        }

        resolve({
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          accuracy: Math.round(accuracy || 0),
          timestamp: pos.timestamp || Date.now(),
          formattedLocation: `${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E (±${Math.round(accuracy || 0)}m)`
        });
      },
      (geoErr) => {
        let message = 'Unable to acquire GPS coordinates.';
        let code = 'UNKNOWN';

        switch (geoErr.code) {
          case 1: // PERMISSION_DENIED
            message = 'Location permission denied. Please allow location access in your device settings.';
            code = 'PERMISSION_DENIED';
            break;
          case 2: // POSITION_UNAVAILABLE
            message = 'GPS location is currently unavailable. Please verify Location / GPS is turned ON.';
            code = 'GPS_DISABLED';
            break;
          case 3: // TIMEOUT
            message = 'GPS signal acquisition timed out. Please try again in an area with better reception.';
            code = 'TIMEOUT';
            break;
          default:
            message = geoErr.message || message;
        }

        const err = new Error(message);
        err.code = code;
        reject(err);
      },
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 0
      }
    );
  });
};
