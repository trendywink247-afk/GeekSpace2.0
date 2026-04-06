// ─── ReminderCard — single reminder item with all inline actions ─────────────
import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlarmClock, Repeat, Pencil, Trash2, Check, Copy } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { Reminder, ReminderPriority } from '@/types';
import {
  categoryHex, priorityConfig, cardVariants,
  formatRelativeTime, humanDue, formatDateTime,
  isOverdue, isDueSoon,
} from './helpers';
import type { ReminderCardState, ReminderCardHandlers } from './types';

interface ReminderCardProps {
  reminder: Reminder;
  state: ReminderCardState;
  handlers: ReminderCardHandlers;
}

export function ReminderCard({ reminder, state, handlers }: ReminderCardProps) {
  const inlineEditRef = useRef<HTMLInputElement>(null);

  const {
    selectedActiveIds, selectedIds, completingIds, justCompletedIds,
    snoozeOpenId, snoozeCustomId, snoozeCustomValue,
    snoozeHistoryId, snoozeHistory, snoozeHistoryLoading,
    inlineEditId, inlineEditValue, duplicatingId,
  } = state;

  const {
    onToggleSelectActive, onToggleSelect, onComplete, onSnooze,
    onSnoozeCustom, onDuplicate, onEditClick, onDelete,
    onSetSnoozeOpenId, onSetSnoozeCustomId, onSetSnoozeCustomValue,
    onSetInlineEditId, onSetInlineEditValue, onInlineEditSave,
    onShowSnoozeHistory, onUpdatePriority,
  } = handlers;

  // eslint-disable-next-line react-hooks/purity
  const nowMs          = Date.now();
  const formatted      = formatDateTime(reminder.datetime);
  const overdue        = isOverdue(reminder.datetime, reminder.completed);
  const dueSoon        = isDueSoon(reminder.datetime, !!reminder.completed);
  const isCompleting   = completingIds.has(reminder.id);
  const isJustComplete = justCompletedIds.has(reminder.id);

  const stripeHex = overdue && !reminder.completed
    ? '#FF2D78'
    : (priorityConfig[reminder.priority ?? 'normal']?.hex ?? '#A78BFA');
  const catHex = categoryHex[reminder.category] ?? '#6B7280';

  return (
    <motion.div
      variants={cardVariants}
      layout
      data-testid={`reminder-card-${reminder.id}`}
      className={[
        'rounded-2xl transition-[background-color,opacity] duration-300',
        'bg-[var(--ag-bg-surface)] backdrop-blur-xl',
        reminder.completed ? 'opacity-55' : '',
        isJustComplete     ? 'bg-[rgba(16,185,129,0.06)]' : '',
      ].join(' ')}
      style={{
        borderLeft: `3px solid ${stripeHex}`,
        boxShadow: isCompleting
          ? 'inset 3px 0 0 #10B981, 0 0 0 1px rgba(16,185,129,0.2), 0 4px 16px rgba(16,185,129,0.1)'
          : overdue && !reminder.completed
          ? 'inset 3px 0 0 #FF2D78, 0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,45,120,0.08)'
          : `inset 3px 0 0 ${stripeHex}, 0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div className="p-4 flex items-start gap-3">
        {/* Bulk checkbox */}
        {!reminder.completed ? (
          <Checkbox
            checked={selectedActiveIds.has(reminder.id)}
            onCheckedChange={() => onToggleSelectActive(reminder.id)}
            aria-label="Select reminder for bulk snooze"
            className="mt-1 flex-shrink-0"
          />
        ) : (
          <Checkbox
            checked={selectedIds.has(reminder.id)}
            onCheckedChange={() => onToggleSelect(reminder.id)}
            aria-label="Select reminder for bulk delete"
            className="mt-1 flex-shrink-0"
          />
        )}

        {/* Date chip */}
        <div
          className="flex-shrink-0 w-12 rounded-xl flex flex-col items-center justify-center py-2 text-center"
          style={{
            background: overdue && !reminder.completed
              ? 'rgba(255,45,120,0.1)'
              : `rgba(${stripeHex.replace('#','').match(/.{2}/g)!.map(h => parseInt(h, 16)).join(',')},0.1)`,
          }}
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-wider leading-none mb-0.5"
            style={{ color: overdue && !reminder.completed ? '#FF2D78' : stripeHex, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatted.month}
          </span>
          <span
            className="text-xl font-bold leading-none"
            style={{ color: overdue && !reminder.completed ? '#FF2D78' : 'var(--ag-text-primary)', fontVariantNumeric: 'tabular-nums' }}
          >
            {formatted.day}
          </span>
          <span className="text-[10px] text-[var(--ag-text-muted)] leading-none mt-0.5">{formatted.weekday}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Title / inline edit */}
              {inlineEditId === reminder.id ? (
                <input
                  ref={inlineEditRef}
                  autoFocus
                  className="w-full bg-white/[0.05] border border-[var(--ag-border-default)] rounded-lg px-2 py-1 text-[var(--ag-text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ag-violet)]/40 min-h-[44px]"
                  value={inlineEditValue}
                  onChange={e => onSetInlineEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  void onInlineEditSave(reminder.id);
                    if (e.key === 'Escape') { onSetInlineEditId(null); onSetInlineEditValue(''); }
                  }}
                  onBlur={() => void onInlineEditSave(reminder.id)}
                />
              ) : (
                <p
                  title="Click to edit"
                  onClick={() => {
                    if (!reminder.completed) {
                      onSetInlineEditId(reminder.id);
                      onSetInlineEditValue(reminder.text);
                    }
                  }}
                  className={[
                    'text-sm font-medium cursor-text rounded-lg px-1 -mx-1 transition-colors duration-200 hover:bg-white/[0.04]',
                    isCompleting
                      ? 'line-through text-[var(--ag-text-muted)] opacity-60'
                      : reminder.completed
                      ? 'line-through text-[var(--ag-text-muted)]'
                      : 'text-[var(--ag-text-primary)]',
                  ].join(' ')}
                  style={{ textDecorationColor: isCompleting ? '#10B981' : undefined }}
                >
                  {reminder.text}
                </p>
              )}

              {/* Metadata row */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span
                  className={`text-xs flex items-center gap-1 ${overdue ? 'text-[#FF2D78]' : 'text-[var(--ag-text-muted)]'}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  {formatted.time}
                </span>

                {overdue && !reminder.completed ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FF2D78]/12 text-[#FF2D78]">Overdue</span>
                ) : !reminder.completed ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#84CC16]/10 text-[#84CC16]">
                    {humanDue(reminder.datetime)}
                  </span>
                ) : null}

                <span className="text-[10px] text-[var(--ag-text-muted)]/50" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatRelativeTime(reminder.datetime)}
                </span>

                {dueSoon && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#10B981]/12 text-[#10B981]">
                    due in {Math.ceil((new Date(reminder.datetime).getTime() - nowMs) / 3_600_000)}h
                  </span>
                )}

                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1"
                  style={{ backgroundColor: `${catHex}18`, color: catHex }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: catHex }} />
                  {reminder.category}
                </span>

                {reminder.recurring && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-[#84CC16]/12 text-[#84CC16] border-[#84CC16]/20">
                    <Repeat className="w-2.5 h-2.5 mr-0.5" />{reminder.recurring}
                  </Badge>
                )}
                {reminder.recurrence && !reminder.recurring && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-[#A78BFA]/12 text-[#A78BFA] border-[#A78BFA]/20">
                    ↺ {reminder.recurrence}
                  </Badge>
                )}

                {/* Priority quick-cycle */}
                {!reminder.completed && (
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      const order: ReminderPriority[] = ['low', 'normal', 'high', 'urgent'];
                      const cur  = order.indexOf((reminder.priority || 'normal') as ReminderPriority);
                      const next = order[(cur + 1) % order.length];
                      onUpdatePriority(reminder.id, next);
                    }}
                    title="Click to change priority"
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: priorityConfig[reminder.priority ?? 'normal']?.bg,
                      color:           priorityConfig[reminder.priority ?? 'normal']?.color,
                      borderColor:     `${priorityConfig[reminder.priority ?? 'normal']?.hex}40`,
                    }}
                  >
                    {priorityConfig[reminder.priority ?? 'normal']?.label}
                  </motion.button>
                )}

                {/* Snooze count + history popover */}
                {(reminder.snoozeCount ?? 0) > 0 && (
                  <div className="relative">
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => void onShowSnoozeHistory(reminder.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/25 hover:bg-[#F59E0B]/20 transition-colors"
                      aria-label="Show snooze history"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      Snoozed {reminder.snoozeCount}×
                    </motion.button>
                    {snoozeHistoryId === reminder.id && (
                      <div
                        className="absolute left-0 top-full mt-1.5 z-20 rounded-xl p-3 min-w-[220px]"
                        style={{ background: 'var(--ag-bg-elevated)', boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.2)' }}
                      >
                        <p className="text-xs font-semibold text-[#F59E0B] mb-2">Snooze history</p>
                        {snoozeHistoryLoading ? (
                          <div className="w-4 h-4 border-2 border-[#F59E0B]/30 border-t-[#F59E0B] rounded-full animate-spin mx-auto" />
                        ) : snoozeHistory.length === 0 ? (
                          <p className="text-xs text-[var(--ag-text-muted)]">No history yet</p>
                        ) : (
                          <>
                            <div className="space-y-1.5">
                              {snoozeHistory.map(h => (
                                <div key={h.id} className="text-xs text-[var(--ag-text-muted)]">
                                  <span className="text-[var(--ag-text-primary)]">{h.preset}</span>{' → '}
                                  {new Date(h.new_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              ))}
                            </div>
                            {(() => {
                              const counts: Record<string, number> = {};
                              snoozeHistory.forEach(h => { counts[h.preset] = (counts[h.preset] ?? 0) + 1; });
                              const mostUsed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
                              return (
                                <p className="text-[10px] text-[var(--ag-text-muted)]/60 border-t border-[#F59E0B]/15 pt-1.5 mt-1.5">
                                  {snoozeHistory.length} snooze{snoozeHistory.length !== 1 ? 's' : ''}
                                  {mostUsed && <> · <span className="text-[#F59E0B]">{mostUsed}</span> most used</>}
                                </p>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {/* Complete */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => void onComplete(reminder.id)}
                aria-label={reminder.completed ? 'Mark as incomplete' : 'Mark as complete'}
                className={[
                  'p-2.5 rounded-xl transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center',
                  isCompleting         ? 'bg-[#10B981]/25 text-[#10B981]'
                  : reminder.completed ? 'bg-[#10B981]/15 text-[#10B981]'
                  : 'text-[var(--ag-text-muted)] hover:bg-[#10B981]/10 hover:text-[#10B981]',
                ].join(' ')}
              >
                <Check className={`w-4 h-4 ${isCompleting ? 'scale-125' : ''} transition-transform duration-200`} />
              </motion.button>

              {/* Snooze */}
              {!reminder.completed && (
                <div className="relative">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onSetSnoozeOpenId(snoozeOpenId === reminder.id ? null : reminder.id)}
                    aria-label="Snooze reminder"
                    className="p-2.5 rounded-xl text-[var(--ag-text-muted)] hover:bg-[#F59E0B]/10 hover:text-[#F59E0B] transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <AlarmClock className="w-4 h-4" />
                  </motion.button>
                  <AnimatePresence>
                    {snoozeOpenId === reminder.id && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.25, bounce: 0 } }}
                        exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.15 } }}
                        className="absolute right-0 top-full mt-1.5 z-10 rounded-xl p-1.5 flex flex-col gap-0.5 min-w-[140px]"
                        style={{ background: 'var(--ag-bg-elevated)', boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.15)' }}
                      >
                        {(['1h', 'tomorrow', 'next-week'] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => void onSnooze(reminder.id, p)}
                            className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#F59E0B]/10 text-[var(--ag-text-primary)] whitespace-nowrap transition-colors"
                          >
                            {p === '1h' ? '+1 hour' : p === 'tomorrow' ? 'Tomorrow 9am' : 'Next week'}
                          </button>
                        ))}
                        <button
                          onClick={() => onSetSnoozeCustomId(snoozeCustomId === reminder.id ? null : reminder.id)}
                          className="text-xs text-left px-3 py-2 rounded-lg hover:bg-[#F59E0B]/10 text-[#F59E0B] whitespace-nowrap transition-colors"
                        >
                          Custom time…
                        </button>
                        {snoozeCustomId === reminder.id && (
                          <div className="flex gap-1 mt-1 px-1 pb-1">
                            <input
                              type="datetime-local"
                              className="text-xs border border-[#F59E0B]/25 rounded-lg px-2 py-1 bg-transparent text-[var(--ag-text-primary)] flex-1 min-w-0 focus:outline-none focus:border-[#F59E0B]/60"
                              value={snoozeCustomValue}
                              onChange={e => onSetSnoozeCustomValue(e.target.value)}
                            />
                            <button
                              onClick={() => void onSnoozeCustom(reminder.id)}
                              className="text-xs px-2 py-1 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B] hover:bg-[#F59E0B]/25 whitespace-nowrap transition-colors"
                            >
                              Set
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Duplicate */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => void onDuplicate(reminder.id)}
                aria-label="Duplicate reminder"
                disabled={duplicatingId === reminder.id}
                className="p-2.5 rounded-xl text-[var(--ag-text-muted)] hover:bg-[#84CC16]/10 hover:text-[#84CC16] transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-40"
              >
                <Copy className="w-4 h-4" />
              </motion.button>

              {/* Edit */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => onEditClick(reminder)}
                aria-label="Edit reminder"
                className="p-2.5 rounded-xl text-[var(--ag-text-muted)] hover:bg-[#A78BFA]/10 hover:text-[#A78BFA] transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Pencil className="w-4 h-4" />
              </motion.button>

              {/* Delete */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => void onDelete(reminder.id)}
                aria-label="Delete reminder"
                className="p-2.5 rounded-xl text-[var(--ag-text-muted)] hover:bg-[#FF2D78]/10 hover:text-[#FF2D78] transition-[background-color,color] duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
