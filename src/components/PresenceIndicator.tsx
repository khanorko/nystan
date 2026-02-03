import { useState } from 'react';
import { usePresence } from '../hooks/usePresence';
import type { Location } from '../types';

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
  userLocation: Location | null;
}

export function PresenceIndicator({ userLocation }: Props) {
  const {
    sessionId,
    nearbyCount,
    nearbyDevices,
    isConnected,
    joinSession,
    leaveSession,
    createSession,
  } = usePresence(userLocation);

  const [showPanel, setShowPanel] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleCreateSession = () => {
    const code = createSession();
    // Copy to clipboard
    navigator.clipboard.writeText(code).catch(() => {});
    setShowJoinInput(false);
  };

  const handleJoinSession = () => {
    if (inputCode.trim()) {
      joinSession(inputCode.trim().toUpperCase());
      setInputCode('');
      setShowJoinInput(false);
    }
  };

  return (
    <div className="relative">
      {/* Main indicator button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-display font-bold border transition-all"
        style={
          isConnected
            ? {
                backgroundColor: COLORS.neonPurple + '20',
                borderColor: COLORS.neonPurple,
                color: COLORS.neonPurple,
              }
            : {
                backgroundColor: COLORS.elevated,
                borderColor: COLORS.surface,
                color: COLORS.textSecondary,
              }
        }
      >
        <span>👥</span>
        {isConnected ? (
          <>
            {nearbyCount > 0 ? `${nearbyCount} NÄRA` : 'ENSAM'}
          </>
        ) : (
          'ANSLUT'
        )}
      </button>

      {/* Expanded panel - centered modal */}
      {showPanel && (
        <>
          <div
            className="fixed inset-0 z-[1100]"
            style={{ backgroundColor: COLORS.deep + 'CC' }}
            onClick={() => setShowPanel(false)}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 rounded-lg shadow-xl z-[1101] overflow-hidden border-2"
            style={{
              backgroundColor: COLORS.elevated,
              borderColor: COLORS.neonPurple,
              boxShadow: `0 0 30px ${COLORS.neonPurple}40`,
            }}
          >
            <div className="p-4 border-b" style={{ borderColor: COLORS.surface }}>
              <h3 className="font-display font-bold mb-1" style={{ color: COLORS.neonPurple }}>
                NÄRVAROSYSTEM
              </h3>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                Dela session-kod för att se andra enheter
              </p>
            </div>

            {isConnected ? (
              <>
                {/* Session info */}
                <div className="p-4" style={{ backgroundColor: COLORS.primary }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-display" style={{ color: COLORS.textMuted }}>SESSION</div>
                      <div
                        className="font-mono text-lg font-bold"
                        style={{ color: COLORS.neonGreen }}
                      >
                        {sessionId}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sessionId || '');
                      }}
                      className="p-2 rounded-lg transition-colors hover:bg-white/10"
                      style={{ color: COLORS.textSecondary }}
                      title="Kopiera kod"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Nearby devices list */}
                <div className="p-4">
                  {nearbyDevices.length > 0 ? (
                    <div className="space-y-2">
                      {nearbyDevices.map((device) => (
                        <div
                          key={device.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: COLORS.neonGreen, boxShadow: `0 0 6px ${COLORS.neonGreen}` }}
                            />
                            <span className="font-mono" style={{ color: COLORS.textSecondary }}>
                              {device.id.slice(0, 8)}
                            </span>
                          </div>
                          <span style={{ color: COLORS.textMuted }}>
                            {device.distance < 1000
                              ? `${Math.round(device.distance)}m`
                              : `${(device.distance / 1000).toFixed(1)}km`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-center py-2" style={{ color: COLORS.textMuted }}>
                      Inga andra enheter hittade
                    </p>
                  )}
                </div>

                {/* Leave button */}
                <div className="p-4 border-t" style={{ borderColor: COLORS.surface }}>
                  <button
                    onClick={() => {
                      leaveSession();
                      setShowPanel(false);
                    }}
                    className="w-full py-2 text-sm font-display font-bold transition-colors hover:opacity-80"
                    style={{ color: COLORS.neonPink }}
                  >
                    LÄMNA SESSION
                  </button>
                </div>
              </>
            ) : (
              <div className="p-4 space-y-3">
                {showJoinInput ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      placeholder="ANGE KOD"
                      maxLength={6}
                      className="w-full px-3 py-2 rounded-lg text-center font-mono text-lg focus:outline-none"
                      style={{
                        backgroundColor: COLORS.surface,
                        border: `2px solid ${COLORS.neonPurple}`,
                        color: COLORS.textPrimary,
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowJoinInput(false)}
                        className="flex-1 py-2 text-sm font-display transition-colors hover:opacity-80"
                        style={{ color: COLORS.textMuted }}
                      >
                        AVBRYT
                      </button>
                      <button
                        onClick={handleJoinSession}
                        disabled={inputCode.length < 4}
                        className="flex-1 py-2 text-sm font-display font-bold rounded-lg text-white transition-all disabled:opacity-50"
                        style={{ backgroundColor: COLORS.neonPurple }}
                      >
                        GÅ MED
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleCreateSession}
                      className="w-full py-3 rounded-lg text-white text-sm font-display font-bold transition-all hover:shadow-neon-purple"
                      style={{ backgroundColor: COLORS.neonPurple }}
                    >
                      SKAPA NY SESSION
                    </button>
                    <button
                      onClick={() => setShowJoinInput(true)}
                      className="w-full py-3 rounded-lg text-sm font-display font-bold border-2 transition-all hover:bg-white/5"
                      style={{ borderColor: COLORS.surface, color: COLORS.textSecondary }}
                    >
                      GÅ MED I SESSION
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
