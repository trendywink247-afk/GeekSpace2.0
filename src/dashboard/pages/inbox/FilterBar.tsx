// inbox/FilterBar.tsx — filter/category tabs for the inbox
import { motion } from 'framer-motion';
import type { InboxMessage, Filter } from './helpers';
import { FILTERS, FADE_UP } from './helpers';

interface FilterBarProps {
  filter: Filter;
  messages: InboxMessage[];
  onChange: (f: Filter) => void;
}

export function FilterBar({ filter, messages, onChange }: FilterBarProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } } }}
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
    >
      {FILTERS.map((f) => {
        const isActive  = filter === f;
        const urgentCnt = f === 'urgent' ? messages.filter(m => m.priority === 'urgent').length : 0;
        return (
          <motion.button
            key={f}
            variants={FADE_UP}
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(f)}
            style={isActive ? {
              boxShadow: '0 0 0 1px var(--ag-border-active), var(--ag-glow-sm)',
            } : {}}
            className={[
              'px-3 py-1.5 rounded-xl text-sm font-semibold font-heading whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 shrink-0',
              isActive
                ? 'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)]'
                : 'bg-white/[0.04] text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-white/[0.08]',
            ].join(' ')}
          >
            {f === 'urgent' ? 'Urgent' : f.charAt(0).toUpperCase() + f.slice(1)}
            {urgentCnt > 0 && (
              <span className="ml-1.5 text-[10px] tabular-nums bg-[var(--ag-pink)]/15 text-[var(--ag-pink)] px-1.5 py-0.5 rounded-md">
                {urgentCnt}
              </span>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}
