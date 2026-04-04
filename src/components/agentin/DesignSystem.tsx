// ============================================================
// Design System — Unified Visual Language for Agentin
// Provides: animations, backgrounds, cards, transitions
// Mobile-first, responsive, accessible
// ============================================================

/* eslint-disable react-refresh/only-export-components */

import { useState, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4, transition: { duration: 0.2 } },
};

// Page transition variants
export const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// ─────────────────────────────────────────────────────────────
// ANIMATED BACKGROUND COMPONENT
// ─────────────────────────────────────────────────────────────

interface AnimatedBackgroundProps {
  variant?: 'aurora' | 'minimal' | 'glow';
  intensity?: 'low' | 'medium' | 'high';
  children: ReactNode;
  className?: string;
}

export function AnimatedBackground({
  variant = 'aurora',
  intensity = 'medium',
  children,
  className = '',
}: AnimatedBackgroundProps) {
  const intensityMap = {
    low: { blur: 60, opacity: 0.04 },
    medium: { blur: 100, opacity: 0.07 },
    high: { blur: 140, opacity: 0.1 },
  };
  const { blur, opacity } = intensityMap[intensity];

  return (
    <div className={`relative min-h-screen overflow-hidden ${className}`}>
      {/* Base background */}
      <div className="absolute inset-0 bg-[var(--ag-bg-base)]" />

      {/* Aurora gradients */}
      {variant === 'aurora' && (
        <>
          <div
            className="absolute -top-1/4 -left-1/4 w-[80vw] h-[80vw] rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, rgba(139, 92, 246, ${opacity}) 0%, transparent 70%)`,
              filter: `blur(${blur}px)`,
            }}
          />
          <div
            className="absolute -bottom-1/4 -right-1/4 w-[60vw] h-[60vw] rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, rgba(245, 158, 11, ${opacity * 0.8}) 0%, transparent 70%)`,
              filter: `blur(${blur * 0.9}px)`,
            }}
          />
          <div
            className="absolute top-1/3 right-1/3 w-[40vw] h-[40vw] rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle, rgba(16, 185, 129, ${opacity * 0.6}) 0%, transparent 70%)`,
              filter: `blur(${blur * 0.8}px)`,
            }}
          />
        </>
      )}

      {variant === 'glow' && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, rgba(139, 92, 246, ${opacity * 0.5}) 0%, transparent 60%)`,
            filter: `blur(${blur * 1.5}px)`,
          }}
        />
      )}

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GLASS CARD COMPONENT
// ─────────────────────────────────────────────────────────────

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'none' | 'violet' | 'cyan' | 'gold' | 'rose';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function GlassCard({
  children,
  className = '',
  hover = true,
  glow = 'none',
  padding = 'md',
  onClick,
}: GlassCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4 md:p-6',
    lg: 'p-6 md:p-8',
  };

  const glowClasses = {
    none: '',
    violet: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]',
    cyan: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.12)]',
    gold: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.12)]',
    rose: 'hover:shadow-[0_0_30px_rgba(244,63,94,0.10)]',
  };

  return (
    <motion.div
      initial="rest"
      whileHover={hover ? 'hover' : undefined}
      variants={cardHover}
      onClick={onClick}
      className={`
        relative rounded-2xl
        bg-white/[0.03] backdrop-blur-xl
        border border-white/[0.06]
        ${paddingClasses[padding]}
        ${hover ? 'cursor-pointer' : ''}
        ${glowClasses[glow]}
        transition-shadow duration-300
        ${className}
      `}
    >
      {/* Subtle inner glow */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE WRAPPER WITH ANIMATIONS
// ─────────────────────────────────────────────────────────────

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function PageWrapper({ children, className = '', delay = 0 }: PageWrapperProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50 + delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isLoaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// STAGGERED LIST ANIMATION
// ─────────────────────────────────────────────────────────────

interface StaggeredListProps {
  children: ReactNode[];
  className?: string;
  itemClassName?: string;
  staggerDelay?: number;
}

export function StaggeredList({
  children,
  className = '',
  itemClassName = '',
  staggerDelay = 0.05,
}: StaggeredListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.1,
          },
        },
      }}
      className={className}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: {
                duration: 0.3,
                ease: [0.25, 0.46, 0.45, 0.94],
              },
            },
          }}
          className={itemClassName}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOADING STATES
// ─────────────────────────────────────────────────────────────

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Loading...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[200px] ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className="w-8 h-8 text-[var(--ag-violet)]" />
      </motion.div>
      <p className="mt-4 text-[var(--ag-text-secondary)] text-sm">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <GlassCard className={`text-center ${className}`} hover={false}>
      {icon && (
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#8B5CF6]/10 flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--ag-text-primary)] mb-2">{title}</h3>
      {description && (
        <p className="text-[var(--ag-text-secondary)] text-sm max-w-sm mx-auto mb-4">{description}</p>
      )}
      {action}
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 ${className}`}>
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-[var(--ag-text-primary)]" style={{ fontFamily: 'Syne, sans-serif' }}>
          {title}
        </h2>
        {subtitle && <p className="text-[var(--ag-text-secondary)] text-sm mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BADGE COMPONENT
// ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

export function StatusBadge({ children, variant = 'default', className = '' }: StatusBadgeProps) {
  const variantClasses = {
    default: 'bg-white/10 text-white/80',
    success: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    error: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    info: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  };

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        border ${variantClasses[variant]} ${className}
      `}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// MOBILE RESPONSIVE GRID
// ─────────────────────────────────────────────────────────────

interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'none' | 'sm' | 'md' | 'lg';
}

export function ResponsiveGrid({
  children,
  className = '',
  cols = { default: 1, sm: 2, lg: 3 },
  gap = 'md',
}: ResponsiveGridProps) {
  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-3',
    md: 'gap-4 md:gap-6',
    lg: 'gap-6 md:gap-8',
  };

  const colClasses = [
    cols.default ? `grid-cols-${cols.default}` : 'grid-cols-1',
    cols.sm ? `sm:grid-cols-${cols.sm}` : '',
    cols.md ? `md:grid-cols-${cols.md}` : '',
    cols.lg ? `lg:grid-cols-${cols.lg}` : '',
    cols.xl ? `xl:grid-cols-${cols.xl}` : '',
  ].join(' ');

  return <div className={`grid ${colClasses} ${gapClasses[gap]} ${className}`}>{children}</div>;
}

