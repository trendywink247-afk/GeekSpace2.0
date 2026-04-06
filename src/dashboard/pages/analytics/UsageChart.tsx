import { useState, useMemo, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from 'recharts';
import { HEATMAP_COLORS, DAY_LABELS, TOOLTIP_STYLE, formatDate, getWeekday } from './helpers';
import type { HeatmapPoint, ActivityEntry } from './helpers';

// ── Skeleton Components ─────────────────────────────────────────

export function SkeletonHeatmap() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-48 bg-[var(--ag-active-bg)] rounded mb-4" />
      <div className="flex gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="w-[10px] h-[10px] rounded-sm bg-[var(--ag-border-subtle)]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonBar() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-20 bg-[var(--ag-active-bg)] rounded" />
          <div className="flex-1 h-6 bg-[var(--ag-border-subtle)] rounded-full" />
          <div className="h-3 w-10 bg-[var(--ag-active-bg)] rounded" />
        </div>
      ))}
    </div>
  );
}

// ── Activity Heatmap (GitHub-style, Mon–Sun) ────────────────────

export function ActivityHeatmap({
  heatmap,
  activityEntries,
}: {
  heatmap: HeatmapPoint[];
  activityEntries: ActivityEntry[];
}) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const messageCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of activityEntries) {
      const dateKey = entry.created_at.slice(0, 10);
      map.set(dateKey, (map.get(dateKey) ?? 0) + 1);
    }
    return map;
  }, [activityEntries]);

  const gridData = useMemo(() => {
    const today = new Date();
    const cells: { date: string; count: number; weekCol: number; dayRow: number }[] = [];
    const heatmapMap = new Map<string, number>();
    for (const pt of heatmap) heatmapMap.set(pt.date, pt.intensity);

    const totalDays = 16 * 7;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);
    const startDay = startDate.getUTCDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    startDate.setDate(startDate.getDate() + mondayOffset);

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayRow = getWeekday(dateStr);
      const weekCol = Math.floor(i / 7);
      const count = heatmapMap.get(dateStr) ?? messageCountByDate.get(dateStr) ?? 0;
      if (d <= today) cells.push({ date: dateStr, count, weekCol, dayRow });
    }
    return cells;
  }, [heatmap, messageCountByDate]);

  const maxCount = useMemo(() => Math.max(...gridData.map((c) => c.count), 1), [gridData]);

  const getColor = (count: number): string => {
    if (count === 0) return HEATMAP_COLORS[0];
    const ratio = count / maxCount;
    if (ratio <= 0.25) return HEATMAP_COLORS[1];
    if (ratio <= 0.5) return HEATMAP_COLORS[2];
    if (ratio <= 0.75) return HEATMAP_COLORS[3];
    return HEATMAP_COLORS[4];
  };

  const cellSize = 10;
  const gap = 2;
  const step = cellSize + gap;
  const labelWidth = 28;
  const numWeeks = Math.max(...gridData.map((c) => c.weekCol), 0) + 1;
  const svgWidth = labelWidth + numWeeks * step + gap;
  const svgHeight = 7 * step + gap;

  const handleMouseEnter = (e: React.MouseEvent, date: string, count: number) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    setTooltip({
      text: `${formatDate(date)}: ${count} message${count !== 1 ? 's' : ''}`,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleTap = (e: React.MouseEvent | React.TouchEvent, date: string, count: number) => {
    e.preventDefault();
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const text = `${formatDate(date)}: ${count} message${count !== 1 ? 's' : ''}`;
    setTooltip((prev) =>
      prev?.text === text ? null : { text, x: rect.left + rect.width / 2, y: rect.top - 8 },
    );
  };

  return (
    <div className="relative">
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg px-3 py-1.5 text-xs text-[var(--ag-text-primary)] pointer-events-none whitespace-nowrap tabular-nums"
          style={{
            top: tooltip.y - 28,
            left: tooltip.x,
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--ag-bg-chrome)',
            boxShadow: '0 0 0 1px rgba(139,92,246,0.18), 0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="overflow-x-auto pb-2">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="min-w-0"
        >
          {DAY_LABELS.map((label, i) => (
            <text
              key={label}
              x={12}
              y={i * step + cellSize - 1}
              textAnchor="middle"
              fill="#6B7280"
              fontFamily="system-ui, sans-serif"
              fontSize="8"
            >
              {i % 2 === 0 ? label : ''}
            </text>
          ))}
          {gridData.map((cell) => (
            <rect
              key={cell.date}
              x={labelWidth + cell.weekCol * step}
              y={cell.dayRow * step}
              width={cellSize}
              height={cellSize}
              rx={2}
              ry={2}
              fill={getColor(cell.count)}
              className="cursor-pointer transition-opacity hover:opacity-75"
              onMouseEnter={(e) => handleMouseEnter(e, cell.date, cell.count)}
              onMouseLeave={() => setTooltip(null)}
              onClick={(e) => handleTap(e, cell.date, cell.count)}
              onTouchEnd={(e) => handleTap(e, cell.date, cell.count)}
            />
          ))}
        </svg>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-[var(--ag-text-muted)]">
        <span>Less</span>
        {HEATMAP_COLORS.map((color, i) => (
          <div
            key={i}
            className="w-[10px] h-[10px] rounded-sm ring-1 ring-inset ring-white/5"
            style={{ backgroundColor: color }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ── Usage by Feature Bar ────────────────────────────────────────

export function UsageBarChart({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  const maxVal = Math.max(...items.map((it) => it.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const pct = Math.round((item.value / total) * 100);
        const barWidth = (item.value / maxVal) * 100;
        return (
          <div key={item.label} className="flex items-center gap-3 min-h-[44px]">
            <div className="flex items-center gap-2 w-24 flex-shrink-0 justify-end">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-[var(--ag-text-secondary)] truncate">
                {item.label}
              </span>
            </div>
            <div className="flex-1 h-5 bg-[var(--ag-border-subtle)] rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: item.color,
                  minWidth: item.value > 0 ? '8px' : '0',
                  boxShadow: `0 0 6px ${item.color}40`,
                }}
              />
            </div>
            <span className="text-xs text-[var(--ag-text-primary)] w-10 text-right font-medium flex-shrink-0 tabular-nums">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Response Latency Area Chart ─────────────────────────────────

export function LatencyChart({ data }: { data: { name: string; latency: number }[] }) {
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--ag-green)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--ag-green)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--ag-border-subtle)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--ag-text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--ag-text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}ms`}
          />
          <RechartsTooltip
            {...TOOLTIP_STYLE}
            formatter={(value: number) => [`${value}ms`, 'Latency']}
          />
          <RechartsLegend
            wrapperStyle={{
              fontSize: '11px',
              paddingTop: '8px',
              color: 'var(--ag-text-secondary)',
            }}
            formatter={() => 'Avg latency (ms)'}
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="var(--ag-green)"
            fill="url(#latencyGrad)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--ag-green)', strokeWidth: 2, stroke: 'var(--ag-bg-base)' }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
