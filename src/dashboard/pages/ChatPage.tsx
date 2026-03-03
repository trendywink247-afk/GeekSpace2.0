import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Volume2, VolumeX, Mic, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { agentService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useVoice } from '@/hooks/useVoice';
import { useTTS } from '@/hooks/useTTS';
import { VoiceButton } from '@/components/VoiceButton';
import type { AgentPersonality } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

const VOICE_SETTINGS_KEY = 'agentin_voice_settings';

function getVoiceMode(): boolean {
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (!raw) return false;
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    return Boolean(cfg.enabled);
  } catch {
    return false;
  }
}

export function ChatPage() {
  const agent = useDashboardStore((s) => s.agent);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState<boolean>(getVoiceMode);
  const [interimText, setInterimText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const personality: AgentPersonality = agent?.personality ?? 'weebo';
  const agentName = personality === 'edith' ? 'Edith' : personality === 'jarvis' ? 'Jarvis' : 'Weebo';

  const tts = useTTS();

  const handleTranscript = useCallback((text: string) => {
    setInterimText('');
    setInput(text);
    // Auto-submit after transcript
    setTimeout(() => {
      inputRef.current?.form?.requestSubmit();
    }, 100);
  }, []);

  const voice = useVoice({
    onTranscript: handleTranscript,
    onInterim: setInterimText,
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await agentService.chat(text, personality);
      const reply = res.data.response ?? res.data.message ?? '';
      const agentMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'agent',
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);

      // Auto-read if voice mode is on and TTS is supported
      if (voiceMode && tts.isSupported) {
        tts.speak(reply);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'agent',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, personality, voiceMode, tts]);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((prev) => {
      const next = !prev;
      try {
        const raw = localStorage.getItem('agentin_voice_settings');
        const cfg: Record<string, unknown> = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        cfg.enabled = next;
        localStorage.setItem('agentin_voice_settings', JSON.stringify(cfg));
      } catch {}
      if (!next && tts.isSpeaking) tts.stop();
      return next;
    });
  }, [tts]);

  const clearChat = useCallback(() => {
    tts.stop();
    setMessages([]);
  }, [tts]);

  const personalityMeta: Record<AgentPersonality, { emoji: string; color: string }> = {
    edith: { emoji: 'E', color: '#3B82F6' },
    jarvis: { emoji: 'J', color: '#BF5FFF' },
    weebo: { emoji: 'W', color: '#00FF88' },
  };
  const meta = personalityMeta[personality];

  return (
    <div className='flex flex-col h-full max-h-[calc(100vh-120px)] bg-[#06060B] rounded-xl border border-[#00F0FF]/10'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-[#00F0FF]/10 flex-shrink-0'>
        <div className='flex items-center gap-3'>
          <div
            className='w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-black'
            style={{ background: meta.color }}
          >
            {meta.emoji}
          </div>
          <div>
            <h2 className='text-sm font-semibold text-[#E8E8F0]'>{agentName}</h2>
            <p className='text-[10px] text-[#6B7280]'>AI Assistant</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {tts.isSpeaking && (
            <button
              onClick={() => tts.stop()}
              className='p-1.5 rounded-lg hover:bg-[#00F0FF]/10 text-[#00F0FF]'
              title='Stop speaking'
            >
              <VolumeX className='w-4 h-4' />
            </button>
          )}
          <button
            onClick={toggleVoiceMode}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              voiceMode
                ? 'bg-[#00F0FF]/20 text-[#00F0FF] ring-1 ring-[#00F0FF]/40'
                : 'hover:bg-[#00F0FF]/10 text-[#6B7280]',
            ].join(' ')}
            title={voiceMode ? 'Voice mode on — responses will be read aloud' : 'Enable voice mode'}
          >
            <Volume2 className='w-3.5 h-3.5' />
            Voice {voiceMode ? 'On' : 'Off'}
          </button>
          <button
            onClick={clearChat}
            className='p-1.5 rounded-lg hover:bg-[#00F0FF]/10 text-[#6B7280] hover:text-[#E8E8F0]'
            title='Clear chat'
          >
            <RotateCcw className='w-4 h-4' />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide'>
        {messages.length === 0 && (
          <div className='flex flex-col items-center justify-center h-full gap-4 text-center py-12'>
            <div
              className='w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-black'
              style={{ background: meta.color }}
            >
              {meta.emoji}
            </div>
            <div>
              <p className='text-[#E8E8F0] font-medium'>Chat with {agentName}</p>
              <p className='text-xs text-[#6B7280] mt-1'>
                {voice.isSupported ? 'Type or speak to get started' : 'Type a message to get started'}
              </p>
            </div>
            {voiceMode && voice.isSupported && (
              <div className='flex items-center gap-1.5 text-xs text-[#00F0FF]'>
                <Sparkles className='w-3.5 h-3.5' />
                Voice mode active — responses will be read aloud
              </div>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={['flex', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
          >
            <div
              className={[
                'max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-[#00F0FF]/15 text-[#E8E8F0] rounded-tr-sm'
                  : 'bg-[#0C0C18] text-[#E8E8F0] border border-[#00F0FF]/10 rounded-tl-sm',
              ].join(' ')}
            >
              <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              <p className='text-[9px] text-[#6B7280] mt-1 text-right'>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className='flex justify-start'>
            <div className='bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl rounded-tl-sm px-3 py-2'>
              <div className='flex gap-1 items-center h-4'>
                <span className='w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-bounce' style={{ animationDelay: '0ms' }} />
                <span className='w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-bounce' style={{ animationDelay: '150ms' }} />
                <span className='w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-bounce' style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {interimText && (
          <div className='flex justify-end'>
            <div className='max-w-[80%] px-3 py-2 rounded-xl text-sm bg-[#00F0FF]/5 text-[#6B7280] border border-dashed border-[#00F0FF]/20 italic'>
              {interimText}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className='px-4 py-3 border-t border-[#00F0FF]/10 flex-shrink-0'>
        {voice.error && (
          <p className='text-xs text-red-400 mb-2'>{voice.error}</p>
        )}
        <form onSubmit={handleSubmit} className='flex items-center gap-2'>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={voice.isListening ? 'Listening...' : 'Message ' + agentName + '...'}
            disabled={isTyping}
            className='flex-1 bg-[#0C0C18] border-[#00F0FF]/20 text-[#E8E8F0] placeholder:text-[#4B5563] focus:border-[#00F0FF]/40 h-10'
          />
          <VoiceButton
            onTranscript={handleTranscript}
            isListening={voice.isListening}
            isProcessing={isTyping && input === ''}
            isSupported={voice.isSupported}
            onClick={voice.startListening}
          />
          <Button
            type='submit'
            disabled={!input.trim() || isTyping}
            className='bg-[#00F0FF] hover:bg-[#00D4B0] text-black h-10 px-3 min-w-[44px]'
          >
            <Send className='w-4 h-4' />
          </Button>
        </form>
        <p className='text-[9px] text-[#4B5563] mt-1.5 text-center'>
          Press Alt+V from anywhere to open voice chat instantly
        </p>
      </div>
    </div>
  );
}
