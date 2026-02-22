import { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { portfolioService } from '@/services/api';

interface AgentToAgentChatProps {
  isOpen: boolean;
  onClose: () => void;
  targetUsername: string;
  targetName: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
}

export function AgentToAgentChat({ isOpen, onClose, targetUsername, targetName }: AgentToAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [canChat, setCanChat] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if we can chat with this agent
  useEffect(() => {
    if (isOpen && targetUsername) {
      portfolioService.canChat(targetUsername)
        .then(({ data }) => {
          setCanChat(data.canChat);
          if (!data.canChat) {
            setError('This user has not enabled agent chat');
          }
        })
        .catch(() => {
          setCanChat(false);
          setError('Unable to check chat permissions');
        });
    }
  }, [isOpen, targetUsername]);

  // Initialize with greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'greeting',
          role: 'agent',
          content: `Hi! I'm reaching out to ${targetName}'s agent. What would you like to say?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length, targetName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isSending || !canChat) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);
    setError(null);

    try {
      await portfolioService.sendAgentMessage(targetUsername, content);
      setMessages((prev) => [...prev, {
        id: `confirm-${Date.now()}`,
        role: 'system',
        content: 'Message sent successfully!',
        timestamp: new Date(),
      }]);
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send message';
      setError(errorMsg);
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#0A0A0F] border border-[#00FFD4]/30 rounded-2xl shadow-2xl shadow-[#00FFD4]/10 flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#00FFD4]/20 bg-[#030304] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00FF88] to-[#00FFD4] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#00FF88] border-2 border-[#030304]" />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#E8E8F0]">Agent Chat</div>
              <div className="text-xs text-[#00FF88] flex items-center gap-1">
                Messaging {targetName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#00FFD4]/10 transition-colors"
          >
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
            >
              {msg.role === 'system' ? (
                <div className={`px-3 py-1.5 rounded-full text-[10px] flex items-center gap-1 ${
                  msg.content.includes('Error') || msg.content.includes('Unable') || msg.content.includes('not enabled')
                    ? 'bg-[#FF3366]/10 border border-[#FF3366]/20 text-[#FF3366]'
                    : 'bg-[#00FF88]/10 border border-[#00FF88]/20 text-[#00FF88]'
                }`}>
                  {msg.content.includes('sent') && <CheckCircle2 className="w-3 h-3" />}
                  {msg.content}
                </div>
              ) : (
                <>
                  {msg.role === 'agent' && (
                    <div className="w-7 h-7 rounded-full bg-[#00FF88]/20 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-[#00FF88]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#00FFD4] text-white rounded-br-md'
                        : 'bg-[#030304] text-[#E8E8F0] border border-[#00FFD4]/20 rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-[#00FFD4]/20 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-[#00FFD4]" />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[#00FFD4]/20 bg-[#030304] rounded-b-2xl">
          {canChat === false ? (
            <div className="text-center py-2 text-sm text-[#6B7280]">
              {error || 'Agent chat is not enabled for this user'}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${targetName}'s agent...`}
                disabled={isSending || canChat === null}
                className="flex-1 bg-[#0A0A0F] border-[#00FFD4]/30 text-[#E8E8F0] rounded-xl"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isSending || canChat === null}
                className="bg-[#00FF88] hover:bg-[#51EF6B] text-black rounded-xl px-3"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}
          <p className="text-[10px] text-[#6B7280]/50 text-center mt-2">
            Messages are stored and delivered to the recipient&apos;s agent inbox
          </p>
        </div>
      </div>
    </div>
  );
}
