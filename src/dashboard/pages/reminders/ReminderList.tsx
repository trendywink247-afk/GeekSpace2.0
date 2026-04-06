// ─── ReminderList — active reminders with grouping + bulk action bar ─────────
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCheck, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { BlurFade } from '@/components/magicui/blur-fade';
import type { Reminder } from '@/types';
import { ReminderCard } from './ReminderCard';
import {
  listVariants, groupRemindersByCategory, groupRemindersByDate,
  groupHeaderAccent, categoryHex,
} from './helpers';
import type { ReminderCardState, ReminderCardHandlers, GroupMode } from './types';

interface ReminderListProps {
  reminders: Reminder[];
  allActiveReminders: Reminder[];
  groupMode: GroupMode;
  isGrouped: boolean;
  selectedActiveIds: Set<string>;
  isBulkSnoozing: boolean;
  isBulkCompleting: boolean;
  isBulkDeletingActive: boolean;
  isBatchEditing: boolean;
  cardState: ReminderCardState;
  cardHandlers: ReminderCardHandlers;
  onSelectAllActive: (checked: boolean) => void;
  onBulkSnooze: (preset: '1h' | 'tomorrow' | 'next-week') => Promise<void>;
  onBulkComplete: () => Promise<void>;
  onBulkDeleteActive: () => Promise<void>;
  onBatchEdit: (ids: string[], fields: { priority?: string; category?: string }) => Promise<void>;
}

export function ReminderList({
  reminders, allActiveReminders, groupMode, isGrouped,
  selectedActiveIds, isBulkSnoozing, isBulkCompleting, isBulkDeletingActive,
  isBatchEditing, cardState, cardHandlers,
  onSelectAllActive, onBulkSnooze, onBulkComplete, onBulkDeleteActive, onBatchEdit,
}: ReminderListProps) {
  const hasSelected = selectedActiveIds.size > 0;

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      {allActiveReminders.length > 0 && (
        <BlurFade delay={0.28} inView>
          <div
            className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap backdrop-blur-xl"
            data-testid="bulk-snooze-bar"
            style={{ background: 'var(--ag-bg-surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(139,92,246,0.06)' }}
          >
            <Checkbox
              id="select-all-active"
              checked={hasSelected && allActiveReminders.every(r => selectedActiveIds.has(r.id))}
              onCheckedChange={checked => onSelectAllActive(!!checked)}
              aria-label="Select all active reminders"
            />
            <label htmlFor="select-all-active" className="text-sm text-[var(--ag-text-muted)] cursor-pointer select-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
              Active ({allActiveReminders.length})
            </label>
            {hasSelected && (
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--ag-text-muted)]">Snooze {selectedActiveIds.size}:</span>
                {(['1h', 'tomorrow', 'next-week'] as const).map(p => (
                  <motion.button
                    key={p} whileTap={{ scale: 0.94 }}
                    onClick={() => void onBulkSnooze(p)} disabled={isBulkSnoozing}
                    className="text-xs px-3 py-2 rounded-lg disabled:opacity-50 transition-colors min-h-[36px]"
                    style={{ background: 'rgba(245,158,11,0.1)', boxShadow: '0 0 0 1px rgba(245,158,11,0.25)', color: '#F59E0B' }}
                  >
                    {p === '1h' ? '+1h' : p === 'tomorrow' ? 'Tomorrow' : 'Next week'}
                  </motion.button>
                ))}
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => void onBulkComplete()} disabled={isBulkCompleting}
                  className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg disabled:opacity-50 transition-colors min-h-[36px]"
                  style={{ background: 'rgba(16,185,129,0.1)', boxShadow: '0 0 0 1px rgba(16,185,129,0.25)', color: '#10B981' }}
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Done
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => void onBulkDeleteActive()} disabled={isBulkDeletingActive}
                  className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg disabled:opacity-50 transition-colors min-h-[36px]"
                  style={{ background: 'rgba(255,45,120,0.1)', boxShadow: '0 0 0 1px rgba(255,45,120,0.25)', color: '#FF2D78' }}
                  aria-label="Delete selected active reminders"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedActiveIds.size})
                </motion.button>
                <select
                  disabled={isBatchEditing}
                  onChange={e => { if (e.target.value) { void onBatchEdit(Array.from(selectedActiveIds), { priority: e.target.value }); e.target.value = ''; } }}
                  className="text-xs px-2 py-2 rounded-lg bg-[var(--ag-bg-surface)] disabled:opacity-50 min-h-[36px] text-[#A78BFA]"
                  style={{ boxShadow: '0 0 0 1px rgba(167,139,250,0.25)' }}
                  aria-label="Set priority for selected reminders"
                >
                  <option value="">Priority…</option>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select
                  disabled={isBatchEditing}
                  onChange={e => { if (e.target.value) { void onBatchEdit(Array.from(selectedActiveIds), { category: e.target.value }); e.target.value = ''; } }}
                  className="text-xs px-2 py-2 rounded-lg bg-[var(--ag-bg-surface)] disabled:opacity-50 min-h-[36px] text-[#A78BFA]"
                  style={{ boxShadow: '0 0 0 1px rgba(167,139,250,0.25)' }}
                  aria-label="Set category for selected reminders"
                >
                  <option value="">Category…</option>
                  <option value="personal">Personal</option>
                  <option value="work">Work</option>
                  <option value="health">Health</option>
                  <option value="finance">Finance</option>
                  <option value="general">General</option>
                </select>
                {isBulkSnoozing && <div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin" />}
              </div>
            )}
          </div>
        </BlurFade>
      )}

      {/* List */}
      {isGrouped ? (
        <div className="space-y-5">
          {(groupMode === 'category'
            ? groupRemindersByCategory(reminders)
            : groupRemindersByDate(reminders)
          ).map(({ label, items }) => {
            const accent = groupMode === 'date'
              ? (groupHeaderAccent[label] ?? '#6B7280')
              : (categoryHex[label.toLowerCase()] ?? '#A78BFA');
            return (
              <div key={label}>
                {/* Group header */}
                <div className="flex items-center gap-2.5 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}80` }} />
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
                    {label}
                  </span>
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded-full ml-0.5"
                    style={{ color: accent, background: `${accent}18`, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {items.length}
                  </span>
                  <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${accent}20, transparent)` }} />
                </div>
                <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-2">
                  {items.map(r => (
                    <ReminderCard key={r.id} reminder={r} state={cardState} handlers={cardHandlers} />
                  ))}
                </motion.div>
              </div>
            );
          })}
        </div>
      ) : (
        <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-2">
          <AnimatePresence initial={false} mode="popLayout">
            {reminders.map(r => (
              <ReminderCard key={r.id} reminder={r} state={cardState} handlers={cardHandlers} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
