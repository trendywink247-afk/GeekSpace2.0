/* eslint-disable react-refresh/only-export-components */
// ============================================================
// Memory Hub — Extracted sub-components (graph, stats, skeletons)
// ============================================================

import { useState, useMemo } from 'react';
import {
  Brain, Clock, Tag, BarChart3,
  User, Briefcase, Heart, Target, BookOpen,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard } from '@/components/agentin';
import type { MemoryEntry } from '@/types';

// ── Constants ──────────────────────────────────────────────────

export const CATEGORY_TABS = [
  { id: 'all', label: 'All', icon: Brain },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'preference', label: 'Preferences', icon: Heart },
  { id: 'goal', label: 'Goals', icon: Target },
  { id: 'fact', label: 'Facts', icon: BookOpen },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'personal', label: 'Personal' },
  { value: 'work', label: 'Work' },
  { value: 'preference', label: 'Preference' },
  { value: 'goal', label: 'Goal' },
  { value: 'fact', label: 'Fact' },
  { value: 'general', label: 'General' },
  { value: 'context', label: 'Context' },
  { value: 'task', label: 'Task' },
] as const;

export const SOURCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  manual: { bg: 'bg-[#00F0FF]/10', text: 'text-[var(--ag-cyan)]', label: 'Manual' },
  chat: { bg: 'bg-[#ADFF2F]/10', text: 'text-[#ADFF2F]', label: 'Chat' },
  extracted: { bg: 'bg-[#ADFF2F]/10', text: 'text-[#ADFF2F]', label: 'Chat' },
  inferred: { bg: 'bg-[#8B5CF6]/10', text: 'text-[var(--ag-violet)]', label: 'Inferred' },
  telegram: { bg: 'bg-[#FFB800]/10', text: 'text-[#FFB800]', label: 'Telegram' },
  'portfolio-chat': { bg: 'bg-[#FF2D78]/10', text: 'text-[#FF2D78]', label: 'Portfolio' },
};

export const GRAPH_COLORS: Record<string, string> = {
  personal: '#00F0FF',
  work: '#FFB800',
  preference: '#FF2D78',
  goal: '#ADFF2F',
  fact: '#8B5CF6',
  general: '#8892A4',
  context: '#00D4B0',
  task: '#FF6161',
};

// ── Helpers ────────────────────────────────────────────────────

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffWeek === 1) return '1 week ago';
  if (diffWeek < 5) return `${diffWeek} weeks ago`;
  if (diffMonth === 1) return '1 month ago';
  if (diffMonth < 12) return `${diffMonth} months ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getSourceStyle(source: string) {
  return SOURCE_STYLES[source] ?? { bg: 'bg-[#8892A4]/10', text: 'text-[var(--ag-text-secondary)]', label: source };
}

export function getCategoryIcon(category: string) {
  const found = CATEGORY_TABS.find(t => t.id === category);
  return found?.icon ?? Tag;
}

// ── Skeleton Components ────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <SectionCard>
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </SectionCard>
  );
}

export function MemoryCardSkeleton() {
  return (
    <SectionCard>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-3 pt-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </SectionCard>
  );
}

// ── Category Breakdown Bar ─────────────────────────────────────

export function CategoryBreakdownBar({ memories }: { memories: MemoryEntry[] }) {
  const breakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of memories) {
      counts[m.category] = (counts[m.category] || 0) + 1;
    }
    const total = memories.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({
        category: cat,
        count,
        pct: Math.round((count / total) * 100),
      }));
  }, [memories]);

  if (breakdown.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-[var(--ag-bg-deep)]">
        {breakdown.map(({ category, pct }) => (
          <div
            key={category}
            className="h-full transition-all duration-500"
            style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: GRAPH_COLORS[category] ?? '#8892A4' }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {breakdown.map(({ category, count, pct }) => (
          <div key={category} className="flex items-center gap-1.5 text-xs text-[var(--ag-text-secondary)]">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: GRAPH_COLORS[category] ?? '#8892A4' }} />
            <span className="capitalize">{category}</span>
            <span className="text-[var(--ag-text-primary)] font-medium">{count}</span>
            <span>({pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Memory Graph ───────────────────────────────────────────────

export function MemoryGraph({ memories }: { memories: MemoryEntry[] }) {
  const nodes = useMemo(() => {
    const map = new Map<string, { count: number; memories: MemoryEntry[] }>();
    for (const m of memories) {
      const cat = m.category;
      const e = map.get(cat);
      if (e) { e.count++; e.memories.push(m); } else { map.set(cat, { count: 1, memories: [m] }); }
    }
    return Array.from(map.entries()).map(([cat, data], i) => {
      const color = GRAPH_COLORS[cat] ?? '#8892A4';
      const angle = (i / map.size) * Math.PI * 2;
      return {
        id: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        color,
        count: data.count,
        memories: data.memories,
        cx: 200 + 120 * Math.cos(angle),
        cy: 180 + 120 * Math.sin(angle),
        r: Math.min(20 + data.count * 4, 50),
      };
    });
  }, [memories]);

  const [hovered, setHovered] = useState<string | null>(null);
  const hovMems = nodes.find(n => n.id === hovered)?.memories ?? [];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 flex items-center justify-center">
        <svg viewBox="0 0 400 360" className="w-full max-w-[400px]">
          <circle cx="200" cy="180" r="30" fill="#6366F1" opacity={0.15} stroke="#6366F1" strokeWidth={1} />
          <text x="200" y="184" textAnchor="middle" fill="#6366F1" fontSize="11" fontWeight="bold">You</text>
          {nodes.map(n => (
            <g key={n.id} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
              <line x1={200} y1={180} x2={n.cx} y2={n.cy} stroke={hovered === n.id ? n.color : 'rgba(255,255,255,0.1)'} strokeWidth={hovered === n.id ? 2 : 1} strokeDasharray={hovered === n.id ? undefined : '4 4'} />
              <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.color} opacity={hovered === n.id ? 0.3 : 0.15} stroke={n.color} strokeWidth={hovered === n.id ? 2 : 1} />
              <text x={n.cx} y={n.cy - n.r - 6} textAnchor="middle" fill={n.color} fontSize="10" fontWeight="500">{n.label}</text>
              <text x={n.cx} y={n.cy + 4} textAnchor="middle" fill="#F4F6FF" fontSize="12" fontWeight="bold">{n.count}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="lg:w-72 space-y-2">
        {hovered ? (
          <>
            <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">
              {nodes.find(n => n.id === hovered)?.label} ({hovMems.length})
            </h3>
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {hovMems.slice(0, 10).map(m => (
                <div key={m.id} className="p-2 rounded-lg bg-white/5 border border-white/5 text-xs">
                  <span className="text-[#6366F1] font-mono">{m.key}</span>
                  <span className="text-[var(--ag-text-secondary)] mx-1">=</span>
                  <span className="text-[var(--ag-text-primary)]">{m.value}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--ag-text-secondary)]">Hover a node to see memories.</p>
        )}
      </div>
    </div>
  );
}

// ── Stats Cards ────────────────────────────────────────────────

interface StatsTabProps {
  memories: MemoryEntry[];
  stats: {
    total: number;
    categoryCount: number;
    thisWeek: number;
    mostAccessed: MemoryEntry | null;
  };
}

export function StatsTab({ memories, stats }: StatsTabProps) {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#6366F1]/10 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-[#6366F1]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--ag-text-primary)]">{stats.total}</div>
              <div className="text-xs text-[var(--ag-text-secondary)]">Total Memories</div>
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--ag-lime)]/10 flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5 text-[var(--ag-lime)]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--ag-text-primary)]">{stats.categoryCount}</div>
              <div className="text-xs text-[var(--ag-text-secondary)]">Categories</div>
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--ag-amber)]/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-[var(--ag-amber)]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--ag-text-primary)]">{stats.thisWeek}</div>
              <div className="text-xs text-[var(--ag-text-secondary)]">This Week</div>
            </div>
          </div>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--ag-violet)]/10 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-[var(--ag-violet)]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--ag-text-primary)] truncate max-w-[120px]" title={stats.mostAccessed?.key}>
                {stats.mostAccessed ? stats.mostAccessed.accessCount : 0}
              </div>
              <div className="text-xs text-[var(--ag-text-secondary)]">Most Referenced</div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Category breakdown */}
      <SectionCard title="Category Breakdown">
        <CategoryBreakdownBar memories={memories} />
      </SectionCard>

      {/* Per-source breakdown */}
      <SectionCard title="Sources">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(
            memories.reduce<Record<string, number>>((acc, m) => {
              acc[m.source] = (acc[m.source] || 0) + 1;
              return acc;
            }, {})
          )
            .sort((a, b) => b[1] - a[1])
            .map(([source, count]) => {
              const style = getSourceStyle(source);
              return (
                <div key={source} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
                  <Badge className={`${style.bg} ${style.text} text-xs px-2 py-0.5 rounded-full border-0`}>
                    {style.label}
                  </Badge>
                  <span className="text-sm font-bold text-[var(--ag-text-primary)]">{count}</span>
                </div>
              );
            })}
        </div>
      </SectionCard>
    </div>
  );
}
