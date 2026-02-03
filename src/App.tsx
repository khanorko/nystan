import { useState, useEffect, useCallback } from 'react';
import { Map } from './components/Map';
import { ObjectEditorWizard } from './components/ObjectEditorWizard';
import { ObjectList } from './components/ObjectList';
import { ExperienceMode } from './components/ExperienceMode';
import { useGeolocation } from './hooks/useGeolocation';
import { getAllObjects, exportAllObjects, importObjects, getStorageEstimate } from './services/db';
import type { MediaObject } from './types';

type View = 'map' | 'create' | 'edit' | 'list' | 'experience';

// Helper to encode objects for URL (without blobs)
function encodeObjectsForShare(objects: MediaObject[]): string {
  const shareableObjects = objects
    .filter(o => o.active)
    .map(({ imageBlob, audioBlob, ...rest }) => rest);
  return btoa(encodeURIComponent(JSON.stringify(shareableObjects)));
}

// Helper to decode objects from URL
function decodeObjectsFromShare(encoded: string): MediaObject[] | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function App() {
  const { latitude, longitude, error, loading, refresh: refreshGPS, useMock, toggleMock } = useGeolocation();
  const [objects, setObjects] = useState<MediaObject[]>([]);
  const [sharedObjects, setSharedObjects] = useState<MediaObject[] | null>(null);
  const [selectedObject, setSelectedObject] = useState<MediaObject | null>(null);
  const [editingObject, setEditingObject] = useState<MediaObject | null>(null);
  const [view, setView] = useState<View>('map');
  const [showMenu, setShowMenu] = useState(false);
  const [isSharedExperience, setIsSharedExperience] = useState(false);
  const [storageUsed, setStorageUsed] = useState<number | null>(null);

  // Check URL for shared experience on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#exp=')) {
      const encoded = hash.slice(5);
      const decoded = decodeObjectsFromShare(encoded);
      if (decoded && decoded.length > 0) {
        setSharedObjects(decoded);
        setIsSharedExperience(true);
        setView('experience');
        // Clear hash to avoid re-triggering
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  const loadObjects = useCallback(async () => {
    const allObjects = await getAllObjects();
    setObjects(allObjects);
    // Check storage usage
    const estimate = await getStorageEstimate();
    if (estimate) {
      setStorageUsed(Math.round(estimate.used / (1024 * 1024))); // MB
    }
  }, []);

  useEffect(() => {
    loadObjects();
  }, [loadObjects]);

  const userPosition = latitude && longitude ? { lat: latitude, lng: longitude } : null;

  const handleObjectClick = (obj: MediaObject) => {
    setSelectedObject(obj);
  };

  const handleEditObject = (obj: MediaObject) => {
    setEditingObject(obj);
    setSelectedObject(null);
    setView('edit');
  };

  const handleCreateObject = () => {
    if (!userPosition) return;
    setEditingObject(null);
    setView('create');
  };

  const handleSave = async () => {
    await loadObjects();
    setView('map');
    setEditingObject(null);
  };

  const handleExport = async () => {
    try {
      const json = await exportAllObjects();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `nystan-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
      setShowMenu(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleShareExperience = async () => {
    const activeObjects = objects.filter(o => o.active);
    if (activeObjects.length === 0) {
      alert('Inga aktiva objekt att dela');
      return;
    }

    const encoded = encodeObjectsForShare(activeObjects);
    const shareUrl = `${window.location.origin}${window.location.pathname}#exp=${encoded}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      alert(`Länk kopierad! (${activeObjects.length} objekt)\n\nDela denna länk för att starta upplevelsen.`);
    } catch {
      // Fallback for older browsers
      prompt('Kopiera denna länk:', shareUrl);
    }
    setShowMenu(false);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const count = await importObjects(text);
        alert(`Importerade ${count} objekt`);
        await loadObjects();
        setShowMenu(false);
      } catch (error) {
        console.error('Import failed:', error);
        alert('Kunde inte importera filen');
      }
    };

    input.click();
  };

  return (
    <div className="min-h-screen min-h-dvh bg-deep flex flex-col bg-grid">
      {/* Header */}
      <header className="h-16 bg-primary/90 backdrop-blur-sm border-b border-surface flex items-center justify-between px-4 safe-top z-[1001]">
        <h1 className="text-lg font-display font-bold text-neon-pink">Nystan</h1>
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          {loading && (
            <span className="text-xs text-neon-yellow flex items-center gap-1 font-display">
              <span className="w-2 h-2 bg-neon-yellow rounded-full animate-pulse" />
              Söker...
            </span>
          )}
          {error && (
            <button
              onClick={() => {
                if (error.code === 1) {
                  alert('GPS nekad. Gå till Inställningar → Safari → Plats och tillåt för denna sida.');
                } else if (error.code === 2) {
                  alert('Kan inte hitta din position. Testa utomhus eller kontrollera att GPS är på.');
                } else {
                  alert('GPS timeout. Försök igen.');
                }
              }}
              className="text-xs text-neon-orange flex items-center gap-1 font-display"
            >
              <span className="w-2 h-2 bg-neon-orange rounded-full animate-neon-pulse" />
              {error.code === 1 ? 'GPS nekad' : error.code === 2 ? 'Ingen GPS' : 'GPS timeout'}
            </button>
          )}
          {userPosition && !loading && (
            <span className="text-xs text-neon-green flex items-center gap-1 font-display">
              <span className="w-2 h-2 bg-neon-green rounded-full shadow-neon-green" />
              {useMock ? 'MOCK' : 'GPS'}
            </span>
          )}

          {/* Dev: Mock GPS toggle */}
          {import.meta.env.DEV && (
            <button
              onClick={toggleMock}
              className={`text-xs px-2 py-1 rounded font-display font-bold transition-all ${
                useMock
                  ? 'bg-neon-yellow text-deep'
                  : 'bg-surface text-text-muted hover:text-neon-yellow'
              }`}
              title="Toggle mock GPS (dev only)"
            >
              {useMock ? '🎯 MOCK' : '📍 GPS'}
            </button>
          )}

          {/* Menu button */}
          <div className="relative">
            <button
              onTouchStart={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              onClick={() => setShowMenu(!showMenu)}
              className="p-3 -m-1 text-text-secondary hover:text-neon-blue active:text-neon-blue rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-elevated border border-surface rounded-lg shadow-xl z-[1002] overflow-hidden">
                <button
                  onTouchStart={() => {
                    setView('list');
                    setShowMenu(false);
                  }}
                  onClick={() => {
                    setView('list');
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-4 text-left text-text-secondary hover:text-neon-blue active:bg-surface flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Alla objekt ({objects.length})
                </button>
                <button
                  onTouchStart={handleShareExperience}
                  onClick={handleShareExperience}
                  disabled={objects.filter(o => o.active).length === 0}
                  className="w-full px-4 py-4 text-left text-text-secondary hover:text-neon-purple active:bg-surface disabled:opacity-50 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Dela upplevelse
                </button>
                <button
                  onTouchStart={() => {
                    if (objects.length > 0) {
                      handleExport();
                    }
                  }}
                  onClick={() => {
                    if (objects.length > 0) {
                      handleExport();
                    }
                  }}
                  disabled={objects.length === 0}
                  className="w-full px-4 py-4 text-left text-text-secondary hover:text-neon-green active:bg-surface disabled:opacity-50 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Exportera JSON
                </button>
                <button
                  onTouchStart={handleImport}
                  onClick={handleImport}
                  className="w-full px-4 py-4 text-left text-text-secondary hover:text-neon-orange active:bg-surface flex items-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Importera JSON
                </button>
                {/* Storage indicator */}
                {storageUsed !== null && (
                  <div className="px-4 py-3 border-t border-surface">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted font-display">LAGRING</span>
                      <span className={`font-mono ${storageUsed > 40 ? 'text-neon-orange' : 'text-text-secondary'}`}>
                        {storageUsed} MB
                      </span>
                    </div>
                    <div className="mt-1 h-1 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(storageUsed / 50 * 100, 100)}%`,
                          backgroundColor: storageUsed > 40 ? '#FF9F1C' : '#06FFA5',
                        }}
                      />
                    </div>
                  </div>
                )}
                <button
                  onTouchStart={() => setShowMenu(false)}
                  onClick={() => setShowMenu(false)}
                  className="w-full px-4 py-3 text-center text-text-muted border-t border-surface hover:text-text-secondary"
                >
                  Stäng
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Map */}
      <main className="flex-1 relative">
        <Map
          userPosition={userPosition}
          objects={objects}
          onObjectClick={handleObjectClick}
        />

        {/* GPS activation banner - z-index above Leaflet */}
        {!userPosition && !loading && (
          <div className="absolute top-4 left-4 right-4 z-[1001]">
            {error?.code === 1 ? (
              // GPS denied - show instructions
              <div className="bg-deep/95 border-2 border-neon-orange rounded-lg p-4 shadow-neon-orange">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🚫</div>
                  <div className="flex-1">
                    <p className="text-neon-orange font-display font-bold">GPS nekad</p>
                    <p className="text-text-secondary text-sm mt-1 leading-relaxed">
                      1. <strong className="text-text-primary">Inställningar</strong> → <strong className="text-text-primary">Sekretess</strong> → <strong className="text-text-primary">Platstjänster</strong> = PÅ<br/>
                      2. <strong className="text-text-primary">Inställningar</strong> → <strong className="text-text-primary">Safari</strong> → <strong className="text-text-primary">Plats</strong> = Tillåt
                    </p>
                    <button
                      onClick={refreshGPS}
                      className="mt-3 px-4 py-2 bg-neon-orange text-deep rounded font-display text-sm font-bold hover:shadow-neon-orange transition-all"
                    >
                      Försök igen
                    </button>
                  </div>
                </div>
              </div>
            ) : error?.code === 2 ? (
              // Position unavailable
              <div className="bg-deep/95 border-2 border-neon-yellow rounded-lg p-4 shadow-neon-yellow flex items-center gap-4">
                <div className="text-3xl">📡</div>
                <div className="flex-1">
                  <p className="text-neon-yellow font-display font-bold">Kan inte hitta position</p>
                  <p className="text-text-secondary text-sm">Testa utomhus eller vänta en stund</p>
                </div>
                <button
                  onTouchStart={refreshGPS}
                  onClick={refreshGPS}
                  className="px-4 py-2 bg-neon-yellow text-deep rounded-lg font-display text-sm font-bold hover:shadow-neon-yellow transition-all"
                >
                  Försök igen
                </button>
              </div>
            ) : error?.code === 3 ? (
              // Timeout
              <div className="bg-deep/95 border-2 border-neon-orange rounded-lg p-4 shadow-neon-orange flex items-center gap-4">
                <div className="text-3xl">⏱️</div>
                <div className="flex-1">
                  <p className="text-neon-orange font-display font-bold">GPS timeout</p>
                  <p className="text-text-secondary text-sm">Tog för lång tid - försök igen</p>
                </div>
                <button
                  onTouchStart={refreshGPS}
                  onClick={refreshGPS}
                  className="px-4 py-2 bg-neon-orange text-deep rounded-lg font-display text-sm font-bold hover:shadow-neon-orange transition-all"
                >
                  Försök igen
                </button>
              </div>
            ) : (
              // GPS not yet requested
              <div className="bg-deep/95 border-2 border-neon-blue rounded-lg p-4 shadow-neon-blue flex items-center gap-4">
                <div className="text-3xl">📍</div>
                <div className="flex-1">
                  <p className="text-neon-blue font-display font-bold">GPS behövs</p>
                  <p className="text-text-secondary text-sm">Tryck för att aktivera platsåtkomst</p>
                </div>
                <button
                  onTouchStart={refreshGPS}
                  onClick={refreshGPS}
                  className="px-4 py-2 bg-neon-pink text-white rounded-lg font-display text-sm font-bold hover:shadow-neon-pink transition-all"
                >
                  Aktivera
                </button>
              </div>
            )}
          </div>
        )}

        {/* Action buttons - z-index must be higher than Leaflet controls (1000) */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-3 safe-bottom z-[1001]">
          {/* Play/Experience button */}
          {objects.filter((o) => o.active).length > 0 && (
            <button
              onClick={() => setView('experience')}
              className="w-14 h-14 bg-neon-green hover:shadow-neon-green rounded-full shadow-lg flex items-center justify-center transition-all"
              title="Starta upplevelse"
            >
              <svg className="w-6 h-6 text-deep" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}

          {/* Locate me button */}
          {userPosition && (
            <button
              onClick={() => {
                const flyToUser = (window as unknown as { flyToUser?: () => void }).flyToUser;
                flyToUser?.();
              }}
              className="w-12 h-12 bg-neon-blue active:shadow-neon-blue rounded-full shadow-lg flex items-center justify-center transition-all"
              title="Här är jag"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          {/* Add button */}
          <button
            onTouchStart={() => userPosition && handleCreateObject()}
            onClick={() => userPosition && handleCreateObject()}
            className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all ${
              userPosition
                ? 'bg-neon-pink hover:shadow-neon-pink'
                : 'bg-surface opacity-50'
            }`}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Object count */}
        {objects.length > 0 && (
          <button
            onClick={() => setView('list')}
            className="absolute top-4 left-4 bg-elevated/90 backdrop-blur-sm border border-surface rounded-lg px-3 py-2 text-sm font-display text-neon-purple hover:border-neon-purple hover:shadow-neon-purple transition-all z-[1001]"
          >
            {objects.length} objekt
          </button>
        )}
      </main>

      {/* Selected object preview */}
      {selectedObject && view === 'map' && (
        <div className="absolute bottom-0 left-0 right-0 bg-elevated/95 backdrop-blur-sm border-t border-surface p-4 safe-bottom z-[1001]">
          <div className="flex items-start justify-between">
            <button
              onClick={() => handleEditObject(selectedObject)}
              className="flex-1 text-left"
            >
              <h2 className="font-display font-bold text-text-primary">{selectedObject.title}</h2>
              {selectedObject.text && (
                <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                  {selectedObject.text}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className={`trigger-badge trigger-${selectedObject.trigger.type}`}>
                  {selectedObject.trigger.type}
                </span>
                <span className="text-text-muted">{selectedObject.radius}m radie</span>
                {selectedObject.audioBlob && <span>🔊</span>}
                {selectedObject.imageBlob && <span>🖼️</span>}
              </div>
            </button>
            <button
              onClick={() => setSelectedObject(null)}
              className="p-2 text-text-muted hover:text-neon-pink transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Object Editor Wizard */}
      {(view === 'create' || view === 'edit') && userPosition && (
        <ObjectEditorWizard
          object={editingObject}
          userLocation={userPosition}
          onSave={handleSave}
          onClose={() => {
            setView('map');
            setEditingObject(null);
          }}
          onDelete={() => {
            loadObjects();
            setSelectedObject(null);
          }}
        />
      )}

      {/* Object List */}
      {view === 'list' && (
        <ObjectList
          objects={objects}
          onSelect={(obj) => {
            setView('map');
            setSelectedObject(obj);
          }}
          onEdit={(obj) => {
            setEditingObject(obj);
            setView('edit');
          }}
          onDelete={loadObjects}
          onClose={() => setView('map')}
        />
      )}

      {/* Experience Mode */}
      {view === 'experience' && (
        <ExperienceMode
          objects={isSharedExperience && sharedObjects ? sharedObjects : objects}
          initialPosition={userPosition}
          onClose={() => {
            setView('map');
            if (isSharedExperience) {
              setIsSharedExperience(false);
              setSharedObjects(null);
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
