/**
 * Gemini Live Voice Configuration
 * Documentation for available voices and their characteristics
 */

export interface VoiceInfo {
  id: string;
  name: string;
  description: string;
  languages: string[];
  characteristics: string[];
  bestFor: string[];
}

export const GEMINI_LIVE_VOICES: VoiceInfo[] = [
  {
    id: 'Aoede',
    name: 'Aoede',
    description: 'Clear, neutral voice with good multilingual support',
    languages: ['en', 'ru', 'kz'],
    characteristics: ['Clear', 'Neutral', 'Professional'],
    bestFor: ['Customer service', 'Information delivery', 'Russian conversations'],
  },
  {
    id: 'Orbit',
    name: 'Orbit',
    description: 'Versatile voice with natural intonation',
    languages: ['en', 'ru', 'kz'],
    characteristics: ['Versatile', 'Clear', 'Adaptive'],
    bestFor: ['Sales calls', 'Dynamic conversations', 'Multilingual support'],
  },
  {
    id: 'Vale',
    name: 'Vale',
    description: 'Natural and expressive voice',
    languages: ['en', 'ru'],
    characteristics: ['Natural', 'Expressive', 'Warm'],
    bestFor: ['Emotional engagement', 'Support calls', 'Building rapport'],
  },
  {
    id: 'Puck',
    name: 'Puck',
    description: 'Friendly and conversational English voice',
    languages: ['en'],
    characteristics: ['Friendly', 'Conversational', 'Approachable'],
    bestFor: ['Casual conversations', 'English-only calls', 'Friendly support'],
  },
  {
    id: 'Charon',
    name: 'Charon',
    description: 'Calm and professional English voice',
    languages: ['en'],
    characteristics: ['Calm', 'Professional', 'Trustworthy'],
    bestFor: ['Professional consultations', 'Serious topics', 'Financial services'],
  },
  {
    id: 'Kore',
    name: 'Kore',
    description: 'Warm and engaging English voice',
    languages: ['en'],
    characteristics: ['Warm', 'Engaging', 'Empathetic'],
    bestFor: ['Customer care', 'Healthcare', 'Personal assistance'],
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    description: 'Deep and authoritative English voice',
    languages: ['en'],
    characteristics: ['Deep', 'Authoritative', 'Confident'],
    bestFor: ['Executive briefings', 'Technical support', 'Authority contexts'],
  },
];

/**
 * Get recommended voices for a specific language
 */
export function getRecommendedVoicesForLanguage(language: string): VoiceInfo[] {
  return GEMINI_LIVE_VOICES.filter(voice => voice.languages.includes(language));
}

/**
 * Get the default voice for a language
 */
export function getDefaultVoiceForLanguage(language: string): string {
  switch (language) {
    case 'ru':
    case 'kz':
      return 'Aoede'; // Best for Russian and Kazakh
    case 'en':
      return 'Puck'; // Friendly default for English
    default:
      return 'Aoede'; // Multilingual fallback
  }
}

/**
 * Voice selection recommendations
 */
export const VOICE_RECOMMENDATIONS = {
  sales: ['Orbit', 'Vale'], // Dynamic and engaging
  support: ['Kore', 'Vale', 'Aoede'], // Empathetic and clear
  information: ['Aoede', 'Charon'], // Clear and professional
  executive: ['Fenrir', 'Charon'], // Authoritative and professional
  casual: ['Puck', 'Vale'], // Friendly and natural
};