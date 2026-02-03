import { useState, useEffect, useCallback } from 'react';
import type { GeolocationState } from '../types';

const defaultOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000, // 15 seconds timeout
  maximumAge: 5000, // Only cache for 5 seconds - get fresh position
};

// Mock position for development (Malmö centrum as default)
const MOCK_POSITION = {
  lat: 55.6050,
  lng: 13.0038,
};

function getMockPosition(): GeolocationPosition {
  const stored = localStorage.getItem('mockPosition');
  const pos = stored ? JSON.parse(stored) : MOCK_POSITION;
  return {
    coords: {
      latitude: pos.lat,
      longitude: pos.lng,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  } as GeolocationPosition;
}

// Expose mock control globally for dev
if (import.meta.env.DEV) {
  (window as unknown as { setMockPosition: (lat: number, lng: number) => void }).setMockPosition = (lat: number, lng: number) => {
    localStorage.setItem('mockPosition', JSON.stringify({ lat, lng }));
    localStorage.setItem('useMockGPS', 'true');
    window.location.reload();
  };
}

export function useGeolocation(options: PositionOptions = defaultOptions) {
  const [useMock, setUseMock] = useState(() =>
    import.meta.env.DEV && localStorage.getItem('useMockGPS') === 'true'
  );

  const [state, setState] = useState<GeolocationState>({
    position: useMock ? getMockPosition() : null,
    error: null,
    loading: !useMock,
  });

  // Expose toggle function
  const toggleMock = useCallback(() => {
    const newValue = !useMock;
    localStorage.setItem('useMockGPS', newValue ? 'true' : 'false');
    setUseMock(newValue);
    if (newValue) {
      setState({ position: getMockPosition(), error: null, loading: false });
    }
  }, [useMock]);

  const updatePosition = useCallback((position: GeolocationPosition) => {
    setState({
      position,
      error: null,
      loading: false,
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    console.error('Geolocation error:', error.code, error.message);
    setState((prev) => ({
      ...prev,
      error,
      loading: false,
    }));
  }, []);

  useEffect(() => {
    // Skip real GPS if using mock
    if (useMock) {
      return;
    }

    if (!navigator.geolocation) {
      setState({
        position: null,
        error: {
          code: 2,
          message: 'Geolocation is not supported',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError,
        loading: false,
      });
      return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(updatePosition, handleError, options);

    // Watch for changes
    const watchId = navigator.geolocation.watchPosition(
      updatePosition,
      handleError,
      options
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [options, updatePosition, handleError, useMock]);

  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true }));
    navigator.geolocation.getCurrentPosition(updatePosition, handleError, options);
  }, [options, updatePosition, handleError]);

  return {
    ...state,
    latitude: state.position?.coords.latitude ?? null,
    longitude: state.position?.coords.longitude ?? null,
    accuracy: state.position?.coords.accuracy ?? null,
    heading: state.position?.coords.heading ?? null,
    refresh,
    useMock,
    toggleMock,
  };
}
