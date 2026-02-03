import { useState, useCallback } from 'react';

interface UseCameraReturn {
  imageBlob: Blob | null;
  imageUrl: string | null;
  isCapturing: boolean;
  error: string | null;
  captureFromCamera: () => Promise<void>;
  selectFromGallery: () => Promise<void>;
  clearImage: () => void;
}

export function useCamera(): UseCameraReturn {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    // Resize image if too large
    const maxSize = 1024;
    const img = new Image();
    const url = URL.createObjectURL(file);

    return new Promise<Blob>((resolve, reject) => {
      img.onload = () => {
        URL.revokeObjectURL(url);

        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/jpeg',
          0.85
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }, []);

  const captureFromCamera = useCallback(async () => {
    setError(null);
    setIsCapturing(true);

    try {
      // Create hidden file input with capture attribute
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';

      const filePromise = new Promise<File | null>((resolve) => {
        input.onchange = () => {
          resolve(input.files?.[0] ?? null);
        };
        input.oncancel = () => resolve(null);
      });

      input.click();
      const file = await filePromise;

      if (file) {
        const blob = await processFile(file);
        const url = URL.createObjectURL(blob);

        setImageBlob(blob);
        setImageUrl(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ta foto');
    } finally {
      setIsCapturing(false);
    }
  }, [processFile]);

  const selectFromGallery = useCallback(async () => {
    setError(null);
    setIsCapturing(true);

    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      const filePromise = new Promise<File | null>((resolve) => {
        input.onchange = () => {
          resolve(input.files?.[0] ?? null);
        };
        input.oncancel = () => resolve(null);
      });

      input.click();
      const file = await filePromise;

      if (file) {
        const blob = await processFile(file);
        const url = URL.createObjectURL(blob);

        setImageBlob(blob);
        setImageUrl(url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte välja bild');
    } finally {
      setIsCapturing(false);
    }
  }, [processFile]);

  const clearImage = useCallback(() => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageBlob(null);
    setImageUrl(null);
    setError(null);
  }, [imageUrl]);

  return {
    imageBlob,
    imageUrl,
    isCapturing,
    error,
    captureFromCamera,
    selectFromGallery,
    clearImage,
  };
}
