// VoiceChatPage — owner: weebo (#00F0FF)
// Redesigned: gs-card, gs-btn-primary, gs-btn-ghost, gs-section-label, GsTabBar patterns
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, PageHeader } from '@/components/agentin';
import { Mic, MicOff, Settings2, MessageSquare, Trash2, Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { agentService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useVoice } from '@/hooks/useVoice';
import { useTTS } from '@/hooks/useTTS';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';

// -- Types --

interface VoiceTurn {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
  engine?: string | null;
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

// -- Component --

export function VoiceChatPage() {
  const navigate = useNavigate();
  const { agent } = useDashboardStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Agent canvas notifications
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'weebo', page: 'voice-chat' });

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

  const addTurn = useCallback((role: 'user' | 'agent', text: string, engine?: string | null) => {
    setTranscript(prev => {
      const next = [...prev, { id: crypto.randomUUID(), role, text, timestamp: new Date(), engine }];
      return next.slice(-MAX_TURNS);
    });
  }, []);

  const sendToAgent = useCallback(async (text: string) => {
    addTurn('user', text);
    setVoiceState('processing');
    void notifyStart(`voice: ${text.slice(0, 60)}`);
    try {
      const res = await agentService.chat(text, 'voice');
      const reply = res.data.text || 'No response';
      void notifyDone('voice response complete');
      if (settings.ttsEnabled && tts.isSupported) {
        setVoiceState('speaking');
        tts.speak(reply, { rate: settings.speed });
        // Engine is set asynchronously by useTTS — add turn without it for now
        addTurn('agent', reply);
      } else {
        addTurn('agent', reply);
        setVoiceState('idle');
      }
    } catch {
      setVoiceState('error');
      setErrorMessage('Failed to get response. Try again.');
      void notifyFail('voice chat error');
      toast.error('Voice chat error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addTurn, settings.ttsEnabled, settings.speed, tts.isSupported, tts.engine, notifyStart, notifyDone, notifyFail]);

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
    <PageShell maxWidth="4xl">
      <div className="flex flex-col h-[100dvh] md:h-full min-h-0">
      {/* -- Header -- */}
      <PageHeader
        icon={Mic}
        title="Voice Chat"
        subtitle="Voice with Weebo"
        actions={
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="gs-btn-ghost min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl px-3"
            aria-label="Voice settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        }
      />

      {/* -- Settings Panel (collapsible) -- */}
      {settingsOpen && (
        <div className="gs-card mt-3 p-4 animate-page-enter">
          <p className="gs-section-label mb-3">Voice Settings</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Voice On/Off */}
            <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px]">
              <input
                type="checkbox"
                checked={settings.ttsEnabled}
                onChange={e => setSettings(s => ({ ...s, ttsEnabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 rounded-full bg-white/[0.06] peer-checked:bg-[#8B5CF6]/30 relative transition-colors">
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${settings.ttsEnabled ? 'translate-x-4 bg-[#8B5CF6]' : 'bg-[#6B7280]'}`} />
              </div>
              <span className="text-[#9CA3AF]">Voice replies</span>
            </label>

            {/* Auto-send toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px]">
              <input
                type="checkbox"
                checked={settings.autoSend}
                onChange={e => setSettings(s => ({ ...s, autoSend: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-9 h-5 rounded-full bg-white/[0.06] peer-checked:bg-[#8B5CF6]/30 relative transition-colors">
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${settings.autoSend ? 'translate-x-4 bg-[#8B5CF6]' : 'bg-[#6B7280]'}`} />
              </div>
              <span className="text-[#9CA3AF]">Auto-send</span>
            </label>

            {/* Speed selector */}
            <div className="flex items-center gap-2 min-h-[44px]">
              <span className="text-[#9CA3AF]">Speed</span>
              <div className="relative">
                <select
                  value={settings.speed}
                  onChange={e => setSettings(s => ({ ...s, speed: Number(e.target.value) }))}
                  className="gs-input appearance-none text-sm rounded-lg px-3 py-1.5 pr-7 min-h-[36px]"
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

      {/* -- Main Content -- */}
      <div className="flex-1 flex flex-col items-center justify-between min-h-0 py-6 gap-4">
        {/* Glass card: orb + status */}
        <div className="gs-card flex flex-col items-center gap-4 pt-4 w-full max-w-sm p-6">
          {/* Central orb (80px) with animated states */}
          <div className="relative flex items-center justify-center">
            {/* Concentric rings for listening/recording */}
            {voiceState === 'recording' && (
              <>
                <span className="absolute w-32 h-32 rounded-full border border-[#8B5CF6]/40 animate-voice-ring-1" />
                <span className="absolute w-44 h-44 rounded-full border border-[#8B5CF6]/25 animate-voice-ring-2" />
                <span className="absolute w-56 h-56 rounded-full border border-[#8B5CF6]/12 animate-voice-ring-3" />
              </>
            )}

            {/* Speaking pulse rings — violet */}
            {voiceState === 'speaking' && (
              <>
                <span className="absolute w-32 h-32 rounded-full border border-[#8B5CF6]/50 animate-voice-ring-1" />
                <span className="absolute w-44 h-44 rounded-full border border-[#8B5CF6]/25 animate-voice-ring-2" />
              </>
            )}

            {/* Idle pulse glow */}
            {voiceState === 'idle' && (
              <span className="absolute w-28 h-28 rounded-full bg-[#8B5CF6]/5 animate-voice-idle-pulse" />
            )}

            {/* Error glow */}
            {voiceState === 'error' && (
              <span className="absolute w-28 h-28 rounded-full bg-[#FF2D78]/10 animate-pulse" />
            )}

            {/* Main orb — 80px with weebo dot */}
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300"
              style={{
                background: voiceState === 'recording'
                  ? 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(12,12,24,1) 80%)'
                  : voiceState === 'speaking'
                    ? 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(12,12,24,1) 80%)'
                    : 'radial-gradient(circle, rgba(12,12,24,0.8) 0%, rgba(12,12,24,1) 80%)',
                border: `2px solid ${
                  voiceState === 'recording' ? '#8B5CF6'
                  : voiceState === 'speaking' ? '#8B5CF6'
                  : voiceState === 'error' ? '#FF2D78'
                  : 'rgba(139,92,246,0.2)'
                }`,
                boxShadow: voiceState === 'recording'
                  ? '0 0 32px rgba(139,92,246,0.35)'
                  : voiceState === 'speaking'
                    ? '0 0 24px rgba(139,92,246,0.25)'
                    : voiceState === 'error'
                      ? '0 0 20px rgba(255,45,120,0.25)'
                      : 'none',
                animation: voiceState === 'speaking' ? 'agent-pulse 1.4s ease-in-out infinite' : 'none',
              }}
            >
              {voiceState === 'processing' ? (
                <Loader2 className="w-9 h-9 text-[#8B5CF6] animate-spin" />
              ) : (
                /* Weebo dot — violet */
                <span
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: '#8B5CF6',
                    boxShadow: '0 0 12px rgba(139,92,246,0.5)',
                  }}
                  aria-label="Weebo agent"
                />
              )}
            </div>
          </div>

          {/* Waveform bars — listening state */}
          {voiceState === 'recording' && (
            <div className="flex items-end gap-1 h-8" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <span
                  key={i}
                  className="w-1.5 bg-[#8B5CF6] rounded-full animate-voice-wave"
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
                  className="w-1.5 rounded-full animate-voice-bar bg-[#8B5CF6]"
                  style={{
                    animationDelay: `${i * 0.12}s`,
                    animationDuration: `${0.4 + i * 0.08}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Status text */}
          <p
            className="text-sm font-medium transition-colors"
            style={{
              color: voiceState === 'recording' ? '#8B5CF6'
                : voiceState === 'processing' ? 'rgba(139,92,246,0.7)'
                : voiceState === 'speaking' ? '#A78BFA'
                : voiceState === 'error' ? '#FF2D78'
                : '#9CA3AF',
            }}
          >
            {voiceState === 'error' && <AlertCircle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
            {statusText}
          </p>

          {/* Interim transcript preview */}
          {interimText && voiceState === 'recording' && (
            <p className="text-xs text-[#9CA3AF] italic max-w-xs text-center truncate px-4">
              &ldquo;{interimText}&rdquo;
            </p>
          )}
        </div>

        {/* -- Transcript History -- */}
        <div className="gs-card flex-1 w-full max-w-lg overflow-y-auto min-h-0 p-3">
          <div ref={scrollRef} className="space-y-2 overflow-y-auto max-h-full">
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Mic className="w-8 h-8 text-[#8B5CF6]/20 mb-3" />
                <p className="text-sm text-[#6B7280]">No conversation yet</p>
                <p className="text-xs text-[#6B7280]/60 mt-1">Tap the microphone to start</p>
              </div>
            ) : (
              transcript.map(turn => (
                <div
                  key={turn.id}
                  className={[
                    'flex flex-col gap-0.5 text-sm rounded-xl px-3 py-2',
                    turn.role === 'user'
                      ? 'bg-[#8B5CF6]/5 ml-4'
                      : 'bg-white/[0.04] mr-4',
                  ].join(' ')}
                >
                  <div className="flex gap-2">
                    <span className={[
                      'font-semibold flex-shrink-0 text-xs mt-0.5',
                      turn.role === 'user' ? 'text-[#8B5CF6]' : 'text-[#A78BFA]',
                    ].join(' ')}>
                      {turn.role === 'user' ? 'You' : agent.name || 'Weebo'}:
                    </span>
                    <span className="text-[#F4F6FF]/90 break-words">{turn.text}</span>
                  </div>
                  {turn.role === 'agent' && turn.engine && (
                    <span className="text-[10px] text-[#6B7280] ml-auto">
                      via {turn.engine}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
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
              !voice.isSupported ? 'opacity-40 cursor-not-allowed bg-white/[0.04]' :
              voiceState === 'processing' ? 'opacity-60 cursor-not-allowed bg-white/[0.04]' :
              voiceState === 'recording' ? 'bg-[#FF2D78] shadow-[0_0_32px_rgba(255,45,120,0.4)] hover:bg-[#FF2D78]/90 cursor-pointer active:scale-95' :
              voiceState === 'speaking' ? 'bg-[#8B5CF6]/20 border-2 border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/30 cursor-pointer active:scale-95' :
              'bg-[#8B5CF6]/15 border-2 border-[#8B5CF6]/30 hover:bg-[#8B5CF6]/25 hover:border-[#8B5CF6]/50 cursor-pointer active:scale-95 animate-voice-idle-pulse',
            ].join(' ')}
          >
            {voiceState === 'processing' ? (
              <Loader2 className="w-7 h-7 text-[#8B5CF6] animate-spin" />
            ) : voiceState === 'recording' ? (
              <MicOff className="w-7 h-7 text-white" />
            ) : voiceState === 'speaking' ? (
              <span className="w-5 h-5 rounded-sm bg-[#8B5CF6]" />
            ) : (
              <Mic className={`w-7 h-7 ${voice.isSupported ? 'text-[#8B5CF6]' : 'text-[#6B7280]'}`} />
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
            className="gs-btn-ghost min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Text Mode</span>
          </button>

          <button
            onClick={clearTranscript}
            disabled={transcript.length === 0}
            className="gs-btn-ghost min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear</span>
          </button>

          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="gs-btn-ghost min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
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
