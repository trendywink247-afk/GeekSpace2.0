import { useState, useRef, useCallback, useEffect } from 'react';

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  lang?: string;
}

export interface UseTTSReturn {
  speak: (text: string, options?: TTSOptions) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

// Strip markdown formatting before speaking
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .trim();
}

function pickEnglishVoice(lang?: string): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const target = lang || 'en-US';
  return (
    voices.find((v) => v.lang === target) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    voices[0] ||
    null
  );
}

export function useTTS(): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    utteranceRef.current = null;
  }, [isSupported]);

  const speak = useCallback((text: string, options?: TTSOptions) => {
    if (!isSupported) return;
    // Cancel any current speech first
    window.speechSynthesis.cancel();

    const clean = stripMarkdown(text).slice(0, 2000);
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = options?.rate ?? 1;
    utterance.pitch = options?.pitch ?? 1;

    const voice = pickEnglishVoice(options?.lang);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => { setIsSpeaking(false); utteranceRef.current = null; };
    utterance.onerror = () => { setIsSpeaking(false); utteranceRef.current = null; };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (isSupported) window.speechSynthesis.cancel(); };
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}

// Export helper for use in tests
export { stripMarkdown };
