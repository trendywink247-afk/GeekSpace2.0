import { Bell, Clock, Flame, GripVertical, LayoutGrid, Trash2 } from 'lucide-react';
import { PRIORITY_COLORS } from '../helpers';
import type { BacklogItem, TimeBlock } from '../helpers';
const TYPE_ACCENT: Record<string, string> = { reminder: 'var(--ag-violet-soft)', habit: 'var(--ag-emerald)', custom: 'var(--ag-violet)' };
export function TimeBlockCard({ block, onRemove }: { block: TimeBlock; onRemove: (id: string) => void }) {
  const accent = TYPE_ACCENT[block.type] ?? 'var(--ag-violet)';
  const dl = block.duration < 1 ? `${Math.round(block.duration * 60)}m` : block.duration === 1 ? '1h' : `${block.duration}h`;
  return (
    <div className="group relative rounded-xl px-3 py-2.5 mb-1.5 transition-all duration-150 hover:scale-[1.01] active:scale-[0.97]"
      style={{ backgroundColor: `${block.color}0D`, border: `1px solid ${block.color}30`, borderLeft: `3px solid ${block.color}`, boxShadow: `0 2px 8px ${block.color}0A` }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${block.color}1A` }}>
            {block.type === 'reminder' ? <Bell className="w-3 h-3" style={{ color: accent }} /> : block.type === 'habit' ? <Flame className="w-3 h-3" style={{ color: accent }} /> : <LayoutGrid className="w-3 h-3" style={{ color: accent }} />}
          </div>
          <span className="text-xs font-medium truncate" style={{ color: 'var(--ag-text-primary)' }}>{block.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="flex items-center gap-0.5 text-[10px] tabular-nums" style={{ color: 'var(--ag-text-muted)' }}><Clock className="w-3 h-3" />{dl}</span>
          <button onClick={() => onRemove(block.id)} className="w-11 h-11 sm:w-6 sm:h-6 rounded flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-500/10" style={{ color: 'var(--ag-text-muted)' }} title="Remove block">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
export function BacklogCard({ item, onDragStart }: { item: BacklogItem; onDragStart: (item: BacklogItem) => void }) {
  const bc = item.type === 'reminder' ? 'var(--ag-violet-soft)' : 'var(--ag-emerald)';
  const pc = item.priority ? PRIORITY_COLORS[item.priority] || '#6B7280' : undefined;
  return (
    <div draggable onDragStart={() => onDragStart(item)} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing active:scale-[0.96] select-none min-h-[44px] transition-all duration-150"
      style={{ background: 'var(--ag-active-bg)', border: '1px solid var(--ag-border-subtle)', borderLeft: '3px solid rgba(139,92,246,0.25)', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
      <GripVertical className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(139,92,246,0.3)' }} />
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: item.type === 'reminder' ? 'rgba(167,139,250,0.12)' : 'rgba(16,185,129,0.12)' }}>
        {item.icon === 'bell' ? <Bell className="w-3.5 h-3.5" style={{ color: bc }} /> : <Flame className="w-3.5 h-3.5" style={{ color: bc }} />}
      </div>
      <div className="flex-1 min-w-0"><p className="text-xs truncate leading-relaxed" style={{ color: 'var(--ag-text-primary)' }}>{item.title}</p></div>
      {pc && item.priority && item.priority !== 'normal' && (
        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0" style={{ color: pc, backgroundColor: `${pc}18`, border: `1px solid ${pc}30` }}>{item.priority}</span>
      )}
    </div>
  );
}
