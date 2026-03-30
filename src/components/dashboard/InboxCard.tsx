import { useState, useEffect, useCallback } from 'react';
import { Inbox, ArrowRight, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { memoryService } from '@/services/api';

interface InboxMessage {
  id: string;
  content: string;
  role: string;
  createdAt: string;
}

interface InboxCardProps {
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function InboxCard({ onNavigate, onOpenChat }: InboxCardProps) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await memoryService.conversations(10);
      const convos = res.data;
      if (Array.isArray(convos)) {
        // Get only assistant responses as "inbox" items
        const assistantMsgs = convos
          .filter((c: InboxMessage) => c.role === 'assistant')
          .slice(0, 3)
          .map((c: InboxMessage) => ({
            id: c.id,
            content: c.content,
            role: c.role,
            createdAt: c.createdAt || new Date().toISOString(),
          }));
        setMessages(assistantMsgs);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const unreadCount = messages.length;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2
            className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Inbox
          </h2>
          {!loading && unreadCount > 0 && (
            <span
              className="inline-flex items-center justify-center text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1"
              style={{ background: '#8B5CF6', color: '#05050A' }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={() => onNavigate?.('inbox')}
          className="flex items-center gap-1 text-xs text-[#8892A4] hover:text-[#8B5CF6] transition-colors"
        >
          Open Inbox
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <Card
        className="border-[#8B5CF6]/10 bg-[#0C0C18] rounded-2xl overflow-hidden"
        style={{ background: '#0C0C18' }}
      >
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-[#8B5CF6]/5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 flex items-start gap-3">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length > 0 ? (
            <>
              <div className="divide-y divide-[#8B5CF6]/5">
                {messages.map((msg) => {
                  const agentColors = ['#8B5CF6', '#BF5FFF', '#00FF88'];
                  const colorIdx = msg.id.charCodeAt(0) % agentColors.length;
                  const color = agentColors[colorIdx];
                  return (
                    <button
                      key={msg.id}
                      onClick={() => onOpenChat?.()}
                      className="w-full p-4 flex items-start gap-3 text-left hover:bg-[#8B5CF6]/[0.03] transition-colors group"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                        style={{
                          background: `${color}15`,
                          color,
                          border: `1.5px solid ${color}30`,
                        }}
                      >
                        A
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F4F6FF] truncate group-hover:text-[#8B5CF6] transition-colors leading-snug">
                          {msg.content.length > 70
                            ? msg.content.slice(0, 67) + '...'
                            : msg.content}
                        </p>
                        <span className="text-xs text-[#8892A4] mt-0.5 block">
                          {relativeTime(msg.createdAt)}
                        </span>
                      </div>
                      {/* Unread dot */}
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                        style={{ background: '#8B5CF6' }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="p-3 border-t border-[#8B5CF6]/5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-[#8B5CF6] hover:bg-[#8B5CF6]/10 text-xs"
                  onClick={() => onNavigate?.('inbox')}
                >
                  <Inbox className="w-3.5 h-3.5 mr-1.5" />
                  Open Inbox
                </Button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(139,92,246,0.08)' }}
              >
                <MessageSquare className="w-6 h-6 text-[#8B5CF6]/30" />
              </div>
              <p className="text-sm font-medium text-[#F4F6FF] mb-1">
                Inbox is clear
              </p>
              <p className="text-xs text-[#8892A4] mb-3">
                Start a conversation to see responses here
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#8B5CF6] hover:bg-[#8B5CF6]/10"
                onClick={() => onOpenChat?.()}
              >
                <MessageSquare className="w-3.5 h-3.5 mr-1" />
                Start a chat
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
