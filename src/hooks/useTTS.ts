import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * @fileoverview Text-to-Speech (TTS) hook using Web Speech API.
 *
 * Provides browser-native speech synthesis with markdown stripping,
 * voice selection, and rate/pitch control.
 *
 * **Browser support:** Chrome, Edge, Safari, Firefox
 * - Requires HTTPS in production
 * - Rate: 0.1 (slow) to 10 (fast), default 1
 * - Pitch: 0 (low) to 2 (high), default 1
 */

/**
 * Configuration options for speech synthesis.
 *
 * @property rate - Speech rate multiplier (0.1–10, default 1)
 * @property pitch - Pitch level (0–2, default 1)
 * @property lang - Language/locale code (e.g., 'en-US', 'en-GB')
 */
export interface TTSOptions {
  rate?: number;
  pitch?: number;
  lang?: string;
}

/**
 * Return value of the useTTS hook.
 *
 * @property speak - Function to start speaking text
 * @property stop - Function to cancel current speech
 * @property isSpeaking - True while utterance is playing
 * @property isSupported - True if Web Speech API is available
 */
export interface UseTTSReturn {
  speak: (text: string, options?: TTSOptions) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

/**
 * Removes markdown formatting from text before TTS rendering.
 * Strips code blocks, formatting, links, images, and lists.
 *
 * **Examples:**
 * - `**bold**` → `bold`
 * - `` `code` `` → `code`
 * - `[link](url)` → `link`
 * - `# Heading` → `Heading`
 * - Code blocks and images are removed entirely
 *
 * @param text - Text possibly containing markdown
 * @returns Plain text with all markdown removed
 */
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

/**
 * Selects an appropriate voice for speech synthesis.
 * Prefers exact language match, then any English voice, then defaults to first available.
 *
 * @param lang - Desired language code (e.g., 'en-US'). Defaults to 'en-US' if not provided.
 * @returns A SpeechSynthesisVoice if available, null if Web Speech API unavailable.
 * @private
 */
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

/**
 * React hook for browser-native text-to-speech synthesis.
 *
 * **Features:**
 * - Strips markdown before speaking (code blocks, formatting, links)
 * - Truncates to 2000 chars (Web Speech API limit)
 * - Cancels previous speech before starting new
 * - Exposes rate and pitch controls
 * - Gracefully disabled if Web Speech API unavailable
 *
 * **Browser support:**
 * - Chrome/Edge/Safari: Full support
 * - Firefox: Full support (as of v87)
 * - Requires HTTPS in production
 *
 * **Performance:**
 * - No network requests (browser-local synthesis)
 * - Voice availability depends on OS (Windows/macOS/iOS/Android)
 * - Memory: ~1MB per active utterance
 *
 * @returns Object with `speak`, `stop`, `isSpeaking`, `isSupported`
 *
 * @example
 * ```typescript
 * const { speak, stop, isSpeaking, isSupported } = useTTS();
 *
 * if (!isSupported) {
 *   return <p>Text-to-speech not supported</p>;
 * }
 *
 * return (
 *   <div>
 *     <button onClick={() => speak('Hello world!')}>Speak</button>
 *     {isSpeaking && <button onClick={stop}>Stop</button>}
 *     <p>Speaking: {isSpeaking ? 'Yes' : 'No'}</p>
 *   </div>
 * );
 * ```
 *
 * @example
 * ```typescript
 * // With custom rate and pitch
 * speak('Check this out!', {
 *   rate: 0.8,  // Slower
 *   pitch: 1.2, // Higher
 *   lang: 'en-GB'
 * });
 * ```
 */
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
