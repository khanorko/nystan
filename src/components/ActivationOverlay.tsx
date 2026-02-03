import { useEffect, useRef, useState } from 'react';
import { TRIGGER_COLORS } from './TriggerTypeSelector';
import type { MediaObject } from '../types';

// Neon Lab colors
const COLORS = {
  deep: '#0a0a0f',
  textPrimary: '#FAFAFA',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',
  neonGreen: '#06FFA5',
  neonPurple: '#8338EC',
};

interface Props {
  object: MediaObject;
  onClose: () => void;
}

export function ActivationOverlay({ object, onClose }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create image URL from blob
  useEffect(() => {
    if (object.imageBlob) {
      const url = URL.createObjectURL(object.imageBlob);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [object.imageBlob]);

  // Auto-play audio if available
  useEffect(() => {
    if (object.audioBlob) {
      const url = URL.createObjectURL(object.audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setAudioPlaying(true);
      audio.onended = () => setAudioPlaying(false);
      audio.onpause = () => setAudioPlaying(false);

      // Auto-play
      audio.play().catch(() => {
        // Autoplay blocked, user needs to interact
      });

      return () => {
        audio.pause();
        URL.revokeObjectURL(url);
      };
    }
  }, [object.audioBlob]);

  const toggleAudio = () => {
    if (!audioRef.current) return;

    if (audioPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const triggerColor = TRIGGER_COLORS[object.trigger.type] || COLORS.neonPurple;

  return (
    <div
      className="fixed inset-0 z-[2001] flex flex-col animate-fade-in"
      style={{ backgroundColor: COLORS.deep + 'F5' }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between p-4 safe-top">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: COLORS.neonGreen, boxShadow: `0 0 10px ${COLORS.neonGreen}` }}
          />
          <span className="text-sm font-display font-bold" style={{ color: COLORS.neonGreen }}>
            AKTIVERAD
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
        {/* Image */}
        {imageUrl && (
          <div
            className="w-full max-w-md mb-6 rounded-2xl overflow-hidden border-2"
            style={{ borderColor: triggerColor, boxShadow: `0 0 30px ${triggerColor}40` }}
          >
            <img
              src={imageUrl}
              alt=""
              className="w-full"
            />
          </div>
        )}

        {/* Title */}
        <h1
          className="text-2xl font-display font-bold text-center mb-4"
          style={{ color: COLORS.textPrimary }}
        >
          {object.title}
        </h1>

        {/* Text */}
        {object.text && (
          <p className="text-lg text-center max-w-md leading-relaxed" style={{ color: COLORS.textSecondary }}>
            {object.text}
          </p>
        )}

        {/* Audio controls */}
        {object.audioBlob && (
          <button
            onClick={toggleAudio}
            className="mt-8 w-16 h-16 rounded-full flex items-center justify-center transition-all"
            style={{
              backgroundColor: triggerColor,
              boxShadow: audioPlaying ? `0 0 30px ${triggerColor}` : `0 0 15px ${triggerColor}50`,
            }}
          >
            {audioPlaying ? (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Trigger info footer */}
      <div
        className="p-4 safe-bottom border-t"
        style={{ backgroundColor: COLORS.deep, borderColor: triggerColor + '30' }}
      >
        <div className="flex items-center justify-center gap-2 text-sm font-display" style={{ color: triggerColor }}>
          <span>{getTriggerIcon(object.trigger.type)}</span>
          <span>Triggad av {getTriggerLabel(object.trigger.type)}</span>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

function getTriggerIcon(type: string): string {
  const icons: Record<string, string> = {
    gps: '📍',
    qr: '📷',
    shake: '📳',
    tilt: '📱',
    compass: '🧭',
    touch: '👆',
    hold: '✋',
    timer: '⏱️',
    proximity: '👥',
    dice: '🎲',
  };
  return icons[type] || '📍';
}

function getTriggerLabel(type: string): string {
  const labels: Record<string, string> = {
    gps: 'GPS-position',
    qr: 'QR-kod',
    shake: 'Skakning',
    tilt: 'Lutning',
    compass: 'Kompassriktning',
    touch: 'Tryck',
    hold: 'Lång tryck',
    timer: 'Timer',
    proximity: 'Närvaro',
    dice: 'Tärning',
  };
  return labels[type] || type;
}
