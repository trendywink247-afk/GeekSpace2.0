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

export interface UseVoiceOptions {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
}

export interface UseVoiceReturn {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

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

    recognition.onerror = (event: Event) => {
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
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported, isListening, lang, onTranscript, onInterim, stopListening]);

  useEffect(() => {
    return () => { recognitionRef.current?.abort(); };
  }, []);

  return { isListening, isSupported, startListening, stopListening, error };
}
