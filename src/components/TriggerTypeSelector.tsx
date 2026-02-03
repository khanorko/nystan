import type { Trigger } from '../types';

// Neon Lab colors - trigger-specific
const TRIGGER_COLORS: Record<Trigger['type'], string> = {
  gps: '#3A86FF',      // neon blue
  qr: '#FF006E',       // neon pink
  shake: '#FF9F1C',    // neon orange
  tilt: '#8338EC',     // neon purple
  compass: '#FFE66D',  // neon yellow
  touch: '#06FFA5',    // neon green
  hold: '#FF006E',     // neon pink
  timer: '#3A86FF',    // neon blue
  proximity: '#8338EC', // neon purple
  dice: '#FF5733',     // neon red-orange
  code: '#00CED1',     // neon cyan
  spinner: '#FF1493',  // neon magenta
  ai: '#00FF88',       // neon green (AI)
};

const COLORS = {
  deep: '#0a0a0f',
  elevated: '#1a1a24',
  surface: '#24243a',
  textPrimary: '#FAFAFA',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',
  neonPink: '#FF006E',
  neonBlue: '#3A86FF',
};

type TriggerType = Trigger['type'];

interface TriggerInfo {
  type: TriggerType;
  icon: string;
  label: string;
  description: string;
  category: 'location' | 'interaction';
  requiresLocation: boolean;
}

const TRIGGERS: TriggerInfo[] = [
  {
    type: 'gps',
    icon: '📍',
    label: 'GPS',
    description: 'Aktiveras när användaren är inom radie av en plats',
    category: 'location',
    requiresLocation: true,
  },
  {
    type: 'qr',
    icon: '📷',
    label: 'QR-kod',
    description: 'Aktiveras genom att skanna en unik QR-kod',
    category: 'interaction',
    requiresLocation: false,
  },
  {
    type: 'shake',
    icon: '📳',
    label: 'Skaka',
    description: 'Aktiveras genom att skaka telefonen',
    category: 'interaction',
    requiresLocation: false,
  },
  {
    type: 'tilt',
    icon: '📱',
    label: 'Luta',
    description: 'Aktiveras genom att luta telefonen i en riktning',
    category: 'interaction',
    requiresLocation: false,
  },
  {
    type: 'compass',
    icon: '🧭',
    label: 'Kompass',
    description: 'Aktiveras när användaren tittar i en viss riktning',
    category: 'location',
    requiresLocation: true,
  },
  {
    type: 'touch',
    icon: '👆',
    label: 'Tryck',
    description: 'Aktiveras genom att trycka på skärmen',
    category: 'interaction',
    requiresLocation: false,
  },
  {
    type: 'hold',
    icon: '✋',
    label: 'Håll inne',
    description: 'Aktiveras genom att hålla inne på skärmen',
    category: 'interaction',
    requiresLocation: false,
  },
  {
    type: 'timer',
    icon: '⏱️',
    label: 'Timer',
    description: 'Aktiveras efter en viss tid',
    category: 'interaction',
    requiresLocation: false,
  },
  {
    type: 'proximity',
    icon: '👥',
    label: 'Närvaro',
    description: 'Aktiveras när flera enheter är i närheten',
    category: 'location',
    requiresLocation: true,
  },
  {
    type: 'dice',
    icon: '🎲',
    label: 'Tärning',
    description: 'Slumpar ett av sex utfall med eget innehåll',
    category: 'interaction',
    requiresLocation: false,
  },
  {
    type: 'spinner',
    icon: '🎰',
    label: 'Spinner',
    description: 'Snurrhjul med 2-8 val - slumpar visuellt',
    category: 'interaction',
    requiresLocation: false,
  },
  {
    type: 'ai',
    icon: '🕸️',
    label: 'AI',
    description: 'AI-driven interaktion - platsinfo eller chat',
    category: 'interaction',
    requiresLocation: false,
  },
];

interface Props {
  selectedType: TriggerType | null;
  onSelect: (type: TriggerType, requiresLocation: boolean) => void;
}

export function TriggerTypeSelector({ selectedType, onSelect }: Props) {
  const locationTriggers = TRIGGERS.filter((t) => t.category === 'location');
  const interactionTriggers = TRIGGERS.filter((t) => t.category === 'interaction');

  const selectedInfo = TRIGGERS.find((t) => t.type === selectedType);

  return (
    <div className="space-y-6">
      {/* Category: Location-based */}
      <div>
        <h3
          className="text-sm font-display font-bold mb-3 flex items-center gap-2 uppercase tracking-wider"
          style={{ color: COLORS.neonBlue }}
        >
          <span>📍</span>
          Platsbaserade
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {locationTriggers.map((trigger) => {
            const isSelected = selectedType === trigger.type;
            const triggerColor = TRIGGER_COLORS[trigger.type];
            return (
              <button
                key={trigger.type}
                onClick={() => onSelect(trigger.type, trigger.requiresLocation)}
                className="p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2"
                style={{
                  backgroundColor: isSelected ? triggerColor + '20' : COLORS.elevated,
                  borderColor: isSelected ? triggerColor : COLORS.surface,
                  color: isSelected ? triggerColor : COLORS.textSecondary,
                  boxShadow: isSelected ? `0 0 15px ${triggerColor}50` : 'none',
                }}
              >
                <span className="text-2xl">{trigger.icon}</span>
                <span className="text-xs font-display font-bold uppercase">{trigger.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category: Interaction-based */}
      <div>
        <h3
          className="text-sm font-display font-bold mb-3 flex items-center gap-2 uppercase tracking-wider"
          style={{ color: COLORS.neonPink }}
        >
          <span>✨</span>
          Interaktion
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {interactionTriggers.map((trigger) => {
            const isSelected = selectedType === trigger.type;
            const triggerColor = TRIGGER_COLORS[trigger.type];
            return (
              <button
                key={trigger.type}
                onClick={() => onSelect(trigger.type, trigger.requiresLocation)}
                className="p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2"
                style={{
                  backgroundColor: isSelected ? triggerColor + '20' : COLORS.elevated,
                  borderColor: isSelected ? triggerColor : COLORS.surface,
                  color: isSelected ? triggerColor : COLORS.textSecondary,
                  boxShadow: isSelected ? `0 0 15px ${triggerColor}50` : 'none',
                }}
              >
                <span className="text-2xl">{trigger.icon}</span>
                <span className="text-xs font-display font-bold uppercase">{trigger.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      {selectedInfo && (
        <div
          className="p-4 rounded-lg border-2"
          style={{
            backgroundColor: COLORS.deep,
            borderColor: TRIGGER_COLORS[selectedInfo.type],
            color: COLORS.textPrimary,
          }}
        >
          <p className="text-sm">{selectedInfo.description}</p>
          {!selectedInfo.requiresLocation && (
            <p className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
              💡 Denna trigger fungerar var som helst - ingen plats krävs
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export { TRIGGERS, TRIGGER_COLORS };
export type { TriggerInfo };
