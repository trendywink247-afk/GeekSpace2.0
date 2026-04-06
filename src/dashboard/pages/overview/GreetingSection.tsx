import { LayoutDashboard, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/agentin';
import { useTranslation } from '@/i18n/use-translation';

interface GreetingSectionProps {
  greeting: string;
  firstName: string;
  pendingRemindersCount: number;
  messagesToday: number;
  festivalGreeting: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function GreetingSection({
  greeting,
  firstName,
  pendingRemindersCount,
  messagesToday,
  festivalGreeting,
  isRefreshing,
  onRefresh,
}: GreetingSectionProps) {
  const { t } = useTranslation();

  const subtitle =
    pendingRemindersCount > 0
      ? `${pendingRemindersCount} reminder${pendingRemindersCount !== 1 ? 's' : ''} today`
      : messagesToday > 0
        ? `${messagesToday} messages sent today`
        : 'All clear — ready to start your day';

  return (
    <PageHeader
      icon={LayoutDashboard}
      title={`${t(greeting)}, ${firstName}`}
      subtitle={subtitle}
      badge={
        <span className="relative flex h-3 w-3" title="Owned by Weebo">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ag-weebo)] opacity-50" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--ag-weebo)]" />
        </span>
      }
      actions={
        <>
          {festivalGreeting && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-[var(--ag-amber)]/20 animate-pulse"
              style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--ag-amber)' }}
            >
              <Sparkles className="w-3 h-3" />
              {festivalGreeting}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-glow)] min-h-[44px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </>
      }
    />
  );
}
