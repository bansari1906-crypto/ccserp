import { Geolocation } from '@capacitor/geolocation';

const isCapacitorNative = (): boolean => {
  return typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
};

export interface GpsLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  formattedText: string;
}

/**
 * Check location permission status.
 */
export const checkLocationPermission = async (): Promise<string> => {
  if (isCapacitorNative()) {
    try {
      const status = await Geolocation.checkPermissions();
      return status.location || 'unknown';
    } catch (err) {
      console.warn('Capacitor checkPermissions error:', err);
    }
  }

  if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
    try {
      const p = await (navigator as any).permissions.query({ name: 'geolocation' });
      return p.state;
    } catch {
      // Ignore
    }
  }

  return 'prompt';
};

/**
 * Request runtime location permission from the device.
 */
export const requestLocationPermission = async (): Promise<string> => {
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
export const getCurrentGpsPosition = async (options: { timeout?: number; enableHighAccuracy?: boolean } = {}): Promise<GpsLocationResult> => {
  const timeoutMs = options.timeout || 15000;
  const enableHighAccuracy = options.enableHighAccuracy !== false;

  // 1. If native Capacitor environment, use Geolocation plugin
  if (isCapacitorNative()) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (req.location === 'denied') {
          const err: any = new Error('Location permission was denied. Please enable location access in Android App Settings to proceed.');
          err.code = 'PERMISSION_DENIED';
          throw err;
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 0,
      });

      if (!position || !position.coords) {
        throw new Error('No GPS coordinate data received from device.');
      }

      const { latitude, longitude, accuracy } = position.coords;
      const accStr = accuracy ? `±${Math.round(accuracy)}m` : 'High';
      return {
        latitude,
        longitude,
        accuracy: Math.round(accuracy || 0),
        formattedText: `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E (GPS Verified, ${accStr})`,
      };
    } catch (err: any) {
      console.error('Capacitor Geolocation error:', err);
      if (err.code === 'PERMISSION_DENIED' || err.message?.includes('denied')) {
        throw new Error('Location permission denied. Please allow Location access in device Settings to proceed.');
      }
      if (err.message?.includes('Location services are not enabled') || err.message?.includes('disabled') || err.code === 2) {
        throw new Error('GPS / Location is disabled on device. Please turn on GPS in quick settings and retry.');
      }
      if (err.message?.includes('timeout') || err.code === 3) {
        throw new Error('GPS location request timed out. Please ensure you have a clear view of sky and tap Retry GPS.');
      }
      // If native plugin threw other error, try browser navigator before failing
    }
  }

  // 2. Standard HTML5 Geolocation (browser or WebView fallback)
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    throw new Error('Geolocation is not supported on this device/browser.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const accStr = accuracy ? `±${Math.round(accuracy)}m` : 'Good';
        resolve({
          latitude,
          longitude,
          accuracy: Math.round(accuracy || 0),
          formattedText: `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E (GPS Verified, ${accStr})`,
        });
      },
      (error) => {
        console.error('Browser Geolocation error:', error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Please allow location access to start your working day.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('GPS location unavailable. Please ensure GPS is enabled and you have clear view of sky.'));
            break;
          case error.TIMEOUT:
            reject(new Error('GPS location request timed out. Please check signal and retry.'));
            break;
          default:
            reject(new Error(error.message || 'Failed to obtain GPS location.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      }
    );
  });
};
