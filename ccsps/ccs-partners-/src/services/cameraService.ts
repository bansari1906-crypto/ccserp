import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

const isCapacitorNative = (): boolean => {
  return typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
};

export interface CapturePhotoOptions {
  direction?: 'front' | 'rear';
  quality?: number;
  maxWidth?: number;
  allowEditing?: boolean;
}

/**
 * Compresses an image element or data URL to JPEG with max dimensions and target quality.
 */
export const compressImage = (dataUrl: string, maxDimension = 1024, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/**
 * Capture photo via HTML file input fallback with explicit front/rear capture attribute.
 */
export const captureViaFileInput = (direction: 'front' | 'rear' = 'front'): Promise<string> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // 'user' for front-facing camera, 'environment' for rear/back-facing camera
    input.capture = direction === 'front' ? 'user' : 'environment';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('Photo capture was cancelled.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const compressed = await compressImage(reader.result as string, 1024, 0.8);
          resolve(compressed);
        } catch {
          resolve(reader.result as string);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read captured photo file.'));
      reader.readAsDataURL(file);
    };

    input.click();
  });
};

/**
 * Unified camera capture service powering both Front Selfie and Back Camera Photo.
 * Handles permissions, hardware selection, error recovery, retries, and orientation.
 */
export const capturePhoto = async (options: CapturePhotoOptions = {}): Promise<string> => {
  const direction = options.direction || 'front';
  const quality = options.quality ?? 80;
  const maxWidth = options.maxWidth ?? 1024;
  const allowEditing = options.allowEditing ?? false;

  if (isCapacitorNative()) {
    try {
      // 1. Check and request camera runtime permissions
      const perm = await Camera.checkPermissions();
      if (perm.camera !== 'granted') {
        const req = await Camera.requestPermissions({ permissions: ['camera'] });
        if (req.camera === 'denied') {
          const err: any = new Error('Camera permission was denied. Please allow Camera access in Android App Settings.');
          err.code = 'PERMISSION_DENIED';
          throw err;
        }
      }

      // 2. Select hardware camera orientation
      const cameraDirection = direction === 'front' ? CameraDirection.Front : CameraDirection.Rear;

      // 3. Invoke native camera hardware
      const photo = await Camera.getPhoto({
        quality,
        allowEditing,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: cameraDirection,
        width: maxWidth,
        correctOrientation: true,
      });

      if (!photo.dataUrl) {
        throw new Error('Camera did not return image data.');
      }

      return photo.dataUrl;
    } catch (err: any) {
      console.warn(`[CameraService] Native capture error (${direction}):`, err);
      if (err.message && (err.message.includes('User cancelled') || err.message.includes('cancelled') || err.message.includes('closed'))) {
        throw new Error('Photo capture was cancelled.');
      }
      if (err.code === 'PERMISSION_DENIED' || err.message?.includes('denied')) {
        throw new Error('Camera permission denied. Please allow Camera permission in Settings.');
      }
      // If hardware camera fails unexpectedly (e.g. emulator without camera), fall back to file input
      return captureViaFileInput(direction);
    }
  }

  // Web / PWA browser environment fallback
  return captureViaFileInput(direction);
};

/**
 * Capture FRONT CAMERA SELFIE using unified camera engine.
 */
export const captureFrontSelfie = (): Promise<string> => {
  return capturePhoto({ direction: 'front' });
};

/**
 * Capture BACK / REAR CAMERA PHOTO using unified camera engine.
 */
export const captureBackCameraPhoto = (): Promise<string> => {
  return capturePhoto({ direction: 'rear' });
};
