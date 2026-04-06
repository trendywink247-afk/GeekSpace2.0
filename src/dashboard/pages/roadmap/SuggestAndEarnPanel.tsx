// ============================================================
// SuggestAndEarnPanel — Suggest & Earn section + all dialogs
// Owns: form state, editing state, detail state, delete state
// Receives: fetched suggestion data + vote handler from parent
// ============================================================

import { useState } from 'react';
import {
  Lightbulb,
  TrendingUp,
  Layers,
  Gift,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Trash2,
  Pencil,
  ChevronDown,
  Star,
  ArrowRight,
} from 'lucide-react';
import { SectionCard } from '@/components/agentin';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { suggestionService } from '@/services/api';
import {
  getStatusColor,
  getStatusLabel,
  getRewardLabel,
  type Suggestion,
  type Reward,
  type Cluster,
} from './helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VoteEntry {
  upvotes: number;
  downvotes: number;
  voting: boolean;
}

interface SuggestAndEarnPanelProps {
  mySuggestions: Suggestion[];
  setMySuggestions: React.Dispatch<React.SetStateAction<Suggestion[]>>;
  myRewards: Reward[];
  topClusters: Cluster[];
  loadingSuggestions: boolean;
  loadError: string;
  voteState: Record<string, VoteEntry>;
  onVote: (id: string) => void;
  suggestionOpen: boolean;
  setSuggestionOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SuggestAndEarnPanel({
  mySuggestions,
  setMySuggestions,
  myRewards,
  topClusters,
  loadingSuggestions,
  loadError,
  voteState,
  onVote,
  suggestionOpen,
  setSuggestionOpen,
}: SuggestAndEarnPanelProps) {
  // ── Submit form ──────────────────────────────────────────────────────
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formTags, setFormTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [similarTitle, setSimilarTitle] = useState('');

  // ── List display ─────────────────────────────────────────────────────
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  // ── Detail modal ─────────────────────────────────────────────────────
  const [detailSuggestion, setDetailSuggestion] = useState<Suggestion | null>(null);
  const [detailEvents, setDetailEvents] = useState<
    Array<{ id: string; oldStatus: string; newStatus: string; changedAt: string }>
  >([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // ── Delete dialog ────────────────────────────────────────────────────
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Edit dialog ──────────────────────────────────────────────────────
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!formTitle.trim() || formBody.trim().length < 20) {
      setSubmitError('Title required; description must be at least 20 characters.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const tags = formTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5);
      const res = await suggestionService.create({ title: formTitle.trim(), body: formBody.trim(), tags });
      if (res.data.duplicate_warning) {
        setDuplicateWarning(true);
        if (res.data.similar_title) setSimilarTitle(res.data.similar_title);
      }
      setSubmitSuccess(true);
      setMySuggestions((prev) => [
        { id: res.data.id, title: res.data.title, body: res.data.body, status: res.data.status, created_at: res.data.created_at },
        ...prev,
      ]);
      setFormTitle('');
      setFormBody('');
      setFormTags('');
      setTimeout(() => {
        setSuggestionOpen(false);
        setSubmitSuccess(false);
        setDuplicateWarning(false);
        setSimilarTitle('');
      }, 3000);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to submit. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteDialogId(null);
    setDeletingId(id);
    try {
      await suggestionService.delete(id);
      setMySuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // non-fatal
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = async () => {
    if (!editingSuggestion) return;
    if (!editTitle.trim() || editBody.trim().length < 20) {
      setEditError('Title required; description must be at least 20 characters.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await suggestionService.update(editingSuggestion.id, {
        title: editTitle.trim(),
        body: editBody.trim(),
      });
      setMySuggestions((prev) =>
        prev.map((s) =>
          s.id === editingSuggestion.id
            ? { ...s, title: res.data.title, body: res.data.body }
            : s,
        ),
      );
      setEditingSuggestion(null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to save. Please try again.';
      setEditError(message);
    } finally {
      setEditSaving(false);
    }
  };

  const openDetail = (s: Suggestion) => {
    setDetailSuggestion(s);
    setDetailEvents([]);
    setLoadingEvents(true);
    suggestionService
      .events(s.id)
      .then((res) => setDetailEvents(res.data.events))
      .catch(() => {})
      .finally(() => setLoadingEvents(false));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const visibleSuggestions = showAllSuggestions ? mySuggestions : mySuggestions.slice(0, 5);

  return (
    <>
      <SectionCard padding="lg">
        {/* ── Header + submit button ────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="w-5 h-5 text-[#EC4899]" />
              <h3 className="text-lg font-semibold text-[var(--ag-text-primary)]">Suggest &amp; Earn</h3>
            </div>
            <p className="text-sm text-[var(--ag-text-secondary)]">
              Submit feature ideas. Earn credits when they&apos;re accepted, shipped, or go live.
            </p>
            <div className="flex gap-4 mt-2 text-xs text-[var(--ag-text-secondary)]">
              <span className="flex items-center gap-1">
                <span className="text-[#00FF88] font-bold">+10</span> Accepted
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[#BF5FFF] font-bold">+50</span> Shipped
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[#F59E0B] font-bold">+100</span> Live
              </span>
            </div>
          </div>

          <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold gap-2 shrink-0 transition-[transform,background-color] duration-150 active:scale-[0.96] min-h-[44px]">
                <Lightbulb className="w-4 h-4" />
                Suggest a Feature
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)]">
              <DialogHeader>
                <DialogTitle className="text-[var(--ag-text-primary)] flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-[#EC4899]" />
                  Suggest a Feature
                </DialogTitle>
              </DialogHeader>
              {submitSuccess ? (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#00FF88]/20 flex items-center justify-center mx-auto mb-4">
                    <Star className="w-8 h-8 text-[#00FF88]" />
                  </div>
                  <p className="text-[#00FF88] font-semibold text-lg">Submitted!</p>
                  {duplicateWarning && (
                    <p className="text-xs text-[#F59E0B] mt-2">
                      Similar to &quot;{similarTitle || 'an existing idea'}&quot; — we&apos;ll merge them.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {duplicateWarning && (
                    <div className="px-3 py-2 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-xs text-[#F59E0B]">
                      Similar to &quot;{similarTitle || 'an existing idea'}&quot; — yours will be merged with it.
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-[var(--ag-text-primary)] text-sm">
                      Title <span className="text-[#FF2D78]">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Dark mode calendar view"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      maxLength={100}
                      className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[var(--ag-text-primary)] text-sm">
                      Description <span className="text-[#FF2D78]">*</span>{' '}
                      <span className="text-[var(--ag-text-secondary)] font-normal">(min 20 chars)</span>
                    </Label>
                    <Textarea
                      placeholder="Describe the feature and why it would be useful..."
                      value={formBody}
                      onChange={(e) => setFormBody(e.target.value)}
                      rows={4}
                      className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] resize-none"
                    />
                    <p className="text-right text-xs text-[var(--ag-text-secondary)]">
                      {formBody.length}/2000
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[var(--ag-text-primary)] text-sm">
                      Tags{' '}
                      <span className="text-[var(--ag-text-secondary)] font-normal">
                        (comma-separated, max 5)
                      </span>
                    </Label>
                    <Input
                      placeholder="e.g. calendar, mobile, ai"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
                    />
                  </div>
                  {submitError && (
                    <p className="text-xs text-[var(--ag-pink)]">{submitError}</p>
                  )}
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={submitting || !formTitle.trim() || formBody.trim().length < 20}
                    className="w-full bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 text-white font-semibold min-h-[44px]"
                  >
                    {submitting ? 'Submitting\u2026' : 'Submit Idea'}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* ── My Suggestions ────────────────────────────────────── */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold font-heading text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--ag-nova)]" />
            My Suggestions
            {mySuggestions.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--ag-nova)]/15 text-[var(--ag-nova)] text-xs font-bold border border-[var(--ag-nova)]/30">
                {mySuggestions.length}
              </span>
            )}
          </h4>

          {loadError && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-[var(--ag-pink)]/10 border border-[var(--ag-pink)]/30 text-xs text-[var(--ag-pink)]">
              {loadError}
            </div>
          )}

          {loadingSuggestions ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] animate-pulse"
                >
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-[var(--ag-violet)]/6 rounded w-3/4" />
                    <div className="h-2.5 bg-[var(--ag-violet)]/4 rounded w-1/2" />
                  </div>
                  <div className="h-6 w-16 bg-[var(--ag-violet)]/6 rounded-full" />
                </div>
              ))}
            </div>
          ) : mySuggestions.length === 0 ? (
            <p className="text-xs text-[var(--ag-text-secondary)]">
              No suggestions yet. Be the first to suggest a feature!
            </p>
          ) : (
            <div className="space-y-2">
              {visibleSuggestions.map((s) => {
                const vs = voteState[s.id];
                const upvotes = vs?.upvotes ?? (s.upvotes ?? 0);
                const downvotes = vs?.downvotes ?? (s.downvotes ?? 0);
                const statusColor = getStatusColor(s.status);

                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--ag-text-primary)] truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[var(--ag-text-secondary)]">
                          {new Date(s.created_at).toLocaleDateString()}
                        </p>
                        <span className="flex items-center gap-0.5 text-xs text-[var(--ag-violet)] tabular-nums">
                          <ThumbsUp className="w-2.5 h-2.5" /> {upvotes}
                        </span>
                        {downvotes > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-[var(--ag-pink)]">
                            <ThumbsDown className="w-2.5 h-2.5" /> {downvotes}
                          </span>
                        )}
                        {s.trending === 1 && (
                          <span className="text-xs text-[var(--ag-amber)] font-semibold">
                            trending
                          </span>
                        )}
                      </div>
                    </div>

                    {/* View detail */}
                    <button
                      onClick={() => openDetail(s)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--ag-violet)]/10 hover:bg-[var(--ag-violet)]/20 text-[var(--ag-violet)] text-xs font-medium transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] justify-center"
                      aria-label="View details"
                    >
                      <Eye className="w-3 h-3" />
                    </button>

                    {/* Upvote */}
                    <button
                      onClick={() => onVote(s.id)}
                      disabled={vs?.voting}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--ag-nova)]/10 hover:bg-[var(--ag-nova)]/20 text-[var(--ag-nova)] text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0 min-w-[44px] min-h-[44px] justify-center"
                      aria-label="Upvote this suggestion"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>{upvotes}</span>
                    </button>

                    {/* Edit (new status only) */}
                    {s.status === 'new' && (
                      <button
                        onClick={() => {
                          setEditingSuggestion(s);
                          setEditTitle(s.title);
                          setEditBody(s.body);
                          setEditError('');
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-transparent hover:bg-[var(--ag-violet)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-violet)] text-xs transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] justify-center"
                        aria-label="Edit suggestion"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}

                    {/* Delete (new status only) */}
                    {s.status === 'new' && (
                      <button
                        onClick={() => setDeleteDialogId(s.id)}
                        disabled={deletingId === s.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-transparent hover:bg-[var(--ag-pink)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-pink)] text-xs transition-colors disabled:opacity-50 flex-shrink-0 min-w-[44px] min-h-[44px] justify-center"
                        aria-label="Delete suggestion"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}

                    <span
                      className="text-xs px-2 py-0.5 rounded-full border flex-shrink-0"
                      style={{
                        color: statusColor,
                        borderColor: `${statusColor}40`,
                        backgroundColor: `${statusColor}15`,
                      }}
                    >
                      {getStatusLabel(s.status)}
                    </span>
                  </div>
                );
              })}

              {mySuggestions.length > 5 && (
                <button
                  onClick={() => setShowAllSuggestions((prev) => !prev)}
                  className="flex items-center gap-1.5 mx-auto mt-2 px-3 py-1.5 rounded-lg bg-[var(--ag-violet)]/5 hover:bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] text-xs font-medium transition-colors min-h-[44px]"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showAllSuggestions ? 'rotate-180' : ''}`}
                  />
                  {showAllSuggestions
                    ? 'Show less'
                    : `View all ${mySuggestions.length} suggestions`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Popular Ideas ─────────────────────────────────────── */}
        {topClusters.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold font-heading text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--ag-violet)]" />
              Popular Ideas
            </h4>
            <div className="space-y-2">
              {topClusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--ag-text-primary)] truncate">
                      {cluster.name ?? cluster.canonical_summary}
                    </p>
                    {cluster.name && cluster.name !== cluster.canonical_summary && (
                      <p className="text-xs text-[var(--ag-text-secondary)] truncate">
                        {cluster.canonical_summary}
                      </p>
                    )}
                  </div>
                  {cluster.total_votes !== undefined && (
                    <span className="flex items-center gap-1 text-xs text-[var(--ag-nova)] flex-shrink-0">
                      <ThumbsUp className="w-3 h-3" /> {cluster.total_votes}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Earned Credits ────────────────────────────────────── */}
        {myRewards.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold font-heading text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
              <Gift className="w-4 h-4 text-[var(--ag-amber)]" />
              Earned Credits
              <span className="text-[var(--ag-amber)] font-bold ml-auto">
                +{myRewards.reduce((sum, r) => sum + r.credits, 0)} credits
              </span>
            </h4>
            <div className="space-y-2">
              {myRewards.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-[var(--ag-amber)]/5 border border-[var(--ag-amber)]/20"
                >
                  <Gift className="w-4 h-4 text-[var(--ag-amber)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--ag-text-primary)]">
                      {getRewardLabel(r.eventType)}
                    </p>
                    <p className="text-xs text-[var(--ag-text-secondary)]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[var(--ag-amber)] flex-shrink-0">
                    +{r.credits}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Edit Suggestion Dialog ────────────────────────────────── */}
      {editingSuggestion && (
        <Dialog
          open={!!editingSuggestion}
          onOpenChange={(open) => {
            if (!open) setEditingSuggestion(null);
          }}
        >
          <DialogContent className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)]">
            <DialogHeader>
              <DialogTitle className="text-[var(--ag-text-primary)] flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#EC4899]" />
                Edit Suggestion
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[var(--ag-text-primary)] text-sm">Title</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={100}
                  className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--ag-text-primary)] text-sm">
                  Description{' '}
                  <span className="text-[var(--ag-text-secondary)] font-normal">(min 20 chars)</span>
                </Label>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={4}
                  className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)] text-[var(--ag-text-primary)] resize-none"
                />
                <p className="text-right text-xs text-[var(--ag-text-secondary)]">
                  {editBody.length}/2000
                </p>
              </div>
              {editError && <p className="text-xs text-[var(--ag-pink)]">{editError}</p>}
              <div className="flex gap-2">
                <Button
                  onClick={() => setEditingSuggestion(null)}
                  variant="outline"
                  className="flex-1 border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleEdit()}
                  disabled={editSaving || !editTitle.trim() || editBody.trim().length < 20}
                  className="flex-1 bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 text-white font-semibold min-h-[44px]"
                >
                  {editSaving ? 'Saving\u2026' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Suggestion Detail Dialog ──────────────────────────────── */}
      {detailSuggestion && (
        <Dialog
          open={!!detailSuggestion}
          onOpenChange={(open) => {
            if (!open) setDetailSuggestion(null);
          }}
        >
          <DialogContent className="bg-[var(--ag-bg-base)] border-[rgba(139,92,246,0.15)]">
            <DialogHeader>
              <DialogTitle className="text-lg text-[var(--ag-text-primary)] pr-8">
                {detailSuggestion.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs px-2 py-0.5 rounded-full border"
                  style={{
                    color: getStatusColor(detailSuggestion.status),
                    borderColor: `${getStatusColor(detailSuggestion.status)}40`,
                    backgroundColor: `${getStatusColor(detailSuggestion.status)}15`,
                  }}
                >
                  {getStatusLabel(detailSuggestion.status)}
                </span>
                <span className="text-xs text-[var(--ag-text-secondary)]">
                  Submitted{' '}
                  {new Date(detailSuggestion.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <div className="rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] p-4">
                <p className="text-sm text-[var(--ag-text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {detailSuggestion.body}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-[var(--ag-text-secondary)]">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-[#EC4899]" />
                  {voteState[detailSuggestion.id]?.upvotes ?? detailSuggestion.upvotes ?? 0} upvotes
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-[#FF6161] rotate-180" />
                  {voteState[detailSuggestion.id]?.downvotes ?? detailSuggestion.downvotes ?? 0}{' '}
                  downvotes
                </span>
              </div>

              {loadingEvents && (
                <p className="text-xs text-[var(--ag-text-secondary)]">Loading history...</p>
              )}
              {detailEvents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--ag-text-secondary)]">
                    Status History
                  </p>
                  <div className="space-y-1.5">
                    {detailEvents.map((ev) => (
                      <div key={ev.id} className="flex items-center gap-2 text-xs">
                        <span
                          className="px-1.5 py-0.5 rounded border"
                          style={{
                            color: getStatusColor(ev.oldStatus),
                            borderColor: `${getStatusColor(ev.oldStatus)}40`,
                            backgroundColor: `${getStatusColor(ev.oldStatus)}10`,
                          }}
                        >
                          {getStatusLabel(ev.oldStatus)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--ag-text-secondary)]" />
                        <span
                          className="px-1.5 py-0.5 rounded border"
                          style={{
                            color: getStatusColor(ev.newStatus),
                            borderColor: `${getStatusColor(ev.newStatus)}40`,
                            backgroundColor: `${getStatusColor(ev.newStatus)}10`,
                          }}
                        >
                          {getStatusLabel(ev.newStatus)}
                        </span>
                        <span className="text-[var(--ag-text-secondary)] ml-auto">
                          {new Date(ev.changedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete Confirmation Dialog ────────────────────────────── */}
      <Dialog
        open={!!deleteDialogId}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogId(null);
        }}
      >
        <DialogContent className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-default)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--ag-text-primary)] font-heading">
              <Trash2 className="w-5 h-5 text-[var(--ag-pink)]" />
              Delete this suggestion?
            </DialogTitle>
            <DialogDescription className="text-[var(--ag-text-secondary)]">
              This suggestion will be permanently removed and cannot be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogId(null)}
              className="min-h-[44px] text-[var(--ag-text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDialogId) void handleDelete(deleteDialogId);
              }}
              className="min-h-[44px]"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
