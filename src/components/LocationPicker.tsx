import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
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
  neonBlue: '#3A86FF',
  neonGreen: '#06FFA5',
  neonOrange: '#FF9F1C',
};

// Custom marker icon - neon orange with glow
const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 40px;
      height: 40px;
      background: ${color};
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 15px ${color}, 0 0 30px ${color}50;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
        <path d="M12 4v16m8-8H4" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

// Map click handler component
function MapClickHandler({
  onLocationChange,
}: {
  onLocationChange: (loc: Location) => void;
}) {
  useMapEvents({
    click: (e) => {
      onLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    },
  });
  return null;
}

// Component to center map on location
function MapCenterUpdater({ location }: { location: Location }) {
  const map = useMap();
  useEffect(() => {
    map.setView([location.lat, location.lng], map.getZoom());
  }, [map, location]);
  return null;
}

interface Props {
  location: Location;
  radius: number;
  onLocationChange: (location: Location) => void;
  onRadiusChange: (radius: number) => void;
  userPosition: Location | null;
}

export function LocationPicker({
  location,
  radius,
  onLocationChange,
  onRadiusChange,
  userPosition,
}: Props) {
  const [showCoords, setShowCoords] = useState(false);

  const handleCenterOnUser = () => {
    if (userPosition) {
      onLocationChange(userPosition);
    }
  };

  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden" style={{ height: '45vh', minHeight: '250px' }}>
        <MapContainer
          center={[location.lat, location.lng]}
          zoom={17}
          className="w-full h-full"
          zoomControl={false}
          dragging={true}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={true}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onLocationChange={onLocationChange} />
          <MapCenterUpdater location={location} />
          <Marker position={[location.lat, location.lng]} icon={createMarkerIcon(COLORS.neonOrange)} />
          <Circle
            center={[location.lat, location.lng]}
            radius={radius}
            pathOptions={{
              color: COLORS.neonOrange,
              fillColor: COLORS.neonOrange,
              fillOpacity: 0.15,
              weight: 3,
            }}
          />
          {/* User position marker */}
          {userPosition && (
            <Circle
              center={[userPosition.lat, userPosition.lng]}
              radius={5}
              pathOptions={{
                color: COLORS.neonBlue,
                fillColor: COLORS.neonBlue,
                fillOpacity: 0.8,
                weight: 2,
              }}
            />
          )}
        </MapContainer>

        {/* Overlay instructions */}
        <div
          className="absolute bottom-3 left-3 right-3 px-4 py-3 rounded-xl text-center border"
          style={{ backgroundColor: COLORS.deep + 'E6', borderColor: COLORS.neonOrange + '50' }}
        >
          <p className="text-sm font-display font-bold" style={{ color: COLORS.textPrimary }}>
            Tryck på kartan för att placera
          </p>
          <button
            onClick={() => setShowCoords(!showCoords)}
            className="text-xs mt-1 font-mono transition-colors hover:opacity-80"
            style={{ color: COLORS.neonOrange }}
          >
            {showCoords
              ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
              : 'Visa koordinater'}
          </button>
        </div>

        {/* Center on user button */}
        {userPosition && (
          <button
            onClick={handleCenterOnUser}
            className="absolute top-3 right-3 w-12 h-12 rounded-full flex items-center justify-center transition-all"
            style={{
              backgroundColor: COLORS.neonBlue,
              boxShadow: `0 0 15px ${COLORS.neonBlue}50`,
            }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="white"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Radius slider */}
      <div
        className="p-4 rounded-xl border"
        style={{ backgroundColor: COLORS.elevated, borderColor: COLORS.surface }}
      >
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-display font-bold" style={{ color: COLORS.neonOrange }}>
            AKTIVERINGSRADIE
          </label>
          <span
            className="text-sm font-display font-bold px-3 py-1 rounded-full"
            style={{ backgroundColor: COLORS.neonOrange, color: 'white' }}
          >
            {radius}m
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="100"
          value={radius}
          onChange={(e) => onRadiusChange(parseInt(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${COLORS.neonOrange} 0%, ${COLORS.neonOrange} ${((radius - 5) / 95) * 100}%, ${COLORS.surface} ${((radius - 5) / 95) * 100}%, ${COLORS.surface} 100%)`,
          }}
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: COLORS.textMuted }}>
          <span>5m</span>
          <span>100m</span>
        </div>
      </div>
    </div>
  );
}
