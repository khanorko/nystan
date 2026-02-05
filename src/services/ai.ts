/**
 * AI Service using GROQ API
 * Provides AI-powered triggers for Kontextlager
 */

import { reverseGeocode, buildLocationDescription } from './geocoding';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  text: string;
  error?: string;
}

/**
 * Get AI completion from GROQ
 */
export async function getAICompletion(
  messages: Message[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}
): Promise<AIResponse> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    return { text: '', error: 'GROQ API-nyckel saknas. Lägg till VITE_GROQ_API_KEY i .env.local' };
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || 'llama-3.1-8b-instant',
        messages,
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content || '' };
  } catch (error) {
    console.error('AI completion error:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Okänt fel vid AI-anrop',
    };
  }
}

/**
 * Get place information based on coordinates
 * Uses reverse geocoding to provide street/neighbourhood/city context to AI
 */
export async function getPlaceInfo(
  lat: number,
  lng: number,
  customPrompt?: string
): Promise<AIResponse> {
  // Get address details via reverse geocoding
  const place = await reverseGeocode(lat, lng);
  const locationDescription = buildLocationDescription(place, lat, lng);

  const systemPrompt = customPrompt || `Du är en lokal guide som berättar intressanta saker om platser.
Svara kort och engagerande (max 2-3 meningar).
Inkludera gärna historiska eller kulturella fakta.
Svara på svenska.`;

  const userMessage = `Berätta något intressant om denna plats:
- ${locationDescription}`;

  return getAICompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]);
}

/**
 * Chat with AI using a custom system prompt
 */
export async function chatWithAI(
  userMessage: string,
  systemPrompt: string,
  conversationHistory: Message[] = []
): Promise<AIResponse> {
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  return getAICompletion(messages);
}

/**
 * Get a random comment based on a prompt
 */
export async function getRandomComment(
  systemPrompt: string,
  context?: string
): Promise<AIResponse> {
  const userMessage = context
    ? `Ge en kort kommentar baserat på: ${context}`
    : 'Ge en kort, slumpmässig kommentar.';

  return getAICompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], { temperature: 0.9 });
}

/**
 * Check if AI is available (API key is set)
 */
export function isAIAvailable(): boolean {
  return !!import.meta.env.VITE_GROQ_API_KEY;
}
