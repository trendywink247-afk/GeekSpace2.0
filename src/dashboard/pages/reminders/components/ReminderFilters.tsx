/**
 * ReminderFilters — Aurora-styled filter bar using agentin primitives.
 * Replaces StatsBar with StatCard, PillButton, and Chip components.
 */
import { memo } from 'react';
import { Search, X, Download, List, Calendar, LayoutGrid, Bell, CheckCheck, AlarmClock, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Input } from '@/components/ui/input';
import { StatCard, PillButton, Chip } from '@/components/ui/agentin';
import type {
  FilterStatus, FilterRecurrence, FilterCategory,
  FilterPriority, SortMode, GroupMode, ViewMode, StatsBarProps,
} from '../types';

export const ReminderFilters = memo(function ReminderFilters({
  activeCount, overdueCount, completedCount, streak,
  filter, recurrenceFilter, categoryFilter, priorityFilter,
  searchQuery, sortMode, groupMode, viewMode, hasActiveFilters,
  onFilterChange, onRecurrenceFilterChange, onCategoryFilterChange, onPriorityFilterChange,
  onSearchQueryChange, onSortModeChange, onGroupModeChange, onViewModeChange,
  onClearFilters, onExportCsv, onExportIcs,
}: StatsBarProps) {
  return (
    <div className="space-y-3">
      {/* Stats row */}
      <BlurFade delay={0.12} inView>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="ACTIVE"    value={activeCount}    icon={Bell}         accent="violet" />
          <StatCard label="OVERDUE"   value={overdueCount}   icon={AlarmClock}   accent={overdueCount > 0 ? 'coral' : 'none'} />
          <StatCard label="COMPLETED" value={completedCount} icon={CheckCheck}   accent="emerald" />
          <StatCard label="STREAK"    value={streak > 0 ? `${streak}d` : '—'} icon={Flame} accent={streak > 0 ? 'amber' : 'none'} />
        </div>
      </BlurFade>

      {/* Search + controls */}
      <BlurFade delay={0.18} inView>
        <div
          className="rounded-2xl p-3 backdrop-blur-xl space-y-2.5"
          style={{ background: 'var(--ag-bg-surface)', border: '1px solid var(--ag-border-subtle)' }}
        >
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--ag-text-muted)' }} />
              <Input
                placeholder="Search reminders…"
                value={searchQuery}
                onChange={e => onSearchQueryChange(e.target.value)}
                className="pl-10 min-h-[44px] bg-transparent border-[var(--ag-border-subtle)] focus:border-[var(--ag-border-active)] transition-[border-color,box-shadow]"
                style={{ boxShadow: searchQuery ? '0 0 0 1px rgba(139,92,246,0.2)' : undefined }}
              />
            </div>

            {/* View mode */}
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid var(--ag-border-subtle)' }}>
              {(['list', 'calendar'] as ViewMode[]).map((mode, i) => {
                const Icon = mode === 'list' ? List : Calendar;
                return (
                  <motion.button
                    key={mode}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => onViewModeChange(mode)}
                    className="flex items-center justify-center w-11 h-11 transition-colors"
                    style={{
                      background: viewMode === mode ? 'rgba(139,92,246,0.12)' : 'transparent',
                      color: viewMode === mode ? 'var(--ag-violet-soft)' : 'var(--ag-text-muted)',
                      borderLeft: i > 0 ? '1px solid var(--ag-border-subtle)' : 'none',
                    }}
                    aria-label={mode === 'list' ? 'List view' : 'Calendar view'}
                  >
                    <Icon className="w-4 h-4" />
                  </motion.button>
                );
              })}
            </div>

            {/* Export */}
            <div className="hidden sm:flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid var(--ag-border-subtle)' }}>
              {[{ label: 'CSV', onClick: onExportCsv }, { label: 'ICS', onClick: onExportIcs }].map(({ label, onClick }, i) => (
                <motion.button
                  key={label}
                  whileTap={{ scale: 0.92 }}
                  onClick={onClick}
                  className="flex items-center gap-1 px-2.5 h-11 text-[11px] font-mono transition-colors"
                  style={{ color: 'var(--ag-text-muted)', borderLeft: i > 0 ? '1px solid var(--ag-border-subtle)' : 'none' }}
                  aria-label={`Export as ${label}`}
                >
                  <Download className="w-3 h-3" />
                  {label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'active', 'completed'] as FilterStatus[]).map(f => (
              <PillButton key={f} active={filter === f} accent="violet" onClick={() => onFilterChange(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </PillButton>
            ))}
            <span className="w-px self-stretch" style={{ background: 'var(--ag-border-subtle)' }} />
            {(['all', 'recurring', 'one-off'] as FilterRecurrence[]).map(f => (
              <PillButton key={f} active={recurrenceFilter === f} accent="indigo" onClick={() => onRecurrenceFilterChange(f)}>
                {f === 'all' ? 'All types' : f === 'recurring' ? 'Recurring' : 'One-off'}
              </PillButton>
            ))}
            <span className="w-px self-stretch" style={{ background: 'var(--ag-border-subtle)' }} />
            {(['all', 'personal', 'work', 'health', 'other'] as FilterCategory[]).map(f => (
              <PillButton key={f} active={categoryFilter === f} accent={f === 'work' ? 'emerald' : f === 'health' ? 'coral' : 'violet'} onClick={() => onCategoryFilterChange(f)}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </PillButton>
            ))}
            <span className="w-px self-stretch" style={{ background: 'var(--ag-border-subtle)' }} />
            {(['all', 'urgent', 'high', 'normal', 'low'] as FilterPriority[]).map(f => (
              <PillButton key={f} active={priorityFilter === f} accent={f === 'urgent' ? 'coral' : f === 'high' ? 'amber' : 'violet'} onClick={() => onPriorityFilterChange(f)}>
                {f === 'all' ? 'Any priority' : f.charAt(0).toUpperCase() + f.slice(1)}
              </PillButton>
            ))}
            <span className="w-px self-stretch" style={{ background: 'var(--ag-border-subtle)' }} />
            {(['priority', 'due'] as SortMode[]).map(m => (
              <PillButton key={m} active={sortMode === m} accent="indigo" onClick={() => onSortModeChange(m)}>
                {m === 'priority' ? 'By priority' : 'By due date'}
              </PillButton>
            ))}
            {(['date', 'category'] as GroupMode[]).map(m => (
              <PillButton key={m} active={groupMode === m} accent="violet" onClick={() => onGroupModeChange(m)}>
                <LayoutGrid className="w-3 h-3" />
                {m === 'date' ? 'By date' : 'By category'}
              </PillButton>
            ))}
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--ag-text-muted)' }}>Filtered:</span>
              {filter !== 'all'           && <Chip accent="violet" onRemove={() => onFilterChange('all')}>{filter}</Chip>}
              {recurrenceFilter !== 'all' && <Chip accent="indigo" onRemove={() => onRecurrenceFilterChange('all')}>{recurrenceFilter}</Chip>}
              {categoryFilter !== 'all'   && <Chip accent="violet" onRemove={() => onCategoryFilterChange('all')}>{categoryFilter}</Chip>}
              {priorityFilter !== 'all'   && <Chip accent="amber"  onRemove={() => onPriorityFilterChange('all')}>{priorityFilter}</Chip>}
              {searchQuery                && <Chip accent="indigo" onRemove={() => onSearchQueryChange('')}>"{searchQuery}"</Chip>}
              <button
                type="button"
                onClick={onClearFilters}
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-full transition-colors min-h-[24px]"
                style={{ color: 'var(--ag-coral)', border: '1px solid rgba(251,146,60,0.3)' }}
              >
                <X className="w-2.5 h-2.5" /> Clear all
              </button>
            </div>
          )}
        </div>
      </BlurFade>
    </div>
  );
});
