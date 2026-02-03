import { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TRIGGER_COLORS } from './TriggerTypeSelector';
import type { MediaObject } from '../types';

// Neon Lab colors
const COLORS = {
  neonBlue: '#3A86FF',
  neonPurple: '#8338EC',
};

// Fix for default marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom user location icon - neon blue pulse
const userIcon = L.divIcon({
  className: 'user-marker',
  html: `<div style="
    width: 16px;
    height: 16px;
    background: ${COLORS.neonBlue};
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 0 15px ${COLORS.neonBlue}, 0 0 30px ${COLORS.neonBlue}50;
    animation: pulse 2s infinite;
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Create trigger-specific marker icon (with optional number)
const createObjectIcon = (triggerType: string, number?: number) => {
  const color = TRIGGER_COLORS[triggerType as keyof typeof TRIGGER_COLORS] || COLORS.neonPurple;

  // Show number if provided
  if (number !== undefined) {
    return L.divIcon({
      className: 'object-marker',
      html: `<div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 0 12px ${color}, 0 0 20px ${color}50;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, sans-serif;
        font-weight: bold;
        font-size: 12px;
        color: white;
      ">${number}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  // Default: eye icon
  return L.divIcon({
    className: 'object-marker',
    html: `<div style="
      width: 28px;
      height: 28px;
      background: ${color};
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 12px ${color}, 0 0 20px ${color}50;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="14" height="14" fill="white" viewBox="0 0 20 20">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

interface MapViewProps {
  zoom: number;
  userPosition: { lat: number; lng: number } | null;
}

function MapView({ zoom, userPosition }: MapViewProps) {
  const map = useMap();
  const hasSetInitialPosition = useRef(false);

  // Fly to user position when it first becomes available
  useEffect(() => {
    if (userPosition && !hasSetInitialPosition.current) {
      map.flyTo([userPosition.lat, userPosition.lng], zoom, { duration: 0.5 });
      hasSetInitialPosition.current = true;
    }
  }, [map, userPosition, zoom]);

  // Expose flyTo function for locate button
  useEffect(() => {
    (window as unknown as { flyToUser?: () => void }).flyToUser = () => {
      if (userPosition) {
        map.flyTo([userPosition.lat, userPosition.lng], 17, { duration: 1 });
      }
    };
    return () => {
      delete (window as unknown as { flyToUser?: () => void }).flyToUser;
    };
  }, [map, userPosition]);

  return null;
}

interface Props {
  userPosition: { lat: number; lng: number } | null;
  objects: MediaObject[];
  onObjectClick?: (object: MediaObject) => void;
}

export function Map({ userPosition, objects, onObjectClick }: Props) {
  // Start at user position, or a neutral default (will be hidden by loading overlay anyway)
  const center: [number, number] = userPosition
    ? [userPosition.lat, userPosition.lng]
    : [0, 0];

  // Show numbers on markers toggle
  const [showNumbers, setShowNumbers] = useState(() =>
    localStorage.getItem('kontextlager_show_numbers') === 'true'
  );

  // Listen for toggle events from ObjectList
  useEffect(() => {
    const handleChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setShowNumbers(customEvent.detail);
    };
    window.addEventListener('showNumbersChanged', handleChange);
    return () => window.removeEventListener('showNumbersChanged', handleChange);
  }, []);

  // Sort objects by dependencies (topological sort) for numbering
  const sortedObjects = useMemo(() => {
    const result: MediaObject[] = [];
    const remaining = [...objects];
    const added = new Set<string>();

    // First: objects without dependencies
    for (let i = remaining.length - 1; i >= 0; i--) {
      const obj = remaining[i];
      if (!obj.armCondition?.triggerId) {
        result.push(obj);
        added.add(obj.id);
        remaining.splice(i, 1);
      }
    }

    // Then: objects whose dependencies are satisfied
    let iterations = 0;
    while (remaining.length > 0 && iterations < 100) {
      iterations++;
      let addedThisRound = false;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const obj = remaining[i];
        const dependsOnId = obj.armCondition?.triggerId;

        if (dependsOnId && added.has(dependsOnId)) {
          const depIndex = result.findIndex(r => r.id === dependsOnId);
          let insertIndex = depIndex + 1;
          while (insertIndex < result.length &&
                 result[insertIndex].armCondition?.triggerId === dependsOnId) {
            insertIndex++;
          }
          result.splice(insertIndex, 0, obj);
          added.add(obj.id);
          remaining.splice(i, 1);
          addedThisRound = true;
        }
      }

      if (!addedThisRound) {
        result.push(...remaining);
        break;
      }
    }

    return result;
  }, [objects]);

  // Create a lookup from object id to its display number
  const objectNumbers: Record<string, number> = {};
  sortedObjects.forEach((obj, idx) => {
    objectNumbers[obj.id] = idx + 1;
  });

  return (
    <MapContainer
      center={center}
      zoom={16}
      className="map-container w-full rounded-lg"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapView zoom={16} userPosition={userPosition} />

      {userPosition && (
        <>
          <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon} />
          <Circle
            center={[userPosition.lat, userPosition.lng]}
            radius={10}
            pathOptions={{
              color: COLORS.neonBlue,
              fillColor: COLORS.neonBlue,
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        </>
      )}

      {objects.map((obj) => {
        const triggerColor = TRIGGER_COLORS[obj.trigger.type as keyof typeof TRIGGER_COLORS] || COLORS.neonPurple;
        const displayNumber = showNumbers ? objectNumbers[obj.id] : undefined;
        return (
        <Marker
          key={obj.id}
          position={[obj.location.lat, obj.location.lng]}
          icon={createObjectIcon(obj.trigger.type, displayNumber)}
          eventHandlers={{
            click: () => onObjectClick?.(obj),
          }}
        >
          {obj.radius > 0 && (
            <Circle
              center={[obj.location.lat, obj.location.lng]}
              radius={obj.radius}
              pathOptions={{
                color: triggerColor,
                fillColor: triggerColor,
                fillOpacity: 0.15,
                weight: 2,
                dashArray: '8, 6',
              }}
            />
          )}
        </Marker>
      )})}
    </MapContainer>
  );
}
