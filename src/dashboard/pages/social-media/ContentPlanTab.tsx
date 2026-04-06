// social-media/ContentPlanTab.tsx
// Content plan management — generate, activate, edit day items
import { useState, useEffect, useCallback } from 'react';
import { SectionCard } from '@/components/agentin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Sparkles, Target, CalendarDays, Wand2,
  CheckCircle, Trash2, Calendar, Edit3, Send,
  XCircle, Image, Film, Eye, Clock,
} from 'lucide-react';
import { socialMediaService } from '@/services/api';
import type { SocialAccount, ContentPlan, ContentPlanItem } from '@/services/api';
import { StatusBadge, StatusIcon, MiniCalendar } from './helpers';
import { PostComposer } from './PostComposer';

interface ContentPlanTabProps {
  onPostScheduled?: () => void;
}

export function ContentPlanTab({ onPostScheduled }: ContentPlanTabProps) {
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [activePlan, setActivePlan] = useState<ContentPlan | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  // Generate form
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('');

  // Activate form
  const [showActivate, setShowActivate] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [activating, setActivating] = useState(false);

  // Editing state
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editMediaId, setEditMediaId] = useState('');

  // Posting
  const [postingItem, setPostingItem] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [plansRes, accountsRes] = await Promise.all([
        socialMediaService.getPlans(),
        socialMediaService.getAccounts(),
      ]);
      setPlans(plansRes.data);
      setAccounts(accountsRes.data);
      if (plansRes.data.length > 0) {
        const planRes = await socialMediaService.getPlan(plansRes.data[0].id);
        setActivePlan(planRes.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await socialMediaService.generatePlan(topic, niche);
      setActivePlan(res.data);
      setTopic('');
      setNiche('');
      loadData();
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  };

  const handleActivate = async () => {
    if (!activePlan || !startDate || !selectedAccountId) return;
    setActivating(true);
    try {
      const res = await socialMediaService.activatePlan(activePlan.id, {
        start_date: startDate,
        social_account_id: selectedAccountId,
      });
      setActivePlan(res.data);
      setShowActivate(false);
      onPostScheduled?.();
      loadData();
    } catch {
      // silent
    } finally {
      setActivating(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!activePlan) return;
    try {
      await socialMediaService.deletePlan(activePlan.id);
      setActivePlan(null);
      loadData();
    } catch {
      // silent
    }
  };

  const handleSaveItem = async (item: ContentPlanItem) => {
    try {
      await socialMediaService.updatePlanItem(item.plan_id, item.id, {
        caption: editCaption,
        media_id: editMediaId || undefined,
      });
      setEditingItem(null);
      if (activePlan) {
        const res = await socialMediaService.getPlan(activePlan.id);
        setActivePlan(res.data);
      }
    } catch {
      // silent
    }
  };

  const handleToggleItem = async (item: ContentPlanItem) => {
    try {
      await socialMediaService.updatePlanItem(item.plan_id, item.id, {
        enabled: !item.enabled,
      });
      if (activePlan) {
        const res = await socialMediaService.getPlan(activePlan.id);
        setActivePlan(res.data);
      }
    } catch {
      // silent
    }
  };

  const handlePostNow = async (item: ContentPlanItem) => {
    setPostingItem(item.id);
    try {
      await socialMediaService.postItem(item.plan_id, item.id);
      onPostScheduled?.();
      if (activePlan) {
        const res = await socialMediaService.getPlan(activePlan.id);
        setActivePlan(res.data);
      }
    } catch {
      // silent
    } finally {
      setPostingItem(null);
    }
  };

  const selectPlan = async (plan: ContentPlan) => {
    try {
      const res = await socialMediaService.getPlan(plan.id);
      setActivePlan(res.data);
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF6B9D]" />
      </div>
    );
  }

  // ---- No plan view ----

  if (!activePlan) {
    return (
      <div className="space-y-4">
        {/* Empty state (no plans, composer hidden) */}
        {plans.length === 0 && !showComposer && (
          <div className="text-center py-10 px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--ag-violet)]/10 to-[var(--ag-gold)]/10 border border-[var(--ag-violet)]/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-[#FF6B9D]" />
            </div>
            <h3 className="text-base font-semibold text-[var(--ag-text-primary)] mb-1">
              Create your first social media post
            </h3>
            <p className="text-sm text-[var(--ag-text-muted)] max-w-md mx-auto mb-4">
              Describe your topic and I'll write 3 variations for different platforms, or generate
              a full 10-day content plan.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                size="sm"
                onClick={() => setShowComposer(true)}
                className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-gold)] text-white border-0 hover:opacity-90 min-h-[44px] transition-[transform,opacity] active:scale-[0.96]"
              >
                <Wand2 className="w-4 h-4 mr-1" /> Quick Post
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] min-h-[44px]"
              >
                <CalendarDays className="w-4 h-4 mr-1" /> Generate Plan
              </Button>
            </div>
          </div>
        )}

        {/* Post Composer */}
        {(showComposer || plans.length > 0) && (
          <PostComposer
            showCancel={showComposer && plans.length === 0}
            onHide={() => setShowComposer(false)}
          />
        )}

        {/* Content plan generator */}
        <SectionCard className="border-[var(--ag-violet)]/20 bg-[var(--ag-bg-surface)] backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-[var(--ag-violet)]" />
            <h2 className="text-sm font-semibold font-heading text-[var(--ag-text-primary)]">
              Generate 10-Day Content Plan
            </h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Topic</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., AI tools for developers"
                className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">Niche</label>
              <Input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g., Tech startups"
                className="bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)]"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating || !topic || !niche}
              className="w-full bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-gold)] text-white border-0 hover:opacity-90 min-h-[44px] transition-[transform,opacity] active:scale-[0.96]"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Generate Plan
                </>
              )}
            </Button>
          </div>
        </SectionCard>

        {/* Existing plans */}
        {plans.length > 0 && (
          <div>
            <h3 className="text-sm font-medium font-heading text-[var(--ag-text-primary)] mb-2">
              Existing Plans
            </h3>
            <div className="grid gap-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => selectPlan(plan)}
                  className="w-full text-left p-3 min-h-[44px] rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] hover:border-[var(--ag-aria)]/20 transition-[transform,border-color,background-color] active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--ag-text-primary)]">{plan.title}</span>
                    <StatusBadge status={plan.status} />
                  </div>
                  <span className="text-xs text-[var(--ag-text-muted)]">
                    {new Date(plan.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- Plan detail view ----

  const items = activePlan.items || [];
  const dayGroups = new Map<number, ContentPlanItem[]>();
  for (const item of items) {
    const existing = dayGroups.get(item.day_number) || [];
    existing.push(item);
    dayGroups.set(item.day_number, existing);
  }

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <SectionCard className="border-[var(--ag-violet)]/20 bg-[var(--ag-bg-surface)] backdrop-blur-xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-medium font-heading text-[var(--ag-text-primary)]">
              {activePlan.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={activePlan.status} />
              <span className="text-xs text-[var(--ag-text-muted)]">{items.length} items</span>
              {activePlan.start_date && (
                <span className="text-xs text-[var(--ag-text-muted)]">
                  Starts: {new Date(activePlan.start_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {activePlan.status === 'draft' && (
              <Button
                size="sm"
                onClick={() => setShowActivate(!showActivate)}
                className="bg-[var(--ag-success)]/10 text-[var(--ag-success)] hover:bg-[var(--ag-success)]/20 border border-[var(--ag-success)]/20 min-h-[44px]"
              >
                <Calendar className="w-4 h-4 mr-1" /> Activate
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => {
                setActivePlan(null);
                loadData();
              }}
            >
              Back
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeletePlan}
              className="text-[var(--ag-error)] min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
              aria-label="Delete plan"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Activate form */}
        {showActivate && (
          <div className="mt-3 p-3 rounded-lg bg-[var(--ag-bg-deep)] border border-[var(--ag-border-subtle)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--ag-text-muted)] mb-1 block">
                  Social Account
                </label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)]">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name} ({a.platform})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={activating || !startDate || !selectedAccountId}
              className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-gold)] text-white border-0 hover:opacity-90 min-h-[44px]"
            >
              {activating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-1" />
              )}
              Activate Schedule
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Mini Calendar — shows scheduled posts by day */}
      {items.some((i) => i.scheduled_at) && <MiniCalendar items={items} />}

      {/* Day cards */}
      {Array.from(dayGroups.entries())
        .sort(([a], [b]) => a - b)
        .map(([dayNum, dayItems]) => (
          <SectionCard key={dayNum}>
            <h3 className="text-sm font-semibold font-heading text-[var(--ag-violet)] mb-3">
              Day {dayNum}
            </h3>
            <div className="space-y-3">
              {dayItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    item.enabled
                      ? 'bg-[var(--ag-bg-deep)] border-[var(--ag-border-subtle)]'
                      : 'bg-[var(--ag-bg-deep)]/50 border-[var(--ag-border-subtle)]/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[var(--ag-text-muted)]">
                        Slot {item.slot}
                      </span>
                      <StatusIcon status={item.status} />
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={!!item.enabled}
                        onCheckedChange={() => handleToggleItem(item)}
                      />
                      {editingItem === item.id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/50"
                          onClick={() => handleSaveItem(item)}
                          aria-label="Save changes"
                        >
                          <CheckCircle className="w-4 h-4 text-[#00FF88]" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#FF6B9D]/50"
                          onClick={() => {
                            setEditingItem(item.id);
                            setEditCaption(item.caption);
                            setEditMediaId(item.media_id);
                          }}
                          aria-label="Edit item"
                        >
                          <Edit3 className="w-4 h-4 text-[var(--ag-text-muted)]" />
                        </Button>
                      )}
                      {item.enabled &&
                        activePlan.status === 'active' &&
                        item.status !== 'posted' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
                            onClick={() => handlePostNow(item)}
                            disabled={postingItem === item.id}
                            aria-label="Post now"
                          >
                            {postingItem === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4 text-[var(--ag-violet)]" />
                            )}
                          </Button>
                        )}
                    </div>
                  </div>

                  {/* Caption */}
                  {editingItem === item.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                        className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] text-sm min-h-[80px]"
                        maxLength={2200}
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          value={editMediaId}
                          onChange={(e) => setEditMediaId(e.target.value)}
                          placeholder="Media ID (img-xxx or vid-xxx)"
                          className="bg-[var(--ag-bg-surface)] border-[var(--ag-border-subtle)] text-xs flex-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--ag-text-primary)] whitespace-pre-wrap">
                      {item.caption}
                    </p>
                  )}

                  {/* Media preview */}
                  {item.media_id && editingItem !== item.id && (
                    <div className="mt-2 flex items-center gap-2">
                      {item.media_type === 'image' ? (
                        <Image className="w-4 h-4 text-[var(--ag-violet)]" />
                      ) : item.media_type === 'video' ? (
                        <Film className="w-4 h-4 text-[var(--ag-warning)]" />
                      ) : null}
                      <span className="text-xs text-[var(--ag-text-muted)] font-mono">
                        {item.media_id}
                      </span>
                      {item.media_url && (
                        <a
                          href={item.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--ag-violet)] hover:underline"
                        >
                          <Eye className="w-3 h-3 inline mr-1" />
                          preview
                        </a>
                      )}
                    </div>
                  )}

                  {/* Scheduled time */}
                  {item.scheduled_at && (
                    <div className="mt-1 text-xs text-[var(--ag-text-muted)]">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(item.scheduled_at).toLocaleString()}
                    </div>
                  )}

                  {/* Error message */}
                  {item.error_message && (
                    <div className="mt-1 text-xs text-[var(--ag-error)]">
                      <XCircle className="w-3 h-3 inline mr-1" />
                      {item.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        ))}
    </div>
  );
}
