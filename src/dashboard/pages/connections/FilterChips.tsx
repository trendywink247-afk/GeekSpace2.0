// ─── FilterChips — status filter (all / connected / disconnected) ─────────────
import { motion } from 'framer-motion';
import { fadeUp } from './helpers';

interface FilterChipsProps {
  statusFilter: 'all' | 'connected' | 'disconnected';
  totalCount: number;
  connectedCount: number;
  onFilter: (v: 'all' | 'connected' | 'disconnected') => void;
}

export function FilterChips({ statusFilter, totalCount, connectedCount, onFilter }: FilterChipsProps) {
  const options = [
    { value: 'all' as const,          label: `All (${totalCount})`,                            color: 'var(--ag-text-accent)' },
    { value: 'connected' as const,    label: `Connected (${connectedCount})`,                   color: 'var(--ag-green)' },
    { value: 'disconnected' as const, label: `Disconnected (${totalCount - connectedCount})`,   color: '#FF6161' },
  ];

  return (
    <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show" className="flex items-center gap-2 flex-wrap">
      {options.map(({ value, label, color }) => {
        const isActive = statusFilter === value;
        return (
          <button
            key={value}
            onClick={() => onFilter(value)}
            className="px-3 py-1.5 rounded-full text-xs font-medium min-h-[36px] active:scale-[0.96] transition-[transform,box-shadow,color,background] duration-150"
            style={{
              color: isActive ? color : 'var(--ag-text-secondary)',
              background: isActive ? `color-mix(in srgb, ${color} 10%, transparent)` : 'transparent',
              boxShadow: isActive
                ? `0 0 0 1px color-mix(in srgb, ${color} 40%, transparent), 0 0 12px color-mix(in srgb, ${color} 10%, transparent)`
                : '0 0 0 1px rgba(139,92,246,0.1)',
            }}
          >
            {label}
          </button>
        );
      })}
    </motion.div>
  );
}
