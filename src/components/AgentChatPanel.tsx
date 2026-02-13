import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, Mic, Paperclip, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { agentService } from '@/services/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

interface AgentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: agent belongs to another user (portfolio chat mode) */
  agentOwner?: string;
}

const suggestedPrompts = [
  "What's on my schedule today?",
  "Show me my usage stats",
  "Create a reminder for tomorrow",
  "Help me with a code review",
];

export function AgentChatPanel({ isOpen, onClose, agentOwner }: AgentChatPanelProps) {
  const user = useAuthStore((s) => s.user);
  const agent = useDashboardStore((s) => s.agent);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ownerName = agentOwner || user?.name?.split(' ')[0] || 'Alex';

  // Initialize with greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'greeting',
          role: 'agent',
          content: `Hey${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! I'm ${ownerName}'s AI assistant. How can I help you today?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length, ownerName, user?.name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = (text?: string) => {
    const content = text || input.trim();
    if (!content) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Call real backend API
    (async () => {
      try {
        const { data } = await agentService.chat(content);
        const agentMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      } catch {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: "Sorry, I couldn't process that right now. Please try again.",
          timestamp: new Date(),
        }]);
      } finally {
        setIsTyping(false);
      }
    })();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] md:bg-transparent md:backdrop-blur-none" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full md:w-[420px] bg-[#0B0B10] border-l border-[#7B61FF]/20 shadow-2xl shadow-[#7B61FF]/10 z-[61] transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#7B61FF]/20 bg-[#05050A]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#61FF7B] border-2 border-[#05050A]" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#F4F6FF]">{agent.displayName || `${ownerName}'s AI`}</div>
              <div className="text-xs text-[#61FF7B] flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Online
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={resetChat}
              className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors"
              title="Reset chat"
            >
              <RotateCcw className="w-4 h-4 text-[#A7ACB8]" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors"
            >
              <X className="w-5 h-5 text-[#A7ACB8]" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'agent' && (
                <div className="w-7 h-7 rounded-full bg-[#7B61FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5 text-[#7B61FF]" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#7B61FF] text-white rounded-br-md'
                    : 'bg-[#05050A] text-[#F4F6FF] border border-[#7B61FF]/20 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-[#7B61FF]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 text-[#7B61FF]" />
              </div>
              <div className="bg-[#05050A] border border-[#7B61FF]/20 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-[#7B61FF]/60"
                      style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Suggested prompts (show when only greeting) */}
          {messages.length <= 1 && !isTyping && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-[#A7ACB8] uppercase tracking-wider">Suggestions</p>
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="block w-full text-left px-4 py-2.5 rounded-xl bg-[#05050A] border border-[#7B61FF]/20 text-sm text-[#A7ACB8] hover:text-[#F4F6FF] hover:border-[#7B61FF]/40 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#7B61FF]/20 bg-[#05050A]">
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors" title="Attach file">
              <Paperclip className="w-4 h-4 text-[#A7ACB8]" />
            </button>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className="flex-1 bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF] rounded-xl"
            />
            <button className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors" title="Voice input">
              <Mic className="w-4 h-4 text-[#A7ACB8]" />
            </button>
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              className="bg-[#7B61FF] hover:bg-[#6B51EF] rounded-xl px-3"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-[#A7ACB8]/50 text-center mt-2">
            Powered by OpenClaw &middot; {agent.primaryModel}
          </p>
        </div>
      </div>
    </>
  );
}
