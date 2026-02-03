import { useState, useCallback, useMemo } from 'react';
import { deleteObject, saveObject } from '../services/db';
import { TRIGGER_COLORS } from './TriggerTypeSelector';
import type { MediaObject, ChainCondition } from '../types';

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
  neonYellow: '#FFE66D',
  neonOrange: '#FF9F1C',
};

interface Props {
  objects: MediaObject[];
  onSelect: (object: MediaObject) => void;
  onEdit: (object: MediaObject) => void;
  onDelete: () => void;
  onClose: () => void;
}

type ViewMode = 'list' | 'chain';

export function ObjectList({ objects, onSelect, onEdit, onDelete, onClose }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('chain');
  const [showNumbers, setShowNumbers] = useState<boolean>(() => {
    return localStorage.getItem('kontextlager_show_numbers') === 'true';
  });

  // Sort objects by dependencies (topological sort)
  // Objects without dependencies first, then objects that depend on them
  const sortedObjects = useMemo(() => {
    const result: MediaObject[] = [];
    const remaining = [...objects];
    const added = new Set<string>();

    // First pass: add all objects without dependencies
    for (let i = remaining.length - 1; i >= 0; i--) {
      const obj = remaining[i];
      if (!obj.armCondition?.triggerId) {
        result.push(obj);
        added.add(obj.id);
        remaining.splice(i, 1);
      }
    }

    // Keep adding objects whose dependencies are satisfied
    let iterations = 0;
    while (remaining.length > 0 && iterations < 100) {
      iterations++;
      let addedThisRound = false;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const obj = remaining[i];
        const dependsOnId = obj.armCondition?.triggerId;

        if (dependsOnId && added.has(dependsOnId)) {
          // Find where the dependency is and insert after it
          const depIndex = result.findIndex(r => r.id === dependsOnId);
          // Find the last item that also depends on the same thing
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

      // If no progress, add remaining items at the end (circular deps or missing refs)
      if (!addedThisRound) {
        result.push(...remaining);
        break;
      }
    }

    return result;
  }, [objects]);

  const handleDelete = async (obj: MediaObject) => {
    if (window.confirm(`Vill du radera "${obj.title}"?`)) {
      setDeletingId(obj.id);
      try {
        await deleteObject(obj.id);
        onDelete();
      } catch (error) {
        console.error('Failed to delete:', error);
      } finally {
        setDeletingId(null);
        setExpandedId(null);
      }
    }
  };

  const handleToggleNumbers = () => {
    const newValue = !showNumbers;
    setShowNumbers(newValue);
    localStorage.setItem('kontextlager_show_numbers', String(newValue));
    // Dispatch event so Map can listen
    window.dispatchEvent(new CustomEvent('showNumbersChanged', { detail: newValue }));
  };

  // Move object up/down in chain order
  const handleMoveObject = useCallback(async (obj: MediaObject, direction: 'up' | 'down') => {
    const currentIndex = sortedObjects.findIndex(o => o.id === obj.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= sortedObjects.length) return;

    const currentOrder = obj.chainOrder ?? currentIndex;
    const targetObj = sortedObjects[targetIndex];
    const targetOrder = targetObj.chainOrder ?? targetIndex;

    // Swap chain orders
    await saveObject({ ...obj, chainOrder: targetOrder });
    await saveObject({ ...targetObj, chainOrder: currentOrder });

    onDelete(); // Reload objects
  }, [sortedObjects, onDelete]);

  // Update chain condition
  const handleUpdateCondition = useCallback(async (obj: MediaObject, triggerId: string | null) => {
    const armCondition: ChainCondition | undefined = triggerId
      ? { type: 'afterTrigger', triggerId }
      : undefined;

    await saveObject({ ...obj, armCondition });
    onDelete(); // Reload objects
  }, [onDelete]);

  // Get the object that this one depends on
  const getDependsOn = (obj: MediaObject): MediaObject | undefined => {
    if (!obj.armCondition?.triggerId) return undefined;
    return objects.find(o => o.id === obj.armCondition?.triggerId);
  };

  return (
    <div className="fixed inset-0 z-[2000] overflow-y-auto bg-grid" style={{ backgroundColor: COLORS.deep }}>
      <div className="min-h-full p-4 safe-top safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold" style={{ color: COLORS.neonPink }}>
            OBJEKT ({objects.length})
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-white/10"
            style={{ color: COLORS.textMuted }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* View mode toggle & options */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: COLORS.surface }}>
            <button
              onClick={() => setViewMode('chain')}
              className="px-3 py-2 text-xs font-display font-bold transition-colors"
              style={{
                backgroundColor: viewMode === 'chain' ? COLORS.neonPurple : COLORS.elevated,
                color: viewMode === 'chain' ? '#fff' : COLORS.textMuted,
              }}
            >
              🔗 KEDJA
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="px-3 py-2 text-xs font-display font-bold transition-colors"
              style={{
                backgroundColor: viewMode === 'list' ? COLORS.neonBlue : COLORS.elevated,
                color: viewMode === 'list' ? '#fff' : COLORS.textMuted,
              }}
            >
              📋 LISTA
            </button>
          </div>

          <div className="flex-1" />

          {/* Numbered markers toggle */}
          <button
            onClick={handleToggleNumbers}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-display font-bold transition-all"
            style={{
              backgroundColor: showNumbers ? COLORS.neonYellow + '20' : COLORS.elevated,
              color: showNumbers ? COLORS.neonYellow : COLORS.textMuted,
              border: `1px solid ${showNumbers ? COLORS.neonYellow : COLORS.surface}`,
            }}
          >
            {showNumbers ? '①②③' : '👁️'}
            <span className="hidden sm:inline">{showNumbers ? 'NUMMER' : 'IKONER'}</span>
          </button>
        </div>

        {objects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📍</div>
            <p style={{ color: COLORS.textSecondary }}>Inga objekt ännu</p>
            <p className="text-sm mt-2" style={{ color: COLORS.textMuted }}>
              Tryck på + för att skapa ditt första objekt
            </p>
          </div>
        ) : viewMode === 'chain' ? (
          // CHAIN VIEW - shows dependencies and order
          <div className="space-y-2">
            {sortedObjects.map((obj, index) => {
              const triggerColor = TRIGGER_COLORS[obj.trigger.type] || COLORS.neonPurple;
              const dependsOn = getDependsOn(obj);
              const isExpanded = expandedId === obj.id;

              return (
                <div key={obj.id}>
                  {/* Chain line connector */}
                  {index > 0 && (
                    <div className="flex items-center justify-center py-1">
                      <div className="w-0.5 h-4" style={{ backgroundColor: dependsOn ? COLORS.neonPurple : COLORS.surface }} />
                    </div>
                  )}

                  <div
                    className="rounded-lg overflow-hidden border-2 transition-all"
                    style={{
                      backgroundColor: COLORS.elevated,
                      borderColor: isExpanded ? triggerColor : COLORS.surface,
                      boxShadow: isExpanded ? `0 0 15px ${triggerColor}30` : 'none',
                    }}
                  >
                    {/* Main row */}
                    <div className="flex items-center gap-2 p-3">
                      {/* Order number / Move buttons */}
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => handleMoveObject(obj, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded transition-colors disabled:opacity-20"
                          style={{ color: COLORS.textMuted }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-display font-bold"
                          style={{ backgroundColor: triggerColor + '30', color: triggerColor }}
                        >
                          {index + 1}
                        </span>
                        <button
                          onClick={() => handleMoveObject(obj, 'down')}
                          disabled={index === sortedObjects.length - 1}
                          className="p-1 rounded transition-colors disabled:opacity-20"
                          style={{ color: COLORS.textMuted }}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Content - clickable */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : obj.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getTriggerIcon(obj.trigger.type)}</span>
                          <span className="font-display font-bold truncate" style={{ color: COLORS.textPrimary }}>
                            {obj.title}
                          </span>
                          {!obj.active && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded" style={{ backgroundColor: COLORS.surface, color: COLORS.textMuted }}>
                              INAKTIV
                            </span>
                          )}
                        </div>

                        {/* Dependency info */}
                        {dependsOn && (
                          <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: COLORS.neonPurple }}>
                            <span>↳</span>
                            <span>efter "{dependsOn.title}"</span>
                          </div>
                        )}
                      </button>

                      {/* Quick actions */}
                      <button
                        onClick={() => onEdit(obj)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: COLORS.textMuted }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded: Chain condition editor */}
                    {isExpanded && (
                      <div className="border-t p-3 space-y-3" style={{ borderColor: COLORS.surface, backgroundColor: COLORS.primary }}>
                        {/* Chain condition */}
                        <div>
                          <label className="block text-xs font-display font-bold mb-2" style={{ color: COLORS.neonPurple }}>
                            SYNLIG EFTER
                          </label>
                          <select
                            value={obj.armCondition?.triggerId || ''}
                            onChange={(e) => handleUpdateCondition(obj, e.target.value || null)}
                            className="w-full px-3 py-2 rounded-lg text-sm border"
                            style={{
                              backgroundColor: COLORS.deep,
                              color: COLORS.textPrimary,
                              borderColor: obj.armCondition?.triggerId ? COLORS.neonPurple : COLORS.surface,
                            }}
                          >
                            <option value="">Alltid synlig (start)</option>
                            {objects
                              .filter(o => o.id !== obj.id)
                              .map(o => (
                                <option key={o.id} value={o.id}>
                                  Efter: {o.title}
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => onSelect(obj)}
                            className="flex-1 py-2 px-3 rounded-lg text-xs font-display font-bold flex items-center justify-center gap-1 transition-all"
                            style={{ backgroundColor: COLORS.neonBlue + '20', color: COLORS.neonBlue, border: `1px solid ${COLORS.neonBlue}50` }}
                          >
                            📍 KARTA
                          </button>
                          <button
                            onClick={() => onEdit(obj)}
                            className="flex-1 py-2 px-3 rounded-lg text-xs font-display font-bold flex items-center justify-center gap-1"
                            style={{ backgroundColor: COLORS.neonPurple, color: '#fff' }}
                          >
                            ✏️ REDIGERA
                          </button>
                          <button
                            onClick={() => handleDelete(obj)}
                            disabled={deletingId === obj.id}
                            className="py-2 px-3 rounded-lg text-xs font-display font-bold flex items-center justify-center transition-all disabled:opacity-50"
                            style={{ backgroundColor: COLORS.neonPink + '20', color: COLORS.neonPink, border: `1px solid ${COLORS.neonPink}50` }}
                          >
                            {deletingId === obj.id ? '...' : '🗑️'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // LIST VIEW - simple list
          <div className="space-y-3">
            {objects.map((obj) => {
              const triggerColor = TRIGGER_COLORS[obj.trigger.type] || COLORS.neonPurple;
              return (
              <div
                key={obj.id}
                className="rounded-lg overflow-hidden border-2 transition-all"
                style={{
                  backgroundColor: COLORS.elevated,
                  borderColor: expandedId === obj.id ? triggerColor : COLORS.surface,
                  boxShadow: expandedId === obj.id ? `0 0 15px ${triggerColor}30` : 'none',
                }}
              >
                {/* Main row - clickable to expand/collapse */}
                <button
                  onClick={() => setExpandedId(expandedId === obj.id ? null : obj.id)}
                  className="w-full p-4 text-left transition-colors hover:bg-white/5"
                >
                  <div className="flex items-start gap-3">
                    {/* Preview image or icon */}
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border-2"
                      style={{
                        backgroundColor: COLORS.surface,
                        borderColor: triggerColor + '50',
                      }}
                    >
                      {obj.imageBlob ? (
                        <img
                          src={URL.createObjectURL(obj.imageBlob)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">
                          {getTriggerIcon(obj.trigger.type)}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold truncate" style={{ color: COLORS.textPrimary }}>
                          {obj.title}
                        </h3>
                        {!obj.active && (
                          <span
                            className="px-1.5 py-0.5 text-xs rounded font-display"
                            style={{ backgroundColor: COLORS.surface, color: COLORS.textMuted }}
                          >
                            INAKTIV
                          </span>
                        )}
                      </div>

                      {obj.text && (
                        <p className="text-sm truncate mt-1" style={{ color: COLORS.textSecondary }}>
                          {obj.text}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span
                          className="flex items-center gap-1 font-display font-bold"
                          style={{ color: triggerColor }}
                        >
                          <span>{getTriggerIcon(obj.trigger.type)}</span>
                          {getTriggerLabel(obj.trigger.type)}
                        </span>
                        <span style={{ color: COLORS.textMuted }}>{obj.radius}m</span>
                        {obj.audioBlob && <span>🔊</span>}
                      </div>
                    </div>

                    {/* Expand/collapse indicator */}
                    <svg
                      className={`w-5 h-5 flex-shrink-0 transition-transform ${
                        expandedId === obj.id ? 'rotate-90' : ''
                      }`}
                      style={{ color: COLORS.textMuted }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded actions */}
                {expandedId === obj.id && (
                  <div
                    className="border-t p-3 flex gap-2"
                    style={{ borderColor: COLORS.surface, backgroundColor: COLORS.primary }}
                  >
                    <button
                      onClick={() => onSelect(obj)}
                      className="flex-1 py-2.5 px-4 rounded-lg text-sm font-display font-bold flex items-center justify-center gap-2 transition-all hover:shadow-neon-blue"
                      style={{ backgroundColor: COLORS.neonBlue + '20', color: COLORS.neonBlue, border: `1px solid ${COLORS.neonBlue}50` }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      KARTA
                    </button>
                    <button
                      onClick={() => {
                        onEdit(obj);
                      }}
                      className="flex-1 py-2.5 px-4 rounded-lg text-sm font-display font-bold flex items-center justify-center gap-2 transition-all hover:shadow-neon-purple"
                      style={{ backgroundColor: COLORS.neonPurple, color: '#fff' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      REDIGERA
                    </button>
                    <button
                      onClick={() => handleDelete(obj)}
                      disabled={deletingId === obj.id}
                      className="py-2.5 px-4 rounded-lg text-sm font-display font-bold flex items-center justify-center gap-2 transition-all hover:shadow-neon-pink disabled:opacity-50"
                      style={{ backgroundColor: COLORS.neonPink + '20', color: COLORS.neonPink, border: `1px solid ${COLORS.neonPink}50` }}
                    >
                      {deletingId === obj.id ? (
                        <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: COLORS.neonPink }} />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </div>
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
    code: '🔢',
    spinner: '🎰',
    ai: '🕸️',
  };
  return icons[type] || '📍';
}

function getTriggerLabel(type: string): string {
  const labels: Record<string, string> = {
    gps: 'GPS',
    qr: 'QR',
    shake: 'Skaka',
    tilt: 'Luta',
    compass: 'Kompass',
    touch: 'Tryck',
    hold: 'Håll',
    timer: 'Timer',
    proximity: 'Närvaro',
    dice: 'Tärning',
    code: 'Kod',
    spinner: 'Spinner',
    ai: 'AI',
  };
  return labels[type] || type;
}
