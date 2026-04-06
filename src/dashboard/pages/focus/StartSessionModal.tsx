// ============================================================
// StartSessionModal — dialog to configure and start a focus session
// ============================================================

import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Play } from 'lucide-react';
import { DURATIONS, SHADOW_CARD } from './helpers';

export interface StartSessionModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  goalInput: string;
  setGoalInput: (v: string) => void;
  durInput: number;
  setDurInput: (v: number) => void;
  onStart: () => Promise<void>;
  loading: boolean;
}

export function StartSessionModal({
  open,
  onOpenChange,
  goalInput,
  setGoalInput,
  durInput,
  setDurInput,
  onStart,
  loading,
}: StartSessionModalProps) {
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
              <Play size={16} style={{ color: 'var(--ag-cyan)' }} className="ml-0.5" />
            </div>
            Start Focus Session
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <Label htmlFor="focus-goal" className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>
              What are you working on?
            </Label>
            <Input
              id="focus-goal"
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              placeholder="e.g. Write report, Fix bug, Study…"
              className="mt-1.5 h-12 rounded-xl"
              style={{
                background: 'var(--ag-bg-surface)',
                borderColor: 'var(--ag-border-subtle)',
                color: 'var(--ag-text-primary)',
              }}
              onKeyDown={e => { if (e.key === 'Enter') void onStart(); }}
            />
          </div>

          <div>
            <Label className="text-sm" style={{ color: 'var(--ag-text-secondary)' }}>Duration</Label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              {DURATIONS.map(d => (
                <motion.button
                  key={d.value}
                  onClick={() => setDurInput(d.value)}
                  whileTap={{ scale: 0.94 }}
                  className="rounded-xl p-3 text-center transition-all duration-200 focus-visible:outline-none min-h-[44px]"
                  style={{
                    background: durInput === d.value ? 'rgba(139,92,246,0.12)' : 'var(--ag-bg-surface)',
                    color: durInput === d.value ? 'var(--ag-cyan)' : 'var(--ag-text-secondary)',
                    boxShadow: durInput === d.value
                      ? '0 0 0 1px rgba(139,92,246,0.3)'
                      : SHADOW_CARD,
                  }}
                >
                  <div className="text-base font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{d.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-60">{d.desc}</div>
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
              onClick={() => void onStart()}
              disabled={loading}
              className="min-h-[44px] px-6 font-semibold rounded-xl"
              style={{
                background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))',
                color: '#0d0d1a',
                border: 'none',
              }}
            >
              {loading ? 'Starting…' : 'Start'}
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
