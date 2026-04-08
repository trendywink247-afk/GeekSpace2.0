/**
 * RemindersHeader — Aurora-styled page header for the Reminders page.
 */
import { motion } from 'framer-motion';
import { Bell, Flame, Plus } from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { PageHeader } from '@/components/agentin';
import { Button } from '@/components/ui/button';

interface RemindersHeaderProps {
  activeCount: number;
  completedCount: number;
  streak: number;
  onAdd: () => void;
}

export function RemindersHeader({ activeCount, completedCount, streak, onAdd }: RemindersHeaderProps) {
  return (
    <BlurFade delay={0.05} inView>
      <PageHeader
        icon={Bell}
        title="Reminders"
        subtitle={`${activeCount} active · ${completedCount} completed`}
        badge={
          <span
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: 'var(--ag-emerald)',
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: 'var(--ag-emerald)' }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: 'var(--ag-emerald)' }} />
            </span>
            Cal
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {streak > 0 && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-xl"
                style={{ background: 'rgba(245,158,11,0.08)', boxShadow: '0 0 0 1px rgba(245,158,11,0.15)' }}
              >
                <Flame className="w-3.5 h-3.5" style={{ color: 'var(--ag-amber)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--ag-amber)', fontVariantNumeric: 'tabular-nums' }}>{streak}</span>
                <span className="text-xs" style={{ color: 'var(--ag-text-muted)' }}>day streak</span>
              </div>
            )}
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                data-testid="create-reminder-button"
                onClick={onAdd}
                className="text-white min-h-[44px] transition-[box-shadow] duration-300 hover:shadow-[var(--ag-glow-sm)]"
                style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-violet-deep))' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Reminder
              </Button>
            </motion.div>
          </div>
        }
      />
    </BlurFade>
  );
}
