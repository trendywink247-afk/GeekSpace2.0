import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Reminder } from '@/types';
import { AddEditDialog } from '../AddEditDialog';
import type { NewReminderForm } from '../types';
import type { ParsedReminder } from '@/utils/reminder-parser';

interface ReminderComposerProps {
  open: boolean;
  editingReminder: Reminder | null;
  recurringEditChoice: Reminder | null;
  editAsOneOff: boolean;
  onOpenChange: (open: boolean) => void;
  onRecurringEditChoiceChange: (r: Reminder | null) => void;
  onEditAsOneOffChange: (v: boolean) => void;
  onNaturalAdd: (parsed: ParsedReminder) => Promise<void>;
  onLegacyAdd: (form: NewReminderForm) => Promise<void>;
  onEditSave: (form: NewReminderForm, editingReminder: Reminder | null, editAsOneOff: boolean) => Promise<void>;
  onEditClick: (reminder: Reminder, skipChoiceDialog?: boolean) => void;
}

const emptyForm: NewReminderForm = {
  text: '', datetime: '', channel: 'telegram', recurring: '', recurrence: '', category: 'personal', priority: 'normal',
};

function buildForm(r: Reminder): NewReminderForm {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date(r.datetime);
  const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const validP = ['low', 'normal', 'high', 'urgent'];
  return {
    text: r.text, datetime: local, channel: r.channel,
    recurring: r.recurring ?? '', recurrence: (r.recurrence as 'daily' | 'weekly' | 'monthly' | undefined) ?? '',
    category: r.category, priority: (validP.includes(r.priority as string) ? r.priority : 'normal') as NewReminderForm['priority'],
  };
}

export function ReminderComposer({ open, editingReminder, recurringEditChoice, editAsOneOff, onOpenChange,
  onRecurringEditChoiceChange, onEditAsOneOffChange, onNaturalAdd, onLegacyAdd, onEditSave, onEditClick }: ReminderComposerProps) {
  const [form, setForm] = useState<NewReminderForm>(emptyForm);
  useEffect(() => { setTimeout(() => setForm(editingReminder ? buildForm(editingReminder) : emptyForm), 0); }, [editingReminder]);

  return (
    <>
      <AddEditDialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) setForm(emptyForm); }}
        editingReminder={editingReminder} newReminder={form} setNewReminder={setForm}
        onNaturalAdd={onNaturalAdd}
        onLegacyAdd={async () => { await onLegacyAdd(form); setForm(emptyForm); }}
        onEditSave={async () => { await onEditSave(form, editingReminder, editAsOneOff); setForm(emptyForm); onEditAsOneOffChange(false); }} />
      <AnimatePresence>
        {recurringEditChoice && (
          <motion.div key="recurring-modal" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2 } }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', duration: 0.35, bounce: 0 } }} exit={{ opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.2 } }}
              className="w-full max-w-sm rounded-2xl p-6 backdrop-blur-xl"
              style={{ background: 'var(--ag-bg-elevated)', boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.15)' }}>
              <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--ag-text-muted)' }}>Recurring reminder</p>
              <h3 className="text-base font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ag-text-primary)' }}>Edit recurring reminder</h3>
              <p className="text-sm mb-5" style={{ color: 'var(--ag-text-muted)' }}>
                This is a <span style={{ color: 'var(--ag-violet-soft)' }}>{recurringEditChoice.recurrence}</span> reminder.
              </p>
              <div className="flex flex-col gap-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { const r = recurringEditChoice; onRecurringEditChoiceChange(null); onEditAsOneOffChange(true); onEditClick(r, true); }}
                  className="w-full py-3 rounded-xl text-sm font-semibold min-h-[44px]"
                  style={{ color: 'var(--ag-violet-soft)', background: 'rgba(167,139,250,0.1)', boxShadow: '0 0 0 1px rgba(167,139,250,0.25)' }}>This occurrence only</motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { const r = recurringEditChoice; onRecurringEditChoiceChange(null); onEditAsOneOffChange(false); onEditClick(r, true); }}
                  className="w-full py-3 rounded-xl text-sm font-semibold min-h-[44px]"
                  style={{ color: 'var(--ag-emerald)', background: 'rgba(16,185,129,0.1)', boxShadow: '0 0 0 1px rgba(16,185,129,0.25)' }}>All future occurrences</motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => onRecurringEditChoiceChange(null)}
                  className="w-full py-2.5 text-sm transition-colors min-h-[44px]" style={{ color: 'var(--ag-text-muted)' }}>Cancel</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
