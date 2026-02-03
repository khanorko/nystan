import { useEffect, useState } from 'react';
import { TRIGGER_COLORS } from './TriggerTypeSelector';
import type { DiceFace } from '../types';

const COLORS = {
  deep: '#0a0a0f',
  textPrimary: '#FAFAFA',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',
  neonGreen: '#06FFA5',
};

interface Props {
  diceContent: DiceFace[];
  onClose: () => void;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function DiceOverlay({ diceContent, onClose }: Props) {
  const [rolling, setRolling] = useState(true);
  const [currentFace, setCurrentFace] = useState(0);
  const [result, setResult] = useState<number | null>(null);

  useEffect(() => {
    if (!rolling) return;

    // Animate through faces
    const interval = setInterval(() => {
      setCurrentFace((prev) => (prev + 1) % 6);
    }, 100);

    // Stop after 1.5 seconds and pick result
    const timeout = setTimeout(() => {
      clearInterval(interval);
      const finalResult = Math.floor(Math.random() * 6);
      setCurrentFace(finalResult);
      setResult(finalResult);
      setRolling(false);
    }, 1500);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [rolling]);

  // Auto-open URL if configured
  useEffect(() => {
    if (result !== null && diceContent[result]?.url && diceContent[result]?.autoOpen) {
      window.open(diceContent[result].url, '_blank');
    }
  }, [result, diceContent]);

  const triggerColor = TRIGGER_COLORS.dice;
  const face = result !== null ? diceContent[result] : null;

  return (
    <div
      className="fixed inset-0 z-[2001] flex flex-col animate-fade-in"
      style={{ backgroundColor: COLORS.deep + 'F5' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 safe-top">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: triggerColor, boxShadow: `0 0 10px ${triggerColor}` }}
          />
          <span className="text-sm font-display font-bold" style={{ color: triggerColor }}>
            {rolling ? 'SLÅR TÄRNING...' : `UTFALL ${(result ?? 0) + 1}`}
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
        {/* Dice animation */}
        <div
          className={`text-8xl mb-8 transition-transform ${rolling ? 'animate-bounce' : ''}`}
          style={{
            textShadow: `0 0 30px ${triggerColor}`,
          }}
        >
          {DICE_FACES[currentFace]}
        </div>

        {/* Result content */}
        {!rolling && face && (
          <div className="animate-fade-in w-full max-w-md">
            <h1
              className="text-2xl font-display font-bold text-center mb-4"
              style={{ color: COLORS.textPrimary }}
            >
              {face.title}
            </h1>

            {face.text && (
              <p className="text-lg text-center leading-relaxed mb-6" style={{ color: COLORS.textSecondary }}>
                {face.text}
              </p>
            )}

            {face.url && !face.autoOpen && (
              <button
                onClick={() => window.open(face.url, '_blank')}
                className="w-full p-4 rounded-lg font-display font-bold transition-all"
                style={{
                  backgroundColor: triggerColor,
                  color: '#fff',
                  boxShadow: `0 0 20px ${triggerColor}50`,
                }}
              >
                Öppna länk
              </button>
            )}
          </div>
        )}

        {/* Roll again button */}
        {!rolling && (
          <button
            onClick={() => {
              setRolling(true);
              setResult(null);
            }}
            className="mt-8 px-6 py-3 rounded-lg border-2 font-display font-bold transition-all hover:bg-white/10"
            style={{
              borderColor: triggerColor,
              color: triggerColor,
            }}
          >
            Slå igen
          </button>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
