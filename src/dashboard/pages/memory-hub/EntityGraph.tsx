// ============================================================
// Memory Hub — Entity/category graph + stats visualisation
// ============================================================

import { useState, useMemo } from 'react';
import { Brain, Clock, Tag, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/agentin';
import type { MemoryEntry } from '@/types';
import { GRAPH_COLORS, getSourceStyle } from './helpers';

// ── Category breakdown bar ─────────────────────────────────────

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
            className="h-full transition-all duration-[var(--ag-transition-spring)]"
            style={{
              width: `${Math.max(pct, 2)}%`,
              backgroundColor: GRAPH_COLORS[category] ?? 'var(--ag-text-secondary)',
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {breakdown.map(({ category, count, pct }) => (
          <div key={category} className="flex items-center gap-1.5 text-xs text-[var(--ag-text-secondary)]">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: GRAPH_COLORS[category] ?? 'var(--ag-text-secondary)' }}
            />
            <span className="capitalize">{category}</span>
            <span className="text-[var(--ag-text-primary)] font-medium">{count}</span>
            <span>({pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Entity graph (SVG force-layout approximation) ──────────────

export function EntityGraph({ memories }: { memories: MemoryEntry[] }) {
  const nodes = useMemo(() => {
    const map = new Map<string, { count: number; memories: MemoryEntry[] }>();
    for (const m of memories) {
      const cat = m.category;
      const e   = map.get(cat);
      if (e) { e.count++; e.memories.push(m); }
      else     { map.set(cat, { count: 1, memories: [m] }); }
    }
    return Array.from(map.entries()).map(([cat, data], i) => {
      const color = GRAPH_COLORS[cat] ?? 'var(--ag-text-secondary)';
      const angle = (i / map.size) * Math.PI * 2;
      return {
        id:       cat,
        label:    cat.charAt(0).toUpperCase() + cat.slice(1),
        color,
        count:    data.count,
        memories: data.memories,
        cx: 200 + 120 * Math.cos(angle),
        cy: 180 + 120 * Math.sin(angle),
        r:  Math.min(20 + data.count * 4, 50),
      };
    });
  }, [memories]);

  const [hovered, setHovered] = useState<string | null>(null);
  const hovMems = nodes.find(n => n.id === hovered)?.memories ?? [];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 flex items-center justify-center">
        <svg viewBox="0 0 400 360" className="w-full max-w-[400px]">
          {/* Centre node */}
          <circle
            cx="200" cy="180" r="30"
            fill="var(--ag-violet)" opacity={0.15}
            stroke="var(--ag-violet)" strokeWidth={1}
          />
          <text x="200" y="184" textAnchor="middle" fill="var(--ag-violet)" fontSize="11" fontWeight="bold">
            You
          </text>
          {/* Category nodes */}
          {nodes.map(n => (
            <g
              key={n.id}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <line
                x1={200} y1={180} x2={n.cx} y2={n.cy}
                stroke={hovered === n.id ? n.color : 'rgba(255,255,255,0.1)'}
                strokeWidth={hovered === n.id ? 2 : 1}
                strokeDasharray={hovered === n.id ? undefined : '4 4'}
              />
              <circle
                cx={n.cx} cy={n.cy} r={n.r}
                fill={n.color}
                opacity={hovered === n.id ? 0.3 : 0.15}
                stroke={n.color}
                strokeWidth={hovered === n.id ? 2 : 1}
              />
              <text
                x={n.cx} y={n.cy - n.r - 6}
                textAnchor="middle" fill={n.color} fontSize="10" fontWeight="500"
              >
                {n.label}
              </text>
              <text
                x={n.cx} y={n.cy + 4}
                textAnchor="middle" fill="var(--ag-text-primary)" fontSize="12" fontWeight="bold"
              >
                {n.count}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Side panel */}
      <div className="lg:w-72 space-y-2">
        {hovered ? (
          <>
            <h3 className="text-sm font-medium text-[var(--ag-text-primary)]">
              {nodes.find(n => n.id === hovered)?.label} ({hovMems.length})
            </h3>
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {hovMems.slice(0, 10).map(m => (
                <div
                  key={m.id}
                  className="p-2 rounded-lg bg-[var(--ag-bg-surface)] shadow-[inset_0_0_0_1px_var(--ag-border-subtle)] text-xs"
                >
                  <span className="text-[var(--ag-violet)] font-mono">{m.key}</span>
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

// ── Stats tab ──────────────────────────────────────────────────

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
            <div className="w-10 h-10 rounded-lg bg-[var(--ag-violet)]/10 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-[var(--ag-violet)]" />
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
              <div
                className="text-2xl font-bold text-[var(--ag-text-primary)] truncate max-w-[120px]"
                title={stats.mostAccessed?.key}
              >
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
                <div
                  key={source}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[var(--ag-bg-surface)] shadow-[inset_0_0_0_1px_var(--ag-border-subtle)] hover:shadow-[inset_0_0_0_1px_var(--ag-border-default)] transition-[box-shadow] duration-150"
                >
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
