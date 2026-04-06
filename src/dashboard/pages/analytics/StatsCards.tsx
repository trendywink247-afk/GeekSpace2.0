import { useState } from 'react';
import type { ComponentType, CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowUpRight, Lightbulb } from 'lucide-react';
import { CARD_SHADOW, CARD_SHADOW_HOVER, cardVariants, INSIGHT_ACCENT } from './helpers';
import type { AIInsight } from './helpers';

// ── Skeleton ────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div
      className="rounded-2xl bg-[var(--ag-bg-surface)] backdrop-blur-xl p-5 animate-pulse"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[var(--ag-active-bg)]" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-16 bg-[var(--ag-active-bg)] rounded-lg" />
          <div className="h-3 w-24 bg-[var(--ag-border-subtle)] rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Trend Arrow ─────────────────────────────────────────────────

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-[var(--ag-lime)]" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-[var(--ag-pink)]" />;
  return <ArrowUpRight className="w-4 h-4 text-[var(--ag-text-muted)] opacity-50" />;
}

// ── Mini Sparkline (inline SVG) ─────────────────────────────────

export function MiniSparkline({
  data,
  color = 'var(--ag-cyan)',
}: {
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 60;
  const h = 24;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * w;
      const y = h - (v / max) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-[60px] h-6 flex-shrink-0"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity="0.75"
      />
    </svg>
  );
}

// ── Overview Stat Card ──────────────────────────────────────────
// Concentric radii: outer rounded-2xl (16px), icon rounded-xl (12px)
// Shadow-over-border: multi-layer box-shadow replaces border ring

export interface OverviewCardProps {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  value: string | number;
  label: string;
  trend: 'up' | 'down' | 'flat';
  sparkData: number[];
  color?: string;
}

export function OverviewCard({
  icon: Icon,
  value,
  label,
  trend,
  sparkData,
  color = 'var(--ag-cyan)',
}: OverviewCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl bg-[var(--ag-bg-surface)] backdrop-blur-xl p-5 flex flex-col gap-3 min-w-0 cursor-default"
      style={{
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
        transition:
          'box-shadow 250ms cubic-bezier(0.4,0,0.2,1), transform 150ms cubic-bezier(0.4,0,0.2,1)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset ring-white/5"
          style={{
            backgroundColor: color.startsWith('var') ? undefined : color + '18',
            background: color.startsWith('var')
              ? `color-mix(in srgb, ${color} 12%, transparent)`
              : undefined,
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <TrendArrow trend={trend} />
      </div>

      <div>
        <div
          className="text-2xl font-bold text-[var(--ag-text-primary)] tracking-tight tabular-nums"
          style={{ textWrap: 'balance' } as CSSProperties}
        >
          {value}
        </div>
        <div
          className="text-xs text-[var(--ag-text-secondary)] mt-0.5"
          style={{ textWrap: 'pretty' } as CSSProperties}
        >
          {label}
        </div>
      </div>

      {sparkData.length >= 2 && (
        <div className="mt-auto pt-1 border-t border-[var(--ag-border-subtle)]">
          <MiniSparkline data={sparkData} color={color} />
        </div>
      )}
    </motion.div>
  );
}

// ── Skeleton Insight Card ───────────────────────────────────────

export function SkeletonInsightCard() {
  return (
    <div className="border-l-2 border-[var(--ag-border-subtle)] pl-4 py-3 animate-pulse">
      <div className="flex items-start gap-2.5">
        <div className="w-5 h-5 rounded bg-[var(--ag-border-subtle)] flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 bg-[var(--ag-active-bg)] rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Insight Cards ───────────────────────────────────────────────

export function InsightCard({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 pl-4 py-2.5 border-l-2 border-[var(--ag-lime)]">
      <Lightbulb className="w-4 h-4 text-[var(--ag-lime)] mt-0.5 flex-shrink-0" />
      <span
        className="text-sm text-[var(--ag-text-primary)]"
        style={{ textWrap: 'pretty' } as CSSProperties}
      >
        {text}
      </span>
    </div>
  );
}

export function AIInsightCard({ insight }: { insight: AIInsight }) {
  const accent = INSIGHT_ACCENT[insight.type] ?? 'var(--ag-violet)';
  return (
    <div
      className="flex items-start gap-3 pl-4 py-2.5 border-l-2 rounded-r-lg"
      style={{
        borderColor: accent,
        backgroundColor: `color-mix(in srgb, ${accent} 4%, transparent)`,
      }}
    >
      <span className="text-base mt-0.5 flex-shrink-0 leading-none">{insight.icon}</span>
      <span
        className="text-sm text-[var(--ag-text-primary)]"
        style={{ textWrap: 'pretty' } as CSSProperties}
      >
        {insight.text}
      </span>
    </div>
  );
}
