import { useState, useEffect, useCallback, useRef } from 'react';
import { Map } from './Map';
import { ActivationOverlay } from './ActivationOverlay';
import { DiceOverlay } from './DiceOverlay';
import { SpinnerOverlay } from './SpinnerOverlay';
import { AIOverlay } from './AIOverlay';
import { QRScanner } from './QRScanner';
import { PresenceIndicator } from './PresenceIndicator';
import { useGeolocation } from '../hooks/useGeolocation';
import { useSensors } from '../hooks/useSensors';
import { usePresence } from '../hooks/usePresence';
import {
  onTriggerActivation,
  checkGPSTrigger,
  checkQRTrigger,
  checkShakeTrigger,
  checkTiltTrigger,
  checkCompassTrigger,
  checkTouchTrigger,
  checkDiceTrigger,
  checkSpinnerTrigger,
  checkAITrigger,
  startHoldDetection,
  checkHoldTrigger,
  startTimerTriggers,
  clearTimerTriggers,
  resetAllActivations,
  checkProximityTrigger,
  initChainSession,
  completeTrigger,
  dismissTrigger,
  manuallyActivate,
} from '../services/triggers';
import type { MediaObject, ChainedMediaObject } from '../types';

interface Props {
  objects: MediaObject[];
  onClose: () => void;
  initialPosition?: { lat: number; lng: number } | null;
}

export function ExperienceMode({ objects, onClose, initialPosition }: Props) {
  const { latitude, longitude, loading: gpsLoading, error: gpsError, refresh: refreshGps } = useGeolocation();
  const {
    alpha,
    beta,
    gamma,
    lastShake,
    hasPermission,
    isSupported,
    requestPermission,
  } = useSensors();

  const [activatedObject, setActivatedObject] = useState<MediaObject | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [holdingScreen, setHoldingScreen] = useState(false);
  const touchStartRef = useRef<number>(0);

  // Använd GPS-position om tillgänglig, annars initialPosition
  const userPosition = latitude && longitude
    ? { lat: latitude, lng: longitude }
    : initialPosition || null;
  const activeObjects = objects.filter((o) => o.active);

  // Presence system
  const { nearbyCount } = usePresence(userPosition);

  // Initialize chain session and subscribe to trigger activations
  useEffect(() => {
    // Initiera kedje-state för alla objekt
    initChainSession(activeObjects as ChainedMediaObject[]);

    const unsubscribe = onTriggerActivation((object) => {
      setActivatedObject(object);
    });

    return () => {
      unsubscribe();
      resetAllActivations();
    };
  }, [activeObjects]);

  // Start timer triggers
  useEffect(() => {
    startTimerTriggers(activeObjects);
    return () => clearTimerTriggers();
  }, [activeObjects]);

  // Track if we've done the initial center on first GPS lock
  const hasInitialCentered = useRef(false);

  // Auto-center ONCE when GPS first becomes available
  useEffect(() => {
    if (userPosition && !hasInitialCentered.current) {
      hasInitialCentered.current = true;
      // Small delay to let map initialize
      const timer = setTimeout(() => {
        (window as unknown as { flyToUser?: () => void }).flyToUser?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [userPosition]);

  // Check GPS triggers
  useEffect(() => {
    if (userPosition) {
      checkGPSTrigger(activeObjects, userPosition);
    }
  }, [userPosition, activeObjects]);

  // Check shake triggers
  useEffect(() => {
    if (lastShake && hasPermission) {
      checkShakeTrigger(activeObjects, 20); // Use a consistent threshold
    }
  }, [lastShake, activeObjects, hasPermission]);

  // Check compass triggers (when heading changes)
  useEffect(() => {
    if (alpha !== null && hasPermission) {
      checkCompassTrigger(activeObjects, alpha);
    }
  }, [alpha, activeObjects, hasPermission]);

  // Check proximity triggers
  useEffect(() => {
    if (nearbyCount > 0) {
      checkProximityTrigger(activeObjects, nearbyCount + 1); // +1 includes self
    }
  }, [nearbyCount, activeObjects]);

  // Check tilt triggers
  useEffect(() => {
    if (beta !== null && gamma !== null && hasPermission) {
      checkTiltTrigger(activeObjects, beta, gamma);
    }
  }, [beta, gamma, activeObjects, hasPermission]);

  // Handle QR scan
  const handleQRScan = useCallback(
    (code: string) => {
      checkQRTrigger(activeObjects, code);
    },
    [activeObjects]
  );

  // Handle touch start (for touch and hold triggers)
  const handleTouchStart = useCallback(() => {
    touchStartRef.current = Date.now();
    setHoldingScreen(true);
    startHoldDetection();
  }, []);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    const duration = Date.now() - touchStartRef.current;
    setHoldingScreen(false);

    if (duration < 300) {
      // Quick tap = touch trigger + dice/spinner/AI trigger
      checkTouchTrigger(activeObjects);
      checkDiceTrigger(activeObjects);
      checkSpinnerTrigger(activeObjects);
      checkAITrigger(activeObjects);
    } else {
      // Longer press = check hold triggers
      checkHoldTrigger(activeObjects);
    }
  }, [activeObjects]);

  // Handle overlay close - mark trigger as completed
  const handleCloseOverlay = useCallback(() => {
    if (activatedObject) {
      // Markera som stängd - triggas inte automatiskt igen (men kan öppnas manuellt)
      dismissTrigger(activatedObject.id);

      // Markera triggern som completed (för kedjor)
      completeTrigger(
        activatedObject.id,
        activatedObject as ChainedMediaObject,
        activeObjects as ChainedMediaObject[]
      );
    }
    setActivatedObject(null);
  }, [activatedObject, activeObjects]);

  // Handle marker click - manually open trigger (even if dismissed)
  const handleMarkerClick = useCallback((object: MediaObject) => {
    // Kontrollera om objektet tillåter manuell öppning (default: true för GPS)
    const allowManualOpen = object.trigger.type === 'gps'
      ? (object.trigger.params.openOnMarkerClick !== false)
      : true;

    if (allowManualOpen) {
      manuallyActivate(object);
      setActivatedObject(object);
    }
  }, []);

  // Request sensor permission on mount
  useEffect(() => {
    if (isSupported && !hasPermission) {
      // Automatically request on first interaction
    }
  }, [isSupported, hasPermission]);

  // Count triggers by type
  const triggerCounts = activeObjects.reduce(
    (acc, obj) => {
      acc[obj.trigger.type] = (acc[obj.trigger.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="fixed inset-0 bg-deep z-[2000] flex flex-col">
      {/* Header */}
      <header className="h-14 bg-primary/90 backdrop-blur-sm border-b border-surface flex items-center justify-between px-4 safe-top z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-neon-green rounded-full animate-neon-pulse shadow-neon-green" />
          <span className="text-sm font-display font-bold text-neon-green">LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          {/* QR Scanner button */}
          <button
            onClick={() => setShowQRScanner(true)}
            className="p-2 text-neon-pink hover:shadow-neon-pink rounded-lg transition-all"
            title="Skanna QR-kod"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </button>

          {/* Sensor permission button */}
          {isSupported && !hasPermission && (
            <button
              onClick={requestPermission}
              className="p-2 text-neon-yellow hover:shadow-neon-yellow rounded-lg transition-all animate-neon-pulse"
              title="Aktivera sensorer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-neon-pink rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Map with touch detection */}
      <main
        className="flex-1 relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
      >
        <Map userPosition={userPosition} objects={activeObjects} onObjectClick={handleMarkerClick} />

        {/* GPS loading overlay */}
        {!userPosition && (
          <div className="absolute inset-0 bg-deep/98 flex flex-col items-center justify-center z-[1001] bg-grid">
            <div className="w-16 h-16 border-4 border-neon-blue border-t-transparent rounded-full animate-spin mb-6 shadow-neon-blue" />
            <h2 className="text-xl font-display font-bold text-neon-blue mb-2">Söker GPS...</h2>
            <p className="text-text-secondary text-sm text-center px-8">
              {gpsError ? 'Kunde inte hitta din position. Kontrollera GPS-inställningar.' : 'Väntar på din position'}
            </p>
            {gpsError && (
              <button
                onClick={refreshGps}
                className="mt-6 px-6 py-3 bg-neon-pink text-white rounded-lg font-display font-bold hover:shadow-neon-pink transition-all"
              >
                Försök igen
              </button>
            )}
          </div>
        )}

        {/* Hold indicator - only show if there are hold/touch triggers */}
        {holdingScreen && (triggerCounts.hold || triggerCounts.touch) && (
          <div className="absolute inset-0 bg-neon-pink/10 pointer-events-none flex items-center justify-center z-[1000]">
            <div className="w-24 h-24 border-4 border-neon-pink rounded-full animate-neon-pulse flex items-center justify-center shadow-neon-pink">
              <span className="text-neon-pink font-display text-sm font-bold">HÅLL</span>
            </div>
          </div>
        )}

        {/* Status overlay */}
        <div className="absolute top-4 left-4 right-4 flex flex-wrap gap-2 z-[1000]">
          {/* GPS status - clickable to refresh */}
          <button
            onClick={refreshGps}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 border transition-all ${
              userPosition
                ? 'bg-neon-green/20 border-neon-green text-neon-green'
                : gpsLoading
                  ? 'bg-neon-yellow/20 border-neon-yellow text-neon-yellow animate-pulse'
                  : 'bg-neon-orange/20 border-neon-orange text-neon-orange'
            }`}
          >
            <span>📍</span>
            {userPosition ? 'GPS' : gpsLoading ? 'SÖKER' : 'GPS?'}
          </button>

          {/* Sensor status - clickable to request permission */}
          {isSupported && (
            <button
              onClick={!hasPermission ? requestPermission : undefined}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 border transition-all ${
                hasPermission
                  ? 'bg-neon-green/20 border-neon-green text-neon-green'
                  : 'bg-neon-yellow/20 border-neon-yellow text-neon-yellow animate-pulse'
              }`}
            >
              <span>📱</span>
              {hasPermission ? 'SENSOR' : 'SENSOR?'}
            </button>
          )}

          {/* Active triggers */}
          {Object.entries(triggerCounts).map(([type, count]) => (
            <div
              key={type}
              className={`trigger-badge trigger-${type}`}
            >
              <span>{getTriggerIcon(type)}</span>
              {count}
            </div>
          ))}

          {/* Presence indicator */}
          <PresenceIndicator userLocation={userPosition} />
        </div>

        {/* Locate me button */}
        <button
          onClick={() => {
            refreshGps();
            (window as unknown as { flyToUser?: () => void }).flyToUser?.();
          }}
          className="absolute bottom-24 right-4 w-12 h-12 bg-neon-blue hover:shadow-neon-blue rounded-full shadow-lg flex items-center justify-center z-[1000] transition-all"
          title="Min position"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Compass display */}
        {hasPermission && alpha !== null && (
          <div className="absolute bottom-24 left-4 bg-elevated/90 border border-surface rounded-lg p-3 z-[1000]">
            <div className="w-12 h-12 relative">
              <div
                className="absolute inset-0 border-2 border-neon-yellow rounded-full"
                style={{ transform: `rotate(${-alpha}deg)` }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-transparent border-b-neon-pink" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-xs text-neon-yellow font-display font-bold">
                {Math.round(alpha)}°
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer with instructions */}
      <footer className="p-4 bg-primary/90 border-t border-surface safe-bottom">
        <p className="text-center text-sm text-text-secondary font-display">
          {getInstructions(activeObjects)}
        </p>
      </footer>

      {/* QR Scanner */}
      {showQRScanner && (
        <QRScanner onScan={handleQRScan} onClose={() => setShowQRScanner(false)} />
      )}

      {/* Activation overlay */}
      {activatedObject && activatedObject.trigger.type !== 'dice' && activatedObject.trigger.type !== 'spinner' && activatedObject.trigger.type !== 'ai' && (
        <ActivationOverlay
          object={activatedObject}
          onClose={handleCloseOverlay}
        />
      )}

      {/* Dice overlay */}
      {activatedObject && activatedObject.trigger.type === 'dice' && activatedObject.diceContent && (
        <DiceOverlay
          diceContent={activatedObject.diceContent}
          onClose={handleCloseOverlay}
        />
      )}

      {/* Spinner overlay */}
      {activatedObject && activatedObject.trigger.type === 'spinner' && activatedObject.spinnerContent && (
        <SpinnerOverlay
          spinnerContent={activatedObject.spinnerContent}
          onClose={handleCloseOverlay}
        />
      )}

      {/* AI overlay */}
      {activatedObject && activatedObject.trigger.type === 'ai' && (
        <AIOverlay
          params={{
            mode: (activatedObject.trigger.params.mode as 'placeInfo' | 'chat' | 'randomComment') || 'placeInfo',
            systemPrompt: activatedObject.trigger.params.systemPrompt as string | undefined,
            role: activatedObject.trigger.params.role as string | undefined,
            tone: activatedObject.trigger.params.tone as string | undefined,
          }}
          userLocation={userPosition}
          onClose={handleCloseOverlay}
        />
      )}
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
    spinner: '🎰',
    code: '🔢',
    ai: '🕸️',
  };
  return icons[type] || '📍';
}

function getInstructions(objects: MediaObject[]): string {
  const triggerTypes = new Set(objects.map((o) => o.trigger.type));

  const instructions: string[] = [];

  if (triggerTypes.has('gps')) instructions.push('Gå till markörerna');
  if (triggerTypes.has('qr')) instructions.push('Skanna QR-koder');
  if (triggerTypes.has('shake')) instructions.push('Skaka telefonen');
  if (triggerTypes.has('tilt')) instructions.push('Luta telefonen');
  if (triggerTypes.has('compass')) instructions.push('Titta i rätt riktning');
  if (triggerTypes.has('touch')) instructions.push('Tryck på skärmen');
  if (triggerTypes.has('hold')) instructions.push('Håll inne på skärmen');
  if (triggerTypes.has('timer')) instructions.push('Vänta på timers');
  if (triggerTypes.has('proximity')) instructions.push('Var nära andra');
  if (triggerTypes.has('dice')) instructions.push('Slå tärning');
  if (triggerTypes.has('spinner')) instructions.push('Snurra hjulet');
  if (triggerTypes.has('ai')) instructions.push('AI-interaktion');

  if (instructions.length === 0) return 'Inga aktiva objekt';
  return instructions.join(' • ');
}
