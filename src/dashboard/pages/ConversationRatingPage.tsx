import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { BlurFade } from '@/components/magicui/blur-fade';

interface Conversation {
  id: string;
  userMessage: string;
  assistantMessage: string;
  provider: string;
  model: string;
  qualityScore: number | null;
  createdAt: string;
}

interface ConversationResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function StarRating({ score, onRate, disabled }: { score: number | null; onRate: (s: number) => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => {
        const active = hovered !== null ? s <= hovered : score !== null && s <= score;
        return (
          <button
            key={s}
            onClick={() => !disabled && onRate(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(null)}
            disabled={disabled}
            className="transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
          >
            <Star
              size={20}
              className={active ? 'fill-yellow-400 text-yellow-400' : 'text-[var(--ag-text-primary,#F4F6FF)]/30 hover:text-yellow-300'}
            />
          </button>
        );
      })}
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + '\u2026';
}

export function ConversationRatingPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'weebo', page: 'conversation-rating' });

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ConversationResponse>(`/agent/conversations/ratings?page=${p}&limit=20`);
      setConversations(res.data.conversations);
      setTotalPages(res.data.totalPages);
      setTotal(res.data.total);
      setPage(res.data.page);
    } catch {
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(1); }, [load]);

  const handleRate = useCallback(async (id: string, score: number) => {
    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      await api.post(`/agent/conversations/${id}/rating`, { score });
      setConversations(prev =>
        prev.map(c => c.id === id ? { ...c, qualityScore: score } : c)
      );
      void notifyDone(`Rated conversation ${score}/5`);
    } catch {
      void notifyFail('Failed to save rating');
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }));
    }
  }, [notifyDone, notifyFail]);

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <PageShell spacing={4}>
      {/* Weebo dot */}
      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_6px_rgba(0,240,255,0.4)]" aria-hidden="true" />

      <PageHeader
        icon={MessageSquare}
        title="Conversation Ratings"
        subtitle={`${total} conversations — rate quality to improve your AI`}
        badge={
          total > 0 ? (
            <Badge className="bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/20 text-xs">
              {total}
            </Badge>
          ) : undefined
        }
      />

      {loading && (
        <BlurFade delay={0.1}>
          <div className="flex items-center justify-center py-12 text-[var(--ag-text-secondary,#9CA3AF)]">Loading conversations...</div>
        </BlurFade>
      )}

      {error && (
        <BlurFade delay={0.1}>
          <SectionCard>
            <div className="text-red-400 text-sm py-4">{error}</div>
          </SectionCard>
        </BlurFade>
      )}

      {!loading && !error && conversations.length === 0 && (
        <BlurFade delay={0.1}>
          <SectionCard>
            <div className="text-center py-12 text-[var(--ag-text-secondary,#9CA3AF)]">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p>No conversations yet. Chat with your agent to get started.</p>
            </div>
          </SectionCard>
        </BlurFade>
      )}

      {!loading && conversations.map((conv, i) => (
        <BlurFade key={conv.id} delay={0.05 + i * 0.03}>
          <SectionCard>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--ag-text-secondary,#9CA3AF)] mb-1">{formatDate(conv.createdAt)}</p>
                  {conv.userMessage && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-[#00F0FF] uppercase tracking-wide">You</span>
                      <p className="text-sm text-[var(--ag-text-primary,#F4F6FF)]/70 mt-0.5">{truncate(conv.userMessage, 200)}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-[#8B5CF6] uppercase tracking-wide">Agent</span>
                    <p className="text-sm text-[var(--ag-text-primary,#F4F6FF)]/90 mt-0.5">{truncate(conv.assistantMessage, 300)}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-[rgba(139,92,246,0.08)]">
                <div className="flex items-center gap-2">
                  {conv.model && (
                    <Badge variant="outline" className="text-xs text-[var(--ag-text-secondary,#9CA3AF)] border-[rgba(139,92,246,0.15)]">
                      {conv.model}
                    </Badge>
                  )}
                  {conv.qualityScore !== null && (
                    <Badge className="bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/20 text-xs">
                      {conv.qualityScore}/5
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--ag-text-secondary,#9CA3AF)]">Rate:</span>
                  <StarRating
                    score={conv.qualityScore}
                    onRate={(s) => void handleRate(conv.id, s)}
                    disabled={busy[conv.id]}
                  />
                </div>
              </div>
            </div>
          </SectionCard>
        </BlurFade>
      ))}

      {totalPages > 1 && (
        <BlurFade delay={0.2}>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => void load(page - 1)}
              className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary,#F4F6FF)] hover:bg-[#8B5CF6]/10 min-h-[44px] min-w-[44px]"
            >
              <ChevronLeft size={16} className="mr-1" />
              Previous
            </Button>
            <span className="text-sm text-[var(--ag-text-secondary,#9CA3AF)]">Page {page} of {totalPages}</span>
            <Button
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => void load(page + 1)}
              className="border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary,#F4F6FF)] hover:bg-[#8B5CF6]/10 min-h-[44px] min-w-[44px]"
            >
              Next
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </BlurFade>
      )}
    </PageShell>
  );
}
