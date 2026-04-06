import { useRef, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { GlanceCard } from './helpers';

interface GlanceCardsProps {
  loading: boolean;
  glanceCards: GlanceCard[];
  mounted: boolean;
  onNavigate?: (page: string) => void;
  onOpenChat?: () => void;
}

export function GlanceCardSkeleton() {
  return (
    <div className="min-w-[160px] flex-shrink-0 snap-start rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] backdrop-blur-xl p-4">
      <Skeleton className="w-10 h-10 rounded-xl mb-3" />
      <Skeleton className="h-7 w-12 mb-1" />
      <Skeleton className="h-4 w-20 mb-1" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function GlanceCards({ loading, glanceCards, mounted, onNavigate, onOpenChat }: GlanceCardsProps) {
  const touchStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const glanceScrollRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const container = glanceScrollRef.current;
    if (!container) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      scrollLeft: container.scrollLeft,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const container = glanceScrollRef.current;
    const start = touchStartRef.current;
    if (!container || !start) return;
    const dx = start.x - e.touches[0].clientX;
    container.scrollLeft = start.scrollLeft + dx;
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  function handleCardClick(key: string) {
    if (key === 'reminders') onNavigate?.('reminders');
    else if (key === 'messages') onOpenChat?.();
    else if (key === 'focus') onNavigate?.('focus');
    else if (key === 'time-saved') onNavigate?.('activity');
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--ag-text-secondary)] uppercase tracking-wider mb-3 font-heading">
        Today at a glance
      </h2>
      <div
        ref={glanceScrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none md:grid md:grid-cols-4 md:overflow-visible"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <GlanceCardSkeleton key={i} />)
          : glanceCards.map((card, idx) => (
              <div
                key={card.key}
                className={`min-w-[160px] flex-shrink-0 snap-start bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl p-4 transition-all duration-500 hover:scale-[1.02] cursor-pointer ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{
                  transitionDelay: `${idx * 80}ms`,
                  boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.04), 0 0 20px ${card.color}08`,
                }}
                onClick={() => handleCardClick(card.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick(card.key);
                  }
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: card.bgColor }}
                >
                  <card.icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: card.color }}>
                  {card.value}
                </div>
                <div className="text-sm font-medium text-[var(--ag-text-primary)] mt-0.5">{card.label}</div>
                <div className="text-xs text-[var(--ag-text-secondary)] mt-0.5">{card.sub}</div>
              </div>
            ))}
      </div>
    </section>
  );
}
