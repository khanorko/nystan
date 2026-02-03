import { useState, useEffect, useCallback, useRef } from 'react';

interface SensorState {
  // Device orientation (compass, tilt)
  alpha: number | null; // Compass heading (0-360)
  beta: number | null;  // Front-back tilt (-180 to 180)
  gamma: number | null; // Left-right tilt (-90 to 90)

  // Accelerometer (for shake detection)
  acceleration: number;
  lastShake: number | null;

  // Status
  hasPermission: boolean;
  isSupported: boolean;
  error: string | null;
}

interface UseSensorsReturn extends SensorState {
  requestPermission: () => Promise<boolean>;
}

const SHAKE_THRESHOLD = 15;
const SHAKE_DEBOUNCE = 500;

export function useSensors(): UseSensorsReturn {
  const [state, setState] = useState<SensorState>({
    alpha: null,
    beta: null,
    gamma: null,
    acceleration: 0,
    lastShake: null,
    hasPermission: false,
    isSupported: true,
    error: null,
  });

  const lastAcceleration = useRef({ x: 0, y: 0, z: 0 });
  const lastShakeTime = useRef(0);

  // Check for device orientation support
  useEffect(() => {
    const isSupported =
      'DeviceOrientationEvent' in window && 'DeviceMotionEvent' in window;

    if (!isSupported) {
      setState((prev) => ({
        ...prev,
        isSupported: false,
        error: 'Sensorer stöds inte på denna enhet',
      }));
    }
  }, []);

  // Request permission (required for iOS 13+)
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Check if we need to request permission (iOS 13+)
      if (
        typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
          .requestPermission === 'function'
      ) {
        const permission = await (
          DeviceOrientationEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();

        if (permission !== 'granted') {
          setState((prev) => ({
            ...prev,
            hasPermission: false,
            error: 'Tillgång nekad till sensorer',
          }));
          return false;
        }
      }

      if (
        typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
          .requestPermission === 'function'
      ) {
        const permission = await (
          DeviceMotionEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();

        if (permission !== 'granted') {
          setState((prev) => ({
            ...prev,
            hasPermission: false,
            error: 'Tillgång nekad till sensorer',
          }));
          return false;
        }
      }

      setState((prev) => ({ ...prev, hasPermission: true, error: null }));
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        hasPermission: false,
        error: err instanceof Error ? err.message : 'Kunde inte aktivera sensorer',
      }));
      return false;
    }
  }, []);

  // Device orientation handler (compass, tilt)
  useEffect(() => {
    if (!state.hasPermission) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      setState((prev) => ({
        ...prev,
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      }));
    };

    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [state.hasPermission]);

  // Device motion handler (shake detection)
  useEffect(() => {
    if (!state.hasPermission) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      const deltaX = Math.abs(acc.x - lastAcceleration.current.x);
      const deltaY = Math.abs(acc.y - lastAcceleration.current.y);
      const deltaZ = Math.abs(acc.z - lastAcceleration.current.z);

      const acceleration = Math.sqrt(
        deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
      );

      lastAcceleration.current = { x: acc.x, y: acc.y, z: acc.z };

      // Detect shake
      const now = Date.now();
      if (
        acceleration >= SHAKE_THRESHOLD &&
        now - lastShakeTime.current > SHAKE_DEBOUNCE
      ) {
        lastShakeTime.current = now;
        setState((prev) => ({
          ...prev,
          acceleration,
          lastShake: now,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          acceleration,
        }));
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [state.hasPermission]);

  return {
    ...state,
    requestPermission,
  };
}

// Hook for just compass heading (simplified)
export function useCompass(): {
  heading: number | null;
  error: string | null;
  requestPermission: () => Promise<boolean>;
} {
  const { alpha, error, requestPermission, hasPermission } = useSensors();

  return {
    heading: hasPermission ? alpha : null,
    error,
    requestPermission,
  };
}
