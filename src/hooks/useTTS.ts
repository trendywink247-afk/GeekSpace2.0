import { useState, useRef, useCallback, useEffect } from 'react';
import { voiceService, jobsService } from '@/services/api';

/**
 * @fileoverview Text-to-Speech (TTS) hook with server-side fallback chain.
 *
 * Priority: Server TTS (Kokoro → Piper → edge-tts) → Browser Web Speech API.
 * Auto-detects server availability on first call and caches the result.
 */

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  lang?: string;
}

export type TtsMode = 'server' | 'browser';

export interface UseTTSReturn {
  speak: (text: string, options?: TTSOptions) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  ttsMode: TtsMode | null;
  engine: string | null;
}

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

// Cache server availability across hook instances
let serverTtsAvailable: boolean | null = null;

export function useTTS(): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsMode, setTtsMode] = useState<TtsMode | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef(false);

  const browserSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    abortRef.current = true;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (browserSupported) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
  }, [browserSupported]);

  const speakBrowser = useCallback((text: string, options?: TTSOptions) => {
    if (!browserSupported) return;
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
    setTtsMode('browser');
    setEngine('browser');
    window.speechSynthesis.speak(utterance);
  }, [browserSupported]);

  const speakServer = useCallback(async (text: string, options?: TTSOptions): Promise<boolean> => {
    const clean = stripMarkdown(text).slice(0, 2000);
    if (!clean) return false;

    try {
      abortRef.current = false;
      const { jobId } = await voiceService.speak(clean);
      const job = await jobsService.pollUntilDone(jobId, 60, 500);

      if (abortRef.current) return false;

      if (job.status === 'failed') return false;

      const result = job.result as { audioBase64?: string; mimeType?: string; engine?: string } | undefined;
      if (!result?.audioBase64) return false;

      const audioBytes = atob(result.audioBase64);
      const audioArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i);
      }
      const blob = new Blob([audioArray], { type: result.mimeType || 'audio/ogg' });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      if (abortRef.current) {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
        return false;
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      if (options?.rate && options.rate !== 1) {
        audio.playbackRate = options.rate;
      }

      setEngine(result.engine || 'server');
      setTtsMode('server');

      return new Promise<boolean>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
          audioRef.current = null;
          setIsSpeaking(false);
          resolve(true);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          objectUrlRef.current = null;
          audioRef.current = null;
          setIsSpeaking(false);
          resolve(false);
        };
        setIsSpeaking(true);
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setIsSpeaking(false);
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }, []);

  const speak = useCallback((text: string, options?: TTSOptions) => {
    // Cancel any current speech first
    stop();
    abortRef.current = false;

    if (!text.trim()) return;

    // If we already know server is unavailable, go straight to browser
    if (serverTtsAvailable === false) {
      if (browserSupported) {
        speakBrowser(text, options);
      } else {
        setIsSpeaking(false);
        setTtsMode(null);
        setEngine(null);
      }
      return;
    }

    // Try server first, fall back to browser
    setIsSpeaking(true);
    speakServer(text, options).then((success) => {
      if (success) {
        serverTtsAvailable = true;
      } else if (!abortRef.current) {
        // Server failed — fall back to browser
        serverTtsAvailable = serverTtsAvailable === null ? false : serverTtsAvailable;
        if (browserSupported) {
          speakBrowser(text, options);
        } else {
          setIsSpeaking(false);
          setTtsMode(null);
          setEngine(null);
        }
      }
    });
  }, [stop, speakBrowser, speakServer, browserSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (browserSupported) window.speechSynthesis.cancel();
    };
  }, [browserSupported]);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported: browserSupported || serverTtsAvailable !== false,
    ttsMode,
    engine,
  };
}

// Export helper for use in tests
export { stripMarkdown };
