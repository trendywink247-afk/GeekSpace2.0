/**
 * @fileoverview Speech-to-Text (STT) hook using Web Speech Recognition API.
 *
 * Provides browser-native voice input with interim results, error handling,
 * and language support.
 *
 * **Browser support:** Chrome, Edge, Safari (with vendor prefix)
 * - Requires HTTPS in production
 * - Works in background (doesn't require focus)
 * - Supports multiple languages
 */

import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
  }
  interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }
}

/**
 * Configuration options for voice input.
 *
 * @property onTranscript - Callback when final transcription is complete (user stopped speaking)
 * @property onInterim - Optional callback for interim results (user still speaking)
 * @property lang - Language/locale code (default: 'en-US'). Examples: 'en-GB', 'es-ES', 'fr-FR'
 */
export interface UseVoiceOptions {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
}

/**
 * Return value of the useVoice hook.
 *
 * @property isListening - True while actively listening for speech
 * @property isSupported - True if Web Speech Recognition API is available
 * @property startListening - Begin voice input (toggle: call again to stop)
 * @property stopListening - End voice input and discard current audio
 * @property error - Last error message (e.g., 'No speech detected'), or null if no error
 */
export interface UseVoiceReturn {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

/**
 * React hook for browser-native speech recognition (voice input).
 *
 * **Features:**
 * - Continuous speech recognition with interim results
 * - Real-time transcription as user speaks
 * - Final transcription when user stops
 * - Language selection support
 * - Graceful error handling (mic denied, no speech detected, etc.)
 * - Auto-cleanup on unmount
 *
 * **Browser support:**
 * - Chrome/Edge: Full support via `SpeechRecognition`
 * - Safari: Full support via `webkitSpeechRecognition`
 * - Firefox: Limited support
 * - Requires HTTPS in production
 * - Requires user permission to access microphone
 *
 * **How it works:**
 * 1. User calls `startListening()`
 * 2. Browser requests microphone permission (if not already granted)
 * 3. `onInterim` callback fires as user speaks (optional, real-time)
 * 4. `onTranscript` callback fires when user stops speaking (final result)
 * 5. User can call `startListening()` again to record more
 *
 * **Common errors:**
 * - `'Microphone access denied'` → User rejected permission request
 * - `'No speech detected'` → User didn't say anything
 * - `'Voice input error'` → Generic error (check browser console)
 *
 * @param options - Configuration: `onTranscript`, optional `onInterim`, `lang`
 * @returns Object with `isListening`, `isSupported`, `startListening`, `stopListening`, `error`
 *
 * @example
 * ```typescript
 * const { isListening, isSupported, startListening, stopListening, error } = useVoice({
 *   onTranscript: (text) => {
 *     console.log('You said:', text);
 *     setUserInput(text);
 *   },
 *   onInterim: (interim) => {
 *     console.log('Interim:', interim);  // Optional, updates as user speaks
 *   },
 *   lang: 'en-US',
 * });
 *
 * if (!isSupported) {
 *   return <p>Voice input not supported in this browser</p>;
 * }
 *
 * return (
 *   <div>
 *     <button onClick={startListening}>
 *       {isListening ? 'Listening...' : 'Start Voice Input'}
 *     </button>
 *     {isListening && <button onClick={stopListening}>Stop</button>}
 *     {error && <p style={{ color: 'red' }}>{error}</p>}
 *   </div>
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Toggle listening on button click
 * const handleVoiceClick = () => {
 *   if (isListening) {
 *     stopListening();
 *   } else {
 *     startListening();
 *   }
 * };
 * ```
 */
export function useVoice({ onTranscript, onInterim, lang = 'en-US' }: UseVoiceOptions): UseVoiceReturn {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Voice input is not supported in this browser');
      return;
    }
    if (isListening) {
      stopListening();
      return;
    }
    setError(null);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = Array.from(event.results);
      const finalResult = results.find((r) => r.isFinal);
      const interimText = results.map((r) => r[0].transcript).join('');
      if (finalResult) {
        onTranscript(finalResult[0].transcript.trim());
      } else if (onInterim) {
        onInterim(interimText.trim());
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    (recognition as unknown as EventTarget).addEventListener('error', (event: Event) => {
      const e = event as SpeechRecognitionErrorEvent;
      const msg =
        e.error === 'not-allowed'
          ? 'Microphone access denied'
          : e.error === 'no-speech'
          ? 'No speech detected'
          : 'Voice input error';
      setError(msg);
      setIsListening(false);
      recognitionRef.current = null;
    });

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, isListening, lang, onTranscript, onInterim, stopListening]);

  useEffect(() => {
    return () => { recognitionRef.current?.abort(); };
  }, []);

  return { isListening, isSupported, startListening, stopListening, error };
}
