import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/agentin';
import { Mic, MicOff, Settings2, MessageSquare, Trash2, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { agentService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useVoice } from '@/hooks/useVoice';
import { useTTS } from '@/hooks/useTTS';
import type { AgentPersonality } from '@/types';

// -- Types --

interface VoiceTurn {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking' | 'error';

interface VoiceSettings {
  ttsEnabled: boolean;
  autoSend: boolean;
  speed: number;
}

// -- Constants --

const MAX_TURNS = 20;

const SPEED_OPTIONS = [0.75, 1, 1.25] as const;

const PERSONALITY_EMOJI: Record<AgentPersonality, string> = {
  edith: '🔷', jarvis: '🟣', weebo: '💚',
  aria: '🎨', forge: '🔧', pulse: '📊',
  echo: '💙', cal: '📅', nova: '🔭',
};

const PERSONALITY_COLOR: Record<AgentPersonality, string> = {
  edith: '#8B5CF6',
  jarvis: '#ADFF2F',
  weebo: '#00F0FF',
  aria: '#F59E0B',
  forge: '#FF6B35',
  pulse: '#10B981',
  echo: '#3B82F6',
  cal: '#06B6D4',
  nova: '#A855F7',
};

// -- Component --

export function VoiceChatPage() {
  const navigate = useNavigate();
  const { agent } = useDashboardStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice state
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<VoiceTurn[]>([]);
  const [interimText, setInterimText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<VoiceSettings>({
    ttsEnabled: true,
    autoSend: true,
    speed: 1,
  });

  // Hooks
  const tts = useTTS();

  const handleTranscript = useCallback((text: string) => {
    setInterimText('');
    if (!text.trim()) {
      setVoiceState('idle');
      return;
    }
    if (settings.autoSend) {
      sendToAgent(text.trim());
    } else {
      // Add user turn and go idle so they can review
      addTurn('user', text.trim());
      setVoiceState('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoSend]);

  const handleInterim = useCallback((text: string) => {
    setInterimText(text);
  }, []);

  const voice = useVoice({
    onTranscript: handleTranscript,
    onInterim: handleInterim,
    lang: 'en-US',
  });

  // Scroll to bottom on new turns
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => { tts.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync voice state with hook state
  useEffect(() => {
    if (!voice.isListening && voiceState === 'recording') {
      // Recognition ended naturally (e.g. silence timeout)
      if (voice.error) {
        setVoiceState('error');
        setErrorMessage(voice.error);
      }
    }
  }, [voice.isListening, voice.error, voiceState]);

  // When TTS finishes speaking, return to idle
  useEffect(() => {
    if (!tts.isSpeaking && voiceState === 'speaking') {
      setVoiceState('idle');
    }
  }, [tts.isSpeaking, voiceState]);

  const addTurn = useCallback((role: 'user' | 'agent', text: string) => {
    setTranscript(prev => {
      const next = [...prev, { id: crypto.randomUUID(), role, text, timestamp: new Date() }];
      return next.slice(-MAX_TURNS);
    });
  }, []);

  const sendToAgent = useCallback(async (text: string) => {
    addTurn('user', text);
    setVoiceState('processing');
    try {
      const res = await agentService.chat(text, 'voice');
      const reply = res.data.text || 'No response';
      addTurn('agent', reply);
      if (settings.ttsEnabled && tts.isSupported) {
        setVoiceState('speaking');
        tts.speak(reply, { rate: settings.speed });
      } else {
        setVoiceState('idle');
      }
    } catch {
      setVoiceState('error');
      setErrorMessage('Failed to get response. Try again.');
      toast.error('Voice chat error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTurn, settings.ttsEnabled, settings.speed, tts.isSupported]);

  const toggleRecording = useCallback(() => {
    if (voiceState === 'speaking') {
      tts.stop();
      setVoiceState('idle');
      return;
    }
    if (voiceState === 'processing') return;

    if (voiceState === 'error') {
      setErrorMessage('');
      setVoiceState('idle');
    }

    if (voice.isListening) {
      voice.stopListening();
      setVoiceState('idle');
    } else {
      setErrorMessage('');
      setVoiceState('recording');
      voice.startListening();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState, voice.isListening]);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setInterimText('');
    setVoiceState('idle');
    tts.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive display state
  const agentEmoji = PERSONALITY_EMOJI[(agent.personality as AgentPersonality) || 'jarvis'] || '🟣';
  const agentColor = PERSONALITY_COLOR[(agent.personality as AgentPersonality) || 'jarvis'] || '#8B5CF6';

  const statusText = (() => {
    switch (voiceState) {
      case 'recording': return 'Listening...';
      case 'processing': return 'Thinking...';
      case 'speaking': return 'Speaking...';
      case 'error': return errorMessage || "Couldn't hear you, try again";
      default: return 'Tap to talk';
    }
  })();

  return (
    <PageShell>
      <div className="flex flex-col h-[100dvh] md:h-full min-h-0">
      {/* -- Header -- */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#00F0FF]/10 flex-shrink-0">
        <h1 className="text-lg font-bold text-[var(--ag-text-primary)]" style={{ fontFamily: 'Syne, sans-serif' }}>
          Voice Chat <span className="text-[10px] text-[#4B5563] font-medium ml-1.5">🎙️ Voice with Weebo</span>
        </h1>
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#00F0FF]/10 transition-colors"
          aria-label="Voice settings"
        >
          <Settings2 className="w-5 h-5 text-[#8892A4]" />
        </button>
      </div>

      {/* -- Settings Panel (collapsible) -- */}
      {settingsOpen && (
        <div className="px-4 py-3 border-b border-[#00F0FF]/10 bg-[var(--ag-bg-surface)] flex-shrink-0 animate-page-enter">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Voice On/Off */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.ttsEnabled}
                onChange={e => setSettings(s => ({ ...s, ttsEnabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 rounded-full bg-[#1A1A2E] peer-checked:bg-[#00F0FF]/30 relative transition-colors">
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${settings.ttsEnabled ? 'translate-x-4 bg-[#00F0FF]' : 'bg-[#6B7280]'}`} />
              </div>
              <span className="text-[#8892A4]">Voice replies</span>
            </label>

            {/* Auto-send toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.autoSend}
                onChange={e => setSettings(s => ({ ...s, autoSend: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 rounded-full bg-[#1A1A2E] peer-checked:bg-[#00F0FF]/30 relative transition-colors">
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${settings.autoSend ? 'translate-x-4 bg-[#00F0FF]' : 'bg-[#6B7280]'}`} />
              </div>
              <span className="text-[#8892A4]">Auto-send</span>
            </label>

            {/* Speed selector */}
            <div className="flex items-center gap-2">
              <span className="text-[#8892A4]">Speed</span>
              <div className="relative">
                <select
                  value={settings.speed}
                  onChange={e => setSettings(s => ({ ...s, speed: Number(e.target.value) }))}
                  className="appearance-none bg-[#1A1A2E] text-[var(--ag-text-primary)] text-sm rounded-lg px-3 py-1.5 pr-7 border border-[#00F0FF]/10 focus:outline-none focus:ring-1 focus:ring-[#00F0FF]/40"
                >
                  {SPEED_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}x</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6B7280] pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -- Main Content — glass card -- */}
      <div className="flex-1 flex flex-col items-center justify-between min-h-0 px-4 py-6 gap-4">
        {/* Glass card: orb + status */}
        <div
          className="flex flex-col items-center gap-4 flex-shrink-0 pt-4 w-full max-w-sm rounded-2xl border px-6 py-6"
          style={{
            background: 'rgba(12,12,24,0.7)',
            backdropFilter: 'blur(16px)',
            borderColor: voiceState === 'recording'
              ? 'rgba(0,240,255,0.25)'
              : voiceState === 'speaking'
                ? `${agentColor}40`
                : 'rgba(0,240,255,0.1)',
            boxShadow: voiceState === 'recording'
              ? '0 0 40px rgba(0,240,255,0.08)'
              : voiceState === 'speaking'
                ? `0 0 32px ${agentColor}15`
                : 'none',
          }}
        >
          {/* Central orb (80px) with animated states */}
          <div className="relative flex items-center justify-center">
            {/* Concentric rings for listening/recording */}
            {voiceState === 'recording' && (
              <>
                <span className="absolute w-32 h-32 rounded-full border border-[#00F0FF]/40 animate-voice-ring-1" />
                <span className="absolute w-44 h-44 rounded-full border border-[#00F0FF]/25 animate-voice-ring-2" />
                <span className="absolute w-56 h-56 rounded-full border border-[#00F0FF]/12 animate-voice-ring-3" />
              </>
            )}

            {/* Speaking pulse rings using agent color */}
            {voiceState === 'speaking' && (
              <>
                <span
                  className="absolute w-32 h-32 rounded-full border animate-voice-ring-1"
                  style={{ borderColor: `${agentColor}50` }}
                />
                <span
                  className="absolute w-44 h-44 rounded-full border animate-voice-ring-2"
                  style={{ borderColor: `${agentColor}25` }}
                />
              </>
            )}

            {/* Idle pulse glow */}
            {voiceState === 'idle' && (
              <span className="absolute w-28 h-28 rounded-full bg-[#00F0FF]/5 animate-voice-idle-pulse" />
            )}

            {/* Error glow */}
            {voiceState === 'error' && (
              <span className="absolute w-28 h-28 rounded-full bg-[#FF2D78]/10 animate-pulse" />
            )}

            {/* Main orb — 80px */}
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl transition-all duration-300"
              style={{
                background: voiceState === 'recording'
                  ? 'radial-gradient(circle, rgba(0,240,255,0.15) 0%, rgba(12,12,24,1) 80%)'
                  : voiceState === 'speaking'
                    ? `radial-gradient(circle, ${agentColor}20 0%, rgba(12,12,24,1) 80%)`
                    : 'radial-gradient(circle, rgba(12,12,24,0.8) 0%, rgba(12,12,24,1) 80%)',
                border: `2px solid ${
                  voiceState === 'recording' ? '#00F0FF'
                  : voiceState === 'speaking' ? agentColor
                  : voiceState === 'error' ? '#FF2D78'
                  : 'rgba(0,240,255,0.2)'
                }`,
                boxShadow: voiceState === 'recording'
                  ? '0 0 32px rgba(0,240,255,0.35)'
                  : voiceState === 'speaking'
                    ? `0 0 24px ${agentColor}40`
                    : voiceState === 'error'
                      ? '0 0 20px rgba(255,45,120,0.25)'
                      : 'none',
                animation: voiceState === 'speaking' ? 'agent-pulse 1.4s ease-in-out infinite' : 'none',
              }}
            >
              {voiceState === 'processing' ? (
                <Loader2 className="w-9 h-9 text-[var(--ag-cyan)] animate-spin" />
              ) : (
                <span role="img" aria-label="agent avatar">{agentEmoji}</span>
              )}
            </div>
          </div>

          {/* Waveform bars — listening state */}
          {voiceState === 'recording' && (
            <div className="flex items-end gap-1 h-8" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <span
                  key={i}
                  className="w-1.5 bg-[#00F0FF] rounded-full animate-voice-wave"
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${0.5 + (i % 3) * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Audio visualizer bars — speaking state */}
          {voiceState === 'speaking' && (
            <div className="flex items-end gap-1 h-8" aria-hidden="true">
              {[0, 1, 2, 3, 4].map(i => (
                <span
                  key={i}
                  className="w-1.5 rounded-full animate-voice-bar"
                  style={{
                    animationDelay: `${i * 0.12}s`,
                    animationDuration: `${0.4 + i * 0.08}s`,
                    backgroundColor: agentColor,
                  }}
                />
              ))}
            </div>
          )}

          {/* Status text */}
          <p
            className="text-sm font-medium transition-colors"
            style={{
              color: voiceState === 'recording' ? '#00F0FF'
                : voiceState === 'processing' ? 'rgba(0,240,255,0.7)'
                : voiceState === 'speaking' ? agentColor
                : voiceState === 'error' ? '#FF2D78'
                : '#8892A4',
            }}
          >
            {voiceState === 'error' && <AlertCircle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
            {statusText}
          </p>

          {/* Interim transcript preview */}
          {interimText && voiceState === 'recording' && (
            <p className="text-xs text-[#8892A4] italic max-w-xs text-center truncate px-4">
              &ldquo;{interimText}&rdquo;
            </p>
          )}
        </div>

        {/* -- Transcript History -- */}
        <div
          ref={scrollRef}
          className="flex-1 w-full max-w-lg overflow-y-auto min-h-0 rounded-xl bg-[var(--ag-bg-surface)]/60 border border-[#00F0FF]/10 p-3 space-y-2"
        >
          {transcript.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Mic className="w-8 h-8 text-[var(--ag-cyan)]/20 mb-3" />
              <p className="text-sm text-[#6B7280]">No conversation yet</p>
              <p className="text-xs text-[#6B7280]/60 mt-1">Tap the microphone to start</p>
            </div>
          ) : (
            transcript.map(turn => (
              <div
                key={turn.id}
                className={[
                  'flex gap-2 text-sm rounded-lg px-3 py-2',
                  turn.role === 'user'
                    ? 'bg-[#00F0FF]/5 ml-4'
                    : 'bg-[#12121F] mr-4',
                ].join(' ')}
              >
                <span className={[
                  'font-semibold flex-shrink-0 text-xs mt-0.5',
                  turn.role === 'user' ? 'text-[var(--ag-cyan)]' : 'text-[#ADFF2F]',
                ].join(' ')}>
                  {turn.role === 'user' ? 'You' : agent.name || 'Agent'}:
                </span>
                <span className="text-[var(--ag-text-primary)]/90 break-words">{turn.text}</span>
              </div>
            ))
          )}
        </div>

        {/* -- Mic Button (primary action) -- */}
        <div className="flex flex-col items-center gap-3 flex-shrink-0">
          <button
            onClick={toggleRecording}
            disabled={voiceState === 'processing' || !voice.isSupported}
            aria-label={
              voiceState === 'recording' ? 'Stop recording' :
              voiceState === 'speaking' ? 'Stop speaking' :
              'Start recording'
            }
            className={[
              'relative min-h-[64px] min-w-[64px] w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200',
              !voice.isSupported ? 'opacity-40 cursor-not-allowed bg-[#1A1A2E]' :
              voiceState === 'processing' ? 'opacity-60 cursor-not-allowed bg-[#1A1A2E]' :
              voiceState === 'recording' ? 'bg-[#FF2D78] shadow-[0_0_32px_rgba(255,45,120,0.4)] hover:bg-[#FF2D78]/90 cursor-pointer active:scale-95' :
              voiceState === 'speaking' ? 'bg-[#ADFF2F]/20 border-2 border-[#ADFF2F]/40 hover:bg-[#ADFF2F]/30 cursor-pointer active:scale-95' :
              'bg-[#00F0FF]/15 border-2 border-[#00F0FF]/30 hover:bg-[#00F0FF]/25 hover:border-[#00F0FF]/50 cursor-pointer active:scale-95 animate-voice-idle-pulse',
            ].join(' ')}
          >
            {voiceState === 'processing' ? (
              <Loader2 className="w-7 h-7 text-[var(--ag-cyan)] animate-spin" />
            ) : voiceState === 'recording' ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : voiceState === 'speaking' ? (
              <span className="w-5 h-5 rounded-sm bg-[#ADFF2F]" />
            ) : (
              <Mic className={`w-7 h-7 ${voice.isSupported ? 'text-[var(--ag-cyan)]' : 'text-[#6B7280]'}`} />
            )}
          </button>

          {!voice.isSupported && (
            <p className="text-xs text-[#FF2D78]">Voice not supported in this browser</p>
          )}
        </div>

        {/* -- Bottom Actions -- */}
        <div className="flex items-center justify-center gap-3 flex-shrink-0 w-full max-w-lg">
          <button
            onClick={() => navigate('/dashboard/chat')}
            className="min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#12121F] hover:bg-[#1A1A2E] border border-[#00F0FF]/10 text-sm text-[#8892A4] hover:text-[var(--ag-text-primary)] transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Text Mode</span>
          </button>

          <button
            onClick={clearTranscript}
            disabled={transcript.length === 0}
            className="min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#12121F] hover:bg-[#1A1A2E] border border-[#00F0FF]/10 text-sm text-[#8892A4] hover:text-[var(--ag-text-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear</span>
          </button>

          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#12121F] hover:bg-[#1A1A2E] border border-[#00F0FF]/10 text-sm text-[#8892A4] hover:text-[var(--ag-text-primary)] transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* -- Keyframe animations injected via style tag -- */}
      <style>{`
        @keyframes voice-ring-expand {
          0% { transform: scale(0.6); opacity: 0.6; }
          100% { transform: scale(1); opacity: 0; }
        }
        .animate-voice-ring-1 {
          animation: voice-ring-expand 1.8s ease-out infinite;
        }
        .animate-voice-ring-2 {
          animation: voice-ring-expand 1.8s ease-out infinite 0.4s;
        }
        .animate-voice-ring-3 {
          animation: voice-ring-expand 1.8s ease-out infinite 0.8s;
        }
        @keyframes voice-idle-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        .animate-voice-idle-pulse {
          animation: voice-idle-pulse 2.5s ease-in-out infinite;
        }
        @keyframes voice-bar {
          0%, 100% { height: 4px; }
          50% { height: 20px; }
        }
        .animate-voice-bar {
          animation: voice-bar 0.5s ease-in-out infinite alternate;
          min-height: 4px;
        }
        @keyframes voice-wave {
          0%, 100% { height: 4px; }
          50% { height: 28px; }
        }
        .animate-voice-wave {
          animation: voice-wave 0.6s ease-in-out infinite alternate;
          min-height: 4px;
        }
        @keyframes agent-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
      </div>
    </PageShell>
  );
}
