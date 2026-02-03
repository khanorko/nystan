import { useState, useEffect, useCallback } from 'react';
import {
  onNearbyDevicesUpdate,
  joinSession,
  leaveSession,
  updatePosition,
  updateDistances,
  getCurrentSession,
  generateSessionCode,
  type NearbyDevice,
} from '../services/proximity';
import type { Location } from '../types';

interface UsePresenceReturn {
  sessionId: string | null;
  nearbyDevices: NearbyDevice[];
  nearbyCount: number;
  isConnected: boolean;
  joinSession: (sessionId: string) => Promise<void>;
  leaveSession: () => Promise<void>;
  createSession: () => string;
  updatePosition: (location: Location) => void;
}

export function usePresence(userLocation: Location | null): UsePresenceReturn {
  const [sessionId, setSessionId] = useState<string | null>(getCurrentSession());
  const [nearbyDevices, setNearbyDevices] = useState<NearbyDevice[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Subscribe to nearby device updates
  useEffect(() => {
    const unsubscribe = onNearbyDevicesUpdate((devices) => {
      setNearbyDevices(devices);
    });

    // Check for existing session
    const existing = getCurrentSession();
    if (existing) {
      setSessionId(existing);
      setIsConnected(true);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Update distances when user location changes
  useEffect(() => {
    if (userLocation && sessionId) {
      updateDistances(userLocation);
      updatePosition(userLocation);
    }
  }, [userLocation, sessionId]);

  // Position update interval
  useEffect(() => {
    if (!sessionId || !userLocation) return;

    const interval = setInterval(() => {
      updatePosition(userLocation);
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId, userLocation]);

  const handleJoinSession = useCallback(async (id: string) => {
    await joinSession(id);
    setSessionId(id);
    setIsConnected(true);
  }, []);

  const handleLeaveSession = useCallback(async () => {
    await leaveSession();
    setSessionId(null);
    setIsConnected(false);
    setNearbyDevices([]);
  }, []);

  const createSession = useCallback(() => {
    const code = generateSessionCode();
    handleJoinSession(code);
    return code;
  }, [handleJoinSession]);

  const handleUpdatePosition = useCallback(
    (location: Location) => {
      if (sessionId) {
        updatePosition(location);
      }
    },
    [sessionId]
  );

  return {
    sessionId,
    nearbyDevices,
    nearbyCount: nearbyDevices.length,
    isConnected,
    joinSession: handleJoinSession,
    leaveSession: handleLeaveSession,
    createSession,
    updatePosition: handleUpdatePosition,
  };
}
