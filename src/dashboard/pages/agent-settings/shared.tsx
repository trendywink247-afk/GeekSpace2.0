import { useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { GLASS_CARD_STYLE, GLASS_CARD_HOVER_SHADOW } from './constants';

// ─── GlassCard ────────────────────────────────────────────────────────────────

export function GlassCard({
  children,
  className = '',
  style,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const dangerStyle: CSSProperties = danger
    ? { boxShadow: '0 0 0 1px rgba(255,45,120,0.2), 0 4px 24px rgba(0,0,0,0.28)' }
    : {};

  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`relative w-full text-left ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        ...GLASS_CARD_STYLE,
        ...(hovered ? { boxShadow: GLASS_CARD_HOVER_SHADOW } : {}),
        ...(danger ? dangerStyle : {}),
        ...style,
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onClick}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  );
}

// ─── SliderRow ────────────────────────────────────────────────────────────────

export function SliderRow({
  label,
  value,
  onChange,
  valueBadge,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number[];
  onChange: (v: number[]) => void;
  valueBadge: string;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-sm font-medium text-[var(--ag-text-primary)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {label}
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-lg"
          style={{
            background: 'rgba(167,139,250,0.12)',
            color: 'var(--ag-text-accent)',
            boxShadow: '0 0 0 1px rgba(167,139,250,0.2)',
          }}
        >
          {valueBadge}
        </span>
      </div>
      <Slider
        value={value}
        onValueChange={onChange}
        max={100}
        step={25}
        className="w-full [&_[data-slot=slider-range]]:bg-[var(--ag-cyan)] [&_[data-slot=slider-thumb]]:bg-[var(--ag-cyan)] [&_[data-slot=slider-thumb]]:border-[var(--ag-cyan)] [&_[data-slot=slider-track]]:bg-[var(--ag-bg-elevated)]"
      />
      <div className="flex justify-between text-xs text-[var(--ag-text-muted)] mt-1.5">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
