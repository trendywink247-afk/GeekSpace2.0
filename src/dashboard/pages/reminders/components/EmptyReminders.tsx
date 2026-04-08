import { motion } from 'framer-motion';
import { Bell, Plus } from 'lucide-react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Button } from '@/components/ui/button';

interface EmptyRemindersProps { onAdd: () => void; }

export function EmptyReminders({ onAdd }: EmptyRemindersProps) {
  return (
    <BlurFade delay={0.32} inView>
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.08)', boxShadow: '0 0 40px rgba(139,92,246,0.1), 0 0 0 1px rgba(139,92,246,0.12)' }}>
            <Bell className="w-9 h-9" style={{ color: 'var(--ag-violet-soft)' }} />
          </div>
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full opacity-60 animate-ping"
            style={{ background: 'var(--ag-violet)' }} />
        </div>
        <h3 className="text-lg font-bold mb-2"
          style={{ fontFamily: 'Syne, sans-serif', color: 'var(--ag-text-primary)' }}>
          No reminders yet
        </h3>
        <p className="text-sm mb-1" style={{ color: 'var(--ag-text-muted)' }}>Try natural language:</p>
        <p className="text-xs mb-6 px-3 py-1.5 rounded-lg font-mono"
          style={{ color: 'var(--ag-violet-soft)', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
          &ldquo;Remind me tomorrow at 3pm to call mom&rdquo;
        </p>
        <motion.div whileTap={{ scale: 0.96 }}>
          <Button onClick={onAdd} className="text-white font-semibold px-6 min-h-[44px] transition-[box-shadow] duration-300"
            style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-violet-deep))', boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}>
            <Plus className="w-4 h-4 mr-2" />Create your first reminder
          </Button>
        </motion.div>
      </div>
    </BlurFade>
  );
}
