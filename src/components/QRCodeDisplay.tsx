import { useState, useEffect } from 'react';
import { generateQRCode, downloadQRCode } from '../utils/qrcode';

// Neon Lab colors
const COLORS = {
  deep: '#0a0a0f',
  primary: '#12121a',
  elevated: '#1a1a24',
  surface: '#24243a',
  textPrimary: '#FAFAFA',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',
  neonPink: '#FF006E',
  neonPurple: '#8338EC',
  neonGreen: '#06FFA5',
};

interface Props {
  objectId: string;
  title: string;
  onClose: () => void;
  onCreateAnother?: () => void;
}

export function QRCodeDisplay({ objectId, title, onClose, onCreateAnother }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateQRCode(objectId)
      .then(setQrDataUrl)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [objectId]);

  const handleDownload = () => {
    if (qrDataUrl) {
      const safeName = title.replace(/[^a-zA-Z0-9åäöÅÄÖ]/g, '-').toLowerCase();
      downloadQRCode(qrDataUrl, `qr-${safeName}`);
    }
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(objectId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      prompt('Kopiera denna kod:', objectId);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2001] flex flex-col bg-grid"
      style={{ backgroundColor: COLORS.deep }}
    >
      {/* Header */}
      <div
        className="px-4 py-4 safe-top flex items-center justify-between border-b"
        style={{ borderColor: COLORS.surface }}
      >
        <h2 className="text-lg font-display font-bold" style={{ color: COLORS.neonGreen }}>
          QR-KOD SKAPAD!
        </h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg transition-colors hover:bg-white/10"
          style={{ color: COLORS.textMuted }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Success icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{
            backgroundColor: COLORS.neonGreen,
            boxShadow: `0 0 30px ${COLORS.neonGreen}60`,
          }}
        >
          <svg className="w-8 h-8" fill="none" stroke="white" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Title */}
        <h3
          className="text-xl font-display font-bold text-center mb-2"
          style={{ color: COLORS.textPrimary }}
        >
          {title}
        </h3>
        <p className="text-sm text-center mb-8" style={{ color: COLORS.textSecondary }}>
          Skriv ut eller dela denna QR-kod
        </p>

        {/* QR Code */}
        <div
          className="p-6 rounded-2xl mb-8 border-2"
          style={{
            backgroundColor: 'white',
            borderColor: COLORS.neonPink,
            boxShadow: `0 0 30px ${COLORS.neonPink}40`,
          }}
        >
          {isLoading ? (
            <div className="w-64 h-64 flex items-center justify-center">
              <div
                className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: COLORS.neonPink, borderTopColor: 'transparent' }}
              />
            </div>
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center" style={{ color: COLORS.neonPink }}>
              Kunde inte generera QR-kod
            </div>
          )}
        </div>

        {/* Object ID */}
        <button
          onClick={handleCopyId}
          className="px-4 py-2 rounded-lg text-xs font-mono flex items-center gap-2 transition-all border"
          style={{
            backgroundColor: COLORS.surface,
            borderColor: copied ? COLORS.neonGreen : COLORS.surface,
            color: COLORS.textMuted,
          }}
        >
          <span>{objectId.slice(0, 8)}...{objectId.slice(-4)}</span>
          {copied ? (
            <svg className="w-4 h-4" style={{ color: COLORS.neonGreen }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Actions */}
      <div className="p-4 safe-bottom space-y-3">
        <button
          onClick={handleDownload}
          disabled={!qrDataUrl}
          className="w-full py-4 rounded-xl font-display font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:shadow-neon-pink"
          style={{ backgroundColor: COLORS.neonPink, color: 'white' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          LADDA NER QR-KOD
        </button>

        <div className="flex gap-3">
          {onCreateAnother && (
            <button
              onClick={onCreateAnother}
              className="flex-1 py-3 rounded-xl font-display font-bold border-2 transition-all hover:bg-white/5"
              style={{
                borderColor: COLORS.surface,
                color: COLORS.textSecondary,
                backgroundColor: 'transparent',
              }}
            >
              SKAPA FLER
            </button>
          )}
          <button
            onClick={onClose}
            className={`${onCreateAnother ? 'flex-1' : 'w-full'} py-3 rounded-xl font-display font-bold transition-all hover:shadow-neon-green`}
            style={{
              backgroundColor: COLORS.neonGreen,
              color: COLORS.deep,
            }}
          >
            KLAR
          </button>
        </div>
      </div>
    </div>
  );
}
