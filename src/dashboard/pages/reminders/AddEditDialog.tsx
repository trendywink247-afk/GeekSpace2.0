// ─── AddEditDialog — create / edit reminder (NL + manual form) ───────────────
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Repeat, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Reminder, ReminderCategory } from '@/types';
import { parseNaturalLanguageReminder } from '@/utils/reminder-parser';
import type { ParsedReminder } from '@/utils/reminder-parser';
import { humanDue, priorityConfig } from './helpers';
import type { NewReminderForm } from './types';

interface AddEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingReminder: Reminder | null;
  newReminder: NewReminderForm;
  setNewReminder: (v: NewReminderForm) => void;
  onNaturalAdd: (parsed: ParsedReminder) => Promise<void>;
  onLegacyAdd: () => Promise<void>;
  onEditSave: () => Promise<void>;
}

export function AddEditDialog({
  open, onOpenChange, editingReminder,
  newReminder, setNewReminder,
  onNaturalAdd, onLegacyAdd, onEditSave,
}: AddEditDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [naturalInput,   setNaturalInput]   = useState('');
  const parsedReminder = useMemo(
    () => naturalInput.trim() ? parseNaturalLanguageReminder(naturalInput) : null,
    [naturalInput],
  );

  // Reset NL state when dialog closes
  useEffect(() => {
    if (!open) { setTimeout(() => setNaturalInput(''), 0); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border-[var(--ag-border-subtle)] backdrop-blur-xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--ag-bg-elevated)', boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.12)' }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[var(--ag-text-primary)]">
            {editingReminder ? 'Edit Reminder' : 'Add Reminder'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* NL input — new mode only */}
          {!editingReminder && (
            <>
              <div>
                <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-2 block">
                  Type naturally (e.g., "tomorrow at 3pm call mom")
                </label>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    data-testid="reminder-text"
                    placeholder="Remind me…"
                    value={naturalInput}
                    onChange={e => setNaturalInput(e.target.value)}
                    className="flex-1 min-h-[44px] border-[var(--ag-border-subtle)] focus:border-[var(--ag-border-active)]"
                    autoFocus
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => parsedReminder && void onNaturalAdd(parsedReminder)}
                    disabled={!parsedReminder}
                    className="p-3 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center text-white disabled:opacity-40 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)' }}
                  >
                    <Wand2 className="w-4 h-4" />
                  </motion.button>
                </div>
                <AnimatePresence>
                  {parsedReminder && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0, transition: { type: 'spring', duration: 0.3, bounce: 0 } }}
                      exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                      className="mt-3 p-3.5 rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.06)', boxShadow: '0 0 0 1px rgba(16,185,129,0.15)' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ag-text-muted)]">Will create</span>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color:       parsedReminder.confidence > 0.8 ? '#10B981' : parsedReminder.confidence > 0.5 ? '#F59E0B' : '#FF2D78',
                            background:  parsedReminder.confidence > 0.8 ? 'rgba(16,185,129,0.1)' : parsedReminder.confidence > 0.5 ? 'rgba(245,158,11,0.1)' : 'rgba(255,45,120,0.1)',
                          }}
                        >
                          {Math.round(parsedReminder.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[var(--ag-text-primary)]">{parsedReminder.text}</p>
                      <p className="text-xs text-[#F59E0B] mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {parsedReminder.datetime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {parsedReminder.recurring && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-[#84CC16]/12 text-[#84CC16] border-[#84CC16]/20 ml-1">
                            <Repeat className="w-2.5 h-2.5 mr-0.5" />{parsedReminder.recurring}
                          </Badge>
                        )}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-px" style={{ background: 'var(--ag-border-subtle)' }} />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-xs text-[var(--ag-text-muted)]" style={{ background: 'var(--ag-bg-elevated)' }}>Or manually</span>
                </div>
              </div>
            </>
          )}

          {/* Manual form */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-1.5 block">What to remind?</label>
              <Input
                placeholder="Enter reminder text…"
                value={newReminder.text}
                onChange={e => setNewReminder({ ...newReminder, text: e.target.value })}
                className="min-h-[44px] border-[var(--ag-border-subtle)] focus:border-[var(--ag-border-active)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-1.5 block">When?</label>
                <Input
                  type="datetime-local"
                  value={newReminder.datetime}
                  onChange={e => setNewReminder({ ...newReminder, datetime: e.target.value })}
                  className="min-h-[44px] border-[var(--ag-border-subtle)] focus:border-[var(--ag-border-active)]"
                />
                {editingReminder && newReminder.datetime && (
                  <p className="text-xs text-[#84CC16] mt-1.5 font-medium">
                    {humanDue(new Date(newReminder.datetime).toISOString())}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {([
                    { label: '+1h',      fn: () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 16) },
                    { label: 'Tmrw 9am', fn: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString().slice(0, 16); } },
                    { label: 'Mon 9am',  fn: () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day)); d.setHours(9, 0, 0, 0); return d.toISOString().slice(0, 16); } },
                    { label: '+1 week',  fn: () => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16) },
                  ] as const).map(({ label, fn }) => (
                    <motion.button
                      key={label} whileTap={{ scale: 0.94 }} type="button"
                      onClick={() => setNewReminder({ ...newReminder, datetime: fn() })}
                      className="px-2.5 py-2 rounded-lg text-xs text-[var(--ag-text-muted)] hover:text-[#84CC16] transition-[color,box-shadow] min-h-[36px]"
                      style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}
                    >
                      {label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-1.5 block">Category</label>
                <select
                  value={newReminder.category}
                  onChange={e => setNewReminder({ ...newReminder, category: e.target.value as ReminderCategory })}
                  className="w-full px-3 py-2 rounded-xl text-sm min-h-[44px] focus:outline-none text-[var(--ag-text-primary)]"
                  style={{ background: 'rgba(255,255,255,0.04)', boxShadow: '0 0 0 1px rgba(139,92,246,0.12)' }}
                >
                  <option value="personal">Personal</option>
                  <option value="work">Work</option>
                  <option value="health">Health</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Recurrence */}
            <div>
              <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-2 block">Recurrence</label>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { label: 'Never',   value: '' as const,        desc: 'One-time'    },
                  { label: 'Daily',   value: 'daily' as const,   desc: 'Every day'   },
                  { label: 'Weekly',  value: 'weekly' as const,  desc: 'Every week'  },
                  { label: 'Monthly', value: 'monthly' as const, desc: 'Every month' },
                ] as { label: string; value: 'daily' | 'weekly' | 'monthly' | ''; desc: string }[]).map(({ label, value, desc }) => {
                  const active = (newReminder.recurrence || '') === value;
                  return (
                    <motion.button
                      key={value || 'never'} type="button" whileTap={{ scale: 0.94 }}
                      onClick={() => setNewReminder({ ...newReminder, recurrence: value, recurring: value })}
                      className="flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl text-center transition-[background-color,color,box-shadow] duration-150 min-h-[56px]"
                      style={{
                        background:  active ? 'rgba(132,204,22,0.1)' : 'rgba(255,255,255,0.03)',
                        boxShadow:   active ? '0 0 0 1.5px #84CC1680' : '0 0 0 1px rgba(139,92,246,0.1)',
                        color:       active ? '#84CC16' : 'var(--ag-text-muted)',
                      }}
                    >
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-[10px] opacity-60">{desc}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div data-testid="priority-selector">
              <label className="text-xs font-medium text-[var(--ag-text-muted)] mb-2 block">Priority</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['low', 'normal', 'high', 'urgent'] as const).map(p => {
                  const cfg    = priorityConfig[p];
                  const active = newReminder.priority === p;
                  return (
                    <motion.button
                      key={p} type="button" whileTap={{ scale: 0.94 }}
                      onClick={() => setNewReminder({ ...newReminder, priority: p })}
                      className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-[background-color,box-shadow] duration-150 min-h-[52px]"
                      style={{
                        background: active ? cfg.bg : 'rgba(255,255,255,0.03)',
                        boxShadow:  active ? `0 0 0 1.5px ${cfg.hex}60` : '0 0 0 1px rgba(139,92,246,0.1)',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.hex }} />
                      <span className="text-xs font-medium" style={{ color: active ? cfg.color : 'var(--ag-text-muted)' }}>{cfg.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-2" style={{ borderTop: '1px solid var(--ag-border-subtle)' }}>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[44px]"
            >
              Cancel
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              data-testid="submit-reminder-btn"
              onClick={editingReminder ? () => void onEditSave() : () => void onLegacyAdd()}
              disabled={!newReminder.text || !newReminder.datetime}
              className="text-white min-h-[44px] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--ag-violet), #7C3AED)' }}
            >
              {editingReminder ? 'Save Changes' : 'Add Reminder'}
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
