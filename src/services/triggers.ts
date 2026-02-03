import type { MediaObject, Location, ChainedMediaObject } from '../types';
import {
  getTriggerStatus,
  processTriggerActivation,
  initializeSession as initChainSession,
  clearSessionState,
} from './chainState';

export type TriggerCallback = (object: MediaObject) => void;

interface TriggerState {
  activeObjects: Set<string>;
  dismissedObjects: Set<string>; // Stängda av användaren - triggas inte automatiskt igen
  listeners: Set<TriggerCallback>;
  touchStartTime: number | null;
  timerTimeouts: Map<string, number>;
}

const state: TriggerState = {
  activeObjects: new Set(),
  dismissedObjects: new Set(),
  listeners: new Set(),
  touchStartTime: null,
  timerTimeouts: new Map(),
};

// Subscribe to trigger activations
export function onTriggerActivation(callback: TriggerCallback): () => void {
  state.listeners.add(callback);
  return () => {
    state.listeners.delete(callback);
  };
}

// Notify all listeners of activation
function notifyActivation(object: MediaObject, allObjects?: MediaObject[]) {
  if (state.activeObjects.has(object.id)) return; // Already activated

  // Kontrollera kedje-status om objektet har armCondition
  const chainedObj = object as ChainedMediaObject;
  if (chainedObj.armCondition) {
    const status = getTriggerStatus(object.id);
    if (status !== 'armed') {
      // Triggern är inte redo (idle eller redan completed)
      return;
    }
    // Bearbeta aktivering genom chainState
    const activated = processTriggerActivation(chainedObj, allObjects as ChainedMediaObject[]);
    if (!activated) return;
  }

  state.activeObjects.add(object.id);
  state.listeners.forEach((cb) => cb(object));

  // Auto-deactivate efter timeout (använd objektets resetTimeout om det finns)
  const timeout = (chainedObj.resetTimeout ?? 30000);
  if (timeout > 0) {
    setTimeout(() => {
      state.activeObjects.delete(object.id);
    }, timeout);
  }
}

// Check GPS/Geofence trigger
export function checkGPSTrigger(
  objects: MediaObject[],
  userLocation: Location
): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'gps') return;

    // Hoppa över om användaren redan stängt denna (dismissed)
    if (state.dismissedObjects.has(obj.id)) return;

    const distance = calculateDistance(userLocation, obj.location);
    const radius = (obj.trigger.params.radius as number) || 10;

    if (distance <= radius) {
      notifyActivation(obj, objects);
    }
  });
}

// Markera trigger som stängd av användaren (triggas inte automatiskt igen)
export function dismissTrigger(objectId: string): void {
  state.dismissedObjects.add(objectId);
  state.activeObjects.delete(objectId);
}

// Manuellt aktivera en trigger (t.ex. tryck på markör på kartan)
export function manuallyActivate(object: MediaObject): void {
  // Tillåt även dismissed triggers att öppnas manuellt
  state.activeObjects.delete(object.id); // Rensa så den kan aktiveras
  state.listeners.forEach((cb) => cb(object));
  state.activeObjects.add(object.id);
}

// Check QR trigger
export function checkQRTrigger(objects: MediaObject[], scannedCode: string): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'qr') return;

    if (obj.trigger.params.code === scannedCode || obj.id === scannedCode) {
      notifyActivation(obj);
    }
  });
}

// Check Shake trigger
export function checkShakeTrigger(
  objects: MediaObject[],
  acceleration: number
): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'shake') return;

    const threshold = (obj.trigger.params.threshold as number) || 15;
    if (acceleration >= threshold) {
      notifyActivation(obj);
    }
  });
}

// Check Tilt trigger
export function checkTiltTrigger(
  objects: MediaObject[],
  beta: number,
  gamma: number
): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'tilt') return;

    const direction = obj.trigger.params.direction as string;
    const targetAngle = (obj.trigger.params.angle as number) || 30;
    const tolerance = 15;

    let triggered = false;
    switch (direction) {
      case 'forward':
        triggered = beta >= targetAngle - tolerance && beta <= targetAngle + tolerance;
        break;
      case 'back':
        triggered = beta <= -targetAngle + tolerance && beta >= -targetAngle - tolerance;
        break;
      case 'left':
        triggered = gamma <= -targetAngle + tolerance && gamma >= -targetAngle - tolerance;
        break;
      case 'right':
        triggered = gamma >= targetAngle - tolerance && gamma <= targetAngle + tolerance;
        break;
    }

    if (triggered) {
      notifyActivation(obj);
    }
  });
}

// Check Compass trigger
export function checkCompassTrigger(
  objects: MediaObject[],
  heading: number
): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'compass') return;

    const targetHeading = (obj.trigger.params.heading as number) || 0;
    const tolerance = (obj.trigger.params.tolerance as number) || 30;

    const diff = Math.abs(normalizeAngle(heading - targetHeading));
    if (diff <= tolerance) {
      notifyActivation(obj);
    }
  });
}

// Check Touch trigger
export function checkTouchTrigger(objects: MediaObject[]): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'touch') return;
    notifyActivation(obj);
  });
}

// Check Dice trigger (same as touch, but shows dice UI)
export function checkDiceTrigger(objects: MediaObject[]): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'dice') return;
    notifyActivation(obj);
  });
}

// Check Spinner trigger (same as touch/dice, but shows spinner UI)
export function checkSpinnerTrigger(objects: MediaObject[]): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'spinner') return;
    notifyActivation(obj);
  });
}

// Check AI trigger (same as touch, but shows AI UI)
export function checkAITrigger(objects: MediaObject[]): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'ai') return;
    notifyActivation(obj);
  });
}

// Start hold detection
export function startHoldDetection(): void {
  state.touchStartTime = Date.now();
}

// Check Hold trigger
export function checkHoldTrigger(objects: MediaObject[]): void {
  if (!state.touchStartTime) return;

  const holdDuration = Date.now() - state.touchStartTime;

  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'hold') return;

    const requiredDuration = (obj.trigger.params.duration as number) || 2000;
    if (holdDuration >= requiredDuration) {
      notifyActivation(obj);
    }
  });

  state.touchStartTime = null;
}

// Start Timer triggers
export function startTimerTriggers(objects: MediaObject[]): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'timer') return;
    if (state.timerTimeouts.has(obj.id)) return; // Already started

    const delay = (obj.trigger.params.delay as number) || 5000;

    const timeoutId = window.setTimeout(() => {
      notifyActivation(obj);
      state.timerTimeouts.delete(obj.id);
    }, delay);

    state.timerTimeouts.set(obj.id, timeoutId);
  });
}

// Clear all timer triggers
export function clearTimerTriggers(): void {
  state.timerTimeouts.forEach((id) => clearTimeout(id));
  state.timerTimeouts.clear();
}

// Check Proximity trigger (called from presence system)
export function checkProximityTrigger(
  objects: MediaObject[],
  nearbyDevices: number
): void {
  objects.forEach((obj) => {
    if (!obj.active || obj.trigger.type !== 'proximity') return;

    const minDevices = (obj.trigger.params.minDevices as number) || 2;
    if (nearbyDevices >= minDevices) {
      notifyActivation(obj);
    }
  });
}

// Reset activation state for an object (allows re-triggering)
export function resetActivation(objectId: string): void {
  state.activeObjects.delete(objectId);
}

// Reset all activations
export function resetAllActivations(): void {
  state.activeObjects.clear();
  state.dismissedObjects.clear();
}

// Check if object has been activated
export function isActivated(objectId: string): boolean {
  return state.activeObjects.has(objectId);
}

// Helper: Calculate distance between two points (Haversine formula)
function calculateDistance(p1: Location, p2: Location): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Helper: Normalize angle to 0-360
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

// Generate QR code data for an object
export function generateQRData(object: MediaObject): string {
  return (object.trigger.params.code as string) || object.id;
}

// Re-export chain functions for ExperienceMode
export { initChainSession, clearSessionState };
export { getTriggerStatus, completeTrigger, onStatusChange } from './chainState';
