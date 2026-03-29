import { useState, useEffect, useCallback } from 'react';
import { Target, Flame, ArrowRight, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardService } from '@/services/api';

interface StreakData {
  habitsToday: Array<{
    id: number;
    name: string;
    icon: string;
    streak: number;
    loggedToday: boolean;
  }>;
}

interface StreakCardProps {
  onNavigate?: (page: string) => void;
}

export function StreakCard({ onNavigate }: StreakCardProps) {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardService.overview();
      const overview = res.data as StreakData;
      setData(overview);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const habits = data?.habitsToday || [];
  const completedCount = habits.filter((h) => h.loggedToday).length;
  const totalCount = habits.length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-sm font-semibold text-[#B8C4D4] uppercase tracking-wider"
          style={{ fontFamily: 'Syne, sans-serif' }}
        >
          Focus & Streaks
        </h2>
        <button
          onClick={() => onNavigate?.('focus')}
          className="flex items-center gap-1 text-xs text-[#B8C4D4] hover:text-[#8B5CF6] transition-colors"
        >
          Details
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <Card
        className="border-[#00FF88]/10 bg-[#0C0C18] rounded-2xl"
        style={{ background: '#0C0C18' }}
      >
        <CardContent className="p-4">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ) : totalCount > 0 ? (
            <div className="space-y-4">
              {/* Streak hero */}
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: bestStreak > 0
                      ? 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(139,92,246,0.1))'
                      : 'rgba(136,146,164,0.08)',
                  }}
                >
                  {bestStreak > 0 ? (
                    <Flame className="w-6 h-6 text-[#00FF88]" />
                  ) : (
                    <Target className="w-6 h-6 text-[#B8C4D4]" />
                  )}
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono" style={{ color: bestStreak > 0 ? '#00FF88' : '#B8C4D4' }}>
                    {bestStreak}
                  </div>
                  <div className="text-xs text-[#B8C4D4]">
                    {bestStreak === 1 ? 'day streak' : 'day best streak'}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[#B8C4D4]">
                    {completedCount}/{totalCount} habits today
                  </span>
                  <span className="text-xs font-mono" style={{ color: progressPct === 100 ? '#00FF88' : '#8B5CF6' }}>
                    {progressPct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#1A1A2E] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPct}%`,
                      background: progressPct === 100
                        ? 'linear-gradient(90deg, #00FF88, #ADFF2F)'
                        : 'linear-gradient(90deg, #8B5CF6, #BF5FFF)',
                    }}
                  />
                </div>
              </div>

              {/* Habit list (top 3) */}
              <div className="space-y-2">
                {habits.slice(0, 3).map((habit) => (
                  <div
                    key={habit.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                      style={{
                        background: habit.loggedToday ? 'rgba(0,255,136,0.15)' : 'rgba(136,146,164,0.1)',
                      }}
                    >
                      {habit.loggedToday ? (
                        <svg className="w-3 h-3 text-[#00FF88]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-[#B8C4D4]/30" />
                      )}
                    </div>
                    <span className={habit.loggedToday ? 'text-[#00FF88]' : 'text-[#E8E8F0]'}>
                      {habit.name}
                    </span>
                    {habit.streak > 0 && (
                      <span className="text-[#B8C4D4] ml-auto">
                        {habit.streak}d
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(0,255,136,0.08)' }}
              >
                <Target className="w-6 h-6 text-[#00FF88]/40" />
              </div>
              <p className="text-sm font-medium text-[#E8E8F0] mb-1">
                No habits yet
              </p>
              <p className="text-xs text-[#B8C4D4] mb-3">
                Set up daily habits to track your streaks
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#00FF88] hover:bg-[#00FF88]/10"
                onClick={() => onNavigate?.('focus')}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Set up Focus
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
