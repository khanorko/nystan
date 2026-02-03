import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { TriggerSelector } from './TriggerSelector';
import { useCamera } from '../hooks/useCamera';
import { useAudio } from '../hooks/useAudio';
import { saveObject, deleteObject } from '../services/db';
import type { MediaObject, Trigger, Location } from '../types';

// Marker icon for object location
const objectMarkerIcon = L.divIcon({
  className: 'object-marker',
  html: `<div class="w-8 h-8 bg-purple-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center animate-pulse">
    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
    </svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Component to handle map clicks
function MapClickHandler({ onLocationChange }: { onLocationChange: (loc: Location) => void }) {
  useMapEvents({
    click: (e) => {
      onLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface Props {
  object?: MediaObject | null;
  location: Location;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function ObjectEditor({ object, location, onSave, onClose, onDelete }: Props) {
  const [title, setTitle] = useState(object?.title || '');
  const [text, setText] = useState(object?.text || '');
  const [radius, setRadius] = useState(object?.radius || 10);
  const [trigger, setTrigger] = useState<Trigger>(
    object?.trigger || { type: 'gps', params: { radius: 10 } }
  );
  const [active, setActive] = useState(object?.active ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [objectLocation, setObjectLocation] = useState<Location>(
    object?.location || location
  );

  const {
    imageBlob,
    imageUrl,
    isCapturing,
    captureFromCamera,
    selectFromGallery,
    clearImage,
  } = useCamera();

  const {
    audioBlob,
    audioUrl,
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    selectFromFile: selectAudioFile,
    clearAudio,
    playAudio,
    stopAudio,
  } = useAudio();

  // Load existing media
  useEffect(() => {
    if (object?.imageBlob) {
      // Image is already a blob, we could display it but hooks don't support initial state well
      // For now, user would need to re-add the image when editing
    }
  }, [object]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const mediaObject: MediaObject = {
        id: object?.id || uuidv4(),
        title: title.trim(),
        text: text.trim() || undefined,
        imageBlob: imageBlob || object?.imageBlob || undefined,
        audioBlob: audioBlob || object?.audioBlob || undefined,
        location: objectLocation,
        radius,
        trigger,
        active,
        requiresPresence: trigger.type === 'proximity'
          ? (trigger.params.minDevices as number)
          : undefined,
        createdAt: object?.createdAt || Date.now(),
      };

      await saveObject(mediaObject);
      onSave();
    } catch (error) {
      console.error('Failed to save object:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!object?.id) return;

    if (window.confirm('Vill du radera detta objekt?')) {
      try {
        await deleteObject(object.id);
        onDelete?.();
        onClose();
      } catch (error) {
        console.error('Failed to delete object:', error);
      }
    }
  };

  // Auto-scroll to form on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      document.getElementById('editor-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-slate-900 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 px-4 py-3 safe-top flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {object ? 'Redigera objekt' : 'Nytt objekt'}
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white rounded-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Mini map showing location - tap to move pin */}
      <div className="h-[35vh] min-h-[180px] relative">
        <MapContainer
          center={[objectLocation.lat, objectLocation.lng]}
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
          <MapClickHandler onLocationChange={setObjectLocation} />
          <Marker
            position={[objectLocation.lat, objectLocation.lng]}
            icon={objectMarkerIcon}
          />
          <Circle
            center={[objectLocation.lat, objectLocation.lng]}
            radius={radius}
            pathOptions={{
              color: '#8b5cf6',
              fillColor: '#8b5cf6',
              fillOpacity: 0.2,
              weight: 2,
            }}
          />
        </MapContainer>
        {/* Label overlay */}
        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 rounded px-3 py-2 text-center pointer-events-none">
          <p className="text-white text-sm font-medium">Tryck på kartan för att flytta</p>
          <p className="text-slate-400 text-xs">{radius}m radie</p>
        </div>
      </div>

      {/* Form */}
      <div id="editor-form" className="flex-1 p-4 safe-bottom">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Titel *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ge objektet ett namn"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Text */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Beskrivning
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Beskriv vad som händer..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Bild
            </label>
            {imageUrl || object?.imageBlob ? (
              <div className="relative">
                <img
                  src={imageUrl || (object?.imageBlob ? URL.createObjectURL(object.imageBlob) : '')}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 p-2 bg-red-600 rounded-full"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={captureFromCamera}
                  disabled={isCapturing}
                  className="flex-1 py-3 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Kamera
                </button>
                <button
                  onClick={selectFromGallery}
                  disabled={isCapturing}
                  className="flex-1 py-3 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Galleri
                </button>
              </div>
            )}
          </div>

          {/* Audio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Ljud
            </label>
            {audioUrl || object?.audioBlob ? (
              <div className="flex items-center gap-2 p-3 bg-slate-800 border border-slate-700 rounded-lg">
                <button
                  onClick={playAudio}
                  className="p-2 bg-purple-600 rounded-full"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
                <div className="flex-1">
                  <div className="h-2 bg-slate-700 rounded-full">
                    <div className="h-2 bg-purple-500 rounded-full w-0"></div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    stopAudio();
                    clearAudio();
                  }}
                  className="p-2 text-red-400 hover:text-red-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                {isRecording ? (
                  <button
                    onClick={stopRecording}
                    className="flex-1 py-3 px-4 bg-red-600 rounded-lg text-white flex items-center justify-center gap-2 animate-pulse"
                  >
                    <span className="w-3 h-3 bg-white rounded-full"></span>
                    Spelar in... {recordingDuration}s
                  </button>
                ) : (
                  <>
                    <button
                      onClick={startRecording}
                      className="flex-1 py-3 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                      Spela in
                    </button>
                    <button
                      onClick={selectAudioFile}
                      className="flex-1 py-3 px-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                      Välj fil
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Trigger */}
          <TriggerSelector trigger={trigger} onChange={setTrigger} />

          {/* Radius (for GPS trigger) */}
          {trigger.type !== 'gps' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Visningsradie (meter)
              </label>
              <input
                type="range"
                min="5"
                max="100"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>5m</span>
                <span className="text-purple-400">{radius}m</span>
                <span>100m</span>
              </div>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <div>
              <div className="font-medium text-white">Aktiv</div>
              <div className="text-sm text-slate-400">Objektet kan triggas</div>
            </div>
            <button
              onClick={() => setActive(!active)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                active ? 'bg-purple-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  active ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

        </div>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSaving}
            className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
          >
            {isSaving ? 'Sparar...' : object ? 'Spara ändringar' : 'Skapa objekt'}
          </button>

          {object && (
            <button
              onClick={handleDelete}
              className="w-full py-4 bg-transparent border border-red-600 text-red-500 hover:bg-red-600 hover:text-white rounded-lg font-medium transition-colors"
            >
              Radera objekt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
