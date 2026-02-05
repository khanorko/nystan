import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { TriggerTypeSelector } from './TriggerTypeSelector';
import { LocationPicker } from './LocationPicker';
import { QRCodeDisplay } from './QRCodeDisplay';
import { useCamera } from '../hooks/useCamera';
import { useAudio } from '../hooks/useAudio';
import { saveObject, deleteObject, getAllObjects } from '../services/db';
import type { MediaObject, Trigger, Location, DiceFace, SpinnerOption, ChainCondition } from '../types';

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

type Step = 'trigger' | 'location' | 'content' | 'qr-result';

interface Props {
  object?: MediaObject | null;
  userLocation: Location;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
}

export function ObjectEditorWizard({ object, userLocation, onSave, onClose, onDelete }: Props) {
  // Wizard state
  const [step, setStep] = useState<Step>(object ? 'content' : 'trigger');
  const [requiresLocation, setRequiresLocation] = useState(true);

  // Object state
  const [triggerType, setTriggerType] = useState<Trigger['type']>(object?.trigger.type || 'gps');
  const [title, setTitle] = useState(object?.title || '');
  const [text, setText] = useState(object?.text || '');
  const [radius, setRadius] = useState(object?.radius || 15);
  const [active, setActive] = useState(object?.active ?? true);
  const [objectLocation, setObjectLocation] = useState<Location>(
    object?.location || userLocation
  );
  const [savedObjectId, setSavedObjectId] = useState<string | null>(null);

  // Trigger-specific params
  const [triggerParams, setTriggerParams] = useState<Record<string, unknown>>(
    object?.trigger.params || {}
  );

  // Dice content (6 faces)
  const [diceContent, setDiceContent] = useState<DiceFace[]>(
    object?.diceContent || Array(6).fill(null).map(() => ({ title: '' }))
  );

  // Spinner content (variable number of options)
  const [spinnerContent, setSpinnerContent] = useState<SpinnerOption[]>(
    object?.spinnerContent || [
      { id: '1', label: 'Val 1' },
      { id: '2', label: 'Val 2' },
      { id: '3', label: 'Val 3' },
    ]
  );

  // Chain condition (för kedjor)
  const [armCondition, setArmCondition] = useState<ChainCondition | undefined>(
    object?.armCondition
  );
  const [allObjects, setAllObjects] = useState<MediaObject[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  // Ladda alla objekt för villkorsväljaren
  useEffect(() => {
    getAllObjects().then(setAllObjects);
  }, []);

  // Media hooks
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

  // Handle trigger type selection
  const handleTriggerSelect = (type: Trigger['type'], needsLocation: boolean) => {
    setTriggerType(type);
    setRequiresLocation(needsLocation);

    // Set default params based on trigger type
    switch (type) {
      case 'gps':
        setTriggerParams({ radius: 15 });
        break;
      case 'qr':
        setTriggerParams({ code: uuidv4() });
        break;
      case 'shake':
        setTriggerParams({ threshold: 'medium' });
        break;
      case 'tilt':
        setTriggerParams({ direction: 'forward', angle: 45 });
        break;
      case 'compass':
        setTriggerParams({ heading: 0, tolerance: 30 });
        break;
      case 'touch':
        setTriggerParams({ icon: '👆' });
        break;
      case 'hold':
        setTriggerParams({ duration: 2000, icon: '✋' });
        break;
      case 'timer':
        setTriggerParams({ delay: 30 });
        break;
      case 'proximity':
        setTriggerParams({ minDevices: 2 });
        break;
      case 'dice':
        setTriggerParams({});
        break;
      case 'spinner':
        setTriggerParams({});
        break;
      case 'ai':
        setTriggerParams({ mode: 'placeInfo' });
        break;
    }
  };

  // Save object
  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const id = object?.id || uuidv4();
      const mediaObject: MediaObject = {
        id,
        title: title.trim(),
        text: text.trim() || undefined,
        imageBlob: imageBlob || object?.imageBlob || undefined,
        audioBlob: audioBlob || object?.audioBlob || undefined,
        location: requiresLocation ? objectLocation : userLocation, // Fallback location
        radius,
        trigger: {
          type: triggerType,
          params: triggerType === 'gps' ? { radius, ...triggerParams } : triggerParams,
        } as Trigger,
        active,
        requiresPresence: triggerType === 'proximity'
          ? (triggerParams.minDevices as number)
          : undefined,
        diceContent: triggerType === 'dice' ? diceContent : undefined,
        spinnerContent: triggerType === 'spinner' ? spinnerContent : undefined,
        armCondition: armCondition,
        createdAt: object?.createdAt || Date.now(),
      };

      await saveObject(mediaObject);

      // Show QR code if QR trigger
      if (triggerType === 'qr' && !object) {
        setSavedObjectId(id);
        setStep('qr-result');
      } else {
        onSave();
      }
    } catch (error) {
      console.error('Failed to save object:', error);
      alert('Kunde inte spara objektet: ' + (error instanceof Error ? error.message : 'Okänt fel'));
    } finally {
      setIsSaving(false);
    }
  };

  // Delete object
  const handleDelete = async () => {
    if (!object?.id) return;
    if (window.confirm('Vill du radera detta objekt?')) {
      try {
        await deleteObject(object.id);
        onDelete?.();
        onClose();
      } catch (error) {
        console.error('Failed to delete:', error);
      }
    }
  };

  // Navigation
  const goNext = () => {
    if (step === 'trigger') {
      if (requiresLocation) {
        setStep('location');
      } else {
        setStep('content');
      }
    } else if (step === 'location') {
      setStep('content');
    }
  };

  const goBack = () => {
    if (step === 'content') {
      if (requiresLocation) {
        setStep('location');
      } else {
        setStep('trigger');
      }
    } else if (step === 'location') {
      setStep('trigger');
    }
  };

  // Render QR result screen
  if (step === 'qr-result' && savedObjectId) {
    return (
      <QRCodeDisplay
        objectId={savedObjectId}
        title={title}
        onClose={onSave}
        onCreateAnother={() => {
          setTitle('');
          setText('');
          setTriggerType('qr');
          setTriggerParams({ code: uuidv4() });
          setSavedObjectId(null);
          setStep('content');
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex flex-col bg-grid"
      style={{ backgroundColor: COLORS.deep }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4 safe-top flex items-center justify-between border-b"
        style={{ backgroundColor: COLORS.primary, borderColor: COLORS.surface }}
      >
        <div className="flex items-center gap-3">
          {step !== 'trigger' && !object && (
            <button
              onClick={goBack}
              className="p-2 -ml-2 rounded-lg transition-colors hover:text-[#FF006E]"
              style={{ color: COLORS.textMuted }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2 className="text-lg font-display font-bold" style={{ color: COLORS.neonPink }}>
            {object ? 'Redigera objekt' : step === 'trigger' ? 'Välj trigger' : step === 'location' ? 'Placera objekt' : 'Innehåll'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg transition-colors hover:text-[#FF006E]"
          style={{ color: COLORS.textMuted }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress indicator */}
      {!object && (
        <div className="px-4 py-3" style={{ backgroundColor: COLORS.primary }}>
          <div className="flex gap-2">
            {['trigger', 'location', 'content'].map((s, i) => {
              const stepIndex = ['trigger', 'location', 'content'].indexOf(step);
              const thisIndex = i;
              const isActive = s === step;
              const isPast = thisIndex < stepIndex;
              const isSkipped = s === 'location' && !requiresLocation;

              if (isSkipped) return null;

              return (
                <div
                  key={s}
                  className="flex-1 h-1 rounded-full transition-colors"
                  style={{
                    backgroundColor: isActive
                      ? COLORS.neonPink
                      : isPast
                      ? COLORS.neonGreen
                      : COLORS.surface,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 safe-bottom">
        {/* Step 1: Trigger Selection */}
        {step === 'trigger' && (
          <TriggerTypeSelector
            selectedType={triggerType}
            onSelect={handleTriggerSelect}
          />
        )}

        {/* Step 2: Location Picker */}
        {step === 'location' && (
          <LocationPicker
            location={objectLocation}
            radius={radius}
            onLocationChange={setObjectLocation}
            onRadiusChange={setRadius}
            userPosition={userLocation}
          />
        )}

        {/* Step 3: Content Editor */}
        {step === 'content' && (
          <div className="space-y-6">
            {/* Trigger-specific config */}
            <TriggerConfig
              type={triggerType}
              params={triggerParams}
              onChange={setTriggerParams}
              diceContent={diceContent}
              onDiceChange={setDiceContent}
              spinnerContent={spinnerContent}
              onSpinnerChange={setSpinnerContent}
            />

            {/* Chain condition selector */}
            {allObjects.filter(o => o.id !== object?.id).length > 0 && (
              <div>
                <label className="block text-sm font-display font-bold mb-2" style={{ color: COLORS.neonPurple }}>
                  SYNLIG EFTER
                </label>
                <select
                  value={armCondition?.triggerId || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setArmCondition({ type: 'afterTrigger', triggerId: e.target.value });
                    } else {
                      setArmCondition(undefined);
                    }
                  }}
                  className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-all appearance-none"
                  style={{
                    backgroundColor: COLORS.deep,
                    color: COLORS.textPrimary,
                    borderColor: armCondition ? COLORS.neonPurple : COLORS.surface,
                  }}
                >
                  <option value="">Alltid synlig (ingen kedja)</option>
                  {allObjects
                    .filter(o => o.id !== object?.id)
                    .map(o => (
                      <option key={o.id} value={o.id}>
                        Efter: {o.title}
                      </option>
                    ))
                  }
                </select>
                {armCondition && (
                  <p className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
                    Denna trigger visas först efter att "{allObjects.find(o => o.id === armCondition.triggerId)?.title}" har aktiverats
                  </p>
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-display font-bold mb-2" style={{ color: COLORS.neonPink }}>
                TITEL *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ge objektet ett namn"
                className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-all"
                style={{
                  backgroundColor: COLORS.deep,
                  color: COLORS.textPrimary,
                  borderColor: title ? COLORS.neonGreen : COLORS.surface,
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-display font-bold mb-2" style={{ color: COLORS.neonBlue }}>
                BESKRIVNING
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Beskriv vad som händer..."
                rows={3}
                className="w-full px-4 py-3 rounded-lg border-2 focus:outline-none transition-all resize-none"
                style={{
                  backgroundColor: COLORS.deep,
                  color: COLORS.textPrimary,
                  borderColor: COLORS.surface,
                }}
              />
            </div>

            {/* Image */}
            <div>
              <label className="block text-sm font-display font-bold mb-2" style={{ color: COLORS.neonPurple }}>
                BILD
              </label>
              {imageUrl || object?.imageBlob ? (
                <div className="relative rounded-lg overflow-hidden border-2" style={{ borderColor: COLORS.neonPurple }}>
                  <img
                    src={imageUrl || (object?.imageBlob ? URL.createObjectURL(object.imageBlob) : '')}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 p-2 rounded-full"
                    style={{ backgroundColor: COLORS.neonPink }}
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
                    className="flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:border-[#8338EC]"
                    style={{ backgroundColor: COLORS.elevated, color: COLORS.textSecondary, borderColor: COLORS.surface }}
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
                    className="flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:border-[#8338EC]"
                    style={{ backgroundColor: COLORS.elevated, color: COLORS.textSecondary, borderColor: COLORS.surface }}
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
              <label className="block text-sm font-display font-bold mb-2" style={{ color: COLORS.neonOrange }}>
                LJUD
              </label>
              {audioUrl || object?.audioBlob ? (
                <div
                  className="flex items-center gap-2 p-3 rounded-lg border-2"
                  style={{ backgroundColor: COLORS.elevated, borderColor: COLORS.neonOrange }}
                >
                  <button
                    onClick={playAudio}
                    className="p-2 rounded-full"
                    style={{ backgroundColor: COLORS.neonGreen }}
                  >
                    <svg className="w-5 h-5 text-deep" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                  <div className="flex-1">
                    <div className="h-2 rounded-full" style={{ backgroundColor: COLORS.surface }}>
                      <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: COLORS.neonOrange }} />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      stopAudio();
                      clearAudio();
                    }}
                    className="p-2 transition-colors hover:text-[#FF006E]"
                    style={{ color: COLORS.textMuted }}
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
                      className="flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 animate-neon-pulse font-display font-bold"
                      style={{ backgroundColor: COLORS.neonPink, color: 'white' }}
                    >
                      <span className="w-3 h-3 bg-white rounded-full" />
                      REC {recordingDuration}s
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={startRecording}
                        className="flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 transition-all hover:border-[#FF9F1C]"
                        style={{ backgroundColor: COLORS.elevated, color: COLORS.textSecondary, borderColor: COLORS.surface }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Spela in
                      </button>
                      <button
                        onClick={selectAudioFile}
                        className="flex-1 py-3 px-4 rounded-lg border-2 flex items-center justify-center gap-2 transition-all hover:border-[#FF9F1C]"
                        style={{ backgroundColor: COLORS.elevated, color: COLORS.textSecondary, borderColor: COLORS.surface }}
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

            {/* Active toggle */}
            <div
              className="flex items-center justify-between p-4 rounded-lg border-2"
              style={{ backgroundColor: COLORS.elevated, borderColor: COLORS.surface }}
            >
              <div>
                <div className="font-display font-bold" style={{ color: COLORS.textPrimary }}>AKTIV</div>
                <div className="text-sm" style={{ color: COLORS.textMuted }}>Objektet kan triggas</div>
              </div>
              <button
                onClick={() => setActive(!active)}
                className="relative w-14 h-8 rounded-full transition-colors"
                style={{ backgroundColor: active ? COLORS.neonGreen : COLORS.surface }}
              >
                <div
                  className="absolute top-1 w-6 h-6 rounded-full shadow transition-transform"
                  style={{
                    backgroundColor: COLORS.textPrimary,
                    transform: active ? 'translateX(28px)' : 'translateX(4px)',
                  }}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 safe-bottom space-y-3 border-t" style={{ backgroundColor: COLORS.primary, borderColor: COLORS.surface }}>
        {step === 'trigger' && (
          <button
            onClick={goNext}
            disabled={!triggerType}
            className="w-full py-4 rounded-lg font-display font-bold uppercase tracking-wider transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(255,0,110,0.5)]"
            style={{ backgroundColor: COLORS.neonPink, color: 'white' }}
          >
            Nästa
          </button>
        )}

        {step === 'location' && (
          <button
            onClick={goNext}
            className="w-full py-4 rounded-lg font-display font-bold uppercase tracking-wider transition-all hover:shadow-[0_0_20px_rgba(58,134,255,0.5)]"
            style={{ backgroundColor: COLORS.neonBlue, color: 'white' }}
          >
            Bekräfta plats
          </button>
        )}

        {step === 'content' && (
          <>
            <button
              onClick={handleSave}
              disabled={!title.trim() || isSaving}
              className="w-full py-4 rounded-lg font-display font-bold uppercase tracking-wider transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(6,255,165,0.5)]"
              style={{ backgroundColor: COLORS.neonGreen, color: COLORS.deep }}
            >
              {isSaving ? 'Sparar...' : object ? 'Spara ändringar' : 'Skapa objekt!'}
            </button>

            {object && (
              <button
                onClick={handleDelete}
                className="w-full py-4 rounded-lg font-display font-bold uppercase tracking-wider border-2 transition-all hover:shadow-[0_0_20px_rgba(255,0,110,0.5)]"
                style={{
                  borderColor: COLORS.neonPink,
                  color: COLORS.neonPink,
                  backgroundColor: 'transparent',
                }}
              >
                Radera objekt
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Trigger-specific configuration component
function TriggerConfig({
  type,
  params,
  onChange,
  diceContent,
  onDiceChange,
  spinnerContent,
  onSpinnerChange,
}: {
  type: Trigger['type'];
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  diceContent?: DiceFace[];
  onDiceChange?: (content: DiceFace[]) => void;
  spinnerContent?: SpinnerOption[];
  onSpinnerChange?: (content: SpinnerOption[]) => void;
}) {
  const updateParam = (key: string, value: unknown) => {
    onChange({ ...params, [key]: value });
  };

  switch (type) {
    case 'gps':
      return (
        <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.elevated }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display font-bold text-sm" style={{ color: COLORS.textPrimary }}>
                Öppna vid markörklick
              </div>
              <div className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                Tillåt användaren att öppna igen genom att klicka på markören
              </div>
            </div>
            <button
              onClick={() => updateParam('openOnMarkerClick', !(params.openOnMarkerClick !== false))}
              className="relative w-12 h-6 rounded-full transition-colors"
              style={{ backgroundColor: params.openOnMarkerClick !== false ? COLORS.neonGreen : COLORS.surface }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform"
                style={{
                  backgroundColor: COLORS.textPrimary,
                  transform: params.openOnMarkerClick !== false ? 'translateX(26px)' : 'translateX(2px)',
                }}
              />
            </button>
          </div>
        </div>
      );

    case 'shake':
      return (
        <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.elevated }}>
          <label className="block text-sm font-medium mb-3" style={{ color: COLORS.textSecondary }}>
            Skaknings-känslighet
          </label>
          <div className="flex gap-2">
            {(['light', 'medium', 'hard'] as const).map((level) => (
              <button
                key={level}
                onClick={() => updateParam('threshold', level)}
                className={`flex-1 py-3 rounded-xl font-display font-bold transition-all`}
                style={{
                  backgroundColor: params.threshold === level ? COLORS.neonOrange : COLORS.surface,
                  color: params.threshold === level ? '#fff' : COLORS.textSecondary,
                  boxShadow: params.threshold === level ? `0 0 15px ${COLORS.neonOrange}50` : 'none',
                }}
              >
                {level === 'light' ? 'LÄTT' : level === 'medium' ? 'MEDIUM' : 'HÅRD'}
              </button>
            ))}
          </div>
        </div>
      );

    case 'tilt':
      return (
        <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: COLORS.elevated }}>
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: COLORS.textSecondary }}>
              Lutriktning
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { dir: 'forward', label: '⬆️ Framåt' },
                { dir: 'back', label: '⬇️ Bakåt' },
                { dir: 'left', label: '⬅️ Vänster' },
                { dir: 'right', label: '➡️ Höger' },
              ] as const).map(({ dir, label }) => (
                <button
                  key={dir}
                  onClick={() => updateParam('direction', dir)}
                  className="py-3 rounded-xl font-display font-bold transition-all"
                  style={{
                    backgroundColor: params.direction === dir ? COLORS.neonPurple : COLORS.surface,
                    color: params.direction === dir ? '#fff' : COLORS.textSecondary,
                    boxShadow: params.direction === dir ? `0 0 15px ${COLORS.neonPurple}50` : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
                Lutningsvinkel
              </label>
              <span className="text-sm font-bold" style={{ color: COLORS.neonBlue }}>
                {params.angle as number}°
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="60"
              value={params.angle as number}
              onChange={(e) => updateParam('angle', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      );

    case 'compass':
      return (
        <div className="p-4 rounded-xl space-y-4" style={{ backgroundColor: COLORS.elevated }}>
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
                Kompassriktning
              </label>
              <span className="text-sm font-bold" style={{ color: COLORS.neonBlue }}>
                {params.heading as number}° ({getCompassDirection(params.heading as number)})
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              value={params.heading as number}
              onChange={(e) => updateParam('heading', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
                Tolerans
              </label>
              <span className="text-sm font-bold" style={{ color: COLORS.neonBlue }}>
                ±{params.tolerance as number}°
              </span>
            </div>
            <input
              type="range"
              min="15"
              max="45"
              value={params.tolerance as number}
              onChange={(e) => updateParam('tolerance', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      );

    case 'hold':
      return (
        <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.elevated }}>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
              Håll-tid
            </label>
            <span className="text-sm font-bold" style={{ color: COLORS.neonBlue }}>
              {((params.duration as number) / 1000).toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min="500"
            max="5000"
            step="500"
            value={params.duration as number}
            onChange={(e) => updateParam('duration', parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      );

    case 'timer':
      return (
        <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.elevated }}>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
              Fördröjning
            </label>
            <span className="text-sm font-bold" style={{ color: COLORS.neonBlue }}>
              {params.delay as number}s
            </span>
          </div>
          <input
            type="range"
            min="5"
            max="300"
            step="5"
            value={params.delay as number}
            onChange={(e) => updateParam('delay', parseInt(e.target.value))}
            className="w-full"
          />
        </div>
      );

    case 'proximity':
      return (
        <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.elevated }}>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
              Antal enheter
            </label>
            <span className="text-sm font-bold" style={{ color: COLORS.neonBlue }}>
              {params.minDevices as number} enheter
            </span>
          </div>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => updateParam('minDevices', n)}
                className="flex-1 py-3 rounded-xl font-display font-bold transition-all"
                style={{
                  backgroundColor: params.minDevices === n ? COLORS.neonPurple : COLORS.surface,
                  color: params.minDevices === n ? '#fff' : COLORS.textSecondary,
                  boxShadow: params.minDevices === n ? `0 0 15px ${COLORS.neonPurple}50` : 'none',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      );

    case 'qr':
      return (
        <div className="p-4 rounded-xl" style={{ backgroundColor: COLORS.elevated }}>
          <p className="text-sm" style={{ color: COLORS.textSecondary }}>
            📷 QR-koden genereras automatiskt när du sparar objektet.
          </p>
          <p className="text-xs mt-2" style={{ color: COLORS.textMuted }}>
            Du kan sedan ladda ner och skriva ut den.
          </p>
        </div>
      );

    case 'dice':
      return (
        <div className="space-y-3">
          <div className="p-3 rounded-xl" style={{ backgroundColor: COLORS.elevated }}>
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>
              🎲 Fyll i innehåll för varje tärningssida (1-6)
            </p>
          </div>
          {diceContent && onDiceChange && (
            <div className="space-y-4">
              {diceContent.map((face, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border-2"
                  style={{ backgroundColor: COLORS.deep, borderColor: COLORS.surface }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][i]}</span>
                    <span className="font-display font-bold" style={{ color: COLORS.neonOrange }}>
                      Sida {i + 1}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={face.title}
                      onChange={(e) => {
                        const newContent = [...diceContent];
                        newContent[i] = { ...face, title: e.target.value };
                        onDiceChange(newContent);
                      }}
                      placeholder="Rubrik"
                      className="w-full px-3 py-2 rounded-lg border-2 text-sm"
                      style={{
                        backgroundColor: COLORS.elevated,
                        color: COLORS.textPrimary,
                        borderColor: face.title ? COLORS.neonGreen : COLORS.surface,
                      }}
                    />
                    <textarea
                      value={face.text || ''}
                      onChange={(e) => {
                        const newContent = [...diceContent];
                        newContent[i] = { ...face, text: e.target.value };
                        onDiceChange(newContent);
                      }}
                      placeholder="Text (valfritt)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border-2 text-sm resize-none"
                      style={{
                        backgroundColor: COLORS.elevated,
                        color: COLORS.textPrimary,
                        borderColor: COLORS.surface,
                      }}
                    />
                    <input
                      type="url"
                      value={face.url || ''}
                      onChange={(e) => {
                        const newContent = [...diceContent];
                        newContent[i] = { ...face, url: e.target.value };
                        onDiceChange(newContent);
                      }}
                      placeholder="URL (valfritt)"
                      className="w-full px-3 py-2 rounded-lg border-2 text-sm"
                      style={{
                        backgroundColor: COLORS.elevated,
                        color: COLORS.textPrimary,
                        borderColor: COLORS.surface,
                      }}
                    />
                    {face.url && (
                      <label className="flex items-center gap-2 text-sm" style={{ color: COLORS.textSecondary }}>
                        <input
                          type="checkbox"
                          checked={face.autoOpen || false}
                          onChange={(e) => {
                            const newContent = [...diceContent];
                            newContent[i] = { ...face, autoOpen: e.target.checked };
                            onDiceChange(newContent);
                          }}
                          className="w-4 h-4 rounded"
                        />
                        Öppna URL automatiskt
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'spinner':
      return (
        <div className="space-y-3">
          <div className="p-3 rounded-xl" style={{ backgroundColor: COLORS.elevated }}>
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>
              🎰 Lägg till val för snurrhjulet (2-8 val)
            </p>
          </div>
          {spinnerContent && onSpinnerChange && (
            <div className="space-y-4">
              {spinnerContent.map((option, i) => (
                <div
                  key={option.id}
                  className="p-4 rounded-xl border-2"
                  style={{ backgroundColor: COLORS.deep, borderColor: COLORS.surface }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-display font-bold" style={{ color: COLORS.neonPurple }}>
                      Val {i + 1}
                    </span>
                    {spinnerContent.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newContent = spinnerContent.filter((_, idx) => idx !== i);
                          onSpinnerChange(newContent);
                        }}
                        className="p-1 rounded transition-colors hover:bg-white/10"
                        style={{ color: COLORS.neonPink }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => {
                        const newContent = [...spinnerContent];
                        newContent[i] = { ...option, label: e.target.value };
                        onSpinnerChange(newContent);
                      }}
                      placeholder="Etikett på hjulet"
                      className="w-full px-3 py-2 rounded-lg border-2 text-sm"
                      style={{
                        backgroundColor: COLORS.elevated,
                        color: COLORS.textPrimary,
                        borderColor: option.label ? COLORS.neonGreen : COLORS.surface,
                      }}
                    />
                    <input
                      type="text"
                      value={option.content?.title || ''}
                      onChange={(e) => {
                        const newContent = [...spinnerContent];
                        newContent[i] = {
                          ...option,
                          content: { ...option.content, title: e.target.value },
                        };
                        onSpinnerChange(newContent);
                      }}
                      placeholder="Resultat-rubrik (valfritt)"
                      className="w-full px-3 py-2 rounded-lg border-2 text-sm"
                      style={{
                        backgroundColor: COLORS.elevated,
                        color: COLORS.textPrimary,
                        borderColor: COLORS.surface,
                      }}
                    />
                    <textarea
                      value={option.content?.text || ''}
                      onChange={(e) => {
                        const newContent = [...spinnerContent];
                        newContent[i] = {
                          ...option,
                          content: { ...option.content, title: option.content?.title || option.label, text: e.target.value },
                        };
                        onSpinnerChange(newContent);
                      }}
                      placeholder="Resultat-text (valfritt)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border-2 text-sm resize-none"
                      style={{
                        backgroundColor: COLORS.elevated,
                        color: COLORS.textPrimary,
                        borderColor: COLORS.surface,
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Add option button */}
              {spinnerContent.length < 8 && (
                <button
                  type="button"
                  onClick={() => {
                    const newId = String(spinnerContent.length + 1);
                    onSpinnerChange([...spinnerContent, { id: newId, label: `Val ${spinnerContent.length + 1}` }]);
                  }}
                  className="w-full py-3 rounded-lg border-2 border-dashed font-display font-bold transition-all hover:bg-white/5"
                  style={{ borderColor: COLORS.neonPurple, color: COLORS.neonPurple }}
                >
                  + Lägg till val
                </button>
              )}
            </div>
          )}
        </div>
      );

    case 'ai': {
      // AI Personalities
      const AI_PERSONALITIES = [
        {
          id: 'guide',
          name: '🗺️ Lokal guide',
          tone: 'vänlig och informativ',
          prompt: 'Du är en lokal guide som berättar intressanta fakta om platser. Inkludera gärna historiska och kulturella detaljer. Håll svaren korta (2-3 meningar). Svara på svenska.',
          isDefault: true,
        },
        {
          id: 'mystery',
          name: '🔮 Mystisk berättare',
          tone: 'mystisk och spännande',
          prompt: 'Du är en mystisk berättare som väver in hemligheter och legender om platser. Använd ett suggestivt och atmosfäriskt språk. Antyda saker snarare än att avslöja allt. Svara på svenska.',
        },
        {
          id: 'historian',
          name: '📜 Historiker',
          tone: 'akademisk men tillgänglig',
          prompt: 'Du är en historiker som berättar om platsens historia med fokus på viktiga händelser och personer. Var faktabaserad men gör det intressant. Svara på svenska.',
        },
        {
          id: 'storyteller',
          name: '📖 Sagoberättare',
          tone: 'lekfull och fantasifull',
          prompt: 'Du är en sagoberättare som förvandlar vardagliga platser till magiska världar. Berätta korta, fantasifulla historier som kunde utspela sig här. Svara på svenska.',
        },
        {
          id: 'nature',
          name: '🌿 Naturguide',
          tone: 'lugn och naturkunnig',
          prompt: 'Du är en naturguide som berättar om växter, djur och ekosystem. Fokusera på vad man kan se och uppleva i naturen på platsen. Svara på svenska.',
        },
        {
          id: 'custom',
          name: '✏️ Skräddarsydd',
          tone: '',
          prompt: 'Du är [ROLL]. Din uppgift är att [UPPGIFT]. Tonen ska vara [TON]. Svara på svenska.',
          isCustom: true,
        },
      ];

      const selectedPersonality = AI_PERSONALITIES.find(p => p.id === params.personality)
        || AI_PERSONALITIES.find(p => p.isDefault)!;

      return (
        <div className="space-y-4">
          <div className="p-3 rounded-xl" style={{ backgroundColor: COLORS.elevated }}>
            <p className="text-sm" style={{ color: COLORS.textSecondary }}>
              🕸️ Välj AI-personlighet
            </p>
          </div>

          {/* AI Mode selector */}
          <div>
            <label className="block text-sm font-display font-bold mb-2" style={{ color: COLORS.neonGreen }}>
              LÄGE
            </label>
            <div className="flex gap-2">
              {[
                { value: 'placeInfo', label: '🌍 Platsinfo', desc: 'AI berättar om platsen' },
                { value: 'chat', label: '💬 Chat', desc: 'Användaren chattar med AI' },
              ].map((mode) => (
                <button
                  type="button"
                  key={mode.value}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    updateParam('mode', mode.value);
                  }}
                  onClick={() => updateParam('mode', mode.value)}
                  className="flex-1 p-3 rounded-lg border-2 text-left transition-all"
                  style={{
                    backgroundColor: params.mode === mode.value ? COLORS.neonGreen + '20' : COLORS.deep,
                    borderColor: params.mode === mode.value ? COLORS.neonGreen : COLORS.surface,
                    color: params.mode === mode.value ? COLORS.neonGreen : COLORS.textSecondary,
                  }}
                >
                  <div className="font-display font-bold text-sm">{mode.label}</div>
                  <div className="text-xs mt-1 opacity-70">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Personality selector */}
          <div>
            <label className="block text-sm font-display font-bold mb-2" style={{ color: COLORS.neonPurple }}>
              PERSONLIGHET
            </label>
            <div className="grid grid-cols-2 gap-2 relative z-10">
              {AI_PERSONALITIES.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    if (p.isCustom) {
                      onChange({ ...params, personality: p.id });
                    } else {
                      onChange({ ...params, personality: p.id, systemPrompt: p.prompt, tone: p.tone });
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (p.isCustom) {
                      onChange({ ...params, personality: p.id });
                    } else {
                      onChange({ ...params, personality: p.id, systemPrompt: p.prompt, tone: p.tone });
                    }
                  }}
                  className="p-3 rounded-lg border-2 text-left transition-all cursor-pointer"
                  style={{
                    backgroundColor: selectedPersonality.id === p.id ? COLORS.neonPurple + '20' : COLORS.deep,
                    borderColor: selectedPersonality.id === p.id ? COLORS.neonPurple : COLORS.surface,
                    color: selectedPersonality.id === p.id ? COLORS.neonPurple : COLORS.textSecondary,
                  }}
                >
                  <div className="font-display font-bold text-sm">{p.name}</div>
                  {p.tone && <div className="text-xs mt-1 opacity-70">{p.tone}</div>}
                  {p.isDefault && <div className="text-[10px] mt-1 opacity-50">(Standard)</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Custom personality editor */}
          {selectedPersonality.isCustom && (
            <div className="p-4 rounded-xl border-2" style={{ backgroundColor: COLORS.deep, borderColor: COLORS.neonPurple }}>
              <label className="block text-sm font-display font-bold mb-3" style={{ color: COLORS.neonPurple }}>
                SKRÄDDARSYDD PROMPT
              </label>
              <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>
                Fyll i [ROLL], [UPPGIFT] och [TON] i prompten nedan:
              </p>
              <textarea
                value={(params.systemPrompt as string) || selectedPersonality.prompt}
                onChange={(e) => updateParam('systemPrompt', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border-2 text-sm resize-none"
                style={{
                  backgroundColor: COLORS.elevated,
                  color: COLORS.textPrimary,
                  borderColor: COLORS.surface,
                }}
              />
            </div>
          )}

          {/* Show current prompt (read-only) for non-custom */}
          {!selectedPersonality.isCustom && (
            <div className="p-3 rounded-xl" style={{ backgroundColor: COLORS.deep }}>
              <div className="text-xs font-display mb-1" style={{ color: COLORS.textMuted }}>AKTIV PROMPT:</div>
              <p className="text-xs" style={{ color: COLORS.textSecondary }}>{selectedPersonality.prompt}</p>
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}

function getCompassDirection(degrees: number): string {
  const directions = ['N', 'NÖ', 'Ö', 'SÖ', 'S', 'SV', 'V', 'NV'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}
