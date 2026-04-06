import { CARD_SHADOW } from './helpers';
import type { TimePeriod } from './helpers';

const TABS: { key: TimePeriod; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

interface PeriodTabsProps {
  value: TimePeriod;
  onChange: (v: TimePeriod) => void;
}

/**
 * Compact period-preset selector.
 * Outer rounded-xl / inner rounded-lg — concentric radius system.
 */
export function PeriodTabs({ value, onChange }: PeriodTabsProps) {
  return (
    <div
      className="flex gap-1 bg-[var(--ag-bg-surface)] rounded-xl p-1 backdrop-blur-xl"
      style={{ boxShadow: CARD_SHADOW }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={[
            'px-4 py-2 rounded-lg text-xs font-medium min-h-[44px]',
            'transition-[background-color,box-shadow,color] duration-200',
            value === tab.key
              ? 'bg-[var(--ag-active-bg)] text-[var(--ag-violet)]'
              : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-border-subtle)]',
          ].join(' ')}
          style={
            value === tab.key
              ? {
                  boxShadow: '0 0 0 1px rgba(139,92,246,0.3)',
                  WebkitFontSmoothing: 'antialiased',
                }
              : undefined
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
