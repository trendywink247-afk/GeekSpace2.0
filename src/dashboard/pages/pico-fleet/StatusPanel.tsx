// StatusPanel.tsx — fleet recent activity feed
import type { RecentTask } from './helpers';
import { getStatusColor, formatTime } from './helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface StatusPanelProps {
  recentTasks: RecentTask[];
}

export function StatusPanel({ recentTasks }: StatusPanelProps) {
  return (
    <Card className="border-[rgba(139,92,246,0.08)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-[var(--ag-text-primary)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00FF88]" />
          Recent Activity
          <Badge variant="outline" className="ml-2 border-[rgba(139,92,246,0.08)] text-[var(--ag-text-muted)] text-xs">
            {recentTasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {recentTasks.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[var(--ag-text-muted)] text-sm">
              No recent activity. Assign tasks to your fleet to see progress here.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentTasks.map((task) => {
              const color = getStatusColor(task.status);
              const ts = task.completed_at || task.started_at || task.created_at || null;
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 sm:p-2.5 rounded-lg bg-[var(--ag-bg-deep)] border border-[rgba(139,92,246,0.08)] min-h-[44px]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="flex-1 text-sm text-[var(--ag-text-primary)] truncate">
                    {task.description}
                  </span>
                  <span className="text-xs capitalize shrink-0" style={{ color }}>
                    {task.status}
                  </span>
                  <span className="text-xs text-[var(--ag-text-muted)] shrink-0 hidden sm:block">
                    {formatTime(ts)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
