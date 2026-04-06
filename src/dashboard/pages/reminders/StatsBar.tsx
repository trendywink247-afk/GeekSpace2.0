// ─── StatsBar — stats grid + search bar + all filter controls ────────────────
import { motion } from 'framer-motion';
import { Search, Calendar, LayoutGrid, List, Download, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { BlurFade } from '@/components/magicui/blur-fade';
import { categoryHex, priorityConfig } from './helpers';
import type { StatsBarProps } from './types';

export function StatsBar({
  activeCount, overdueCount, completedCount, streak,
  filter, recurrenceFilter, categoryFilter, priorityFilter,
  searchQuery, sortMode, groupMode, viewMode, hasActiveFilters,
  onFilterChange, onRecurrenceFilterChange, onCategoryFilterChange, onPriorityFilterChange,
  onSearchQueryChange, onSortModeChange, onGroupModeChange, onViewModeChange,
  onClearFilters, onExportCsv, onExportIcs,
}: StatsBarProps) {
  return (
    <div className="space-y-3">
      {/* Stats grid */}
      <BlurFade delay={0.12} inView>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active',    value: activeCount,    color: '#A78BFA', glow: 'rgba(167,139,250,0.1)' },
            { label: 'Overdue',   value: overdueCount,   color: overdueCount > 0 ? '#FF2D78' : '#6B7280', glow: overdueCount > 0 ? 'rgba(255,45,120,0.08)' : 'transparent' },
            { label: 'Completed', value: completedCount, color: '#10B981', glow: 'rgba(16,185,129,0.08)' },
            { label: 'Streak',    value: streak,         color: '#F59E0B', glow: 'rgba(245,158,11,0.08)',  suffix: 'd' },
          ].map(({ label, value, color, glow, suffix }) => (
            <div
              key={label}
              className="rounded-2xl px-4 py-3 backdrop-blur-xl"
              style={{
                background:  'var(--ag-bg-surface)',
                boxShadow:   `0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px ${glow === 'transparent' ? 'rgba(139,92,246,0.06)' : color + '22'}${glow !== 'transparent' ? `, 0 0 20px ${glow}` : ''}`,
              }}
            >
              <p className="text-xs text-[var(--ag-text-muted)] mb-0.5">{label}</p>
              <p className="text-2xl font-bold" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
                {value}{suffix ?? ''}
              </p>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* Search + view controls */}
      <BlurFade delay={0.24} inView>
        <div
          className="rounded-2xl p-3 backdrop-blur-xl space-y-2.5"
          style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.06)' }}
        >
          {/* Search row */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ag-text-muted)] pointer-events-none" />
              <Input
                placeholder="Search reminders…"
                value={searchQuery}
                onChange={e => onSearchQueryChange(e.target.value)}
                className="pl-10 min-h-[44px] bg-transparent border-[var(--ag-border-subtle)] focus:border-[var(--ag-border-active)] transition-[border-color,box-shadow]"
                style={{ boxShadow: searchQuery ? '0 0 0 1px rgba(139,92,246,0.2)' : undefined }}
              />
            </div>
            {/* Sort */}
            <div className="flex items-center rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}>
              {(['priority', 'due'] as const).map(mode => (
                <motion.button key={mode} whileTap={{ scale: 0.94 }}
                  onClick={() => onSortModeChange(mode)}
                  aria-label={`Sort by ${mode}`}
                  className={`px-3 min-h-[44px] text-xs font-medium transition-[background-color,color] duration-150 ${sortMode === mode ? 'text-[#A78BFA]' : 'text-[var(--ag-text-muted)]'}`}
                  style={{ background: sortMode === mode ? 'rgba(167,139,250,0.12)' : 'transparent' }}
                >
                  {mode === 'priority' ? 'P↑' : 'Due↑'}
                </motion.button>
              ))}
            </div>
            {/* Group */}
            <div className="flex items-center rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => onGroupModeChange('date')} aria-label="Group by date"
                className={`p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-150 ${groupMode === 'date' ? 'text-[#84CC16]' : 'text-[var(--ag-text-muted)]'}`}
                style={{ background: groupMode === 'date' ? 'rgba(132,204,22,0.1)' : 'transparent' }}
              ><Calendar className="w-4 h-4" /></motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => onGroupModeChange('category')} aria-label="Group by category"
                className={`p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-150 ${groupMode === 'category' ? 'text-[#A78BFA]' : 'text-[var(--ag-text-muted)]'}`}
                style={{ background: groupMode === 'category' ? 'rgba(167,139,250,0.1)' : 'transparent' }}
              ><LayoutGrid className="w-4 h-4" /></motion.button>
            </div>
            {/* View */}
            <div className="flex items-center rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => onViewModeChange('list')} aria-label="List view"
                className={`p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-150 ${viewMode === 'list' ? 'text-[#84CC16]' : 'text-[var(--ag-text-muted)]'}`}
                style={{ background: viewMode === 'list' ? 'rgba(132,204,22,0.1)' : 'transparent' }}
              ><List className="w-4 h-4" /></motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => onViewModeChange('calendar')} aria-label="Calendar view"
                className={`p-3 min-h-[44px] min-w-[44px] flex items-center justify-center transition-[background-color,color] duration-150 ${viewMode === 'calendar' ? 'text-[#84CC16]' : 'text-[var(--ag-text-muted)]'}`}
                style={{ background: viewMode === 'calendar' ? 'rgba(132,204,22,0.1)' : 'transparent' }}
              ><LayoutGrid className="w-4 h-4" /></motion.button>
            </div>
          </div>

          {/* Status + recurrence tabs + export */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {(['all', 'active', 'completed'] as const).map(v => (
              <motion.button key={v} whileTap={{ scale: 0.96 }}
                onClick={() => onFilterChange(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap min-h-[36px] transition-[background-color,color,box-shadow] duration-150 ${filter === v ? 'text-[var(--ag-text-primary)]' : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)]'}`}
                style={{ background: filter === v ? 'rgba(167,139,250,0.15)' : 'transparent', boxShadow: filter === v ? '0 0 0 1px rgba(167,139,250,0.25)' : 'none' }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </motion.button>
            ))}
            <div className="w-px h-5 bg-[var(--ag-border-subtle)] mx-1 flex-shrink-0" />
            {(['all', 'recurring', 'one-off'] as const).map(v => (
              <motion.button key={v} whileTap={{ scale: 0.96 }}
                onClick={() => onRecurrenceFilterChange(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap min-h-[36px] transition-[background-color,color,box-shadow] duration-150 ${recurrenceFilter === v ? 'text-[#F59E0B]' : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)]'}`}
                style={{ background: recurrenceFilter === v ? 'rgba(245,158,11,0.1)' : 'transparent', boxShadow: recurrenceFilter === v ? '0 0 0 1px rgba(245,158,11,0.25)' : 'none' }}
              >
                {v === 'all' ? 'All types' : v === 'recurring' ? '↺ Recurring' : '• One-off'}
              </motion.button>
            ))}
            <div className="ml-auto flex items-center gap-1 flex-shrink-0">
              <motion.button whileTap={{ scale: 0.94 }}
                onClick={onExportCsv}
                className="px-2 py-1.5 rounded-lg text-xs text-[var(--ag-text-muted)] hover:text-[#84CC16] transition-colors min-h-[36px] flex items-center gap-1"
                style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}
                aria-label="Export reminders as CSV"
              ><Download className="w-3 h-3" />CSV</motion.button>
              <motion.button whileTap={{ scale: 0.94 }}
                onClick={onExportIcs}
                className="px-2 py-1.5 rounded-lg text-xs text-[var(--ag-text-muted)] hover:text-[#84CC16] transition-colors min-h-[36px] flex items-center gap-1"
                style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}
                aria-label="Export reminders as iCalendar"
              ><Download className="w-3 h-3" />iCal</motion.button>
            </div>
          </div>

          {/* Category + Priority filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {(['all', 'personal', 'work', 'health', 'other'] as const).map(cat => {
              const hex = cat === 'all' ? '#A78BFA' : (categoryHex[cat] ?? '#6B7280');
              const on  = categoryFilter === cat;
              return (
                <motion.button key={cat} whileTap={{ scale: 0.94 }}
                  onClick={() => onCategoryFilterChange(cat)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap min-h-[36px] transition-[background-color,color,box-shadow] duration-150"
                  style={{ color: on ? hex : 'var(--ag-text-muted)', background: on ? `${hex}18` : 'transparent', boxShadow: on ? `0 0 0 1px ${hex}44` : '0 0 0 1px rgba(139,92,246,0.08)' }}
                >
                  {cat === 'all' ? 'All cats' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </motion.button>
              );
            })}
            <div className="w-px h-5 bg-[var(--ag-border-subtle)] mx-1 flex-shrink-0" />
            {(['all', 'urgent', 'high', 'normal', 'low'] as const).map(pri => {
              const cfg = pri === 'all' ? null : priorityConfig[pri];
              const hex = cfg?.hex ?? '#A78BFA';
              const on  = priorityFilter === pri;
              return (
                <motion.button key={pri} whileTap={{ scale: 0.94 }}
                  onClick={() => onPriorityFilterChange(pri)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap min-h-[36px] transition-[background-color,color,box-shadow] duration-150"
                  style={{ color: on ? hex : 'var(--ag-text-muted)', background: on ? `${hex}18` : 'transparent', boxShadow: on ? `0 0 0 1px ${hex}44` : '0 0 0 1px rgba(139,92,246,0.08)' }}
                >
                  {pri === 'all' ? 'All priorities' : cfg?.label ?? pri}
                </motion.button>
              );
            })}
            {hasActiveFilters && (
              <motion.button whileTap={{ scale: 0.94 }}
                onClick={onClearFilters}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 whitespace-nowrap min-h-[36px] transition-colors ml-1"
                style={{ color: '#FF2D78', background: 'rgba(255,45,120,0.08)', boxShadow: '0 0 0 1px rgba(255,45,120,0.2)' }}
              >
                <X className="w-3 h-3" /> Clear all
              </motion.button>
            )}
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
