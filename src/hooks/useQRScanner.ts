import { useState, useCallback, useRef, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface UseQRScannerReturn {
  isScanning: boolean;
  lastScannedCode: string | null;
  error: string | null;
  startScanning: (elementId: string) => Promise<void>;
  stopScanning: () => Promise<void>;
}

export function useQRScanner(onScan?: (code: string) => void): UseQRScannerReturn {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);

  // Keep callback ref updated
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const startScanning = useCallback(async (elementId: string) => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
    }

    setError(null);

    try {
      const scanner = new Html5Qrcode(elementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });

      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          setLastScannedCode(decodedText);
          onScanRef.current?.(decodedText);
        },
        () => {
          // QR code not found in frame, ignore
        }
      );

      setIsScanning(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunde inte starta kameran';
      setError(message);
      setIsScanning(false);
    }
  }, []);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch {
        // Ignore stop errors
      }
    }
    setIsScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return {
    isScanning,
    lastScannedCode,
    error,
    startScanning,
    stopScanning,
  };
}

// Generate QR code as data URL
export async function generateQRCodeDataURL(
  data: string,
  size: number = 256
): Promise<string> {
  // Use a simple QR code generation via canvas
  // For a more robust solution, consider using a library like 'qrcode'
  const { toDataURL } = await import('qrcode');
  return toDataURL(data, {
    width: size,
    margin: 2,
    color: {
      dark: '#1e1e2e',
      light: '#ffffff',
    },
  });
}
