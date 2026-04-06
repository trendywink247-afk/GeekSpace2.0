// social-media/PlatformSelector.tsx
// Platform badge toggle group + character counter bar
import { PLATFORMS, PlatformIcon } from './helpers';
import type { Platform } from './helpers';

// ---- Platform Badge Selector ----

export function PlatformBadges({
  selected,
  onChange,
}: {
  selected: Platform;
  onChange: (p: Platform) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full text-xs font-medium transition-[transform,background-color,color,box-shadow] active:scale-[0.96] ${
            selected === p.value
              ? 'border shadow-[0_0_8px_rgba(0,0,0,0.2)]'
              : 'bg-[var(--ag-bg-deep)] text-[var(--ag-text-muted)] border border-[var(--ag-border-subtle)] hover:border-[var(--ag-aria)]/20 hover:text-[var(--ag-text-primary)]'
          }`}
          style={
            selected === p.value
              ? {
                  background: `${p.color}20`,
                  color: p.color,
                  borderColor: `${p.color}60`,
                }
              : undefined
          }
        >
          <PlatformIcon platform={p.value} className="w-3.5 h-3.5" />
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ---- Character Counter ----

export function CharacterCounter({
  count,
  platform,
}: {
  count: number;
  platform: Platform;
}) {
  const info = PLATFORMS.find((p) => p.value === platform)!;
  const pct = Math.min((count / info.limit) * 100, 100);
  const isOver = count > info.limit;
  const barColor = isOver
    ? 'var(--ag-error)'
    : pct > 90
      ? 'var(--ag-warning)'
      : 'var(--ag-violet)';

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1 rounded-full bg-[#1a1a2e] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
        />
      </div>
      <span
        className="text-xs font-mono tabular-nums"
        style={{ color: barColor }}
      >
        {count}/{info.limit}
      </span>
    </div>
  );
}
