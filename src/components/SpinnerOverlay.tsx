import { useEffect, useState, useRef } from 'react';
import { TRIGGER_COLORS } from './TriggerTypeSelector';
import type { SpinnerOption } from '../types';

const COLORS = {
  deep: '#0a0a0f',
  textPrimary: '#FAFAFA',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',
  neonGreen: '#06FFA5',
  neonPink: '#FF006E',
  neonBlue: '#3A86FF',
  neonPurple: '#8338EC',
  neonYellow: '#FFE66D',
  neonOrange: '#FF9F1C',
};

// Default colors for spinner sections
const SECTION_COLORS = [
  COLORS.neonPink,
  COLORS.neonBlue,
  COLORS.neonPurple,
  COLORS.neonGreen,
  COLORS.neonYellow,
  COLORS.neonOrange,
];

interface Props {
  spinnerContent: SpinnerOption[];
  onClose: () => void;
  onChainTrigger?: (triggerId: string) => void;
}

export function SpinnerOverlay({ spinnerContent, onClose, onChainTrigger }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinnerOption | null>(null);
  const [hasSpun, setHasSpun] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const options = spinnerContent.length > 0 ? spinnerContent : [
    { id: '1', label: 'Val 1' },
    { id: '2', label: 'Val 2' },
    { id: '3', label: 'Val 3' },
  ];

  const sectionAngle = 360 / options.length;
  const triggerColor = TRIGGER_COLORS.spinner || COLORS.neonPurple;

  // Draw the wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 10;

    ctx.clearRect(0, 0, size, size);

    // Draw sections
    options.forEach((option, i) => {
      const startAngle = (i * sectionAngle - 90) * (Math.PI / 180);
      const endAngle = ((i + 1) * sectionAngle - 90) * (Math.PI / 180);
      const color = option.color || SECTION_COLORS[i % SECTION_COLORS.length];

      // Draw section
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Draw border
      ctx.strokeStyle = COLORS.deep;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      const midAngle = (startAngle + endAngle) / 2;
      const labelRadius = radius * 0.65;
      const labelX = center + Math.cos(midAngle) * labelRadius;
      const labelY = center + Math.sin(midAngle) * labelRadius;

      ctx.save();
      ctx.translate(labelX, labelY);

      // Rotate text to be readable (flip if on bottom half)
      let textRotation = midAngle + Math.PI / 2;
      // If the text would be upside down, flip it
      if (midAngle > Math.PI / 2 && midAngle < (3 * Math.PI / 2)) {
        textRotation += Math.PI;
      }
      ctx.rotate(textRotation);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Truncate long labels
      const label = option.label.length > 12 ? option.label.slice(0, 10) + '...' : option.label;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(center, center, 20, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.deep;
    ctx.fill();
    ctx.strokeStyle = triggerColor;
    ctx.lineWidth = 3;
    ctx.stroke();

  }, [options, sectionAngle, triggerColor]);

  // Spin the wheel
  const handleSpin = () => {
    if (spinning) return;

    setSpinning(true);
    setResult(null);

    // Random number of full rotations (3-6) plus random final position
    const fullRotations = 3 + Math.random() * 3;
    const randomAngle = Math.random() * 360;
    const targetRotation = rotation + (fullRotations * 360) + randomAngle;

    setRotation(targetRotation);

    // Calculate result after animation
    setTimeout(() => {
      // Normalize final rotation to 0-360
      const normalizedRotation = ((targetRotation % 360) + 360) % 360;
      // The pointer is at the top (12 o'clock). The wheel rotates clockwise.
      // Section 0 starts at the top initially.
      // After rotating X degrees clockwise, the section at the top is the one
      // that was originally at position -X (or 360-X).
      const effectiveAngle = (360 - normalizedRotation) % 360;
      const resultIndex = Math.floor(effectiveAngle / sectionAngle) % options.length;

      setResult(options[resultIndex]);
      setSpinning(false);
      setHasSpun(true);
    }, 4000); // Match CSS transition duration
  };

  // Auto-open URL or trigger chain
  useEffect(() => {
    if (result) {
      if (result.content?.url && result.content?.autoOpen) {
        window.open(result.content.url, '_blank');
      }
      if (result.chainToTriggerId && onChainTrigger) {
        onChainTrigger(result.chainToTriggerId);
      }
    }
  }, [result, onChainTrigger]);

  return (
    <div
      className="fixed inset-0 z-[2001] flex flex-col animate-fade-in"
      style={{ backgroundColor: COLORS.deep + 'F5' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 safe-top">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: triggerColor,
              boxShadow: `0 0 10px ${triggerColor}`,
              animation: spinning ? 'pulse 0.5s infinite' : 'none',
            }}
          />
          <span className="text-sm font-display font-bold" style={{ color: triggerColor }}>
            {spinning ? 'SNURRAR...' : result ? result.label : 'SNURRA HJULET'}
          </span>
        </div>
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
      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        {/* Wheel container */}
        <div className="relative mb-6">
          {/* Pointer */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10"
            style={{
              width: 0,
              height: 0,
              borderLeft: '15px solid transparent',
              borderRight: '15px solid transparent',
              borderTop: `25px solid ${triggerColor}`,
              filter: `drop-shadow(0 0 10px ${triggerColor})`,
            }}
          />

          {/* Spinning wheel */}
          <div
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
            }}
          >
            <canvas
              ref={canvasRef}
              width={280}
              height={280}
              style={{
                filter: `drop-shadow(0 0 20px ${triggerColor}50)`,
              }}
            />
          </div>
        </div>

        {/* Spin button */}
        {!spinning && !result && (
          <button
            onClick={handleSpin}
            className="px-8 py-4 rounded-lg font-display font-bold text-lg transition-all hover:scale-105"
            style={{
              backgroundColor: triggerColor,
              color: '#fff',
              boxShadow: `0 0 30px ${triggerColor}50`,
            }}
          >
            SNURRA!
          </button>
        )}

        {/* Result content */}
        {!spinning && result && (
          <div className="animate-fade-in w-full max-w-md text-center">
            {result.content ? (
              <>
                <h1
                  className="text-2xl font-display font-bold mb-4"
                  style={{ color: COLORS.textPrimary }}
                >
                  {result.content.title || result.label}
                </h1>

                {result.content.text && (
                  <p className="text-lg leading-relaxed mb-6" style={{ color: COLORS.textSecondary }}>
                    {result.content.text}
                  </p>
                )}

                {result.content.url && !result.content.autoOpen && (
                  <button
                    onClick={() => window.open(result.content!.url, '_blank')}
                    className="w-full p-4 rounded-lg font-display font-bold transition-all mb-4"
                    style={{
                      backgroundColor: triggerColor,
                      color: '#fff',
                      boxShadow: `0 0 20px ${triggerColor}50`,
                    }}
                  >
                    Öppna länk
                  </button>
                )}
              </>
            ) : (
              <h1
                className="text-2xl font-display font-bold mb-4"
                style={{ color: COLORS.textPrimary }}
              >
                {result.label}
              </h1>
            )}

            {result.chainToTriggerId && (
              <p className="text-sm" style={{ color: COLORS.textMuted }}>
                Nästa trigger aktiveras...
              </p>
            )}
          </div>
        )}

        {/* Spin again button */}
        {hasSpun && !spinning && (
          <button
            onClick={() => {
              setResult(null);
              handleSpin();
            }}
            className="mt-6 px-6 py-3 rounded-lg border-2 font-display font-bold transition-all hover:bg-white/10"
            style={{
              borderColor: triggerColor,
              color: triggerColor,
            }}
          >
            Snurra igen
          </button>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
