// ============================================================
// AddHabitDialog — dialog for creating a new habit
// ============================================================

import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { HABIT_ICONS, FREQUENCY_OPTIONS, SHADOW_CARD } from './helpers';

export interface AddHabitDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  newHabitName: string;
  setNewHabitName: (v: string) => void;
  newHabitIcon: string;
  setNewHabitIcon: (v: string) => void;
  newHabitFreq: string;
  setNewHabitFreq: (v: string) => void;
  onAdd: () => Promise<void>;
  loading: boolean;
}

export function AddHabitDialog({
  open,
  onOpenChange,
  newHabitName,
  setNewHabitName,
  newHabitIcon,
  setNewHabitIcon,
  newHabitFreq,
  setNewHabitFreq,
  onAdd,
  loading,
}: AddHabitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg rounded-2xl"
        style={{
          background: 'var(--ag-bg-elevated)',
          boxShadow: '0 0 0 1px rgba(139,92,246,0.15), 0 24px 48px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)',
          border: 'none',
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2" style={{ color: 'var(--ag-text-primary)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
              <Plus size={16} style={{ color: 'var(--ag-cyan)' }} />
            </div>
            Add Habit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <Label className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>Habit Name</Label>
            <Input
              value={newHabitName}
              onChange={e => setNewHabitName(e.target.value)}
              placeholder="e.g. Morning Workout, Read 30 mins…"
              className="mt-1.5 h-12 rounded-xl"
              style={{
                background: 'var(--ag-bg-surface)',
                borderColor: 'var(--ag-border-subtle)',
                color: 'var(--ag-text-primary)',
              }}
              onKeyDown={e => { if (e.key === 'Enter') void onAdd(); }}
            />
          </div>

          <div>
            <Label className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>Icon</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {HABIT_ICONS.map(ic => (
                <motion.button
                  key={ic}
                  onClick={() => setNewHabitIcon(ic)}
                  whileTap={{ scale: 0.9 }}
                  className="text-xl p-2 rounded-xl transition-all min-h-[44px] min-w-[44px]
                    flex items-center justify-center focus-visible:outline-none"
                  style={{
                    background: newHabitIcon === ic ? 'rgba(139,92,246,0.12)' : 'transparent',
                    boxShadow: newHabitIcon === ic ? '0 0 0 1px rgba(139,92,246,0.3)' : 'none',
                    transform: newHabitIcon === ic ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  {ic}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>Frequency</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {FREQUENCY_OPTIONS.map(f => (
                <motion.button
                  key={f.value}
                  onClick={() => setNewHabitFreq(f.value)}
                  whileTap={{ scale: 0.94 }}
                  className="rounded-xl p-3 text-center text-sm transition-all duration-200
                    focus-visible:outline-none min-h-[44px] font-medium"
                  style={{
                    background: newHabitFreq === f.value ? 'rgba(139,92,246,0.12)' : 'var(--ag-bg-surface)',
                    color: newHabitFreq === f.value ? 'var(--ag-cyan)' : 'var(--ag-text-secondary)',
                    boxShadow: newHabitFreq === f.value
                      ? '0 0 0 1px rgba(139,92,246,0.3)'
                      : SHADOW_CARD,
                  }}
                >
                  {f.label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] rounded-xl"
              style={{ color: 'var(--ag-text-secondary)' }}
            >
              Cancel
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              onClick={() => void onAdd()}
              className="min-h-[44px] px-6 font-semibold rounded-xl"
              disabled={!newHabitName.trim() || loading}
              style={{
                background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))',
                color: '#0d0d1a',
                border: 'none',
              }}
            >
              {loading ? 'Adding…' : 'Add Habit'}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
