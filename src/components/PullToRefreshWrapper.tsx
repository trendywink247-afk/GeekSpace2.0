import { type ReactNode } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { Loader2 } from 'lucide-react';

interface Props {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefreshWrapper({ onRefresh, children, className = '' }: Props) {
  const isMobile = useMobileDetect();
  const { containerRef, pullDistance, refreshing, pullHandlers } = usePullToRefresh({ onRefresh });

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto ${className}`}
      {...pullHandlers}
    >
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center transition-all duration-150"
          style={{ height: refreshing ? 48 : pullDistance, opacity: Math.min(1, pullDistance / 60) }}
        >
          <Loader2
            className={`w-5 h-5 text-primary ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${pullDistance * 3}deg)` }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
