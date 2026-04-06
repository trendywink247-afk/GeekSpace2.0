// ============================================================
// RoadmapTimeline — progress bar + Q1/Q2/Q3-Q4 quarter sections
// Includes CategoryFilter integration for client-side filtering
// ============================================================

import { useState, useMemo } from 'react';
import { CheckCircle2, Clock, Circle } from 'lucide-react';
import { SectionCard } from '@/components/agentin';
import { FeatureCard } from './FeatureCard';
import { CategoryFilter } from './CategoryFilter';
import { getCategories, type RoadmapItem } from './helpers';

interface RoadmapTimelineProps {
  items: RoadmapItem[];
}

export function RoadmapTimeline({ items }: RoadmapTimelineProps) {
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const plannedCount = items.filter((i) => i.status === 'planned').length;
  const progressPercent = (completedCount / items.length) * 100;

  const [selectedCategory, setSelectedCategory] = useState('All');
  const categories = useMemo(() => getCategories(items), [items]);

  const filtered = useMemo(
    () => (selectedCategory === 'All' ? items : items.filter((i) => i.category === selectedCategory)),
    [items, selectedCategory],
  );

  const q1Items = filtered.filter((i) => i.quarter === 'Q1 2026');
  const q2Items = filtered.filter((i) => i.quarter === 'Q2 2026');
  const futureItems = filtered.filter(
    (i) => i.quarter.startsWith('Q3') || i.quarter.startsWith('Q4'),
  );

  return (
    <div className="space-y-6">
      {/* ── Progress bar ──────────────────────────────────────── */}
      <SectionCard padding="lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[var(--ag-text-secondary)]">Overall Progress</span>
          <span className="text-sm font-medium text-[var(--ag-text-primary)] tabular-nums">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="h-3 bg-[var(--ag-bg-base)] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--ag-green)]" />
            <span className="text-[var(--ag-text-primary)] tabular-nums">
              {completedCount} Completed
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FFB800]" />
            <span className="text-[var(--ag-text-secondary)]">0 In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-4 h-4 text-[var(--ag-violet)]" />
            <span className="text-[var(--ag-text-secondary)] tabular-nums">
              {plannedCount} Planned
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── Category filter ───────────────────────────────────── */}
      <CategoryFilter
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* ── Q1 2026 ───────────────────────────────────────────── */}
      {q1Items.length > 0 && (
        <SectionCard title="Q1 2026" subtitle="Recently Shipped">
          <div className="grid md:grid-cols-2 gap-4">
            {q1Items.map((item) => (
              <FeatureCard key={item.id} item={item} variant="shipped" />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Q2 2026 ───────────────────────────────────────────── */}
      {q2Items.length > 0 && (
        <SectionCard title="Q2 2026" subtitle="Coming Next">
          <div className="grid md:grid-cols-2 gap-4">
            {q2Items.map((item) => (
              <FeatureCard key={item.id} item={item} variant="upcoming" />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Q3-Q4 2026 ────────────────────────────────────────── */}
      {futureItems.length > 0 && (
        <SectionCard title="Q3–Q4 2026" subtitle="Future Vision">
          <div className="grid md:grid-cols-2 gap-4">
            {futureItems.map((item) => (
              <FeatureCard key={item.id} item={item} variant="future" />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
