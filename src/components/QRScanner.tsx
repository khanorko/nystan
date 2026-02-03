import { useEffect, useRef, useCallback } from 'react';
import { useQRScanner } from '../hooks/useQRScanner';

// Neon Lab colors
const COLORS = {
  deep: '#0a0a0f',
  textPrimary: '#FAFAFA',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',
  neonPink: '#FF006E',
  neonPurple: '#8338EC',
};

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: Props) {
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  const handleScan = useCallback(
    (code: string) => {
      onScan(code);
      onClose();
    },
    [onScan, onClose]
  );

  const { isScanning, error, startScanning, stopScanning } = useQRScanner(handleScan);

  useEffect(() => {
    const elementId = 'qr-reader';

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      startScanning(elementId);
    }, 100);

    return () => {
      clearTimeout(timer);
      stopScanning();
    };
  }, [startScanning, stopScanning]);

  return (
    <div className="fixed inset-0 z-[2001] flex flex-col" style={{ backgroundColor: COLORS.deep }}>
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 safe-top"
        style={{ backgroundColor: COLORS.deep + 'E6' }}
      >
        <h2 className="text-lg font-display font-bold" style={{ color: COLORS.neonPink }}>
          SKANNA QR-KOD
        </h2>
        <button
          onClick={() => {
            stopScanning();
            onClose();
          }}
          className="p-2 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: COLORS.textMuted }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scanner viewport */}
      <div className="flex-1 relative" ref={scannerContainerRef}>
        <div id="qr-reader" className="w-full h-full" />

        {/* Overlay frame */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 relative">
              {/* Corner markers - neon pink with glow */}
              <div
                className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 rounded-tl-lg"
                style={{ borderColor: COLORS.neonPink, boxShadow: `0 0 10px ${COLORS.neonPink}` }}
              />
              <div
                className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 rounded-tr-lg"
                style={{ borderColor: COLORS.neonPink, boxShadow: `0 0 10px ${COLORS.neonPink}` }}
              />
              <div
                className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 rounded-bl-lg"
                style={{ borderColor: COLORS.neonPink, boxShadow: `0 0 10px ${COLORS.neonPink}` }}
              />
              <div
                className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 rounded-br-lg"
                style={{ borderColor: COLORS.neonPink, boxShadow: `0 0 10px ${COLORS.neonPink}` }}
              />

              {/* Scanning line animation */}
              {isScanning && (
                <div
                  className="absolute left-2 right-2 h-1 animate-scan"
                  style={{ backgroundColor: COLORS.neonPink, boxShadow: `0 0 15px ${COLORS.neonPink}` }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute inset-x-0 bottom-20 flex justify-center">
            <div
              className="px-4 py-2 rounded-lg text-white text-sm font-display"
              style={{ backgroundColor: COLORS.neonPink }}
            >
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div
        className="p-6 text-center safe-bottom"
        style={{ backgroundColor: COLORS.deep + 'E6' }}
      >
        <p className="font-display" style={{ color: COLORS.textSecondary }}>
          Rikta kameran mot en QR-kod för att trigga ett objekt
        </p>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0.5rem; }
          50% { top: calc(100% - 0.5rem); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #qr-reader > div {
          border: none !important;
        }
      `}</style>
    </div>
  );
}
