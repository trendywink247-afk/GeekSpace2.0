// ============================================================
// TaskCard — BacklogCard (drag source) + TimeBlockCard (drop target)
// ============================================================

import { Bell, Flame, Clock, LayoutGrid, GripVertical, Trash2 } from 'lucide-react';
import { PRIORITY_COLORS } from './helpers';
import type { TimeBlock, BacklogItem } from './helpers';

// ── BacklogCard ────────────────────────────────────────────────────────────

export function BacklogCard({
  item,
  onDragStart,
}: {
  item: BacklogItem;
  onDragStart: (item: BacklogItem) => void;
}) {
  const borderColor = item.type === 'reminder' ? '#A78BFA' : '#22C55E';
  const priorityColor = item.priority ? PRIORITY_COLORS[item.priority] || '#6B7280' : undefined;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(item)}
      className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing active:scale-[0.96]
        shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_1px_4px_rgba(0,0,0,0.18)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_4px_12px_rgba(0,0,0,0.28)]
        bg-[var(--ag-active-bg)] hover:bg-[var(--ag-bg-surface-hover)]
        transition-[transform,box-shadow] duration-150 select-none min-h-[44px]"
      style={{
        borderLeftWidth: 3,
        borderLeftColor: `${borderColor}60`,
      }}
    >
      <GripVertical className="w-3 h-3 text-[var(--ag-text-secondary)]/40 flex-shrink-0 group-hover:text-[var(--ag-text-secondary)]" />

      <div
        className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${borderColor}15` }}
      >
        {item.icon === 'bell' ? (
          <Bell className="w-3.5 h-3.5" style={{ color: borderColor }} />
        ) : (
          <Flame className="w-3.5 h-3.5" style={{ color: borderColor }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--ag-text-primary)] truncate leading-relaxed">{item.title}</p>
      </div>

      {priorityColor && item.priority && item.priority !== 'normal' && (
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
          style={{
            color: priorityColor,
            backgroundColor: `${priorityColor}18`,
            border: `1px solid ${priorityColor}30`,
          }}
        >
          {item.priority}
        </span>
      )}
    </div>
  );
}

// ── TimeBlockCard ──────────────────────────────────────────────────────────

export function TimeBlockCard({
  block,
  onRemove,
}: {
  block: TimeBlock;
  onRemove: (id: string) => void;
}) {
  const durationLabel =
    block.duration < 1
      ? `${Math.round(block.duration * 60)}m`
      : block.duration === 1
        ? '1h'
        : `${block.duration}h`;

  return (
    <div
      className="group relative rounded-lg px-3 py-2 mb-1 shadow-[0_0_0_1px_rgba(139,92,246,0.10),0_1px_3px_rgba(0,0,0,0.15)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.20),0_4px_10px_rgba(0,0,0,0.25)] transition-[transform,box-shadow] duration-150 hover:scale-[1.01] active:scale-[0.96]"
      style={{
        backgroundColor: `${block.color}0A`,
        borderColor: `${block.color}35`,
        borderLeftWidth: 3,
        borderLeftColor: block.color,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${block.color}20` }}
          >
            {block.type === 'reminder' ? (
              <Bell className="w-3 h-3" style={{ color: block.color }} />
            ) : block.type === 'habit' ? (
              <Flame className="w-3 h-3" style={{ color: block.color }} />
            ) : (
              <LayoutGrid className="w-3 h-3" style={{ color: block.color }} />
            )}
          </div>

          <span className="text-xs font-medium text-[var(--ag-text-primary)] truncate">{block.title}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-0.5 text-[10px] text-[var(--ag-text-secondary)] tabular-nums">
            <Clock className="w-3 h-3" />
            {durationLabel}
          </span>

          <button
            onClick={() => onRemove(block.id)}
            className="w-11 h-11 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[var(--ag-text-secondary)]/40 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove block"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
