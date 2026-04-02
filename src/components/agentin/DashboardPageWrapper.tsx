// ============================================================
// DashboardPageWrapper — Enhancement wrapper for dashboard pages
// Adds: entrance animations, consistent card styling, mobile optimizations
// ============================================================

import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface DashboardPageWrapperProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  isLoading?: boolean;
  loadingMessage?: string;
}

// Page entrance animation variants
const pageVariants = {
  initial: { 
    opacity: 0, 
    y: 20,
    scale: 0.98 
  },
  animate: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
      staggerChildren: 0.05,
      delayChildren: 0.1,
    }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    scale: 0.98,
    transition: { duration: 0.2 }
  }
};

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

export function DashboardPageWrapper({ 
  children, 
  className = '', 
  delay = 0,
  isLoading = false,
  loadingMessage = 'Loading...'
}: DashboardPageWrapperProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 50 + delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-8 h-8 text-[#00F0FF]" />
        </motion.div>
        <p className="mt-4 text-[#6B7280] text-sm">{loadingMessage}</p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {isReady && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Enhanced Card Component for Dashboard Pages
interface DashboardCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'none' | 'cyan' | 'violet' | 'gold' | 'rose';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function DashboardCard({
  children,
  className = '',
  hover = true,
  glow = 'none',
  padding = 'md',
  onClick,
  title,
  subtitle,
  action,
}: DashboardCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4 md:p-5',
    lg: 'p-5 md:p-6',
  };

  const glowStyles = {
    none: {},
    cyan: { boxShadow: '0 0 30px rgba(0, 240, 255, 0.08)' },
    violet: { boxShadow: '0 0 30px rgba(139, 92, 246, 0.1)' },
    gold: { boxShadow: '0 0 30px rgba(255, 184, 0, 0.08)' },
    rose: { boxShadow: '0 0 30px rgba(255, 45, 120, 0.08)' },
  };

  return (
    <motion.div
      variants={cardVariants}
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      onClick={onClick}
      className={`
        relative rounded-2xl overflow-hidden
        bg-[rgba(30,30,50,0.6)] backdrop-blur-xl
        border border-[rgba(0,240,255,0.08)]
        ${paddingClasses[padding]}
        ${hover ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={glowStyles[glow]}
    >
      {/* Header */}
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-[#F4F6FF]" style={{ fontFamily: 'Syne, sans-serif' }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-[#6B7280] mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      
      {/* Content */}
      <div className="relative z-10">{children}</div>

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
    </motion.div>
  );
}

// Mobile-Optimized Grid
interface DashboardGridProps {
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

export function DashboardGrid({
  children,
  className = '',
  cols = { default: 1, sm: 2, lg: 3, xl: 4 },
  gap = 'md',
}: DashboardGridProps) {
  const gapClasses = {
    none: 'gap-0',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-5',
  };

  const colClasses = [
    cols.default ? `grid-cols-${cols.default}` : 'grid-cols-1',
    cols.sm ? `sm:grid-cols-${cols.sm}` : '',
    cols.md ? `md:grid-cols-${cols.md}` : '',
    cols.lg ? `lg:grid-cols-${cols.lg}` : '',
    cols.xl ? `xl:grid-cols-${cols.xl}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`grid ${colClasses} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}

// Section Header for Dashboard Pages
interface DashboardSectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function DashboardSectionHeader({ 
  title, 
  subtitle, 
  action, 
  className = '' 
}: DashboardSectionHeaderProps) {
  return (
    <motion.div 
      variants={cardVariants}
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 ${className}`}
    >
      <div>
        <h2 
          className="text-xl md:text-2xl font-bold text-[#F4F6FF]" 
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-[#6B7280] mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  );
}

// Pull to Refresh Indicator
interface PullToRefreshIndicatorProps {
  pulling: boolean;
  threshold: number;
  distance: number;
}

export function PullToRefreshIndicator({ 
  pulling, 
  threshold, 
  distance 
}: PullToRefreshIndicatorProps) {
  if (!pulling) return null;

  const progress = Math.min(distance / threshold, 1);
  const isReady = distance >= threshold;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ 
        transform: `translateY(${Math.min(distance, threshold + 20)}px)`,
        opacity: progress 
      }}
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[rgba(6,6,26,0.9)] backdrop-blur-xl border border-[rgba(0,240,255,0.2)]">
        <motion.div
          animate={{ rotate: isReady ? 180 : progress * 360 }}
          transition={{ duration: 0.2 }}
        >
          <Loader2 className="w-4 h-4 text-[#00F0FF]" />
        </motion.div>
        <span className="text-xs text-[#00F0FF]">
          {isReady ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  );
}

// Export all
export * from './DashboardPageWrapper';
