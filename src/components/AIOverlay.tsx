import { useState, useEffect, useRef } from 'react';
import { getPlaceInfo, chatWithAI, isAIAvailable } from '../services/ai';
import { TRIGGER_COLORS } from './TriggerTypeSelector';

const COLORS = {
  deep: '#0a0a0f',
  elevated: '#1a1a24',
  surface: '#24243a',
  textPrimary: '#FAFAFA',
  textSecondary: '#A0A0B0',
  textMuted: '#606070',
  neonGreen: '#06FFA5',
  neonPink: '#FF006E',
  neonBlue: '#3A86FF',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AITriggerParams {
  mode: 'placeInfo' | 'chat' | 'randomComment';
  systemPrompt?: string;
  role?: string;
  intention?: string;
  context?: string;
  tone?: string;
}

interface Props {
  params: AITriggerParams;
  userLocation?: { lat: number; lng: number } | null;
  onClose: () => void;
}

export function AIOverlay({ params, userLocation, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false); // Prevent double-loading in StrictMode

  const triggerColor = TRIGGER_COLORS.proximity || COLORS.neonBlue; // Using proximity color for AI

  // Build system prompt from RICT components
  const buildSystemPrompt = () => {
    if (params.systemPrompt) return params.systemPrompt;

    const parts: string[] = [];
    if (params.role) parts.push(`Du är ${params.role}.`);
    if (params.intention) parts.push(`Ditt mål är att ${params.intention}.`);
    if (params.context) parts.push(`Kontext: ${params.context}`);
    if (params.tone) parts.push(`Tonen ska vara ${params.tone}.`);

    return parts.length > 0
      ? parts.join(' ') + ' Svara på svenska.'
      : 'Du är en hjälpsam assistent. Svara kort och engagerande på svenska.';
  };

  // Initial load for placeInfo mode (with StrictMode protection)
  useEffect(() => {
    if (hasLoadedRef.current) return;

    if (params.mode === 'placeInfo' && userLocation) {
      hasLoadedRef.current = true;
      loadPlaceInfo();
    } else {
      setLoading(false);
    }
  }, [params.mode, userLocation]);

  const loadPlaceInfo = async () => {
    if (!userLocation) {
      setError('Ingen plats tillgänglig');
      setLoading(false);
      return;
    }

    if (!isAIAvailable()) {
      setError('AI är inte konfigurerad. Lägg till GROQ API-nyckel.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await getPlaceInfo(
      userLocation.lat,
      userLocation.lng,
      buildSystemPrompt()
    );

    if (result.error) {
      setError(result.error);
    } else {
      setResponse(result.text);
    }
    setLoading(false);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const userMessage = inputText.trim();
    setInputText('');
    setSending(true);

    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    const result = await chatWithAI(
      userMessage,
      buildSystemPrompt(),
      messages.map(m => ({ ...m, role: m.role as 'user' | 'assistant' }))
    );

    if (result.error) {
      setMessages([...newMessages, { role: 'assistant', content: `Fel: ${result.error}` }]);
    } else {
      setMessages([...newMessages, { role: 'assistant', content: result.text }]);
    }

    setSending(false);
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      className="fixed inset-0 z-[2001] flex flex-col animate-fade-in"
      style={{ backgroundColor: COLORS.deep + 'F8' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 safe-top border-b" style={{ borderColor: COLORS.surface }}>
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{
              backgroundColor: triggerColor,
              boxShadow: `0 0 10px ${triggerColor}`,
              animation: loading || sending ? 'pulse 1s infinite' : 'none',
            }}
          />
          <span className="text-sm font-display font-bold" style={{ color: triggerColor }}>
            {params.mode === 'placeInfo' ? '🌍 PLATSINFO' :
             params.mode === 'chat' ? '💬 AI CHAT' : '🤖 AI'}
          </span>
        </div>
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

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Place Info mode */}
        {params.mode === 'placeInfo' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-12 h-12 border-4 rounded-full animate-spin"
                  style={{ borderColor: COLORS.surface, borderTopColor: triggerColor }}
                />
                <p style={{ color: COLORS.textSecondary }}>Hämtar information...</p>
              </div>
            ) : error ? (
              <div className="text-center">
                <p className="text-lg mb-4" style={{ color: COLORS.neonPink }}>{error}</p>
                <button
                  onClick={loadPlaceInfo}
                  className="px-6 py-3 rounded-lg font-display font-bold"
                  style={{ backgroundColor: triggerColor, color: '#fff' }}
                >
                  Försök igen
                </button>
              </div>
            ) : response ? (
              <div className="max-w-md text-center">
                <div className="text-4xl mb-4">🌍</div>
                <p className="text-lg leading-relaxed" style={{ color: COLORS.textPrimary }}>
                  {response}
                </p>
                {userLocation && (
                  <p className="text-xs mt-4" style={{ color: COLORS.textMuted }}>
                    📍 {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Chat mode */}
        {params.mode === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">💬</div>
                  <p style={{ color: COLORS.textSecondary }}>
                    Skriv något för att börja chatta med AI
                  </p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[80%] p-3 rounded-lg"
                    style={{
                      backgroundColor: msg.role === 'user' ? triggerColor : COLORS.elevated,
                      color: msg.role === 'user' ? '#fff' : COLORS.textPrimary,
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div
                    className="p-3 rounded-lg flex items-center gap-2"
                    style={{ backgroundColor: COLORS.elevated }}
                  >
                    <div
                      className="w-2 h-2 rounded-full animate-bounce"
                      style={{ backgroundColor: triggerColor }}
                    />
                    <div
                      className="w-2 h-2 rounded-full animate-bounce"
                      style={{ backgroundColor: triggerColor, animationDelay: '0.1s' }}
                    />
                    <div
                      className="w-2 h-2 rounded-full animate-bounce"
                      style={{ backgroundColor: triggerColor, animationDelay: '0.2s' }}
                    />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="p-4 border-t" style={{ borderColor: COLORS.surface }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Skriv ett meddelande..."
                  className="flex-1 px-4 py-3 rounded-lg border-2"
                  style={{
                    backgroundColor: COLORS.elevated,
                    color: COLORS.textPrimary,
                    borderColor: COLORS.surface,
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !inputText.trim()}
                  className="px-4 py-3 rounded-lg font-display font-bold transition-all disabled:opacity-50"
                  style={{ backgroundColor: triggerColor, color: '#fff' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
