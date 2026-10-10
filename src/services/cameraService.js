import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

const isCapacitorNative = () => {
  return typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
};

/**
 * Compresses an image element or data URL to JPEG with max dimensions and target quality.
 */
export const compressImage = (dataUrl, maxDimension = 1280, quality = 0.8) => {
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
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/**
 * Capture photo via HTML file input fallback with explicit front/rear capture attribute.
 */
const captureViaFileInput = (direction = 'front') => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // 'user' for front camera, 'environment' for rear camera
    input.capture = direction === 'front' ? 'user' : 'environment';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('User cancelled camera capture.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const compressed = await compressImage(reader.result, 1280, 0.8);
          resolve(compressed);
        } catch {
          resolve(reader.result);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read captured photo.'));
      reader.readAsDataURL(file);
    };

    // Trigger file chooser
    input.click();
  });
};

/**
 * Capture FRONT CAMERA SELFIE.
 * Strictly uses front-facing camera hardware.
 */
export const captureFrontSelfie = async () => {
  if (isCapacitorNative()) {
    try {
      const perm = await Camera.checkPermissions();
      if (perm.camera !== 'granted') {
        const req = await Camera.requestPermissions({ permissions: ['camera'] });
        if (req.camera === 'denied') {
          const err = new Error('Camera permission was denied. Please allow Camera access in Android settings.');
          err.code = 'PERMISSION_DENIED';
          throw err;
        }
      }

      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        direction: CameraDirection.Front,
        width: 1280,
        height: 1280,
        correctOrientation: true
      });

      if (!photo?.base64String) {
        throw new Error('No photo data received from camera.');
      }

      return `data:image/jpeg;base64,${photo.base64String}`;
    } catch (err) {
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('cancel') || msg.includes('user cancelled')) {
        const cancelErr = new Error('Selfie capture was cancelled.');
        cancelErr.code = 'CANCELLED';
        throw cancelErr;
      }
      if (msg.includes('denied') || msg.includes('permission')) {
        const permErr = new Error('Camera permission denied. Please grant Camera access in Android Settings.');
        permErr.code = 'PERMISSION_DENIED';
        throw permErr;
      }
      console.warn('Native front camera error, trying web fallback:', err);
    }
  }

  // Fallback to web input with capture="user"
  return captureViaFileInput('front');
};

/**
 * Capture BACK CAMERA PHOTO.
 * Strictly uses rear-facing camera hardware.
 */
export const captureBackCameraPhoto = async () => {
  if (isCapacitorNative()) {
    try {
      const perm = await Camera.checkPermissions();
      if (perm.camera !== 'granted') {
        const req = await Camera.requestPermissions({ permissions: ['camera'] });
        if (req.camera === 'denied') {
          const err = new Error('Camera permission was denied. Please allow Camera access in Android settings.');
          err.code = 'PERMISSION_DENIED';
          throw err;
        }
      }

      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        direction: CameraDirection.Rear,
        width: 1280,
        height: 1280,
        correctOrientation: true
      });

      if (!photo?.base64String) {
        throw new Error('No photo data received from camera.');
      }

      return `data:image/jpeg;base64,${photo.base64String}`;
    } catch (err) {
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('cancel') || msg.includes('user cancelled')) {
        const cancelErr = new Error('Back camera capture was cancelled.');
        cancelErr.code = 'CANCELLED';
        throw cancelErr;
      }
      if (msg.includes('denied') || msg.includes('permission')) {
        const permErr = new Error('Camera permission denied. Please grant Camera access in Android Settings.');
        permErr.code = 'PERMISSION_DENIED';
        throw permErr;
      }
      console.warn('Native back camera error, trying web fallback:', err);
    }
  }

  // Fallback to web input with capture="environment"
  return captureViaFileInput('back');
};
