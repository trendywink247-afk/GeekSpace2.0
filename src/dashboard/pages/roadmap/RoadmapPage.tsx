// ============================================================
// Roadmap Page — Upcoming features and company vision
// Owner agent: nova (#EC4899)
// Revamped: design tokens, PageShell + PageHeader + SectionCard,
//   useAgentCanvas, Dialog delete confirm, mobile QA (44px), nova dot
// ============================================================

import { useState, useEffect } from 'react';
import { PageShell, PageHeader, SectionCard, DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { Rocket, Sparkles, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { suggestionService } from '@/services/api';
import pkgJson from '../../../../package.json';
import { RoadmapTimeline, SuggestAndEarnPanel } from './';
import { roadmapItems, releaseNotes, type Suggestion, type Reward, type Cluster } from './helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

type VoteEntry = { upvotes: number; downvotes: number; voting: boolean };

// ─── Constants ───────────────────────────────────────────────────────────────

const RECENT_IMPROVEMENTS = [
  { phase: 72, title: 'Status notifications, timeline UI, loading skeletons, error handling' },
  { phase: 71, title: 'Suggestion editing, vote rate limits, admin bulk-status, trending decay' },
  { phase: 70, title: 'Release Train R3 — v3.1.0 production deploy, clusters, trending' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function RoadmapPage() {
  const { notifyDone } = useAgentCanvas({ agent: 'nova', page: 'roadmap' });

  // Suggestion data
  const [mySuggestions, setMySuggestions] = useState<Suggestion[]>([]);
  const [myRewards, setMyRewards] = useState<Reward[]>([]);
  const [topClusters, setTopClusters] = useState<Cluster[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [voteState, setVoteState] = useState<Record<string, VoteEntry>>({});
  const [suggestionOpen, setSuggestionOpen] = useState(false);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => setLoadingSuggestions(true), 0);
    Promise.allSettled([
      suggestionService.mine(),
      suggestionService.rewards(),
      suggestionService.clusters(),
    ])
      .then(([sugRes, rewRes, clusterRes]) => {
        if (sugRes.status === 'fulfilled') setMySuggestions(sugRes.value.data.suggestions);
        if (rewRes.status === 'fulfilled') setMyRewards(rewRes.value.data.rewards);
        if (clusterRes.status === 'fulfilled') {
          setTopClusters(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            clusterRes.value.data.clusters.slice(0, 3).map((c: any) => ({
              id: c.id,
              name: c.name,
              canonical_summary: c.canonical_summary,
              total_votes: c.total_votes,
              overall_score: c.overall_score ?? null,
            })),
          );
        }
        const failed = [sugRes, rewRes, clusterRes].filter((r) => r.status === 'rejected');
        if (failed.length > 0) setLoadError('Some data failed to load.');
      })
      .finally(() => setLoadingSuggestions(false));
  }, []);

  // ── Vote handler (kept here — mutates page-level voteState) ───────────────
  const handleVote = async (id: string) => {
    setVoteState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { upvotes: 0, downvotes: 0 }), voting: true },
    }));
    try {
      const res = await suggestionService.vote(id, 1);
      setVoteState((prev) => ({
        ...prev,
        [id]: { upvotes: res.data.upvotes, downvotes: res.data.downvotes, voting: false },
      }));
      void notifyDone(`Voted on suggestion ${id}`);
    } catch {
      setVoteState((prev) => {
        const existing = prev[id];
        return {
          ...prev,
          [id]: {
            upvotes: existing?.upvotes ?? 0,
            downvotes: existing?.downvotes ?? 0,
            voting: false,
          },
        };
      });
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardPageWrapper>
      <PageShell>
        <div className="space-y-6">
          {/* ── Header ──────────────────────────────────────────── */}
          <PageHeader
            icon={Rocket}
            title="Agentin Roadmap"
            subtitle="Building the future of AI-powered personal workspaces."
            badge={
              <span className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5" title="Nova">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ag-nova)] opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--ag-nova)]" />
                </span>
                <Badge className="bg-[var(--ag-nova)]/15 text-[var(--ag-nova)] border-[var(--ag-nova)]/30 text-xs">
                  Nova
                </Badge>
                <Badge className="bg-[rgba(139,92,246,0.1)] text-[var(--ag-violet)] border-[rgba(139,92,246,0.15)] text-xs">
                  v{pkgJson.version}
                </Badge>
              </span>
            }
          />

          {/* ── Recent Changes ──────────────────────────────────── */}
          <SectionCard title="Recent Changes" subtitle="Latest shipped improvements">
            <div className="space-y-3">
              {releaseNotes.map((note) => (
                <div
                  key={note.phase}
                  className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-all duration-200"
                >
                  <div
                    className="w-2 h-full min-h-[40px] rounded-full flex-shrink-0"
                    style={{ backgroundColor: note.color, opacity: 0.7 }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: `${note.color}20`,
                          color: note.color,
                          borderColor: `${note.color}40`,
                        }}
                      >
                        {note.phase}
                      </Badge>
                      <span className="font-semibold text-[var(--ag-text-primary)] text-sm">
                        {note.title}
                      </span>
                      <span className="text-xs text-[var(--ag-text-secondary)] ml-auto">
                        {note.date}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {note.items.map((item, i) => (
                        <li
                          key={i}
                          className="text-xs text-[var(--ag-text-secondary)] flex items-start gap-1.5"
                        >
                          <span className="text-[#00FF88] mt-0.5 flex-shrink-0">+</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ── Timeline (progress + Q1/Q2/Q3-Q4) ──────────────── */}
          <RoadmapTimeline items={roadmapItems} />

          {/* ── Suggest & Earn ──────────────────────────────────── */}
          <SuggestAndEarnPanel
            mySuggestions={mySuggestions}
            setMySuggestions={setMySuggestions}
            myRewards={myRewards}
            topClusters={topClusters}
            loadingSuggestions={loadingSuggestions}
            loadError={loadError}
            voteState={voteState}
            onVote={(id) => void handleVote(id)}
            suggestionOpen={suggestionOpen}
            setSuggestionOpen={setSuggestionOpen}
          />

          {/* ── CTA ─────────────────────────────────────────────── */}
          <BlurFade delay={0.7}>
            <SectionCard padding="lg" className="text-center">
              <Sparkles className="w-8 h-8 text-[var(--ag-nova)] mx-auto mb-3" />
              <h3 className="text-lg font-semibold font-heading text-[var(--ag-text-primary)] mb-2">
                Have a feature request?
              </h3>
              <p className="text-sm text-[var(--ag-text-secondary)] mb-4">
                We&apos;re building Agentin for you. Let us know what you&apos;d like to see next.
              </p>
              <button
                onClick={() => setSuggestionOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-amber)]/90 text-white font-medium transition-[transform,opacity] duration-150 active:scale-[0.96] min-h-[44px] min-w-[44px]"
              >
                Share Feedback
                <ArrowRight className="w-4 h-4" />
              </button>
            </SectionCard>
          </BlurFade>

          {/* ── Recent Improvements ─────────────────────────────── */}
          <BlurFade delay={0.8}>
            <SectionCard title="Recent Improvements" padding="lg">
              <div className="space-y-3">
                {RECENT_IMPROVEMENTS.map((item, idx) => (
                  <div key={item.phase} className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-px self-stretch bg-[#EC4899]/20 ml-5 ${idx === 0 ? 'mt-6' : ''}`}
                      aria-hidden="true"
                    />
                    <div className="flex items-start gap-3 flex-1 pb-3 border-b border-[rgba(139,92,246,0.08)] last:border-0">
                      <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-[var(--ag-nova)]/15 text-[var(--ag-nova)] text-xs font-bold border border-[var(--ag-nova)]/30">
                        v{item.phase}
                      </span>
                      <p className="text-sm text-[var(--ag-text-secondary)] leading-relaxed">
                        {item.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </BlurFade>
        </div>
      </PageShell>
    </DashboardPageWrapper>
  );
}
