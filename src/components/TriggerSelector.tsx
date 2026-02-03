import type { Trigger, TriggerType } from '../types';

const TRIGGER_OPTIONS: { type: TriggerType; label: string; icon: string; description: string }[] = [
  { type: 'gps', label: 'GPS', icon: '📍', description: 'Aktiveras när du är inom radie' },
  { type: 'qr', label: 'QR-kod', icon: '📷', description: 'Aktiveras vid QR-skanning' },
  { type: 'shake', label: 'Skaka', icon: '📳', description: 'Aktiveras när du skakar telefonen' },
  { type: 'tilt', label: 'Luta', icon: '📱', description: 'Aktiveras vid lutning' },
  { type: 'compass', label: 'Kompass', icon: '🧭', description: 'Aktiveras när du tittar i rätt riktning' },
  { type: 'touch', label: 'Tryck', icon: '👆', description: 'Aktiveras vid tryck på skärm' },
  { type: 'hold', label: 'Håll inne', icon: '✋', description: 'Aktiveras efter att hålla inne' },
  { type: 'timer', label: 'Timer', icon: '⏱️', description: 'Aktiveras efter fördröjning' },
  { type: 'proximity', label: 'Närvaro', icon: '👥', description: 'Aktiveras när flera enheter är nära' },
];

interface Props {
  trigger: Trigger;
  onChange: (trigger: Trigger) => void;
}

export function TriggerSelector({ trigger, onChange }: Props) {
  const selectedOption = TRIGGER_OPTIONS.find((o) => o.type === trigger.type);

  return (
    <div className="space-y-4">
      {/* Trigger type selection */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Trigger-typ
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TRIGGER_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() =>
                onChange({
                  type: option.type,
                  params: getDefaultParams(option.type),
                })
              }
              className={`p-3 rounded-lg border text-center transition-all ${
                trigger.type === option.type
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="text-lg">{option.icon}</span>
              <span className="block text-xs mt-1">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      {selectedOption && (
        <p className="text-sm text-slate-400 bg-slate-800/50 rounded-lg p-3">
          {selectedOption.description}
        </p>
      )}

      {/* Trigger-specific parameters */}
      {trigger.type === 'gps' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Radie (meter)
          </label>
          <input
            type="range"
            min="5"
            max="100"
            value={(trigger.params.radius as number) || 10}
            onChange={(e) =>
              onChange({
                ...trigger,
                params: { ...trigger.params, radius: parseInt(e.target.value) },
              })
            }
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>5m</span>
            <span className="text-purple-400">{(trigger.params.radius as number) || 10}m</span>
            <span>100m</span>
          </div>
        </div>
      )}

      {trigger.type === 'compass' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Riktning (grader)
          </label>
          <input
            type="range"
            min="0"
            max="359"
            value={(trigger.params.heading as number) || 0}
            onChange={(e) =>
              onChange({
                ...trigger,
                params: { ...trigger.params, heading: parseInt(e.target.value) },
              })
            }
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>N (0°)</span>
            <span className="text-purple-400">
              {getCompassDirection((trigger.params.heading as number) || 0)}
            </span>
            <span>N (360°)</span>
          </div>
        </div>
      )}

      {trigger.type === 'hold' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Håll inne (sekunder)
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={((trigger.params.duration as number) || 2000) / 1000}
            onChange={(e) =>
              onChange({
                ...trigger,
                params: { ...trigger.params, duration: parseInt(e.target.value) * 1000 },
              })
            }
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1s</span>
            <span className="text-purple-400">
              {((trigger.params.duration as number) || 2000) / 1000}s
            </span>
            <span>10s</span>
          </div>
        </div>
      )}

      {trigger.type === 'timer' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Fördröjning (sekunder)
          </label>
          <input
            type="range"
            min="1"
            max="60"
            value={((trigger.params.delay as number) || 5000) / 1000}
            onChange={(e) =>
              onChange({
                ...trigger,
                params: { ...trigger.params, delay: parseInt(e.target.value) * 1000 },
              })
            }
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1s</span>
            <span className="text-purple-400">
              {((trigger.params.delay as number) || 5000) / 1000}s
            </span>
            <span>60s</span>
          </div>
        </div>
      )}

      {trigger.type === 'proximity' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Antal enheter i närheten
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={(trigger.params.minDevices as number) || 2}
            onChange={(e) =>
              onChange({
                ...trigger,
                params: { ...trigger.params, minDevices: parseInt(e.target.value) },
              })
            }
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>1</span>
            <span className="text-purple-400">
              {(trigger.params.minDevices as number) || 2} enheter
            </span>
            <span>10</span>
          </div>
        </div>
      )}

      {trigger.type === 'shake' && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Känslighet
          </label>
          <input
            type="range"
            min="5"
            max="30"
            value={(trigger.params.threshold as number) || 15}
            onChange={(e) =>
              onChange({
                ...trigger,
                params: { ...trigger.params, threshold: parseInt(e.target.value) },
              })
            }
            className="w-full accent-purple-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>Känslig</span>
            <span className="text-purple-400">
              {(trigger.params.threshold as number) || 15}
            </span>
            <span>Kraftig</span>
          </div>
        </div>
      )}

      {trigger.type === 'tilt' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Riktning
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['forward', 'back', 'left', 'right'].map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...trigger,
                      params: { ...trigger.params, direction: dir },
                    })
                  }
                  className={`p-2 rounded-lg border text-xs ${
                    trigger.params.direction === dir
                      ? 'bg-purple-600 border-purple-500'
                      : 'bg-slate-800 border-slate-700'
                  }`}
                >
                  {dir === 'forward' && '↑ Framåt'}
                  {dir === 'back' && '↓ Bakåt'}
                  {dir === 'left' && '← Vänster'}
                  {dir === 'right' && '→ Höger'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Vinkel (grader)
            </label>
            <input
              type="range"
              min="15"
              max="75"
              value={(trigger.params.angle as number) || 30}
              onChange={(e) =>
                onChange({
                  ...trigger,
                  params: { ...trigger.params, angle: parseInt(e.target.value) },
                })
              }
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>15°</span>
              <span className="text-purple-400">{(trigger.params.angle as number) || 30}°</span>
              <span>75°</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultParams(type: TriggerType): Record<string, unknown> {
  switch (type) {
    case 'gps':
      return { radius: 10 };
    case 'qr':
      return { code: crypto.randomUUID().slice(0, 8) };
    case 'shake':
      return { threshold: 15 };
    case 'tilt':
      return { direction: 'forward', angle: 30 };
    case 'compass':
      return { heading: 0, tolerance: 30 };
    case 'touch':
      return {};
    case 'hold':
      return { duration: 2000 };
    case 'timer':
      return { delay: 5000 };
    case 'proximity':
      return { minDevices: 2 };
    default:
      return {};
  }
}

function getCompassDirection(degrees: number): string {
  const directions = ['N', 'NÖ', 'Ö', 'SÖ', 'S', 'SV', 'V', 'NV'];
  const index = Math.round(degrees / 45) % 8;
  return `${directions[index]} (${degrees}°)`;
}
