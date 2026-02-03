import type { Location } from '../types';

export interface NearbyDevice {
  id: string;
  location: Location;
  distance: number; // meters
  lastSeen: number;
}

interface ProximityState {
  sessionId: string | null;
  deviceId: string;
  nearbyDevices: Map<string, NearbyDevice>;
  updateInterval: number | null;
  eventSource: EventSource | null;
}

// Generate a unique device ID
const generateDeviceId = (): string => {
  const stored = localStorage.getItem('kontextlager_device_id');
  if (stored) return stored;

  const id = crypto.randomUUID();
  localStorage.setItem('kontextlager_device_id', id);
  return id;
};

const state: ProximityState = {
  sessionId: null,
  deviceId: generateDeviceId(),
  nearbyDevices: new Map(),
  updateInterval: null,
  eventSource: null,
};

// Callbacks for updates
const listeners: Set<(devices: NearbyDevice[]) => void> = new Set();

// Subscribe to nearby device updates
export function onNearbyDevicesUpdate(
  callback: (devices: NearbyDevice[]) => void
): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// Notify listeners
function notifyListeners() {
  const devices = Array.from(state.nearbyDevices.values());
  listeners.forEach((cb) => cb(devices));
}

// Join a session
export async function joinSession(sessionId: string): Promise<void> {
  if (state.sessionId === sessionId) return;

  // Leave current session if any
  if (state.sessionId) {
    await leaveSession();
  }

  state.sessionId = sessionId;
  localStorage.setItem('kontextlager_session', sessionId);

  // Connect to relay server if available
  const relayUrl = getRelayUrl();
  if (relayUrl) {
    connectToRelay(relayUrl, sessionId);
  }
}

// Leave current session
export async function leaveSession(): Promise<void> {
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }

  if (state.updateInterval) {
    clearInterval(state.updateInterval);
    state.updateInterval = null;
  }

  state.sessionId = null;
  state.nearbyDevices.clear();
  localStorage.removeItem('kontextlager_session');
  notifyListeners();
}

// Update position (broadcast to relay)
export async function updatePosition(location: Location): Promise<void> {
  if (!state.sessionId) return;

  const relayUrl = getRelayUrl();
  if (!relayUrl) return;

  try {
    await fetch(`${relayUrl}/position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        deviceId: state.deviceId,
        lat: location.lat,
        lng: location.lng,
        timestamp: Date.now(),
      }),
    });
  } catch (error) {
    console.error('Failed to update position:', error);
  }
}

// Connect to relay server via Server-Sent Events
function connectToRelay(relayUrl: string, sessionId: string) {
  // Close existing connection
  if (state.eventSource) {
    state.eventSource.close();
  }

  const eventSource = new EventSource(
    `${relayUrl}/events?session=${sessionId}&device=${state.deviceId}`
  );

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'position') {
        // Update nearby device
        if (data.deviceId !== state.deviceId) {
          state.nearbyDevices.set(data.deviceId, {
            id: data.deviceId,
            location: { lat: data.lat, lng: data.lng },
            distance: 0, // Will be calculated
            lastSeen: Date.now(),
          });
          notifyListeners();
        }
      } else if (data.type === 'leave') {
        state.nearbyDevices.delete(data.deviceId);
        notifyListeners();
      }
    } catch (error) {
      console.error('Failed to parse relay message:', error);
    }
  };

  eventSource.onerror = () => {
    // Reconnect after delay
    setTimeout(() => {
      if (state.sessionId === sessionId) {
        connectToRelay(relayUrl, sessionId);
      }
    }, 5000);
  };

  state.eventSource = eventSource;
}

// Get relay URL from environment or use default
function getRelayUrl(): string | null {
  // For local development/demo, return null (no relay)
  // In production, this would be the Vercel Edge Function URL
  return import.meta.env.VITE_RELAY_URL || null;
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(p1: Location, p2: Location): number {
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

// Update distances based on user's current position
export function updateDistances(userLocation: Location): NearbyDevice[] {
  const devices = Array.from(state.nearbyDevices.values());

  devices.forEach((device) => {
    device.distance = calculateDistance(userLocation, device.location);
  });

  // Remove stale devices (not seen in 30 seconds)
  const now = Date.now();
  devices.forEach((device) => {
    if (now - device.lastSeen > 30000) {
      state.nearbyDevices.delete(device.id);
    }
  });

  notifyListeners();
  return devices.filter((d) => now - d.lastSeen <= 30000);
}

// Get current session ID
export function getCurrentSession(): string | null {
  return state.sessionId || localStorage.getItem('kontextlager_session');
}

// Get device ID
export function getDeviceId(): string {
  return state.deviceId;
}

// Generate session code (short, shareable)
export function generateSessionCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Get nearby device count
export function getNearbyCount(): number {
  return state.nearbyDevices.size;
}

// Get all nearby devices
export function getNearbyDevices(): NearbyDevice[] {
  return Array.from(state.nearbyDevices.values());
}
