import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { PageShell } from '@/components/agentin';

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

function StarRating({ score, onRate }: { score: number | null; onRate: (s: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => {
        const active = hovered !== null ? s <= hovered : score !== null && s <= score;
        return (
          <button
            key={s}
            onClick={() => onRate(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(null)}
            className="transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 rounded"
            aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
          >
            <Star
              size={20}
              className={active ? 'fill-yellow-400 text-yellow-400' : 'text-[#F4F6FF]/30 hover:text-yellow-300'}
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
    } catch {
      // silent — optimistic update shown
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }));
    }
  }, []);

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <PageShell spacing={4}>
    <div className="min-w-0 overflow-x-hidden">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center">
          <MessageSquare size={20} className="text-[var(--ag-violet)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#F4F6FF]">Conversation Ratings</h1>
          <p className="text-sm text-[#F4F6FF]/50">{total} conversations — rate quality to improve your AI</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-[#F4F6FF]/40">Loading conversations…</div>
      )}

      {error && (
        <div className="text-red-400 text-sm py-4">{error}</div>
      )}

      {!loading && !error && conversations.length === 0 && (
        <div className="text-center py-12 text-[#F4F6FF]/40">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p>No conversations yet. Chat with your agent to get started.</p>
        </div>
      )}

      {!loading && conversations.map(conv => (
        <Card key={conv.id} className="bg-[var(--ag-bg-surface)] border-[#00F0FF]/10">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#F4F6FF]/40 mb-1">{formatDate(conv.createdAt)}</p>
                {conv.userMessage && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-[var(--ag-cyan)] uppercase tracking-wide">You</span>
                    <p className="text-sm text-[#F4F6FF]/70 mt-0.5">{truncate(conv.userMessage, 200)}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-[var(--ag-violet)] uppercase tracking-wide">Agent</span>
                  <p className="text-sm text-[#F4F6FF]/90 mt-0.5">{truncate(conv.assistantMessage, 300)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[#00F0FF]/5">
              <div className="flex items-center gap-2">
                {conv.model && (
                  <Badge variant="outline" className="text-xs text-[#F4F6FF]/40 border-[#00F0FF]/10">
                    {conv.model}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#F4F6FF]/30">Rate:</span>
                <StarRating
                  score={conv.qualityScore}
                  onRate={(s) => !busy[conv.id] && void handleRate(conv.id, s)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => void load(page - 1)}
            className="border-[#00F0FF]/10 text-[#F4F6FF]/70"
          >
            Previous
          </Button>
          <span className="text-sm text-[#F4F6FF]/40">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => void load(page + 1)}
            className="border-[#00F0FF]/10 text-[#F4F6FF]/70"
          >
            Next
          </Button>
        </div>
      )}
    </div>
    </PageShell>
  );
}
