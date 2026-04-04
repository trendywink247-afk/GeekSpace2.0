import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { DashboardPageWrapper, PageHeader, SectionCard } from '@/components/agentin';
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
            className="transition-all duration-300 min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:ring-[var(--ag-focus-ring)] focus-visible:outline-none rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ag-active-bg)] hover:scale-110"
            aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
          >
            <Star
              size={20}
              className={active ? 'fill-[var(--ag-amber)] text-[var(--ag-amber)]' : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-amber)]/60'}
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
    <DashboardPageWrapper className="min-h-screen px-4 py-6 max-w-4xl mx-auto" delay={100}>
      {/* Weebo indicator */}
      <div className="absolute top-6 right-6 w-3 h-3 rounded-full bg-[var(--ag-weebo)] shadow-[var(--ag-glow-sm)] animate-pulse" aria-hidden="true" />

      <BlurFade delay={0}>
        <PageHeader
          icon={MessageSquare}
          title="Conversation Ratings"
          subtitle={`${total} conversations — rate quality to improve your AI`}
          badge={
            total > 0 ? (
              <Badge className="bg-[var(--ag-active-bg)] text-[var(--ag-cyan)] border-[var(--ag-border-glow)] text-xs font-medium">
                {total}
              </Badge>
            ) : undefined
          }
        />
      </BlurFade>

      <div className="mt-6 space-y-4">
        {loading && (
          <BlurFade delay={0.1}>
            <SectionCard className="text-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[var(--ag-border-default)] border-t-[var(--ag-cyan)] rounded-full animate-spin"></div>
                <p className="text-[var(--ag-text-secondary)] text-sm">Loading conversations...</p>
              </div>
            </SectionCard>
          </BlurFade>
        )}

        {error && (
          <BlurFade delay={0.1}>
            <SectionCard className="border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </SectionCard>
          </BlurFade>
        )}

        {!loading && !error && conversations.length === 0 && (
          <BlurFade delay={0.1}>
            <SectionCard className="text-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--ag-active-bg)] flex items-center justify-center">
                  <MessageSquare size={24} className="text-[var(--ag-text-muted)]" />
                </div>
                <div>
                  <h3 className="font-heading text-lg text-[var(--ag-text-primary)] mb-1">No conversations yet</h3>
                  <p className="text-[var(--ag-text-secondary)] text-sm">Chat with your agent to get started.</p>
                </div>
              </div>
            </SectionCard>
          </BlurFade>
        )}
      </div>

      <div className="space-y-4">
        {!loading && conversations.map((conv, i) => (
          <BlurFade key={conv.id} delay={0.1 + i * 0.05}>
            <SectionCard className="hover:shadow-[var(--ag-glow-sm)] transition-all duration-300">
              <div className="space-y-4">
                {/* Timestamp */}
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/40"></div>
                  <time className="text-xs text-[var(--ag-text-muted)] font-mono">{formatDate(conv.createdAt)}</time>
                </div>

                {/* Messages */}
                <div className="space-y-3">
                  {conv.userMessage && (
                    <div className="relative pl-4 border-l-2 border-[var(--ag-border-subtle)]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-[var(--ag-cyan)] uppercase tracking-wider">You</span>
                      </div>
                      <p className="text-sm text-[var(--ag-text-primary)]/80 leading-relaxed">{truncate(conv.userMessage, 200)}</p>
                    </div>
                  )}
                  <div className="relative pl-4 border-l-2 border-[var(--ag-violet)]/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[var(--ag-violet)] uppercase tracking-wider">Agent</span>
                    </div>
                    <p className="text-sm text-[var(--ag-text-primary)] leading-relaxed">{truncate(conv.assistantMessage, 300)}</p>
                  </div>
                </div>

                {/* Metadata & Rating */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-[var(--ag-border-subtle)]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {conv.model && (
                      <Badge variant="outline" className="text-xs text-[var(--ag-text-secondary)] border-[var(--ag-border-default)] bg-[var(--ag-bg-surface)] font-mono">
                        {conv.model}
                      </Badge>
                    )}
                    {conv.qualityScore !== null && (
                      <Badge className="bg-[var(--ag-active-bg)] text-[var(--ag-amber)] border-[var(--ag-border-glow)] text-xs font-medium">
                        ★ {conv.qualityScore}/5
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--ag-text-secondary)] font-medium">Rate quality:</span>
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
      </div>

      {totalPages > 1 && (
        <BlurFade delay={0.3}>
          <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-[var(--ag-border-subtle)]">
            <Button
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => void load(page - 1)}
              className="min-h-[44px] px-6 border-[var(--ag-border-default)] text-[var(--ag-text-primary)] hover:bg-[var(--ag-active-bg)] hover:border-[var(--ag-border-glow)] hover:shadow-[var(--ag-glow-sm)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <ChevronLeft size={16} className="mr-2 group-hover:-translate-x-0.5 transition-transform" />
              Previous
            </Button>
            
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)]">
              <span className="text-sm text-[var(--ag-text-secondary)] font-medium">Page</span>
              <span className="text-sm text-[var(--ag-text-primary)] font-mono font-bold">{page}</span>
              <span className="text-sm text-[var(--ag-text-muted)]">/</span>
              <span className="text-sm text-[var(--ag-text-secondary)] font-mono">{totalPages}</span>
            </div>
            
            <Button
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => void load(page + 1)}
              className="min-h-[44px] px-6 border-[var(--ag-border-default)] text-[var(--ag-text-primary)] hover:bg-[var(--ag-active-bg)] hover:border-[var(--ag-border-glow)] hover:shadow-[var(--ag-glow-sm)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              Next
              <ChevronRight size={16} className="ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </BlurFade>
      )}
    </DashboardPageWrapper>
  );
}
