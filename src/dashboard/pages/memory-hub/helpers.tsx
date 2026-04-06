/* eslint-disable react-refresh/only-export-components */
// ============================================================
// Memory Hub — Shared helpers, constants, motion variants, skeletons
// ============================================================

import type { RefObject } from 'react';
import { Brain, User, Briefcase, Heart, Target, BookOpen, Tag, AlertTriangle, RefreshCw, MessageSquare, Plus, Send, Loader2, Sparkles, Clock, Layers, List, Network, BarChart3 } from 'lucide-react';
import { SectionCard } from '@/components/agentin';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

// ── Category config ────────────────────────────────────────────

export const CATEGORY_TABS = [
  { id: 'all',        label: 'All',         icon: Brain    },
  { id: 'personal',   label: 'Personal',    icon: User     },
  { id: 'work',       label: 'Work',        icon: Briefcase },
  { id: 'preference', label: 'Preferences', icon: Heart    },
  { id: 'goal',       label: 'Goals',       icon: Target   },
  { id: 'fact',       label: 'Facts',       icon: BookOpen },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'personal',   label: 'Personal'   },
  { value: 'work',       label: 'Work'       },
  { value: 'preference', label: 'Preference' },
  { value: 'goal',       label: 'Goal'       },
  { value: 'fact',       label: 'Fact'       },
  { value: 'general',    label: 'General'    },
  { value: 'context',    label: 'Context'    },
  { value: 'task',       label: 'Task'       },
] as const;

export const SOURCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  manual:           { bg: 'bg-[var(--ag-cyan)]/10',   text: 'text-[var(--ag-cyan)]',   label: 'Manual'    },
  chat:             { bg: 'bg-[var(--ag-lime)]/10',   text: 'text-[var(--ag-lime)]',   label: 'Chat'      },
  extracted:        { bg: 'bg-[var(--ag-lime)]/10',   text: 'text-[var(--ag-lime)]',   label: 'Chat'      },
  inferred:         { bg: 'bg-[var(--ag-violet)]/10', text: 'text-[var(--ag-violet)]', label: 'Inferred'  },
  telegram:         { bg: 'bg-[var(--ag-amber)]/10',  text: 'text-[var(--ag-amber)]',  label: 'Telegram'  },
  'portfolio-chat': { bg: 'bg-[var(--ag-pink)]/10',   text: 'text-[var(--ag-pink)]',   label: 'Portfolio' },
};

export const GRAPH_COLORS: Record<string, string> = {
  personal:   'var(--ag-cyan)',
  work:       'var(--ag-amber)',
  preference: 'var(--ag-pink)',
  goal:       'var(--ag-lime)',
  fact:       'var(--ag-violet)',
  general:    'var(--ag-text-secondary)',
  context:    'var(--ag-green)',
  task:       'var(--ag-pink)',
};

// ── Shadow tokens ──────────────────────────────────────────────

export const CARD_SHADOW =
  'shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_12px_rgba(0,0,0,0.28),0_0_0_1px_rgba(139,92,246,0.06)_inset]';
export const CARD_SHADOW_HOVER =
  'hover:shadow-[0_0_0_1px_rgba(99,102,241,0.18),0_6px_24px_rgba(0,0,0,0.38),0_0_20px_rgba(99,102,241,0.07)]';
export const CARD_DANGER_SHADOW =
  'shadow-[0_0_0_1px_rgba(255,45,120,0.12),0_2px_12px_rgba(0,0,0,0.28)]';

// ── Motion variants ────────────────────────────────────────────

export const pageVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const sectionVariants = {
  hidden:  { opacity: 0, y: 12, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring' as const, duration: 0.5, bounce: 0 },
  },
};

export const tabContentVariants = {
  hidden:  { opacity: 0, y:  8, filter: 'blur(3px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring' as const, duration: 0.4, bounce: 0 },
  },
  exit: {
    opacity: 0, y: -6, filter: 'blur(3px)',
    transition: { duration: 0.15, ease: 'easeIn' as const },
  },
};

// ── Formatters ─────────────────────────────────────────────────

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now  = new Date();
  const diffMs    = now.getTime() - date.getTime();
  const diffSec   = Math.floor(diffMs   / 1000);
  const diffMin   = Math.floor(diffSec  / 60);
  const diffHr    = Math.floor(diffMin  / 60);
  const diffDay   = Math.floor(diffHr   / 24);
  const diffWeek  = Math.floor(diffDay  / 7);
  const diffMonth = Math.floor(diffDay  / 30);

  if (diffSec   <  60) return 'just now';
  if (diffMin   <  60) return `${diffMin}m ago`;
  if (diffHr    <  24) return `${diffHr}h ago`;
  if (diffDay  ===  1) return 'yesterday';
  if (diffDay   <   7) return `${diffDay} days ago`;
  if (diffWeek ===  1) return '1 week ago';
  if (diffWeek  <   5) return `${diffWeek} weeks ago`;
  if (diffMonth === 1) return '1 month ago';
  if (diffMonth <  12) return `${diffMonth} months ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getSourceStyle(source: string) {
  return SOURCE_STYLES[source] ?? {
    bg: 'bg-[#8892A4]/10', text: 'text-[var(--ag-text-secondary)]', label: source,
  };
}

export function getCategoryIcon(category: string) {
  const found = CATEGORY_TABS.find(t => t.id === category);
  return found?.icon ?? Tag;
}

// ── Skeleton components ────────────────────────────────────────

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

// ── Error state ────────────────────────────────────────────────

export function MemoryErrorState({ loadError, onRetry }: { loadError: string; onRetry: () => void }) {
  return (
    <motion.div variants={sectionVariants} className="text-center py-16 space-y-4">
      <div
        className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
        style={{ background: 'rgba(255,45,120,0.08)', boxShadow: '0 0 0 1px rgba(255,45,120,0.15)' }}
      >
        <AlertTriangle className="w-8 h-8 text-[var(--ag-pink)]/60" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-[var(--ag-text-primary)]"
          style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' } as React.CSSProperties}>
          Could not load memories
        </h3>
        <p className="text-sm text-[var(--ag-text-secondary)] max-w-xs mx-auto"
          style={{ textWrap: 'pretty' } as React.CSSProperties}>
          {loadError}
        </p>
      </div>
      <motion.div whileTap={{ scale: 0.96 }}>
        <Button
          onClick={onRetry}
          className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-h-[44px] transition-opacity"
        >
          <RefreshCw className="w-4 h-4 mr-2" />Retry
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ── Empty state ────────────────────────────────────────────────

interface MemoryEmptyStateProps {
  quickAddText: string;
  onQuickAddTextChange: (t: string) => void;
  quickAddInputRef: RefObject<HTMLInputElement | null>;
  isAdding: boolean;
  onQuickAdd: () => void;
  onNavigateToChat: () => void;
}

export function MemoryEmptyState({
  quickAddText,
  onQuickAddTextChange,
  quickAddInputRef,
  isAdding,
  onQuickAdd,
  onNavigateToChat,
}: MemoryEmptyStateProps) {
  return (
    <motion.div variants={sectionVariants} className="text-center py-12 space-y-6">
      <div className="relative mx-auto w-20 h-20">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center animate-pulse"
          style={{ background: 'rgba(99,102,241,0.08)', boxShadow: '0 0 0 1px rgba(99,102,241,0.15), 0 0 24px rgba(99,102,241,0.08)' }}
        >
          <Brain className="w-9 h-9 text-[var(--ag-echo)]/50" />
        </div>
        <span
          className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(173,255,47,0.1)', boxShadow: '0 0 0 1px rgba(173,255,47,0.2)' }}
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--ag-lime)]" />
        </span>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-[var(--ag-text-primary)]"
          style={{ fontFamily: 'Syne, sans-serif', textWrap: 'balance' } as React.CSSProperties}>
          No memories yet
        </h3>
        <p className="text-sm text-[var(--ag-text-secondary)] max-w-xs mx-auto leading-relaxed"
          style={{ textWrap: 'pretty' } as React.CSSProperties}>
          Your AI remembers everything you teach it. Start a conversation or add a memory below.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <motion.div whileTap={{ scale: 0.96 }}>
          <Button
            onClick={onNavigateToChat}
            className="border-0 bg-[var(--ag-echo)]/12 hover:bg-[var(--ag-echo)]/20 text-[var(--ag-echo)] min-h-[44px] px-6 transition-[background-color,box-shadow]"
            style={{ boxShadow: '0 0 0 1px rgba(99,102,241,0.2)' }}
          >
            <MessageSquare className="w-4 h-4 mr-2" />Start Chat
          </Button>
        </motion.div>
        <span className="text-xs text-[var(--ag-text-muted)]">or add manually below</span>
      </div>
      <div
        className="max-w-lg mx-auto rounded-2xl p-4 backdrop-blur-xl"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.28)' }}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted)]" />
            <Input
              ref={quickAddInputRef}
              placeholder="Add a memory… (e.g. 'favorite color: blue')"
              value={quickAddText}
              onChange={e => onQuickAddTextChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onQuickAdd(); } }}
              className="pl-10 rounded-xl bg-[var(--ag-bg-deep)] border-0"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
            />
          </div>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              onClick={onQuickAdd}
              disabled={isAdding || !quickAddText.trim()}
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] hover:opacity-90 text-white min-w-[44px] min-h-[44px] transition-opacity border-0"
            >
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Hub tab switcher ───────────────────────────────────────

export type HubTab = 'browse' | 'graph' | 'stats';

export const HUB_TABS: { id: HubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'browse', label: 'Browse', icon: List    },
  { id: 'graph',  label: 'Graph',  icon: Network  },
  { id: 'stats',  label: 'Stats',  icon: BarChart3 },
];

export function HubTabSwitcher({ activeTab, onTabChange }: {
  activeTab: HubTab;
  onTabChange: (tab: HubTab) => void;
}) {
  return (
    <motion.div variants={sectionVariants}>
      <div
        className="inline-flex items-center bg-[var(--ag-bg-surface)] backdrop-blur-xl rounded-2xl p-1 gap-0.5"
        style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 2px 12px rgba(0,0,0,0.3)' }}
      >
        {HUB_TABS.map(tab => {
          const Icon     = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              whileTap={{ scale: 0.96 }}
              className={[
                'relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px]',
                'transition-[color,background-color,box-shadow] duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-echo)]/40',
                isActive
                  ? 'text-[var(--ag-echo)] bg-[var(--ag-echo)]/10'
                  : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-elevated)]',
              ].join(' ')}
              style={isActive
                ? { boxShadow: '0 0 0 1px rgba(99,102,241,0.2), 0 2px 8px rgba(99,102,241,0.12)' }
                : undefined}
            >
              <Icon className="w-4 h-4" /><span>{tab.label}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Compact stats strip ──────────────────────────────────

interface MemoryStatsStripProps {
  total: number;
  thisWeek: number;
  categoryCount: number;
  topAccessCount: number;
}

export function MemoryStatsStrip({ total, thisWeek, categoryCount, topAccessCount }: MemoryStatsStripProps) {
  const items = [
    { label: 'Total',      value: total,          icon: Brain,    color: 'var(--ag-echo)'  },
    { label: 'This week',  value: thisWeek,        icon: Clock,    color: 'var(--ag-cyan)'  },
    { label: 'Categories', value: categoryCount,   icon: Layers,   color: 'var(--ag-green)' },
    { label: 'Top access', value: topAccessCount,  icon: Sparkles, color: 'var(--ag-amber)' },
  ] as const;
  return (
    <motion.div variants={sectionVariants}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {items.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl p-3 bg-[var(--ag-bg-surface)] backdrop-blur-xl"
            style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.22)' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-none text-[var(--ag-text-primary)]"
                style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'Space Grotesk, sans-serif' }}>
                {value}
              </p>
              <p className="text-xs text-[var(--ag-text-muted)] mt-0.5 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Loading skeleton state ─────────────────────────────────

export function MemoryLoadingState() {
  return (
    <motion.div variants={sectionVariants} className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
      </div>
      <div className="space-y-3">
        <MemoryCardSkeleton /><MemoryCardSkeleton /><MemoryCardSkeleton />
      </div>
    </motion.div>
  );
}
