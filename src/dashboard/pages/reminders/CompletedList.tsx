// ─── CompletedList — completed reminders with bulk restore / delete bar ───────
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Reminder } from '@/types';
import { ReminderCard } from './ReminderCard';
import { listVariants } from './helpers';
import type { ReminderCardState, ReminderCardHandlers } from './types';

interface CompletedListProps {
  reminders: Reminder[];
  selectedIds: Set<string>;
  isBulkDeleting: boolean;
  isBulkRestoringSnooze: boolean;
  cardState: ReminderCardState;
  cardHandlers: ReminderCardHandlers;
  onSelectAll: (checked: boolean) => void;
  onBulkDelete: () => Promise<void>;
  onBulkRestoreSnooze: (preset: '1h' | 'tomorrow' | 'next-week') => Promise<void>;
}

export function CompletedList({
  reminders, selectedIds, isBulkDeleting, isBulkRestoringSnooze,
  cardState, cardHandlers,
  onSelectAll, onBulkDelete, onBulkRestoreSnooze,
}: CompletedListProps) {
  const hasSelected = selectedIds.size > 0;

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap backdrop-blur-xl"
        style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.06)' }}
      >
        <Checkbox
          id="select-all-completed"
          checked={hasSelected && reminders.every(r => selectedIds.has(r.id))}
          onCheckedChange={checked => onSelectAll(!!checked)}
          aria-label="Select all completed reminders"
        />
        <label htmlFor="select-all-completed" className="text-sm text-[var(--ag-text-muted)] cursor-pointer select-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
          Completed ({reminders.length})
        </label>
        {hasSelected && (
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--ag-text-muted)]">Restore {selectedIds.size}:</span>
            {(['1h', 'tomorrow', 'next-week'] as const).map(p => (
              <motion.button
                key={p} whileTap={{ scale: 0.94 }}
                onClick={() => void onBulkRestoreSnooze(p)} disabled={isBulkRestoringSnooze}
                className="text-xs px-3 py-2 rounded-lg disabled:opacity-50 transition-colors min-h-[36px]"
                style={{ background: 'rgba(245,158,11,0.1)', boxShadow: '0 0 0 1px rgba(245,158,11,0.25)', color: '#F59E0B' }}
              >
                {p === '1h' ? '+1h' : p === 'tomorrow' ? 'Tomorrow' : 'Next week'}
              </motion.button>
            ))}
            {isBulkRestoringSnooze && (
              <div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" />
            )}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => void onBulkDelete()} disabled={isBulkDeleting}
              className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg disabled:opacity-50 min-h-[36px]"
              style={{ background: 'rgba(255,45,120,0.1)', boxShadow: '0 0 0 1px rgba(255,45,120,0.25)', color: '#FF2D78' }}
            >
              {isBulkDeleting
                ? <div className="w-3.5 h-3.5 border-2 border-[#FF2D78]/30 border-t-[#FF2D78] rounded-full animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />
              }
              Delete ({selectedIds.size})
            </motion.button>
          </div>
        )}
      </div>

      {/* List */}
      <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {reminders.map(r => (
            <ReminderCard key={r.id} reminder={r} state={cardState} handlers={cardHandlers} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
