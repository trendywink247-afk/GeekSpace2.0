// TaskQueue.tsx — task history accordion with expandable detail rows
import type { PicoAgentFull } from '@/services/api';
import type { PicoTask } from './helpers';
import { getAgentColor, getStatusColor, formatTime } from './helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock, AlertCircle, ChevronDown, ChevronUp,
  X, CheckCircle, XCircle, Loader2,
} from 'lucide-react';

// StatusIcon defined here (only used in this component)
function StatusIcon({ status }: { status: string }) {
  const color = getStatusColor(status);
  switch (status) {
    case 'completed': return <CheckCircle className="w-4 h-4" style={{ color }} />;
    case 'failed':    return <XCircle className="w-4 h-4" style={{ color }} />;
    case 'running':   return <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />;
    case 'queued':    return <Clock className="w-4 h-4" style={{ color }} />;
    case 'cancelled': return <X className="w-4 h-4" style={{ color }} />;
    default:          return <AlertCircle className="w-4 h-4" style={{ color }} />;
  }
}

function AgentDot({ agentName, agents, size = 'md' }: { agentName: string; agents: PicoAgentFull[]; size?: 'sm' | 'md' }) {
  const taskAgent = agents.find(a => a.name === agentName);
  const agentColor = taskAgent ? getAgentColor(taskAgent.personality) : '#9CA3AF';
  const letter = taskAgent
    ? (taskAgent.personality === 'edith' ? 'E' : taskAgent.personality === 'jarvis' ? 'J' : 'W')
    : '?';
  const dim = size === 'sm' ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[9px]';
  return (
    <span
      className={`${dim} rounded-full inline-flex items-center justify-center font-bold`}
      style={{ backgroundColor: `${agentColor}20`, border: `1.5px solid ${agentColor}`, color: agentColor }}
    >
      {letter}
    </span>
  );
}

interface TaskQueueProps {
  tasks: PicoTask[];
  agents: PicoAgentFull[];
  expandedTaskId: string | null;
  onExpandTask: (id: string | null) => void;
  onCancelTask: (id: string) => void;
}

export function TaskQueue({ tasks, agents, expandedTaskId, onExpandTask, onCancelTask }: TaskQueueProps) {
  return (
    <Card className="border-[rgba(139,92,246,0.08)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-[var(--ag-text-primary)] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--ag-text-muted)]" />
          Task History
          <Badge variant="outline" className="ml-2 border-[rgba(139,92,246,0.08)] text-[var(--ag-text-muted)] text-xs">
            {tasks.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {tasks.length === 0 ? (
          <div className="text-center py-10">
            <AlertCircle className="w-10 h-10 text-[var(--ag-violet)]/30 mx-auto mb-3" />
            <p className="text-[var(--ag-text-muted)] text-sm">No fleet agents yet. Create your first agent to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              return (
                <div key={task.id}>
                  <button
                    onClick={() => onExpandTask(isExpanded ? null : task.id)}
                    className="w-full text-left p-3 py-4 rounded-lg bg-[var(--ag-bg-deep)] border border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)] transition-all min-h-[44px]"
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon status={task.status} />
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0"
                        style={{ borderColor: `${getStatusColor(task.status)}30`, color: getStatusColor(task.status) }}
                      >
                        {task.task_type}
                      </Badge>
                      <span className="flex-1 text-sm text-[var(--ag-text-primary)] truncate">
                        {task.description}
                      </span>
                      <span className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <AgentDot agentName={task.agent_name} agents={agents} size="md" />
                        <span className="text-xs text-[var(--ag-text-muted)]">{task.agent_name}</span>
                      </span>
                      <span className="text-xs text-[var(--ag-text-muted)] hidden md:block shrink-0 min-w-[70px] text-right">
                        {formatTime(task.completed_at || task.started_at || task.created_at)}
                      </span>
                      {task.status === 'queued' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); onCancelTask(task.id); }}
                          className="text-[var(--ag-text-muted)] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-10 w-10 p-0 shrink-0 press-scale"
                          title="Cancel task"
                          aria-label="Cancel task"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-[var(--ag-text-muted)] shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-[var(--ag-text-muted)] shrink-0" />
                      }
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-1 ml-4 p-4 rounded-lg bg-[var(--ag-bg-deep)]/80 border border-[rgba(139,92,246,0.08)] animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <div className="text-xs text-[var(--ag-text-muted)]">Status</div>
                          <div className="text-sm font-medium capitalize" style={{ color: getStatusColor(task.status) }}>
                            {task.status}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--ag-text-muted)]">Agent</div>
                          <div className="text-sm text-[var(--ag-text-primary)] flex items-center gap-1.5">
                            <AgentDot agentName={task.agent_name} agents={agents} size="sm" />
                            {task.agent_name}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--ag-text-muted)]">Started</div>
                          <div className="text-sm text-[var(--ag-text-primary)]">{formatTime(task.started_at)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-[var(--ag-text-muted)]">Completed</div>
                          <div className="text-sm text-[var(--ag-text-primary)]">{formatTime(task.completed_at)}</div>
                        </div>
                      </div>

                      {task.result ? (
                        <div>
                          <div className="text-xs text-[var(--ag-text-muted)] mb-1">Result</div>
                          <pre className="text-xs text-[var(--ag-text-primary)] bg-[var(--ag-bg-surface)] p-3 rounded-lg border border-[rgba(139,92,246,0.08)] overflow-x-auto whitespace-pre-wrap font-mono">
                            {task.result}
                          </pre>
                        </div>
                      ) : (
                        task.status !== 'queued' && task.status !== 'running' && (
                          <div className="text-xs text-[var(--ag-text-muted)] italic">No result data available.</div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
