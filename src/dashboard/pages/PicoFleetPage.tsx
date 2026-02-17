import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Plus, Trash2, Clock, CheckCircle, XCircle, AlertCircle,
  RefreshCw, Send, Loader2, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { picoService } from '@/services/api';

// ---- Types ----

interface PicoAgent {
  id: string;
  user_id: string;
  slot: number;
  name: string;
  status: string;
  tasks_completed: number;
  tasks_failed: number;
  created_at: string;
}

interface PicoTask {
  id: string;
  user_id: string;
  agent_slot: number;
  agent_name: string;
  task_type: string;
  description: string;
  payload: string;
  status: string;
  result: string | null;
  planned_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ---- Status colors ----

const statusColors: Record<string, string> = {
  active: '#61FF7B',
  completed: '#61FF7B',
  idle: '#A7ACB8',
  cancelled: '#A7ACB8',
  disabled: '#FF6161',
  failed: '#FF6161',
  queued: '#7B61FF',
  running: '#FFD761',
};

function getStatusColor(status: string): string {
  return statusColors[status] || '#A7ACB8';
}

// ---- Status icons ----

function StatusIcon({ status }: { status: string }) {
  const color = getStatusColor(status);
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4" style={{ color }} />;
    case 'failed':
      return <XCircle className="w-4 h-4" style={{ color }} />;
    case 'running':
      return <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />;
    case 'queued':
      return <Clock className="w-4 h-4" style={{ color }} />;
    case 'cancelled':
      return <X className="w-4 h-4" style={{ color }} />;
    default:
      return <AlertCircle className="w-4 h-4" style={{ color }} />;
  }
}

// ---- Time formatting ----

function formatTime(ts: string | null): string {
  if (!ts) return '--';
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ---- Main Component ----

export function PicoFleetPage() {
  const [agents, setAgents] = useState<PicoAgent[]>([]);
  const [tasks, setTasks] = useState<PicoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Quick task
  const [taskInput, setTaskInput] = useState('');
  const [planning, setPlanning] = useState(false);

  // Create agent
  const [creatingSlot, setCreatingSlot] = useState<number | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [savingAgent, setSavingAgent] = useState(false);

  // Expanded task detail
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  // ---- Data loading ----

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const [agentsRes, tasksRes] = await Promise.all([
        picoService.getAgents(),
        picoService.getTasks({ limit: 50 }),
      ]);
      setAgents(agentsRes.data);
      setTasks(tasksRes.data);
    } catch {
      showToast('Failed to load fleet data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // ---- Agent actions ----

  const handleCreateAgent = async () => {
    if (!newAgentName.trim() || creatingSlot === null) return;
    setSavingAgent(true);
    try {
      await picoService.createAgent(newAgentName.trim());
      showToast(`Agent "${newAgentName.trim()}" deployed`, 'success');
      setNewAgentName('');
      setCreatingSlot(null);
      await loadData();
    } catch {
      showToast('Failed to create agent', 'error');
    } finally {
      setSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (agent: PicoAgent) => {
    try {
      await picoService.deleteAgent(agent.id);
      showToast(`Agent "${agent.name}" removed`, 'success');
      await loadData();
    } catch {
      showToast('Failed to remove agent', 'error');
    }
  };

  // ---- Quick task ----

  const handlePlanTask = async () => {
    if (!taskInput.trim()) return;
    setPlanning(true);
    try {
      const res = await picoService.planTask(taskInput.trim());
      const count = res.data.tasks.length;
      showToast(`Planned ${count} task${count !== 1 ? 's' : ''} (${res.data.creditCost} credits)`, 'success');
      setTaskInput('');
      await loadData();
    } catch {
      showToast('Failed to plan task', 'error');
    } finally {
      setPlanning(false);
    }
  };

  // ---- Task actions ----

  const handleCancelTask = async (taskId: string) => {
    try {
      await picoService.cancelTask(taskId);
      showToast('Task cancelled', 'success');
      await loadData();
    } catch {
      showToast('Failed to cancel task', 'error');
    }
  };

  // ---- Build slot data ----

  const slots = [1, 2, 3].map((slotNum) => {
    const agent = agents.find((a) => a.slot === slotNum);
    return { slotNum, agent };
  });

  const totalCompleted = agents.reduce((sum, a) => sum + a.tasks_completed, 0);

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#7B61FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-300">
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#0B0B10]/95 backdrop-blur-sm border shadow-2xl"
            style={{
              borderColor: toast.type === 'success' ? '#61FF7B40' : '#FF616140',
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[#61FF7B] shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-[#FF6161] shrink-0" />
            )}
            <span className="text-sm text-[#F4F6FF]">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-[#A7ACB8] hover:text-[#F4F6FF]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Weebo's
          </h1>
          <p className="text-[#A7ACB8]">
            <span className="text-[#61FF7B] font-medium">{agents.length}</span> agent{agents.length !== 1 ? 's' : ''} deployed
            {' '}&middot;{' '}
            <span className="text-[#7B61FF] font-medium">{totalCompleted}</span> tasks completed
          </p>
        </div>
        <Button
          onClick={() => loadData()}
          disabled={refreshing}
          variant="outline"
          className="border-[#7B61FF]/30 hover:bg-[#7B61FF]/10 text-[#A7ACB8] hover:text-[#F4F6FF]"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Agent Cards — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slots.map(({ slotNum, agent }) => {
          if (agent) {
            const color = getStatusColor(agent.status);
            const isPermanent = slotNum === 1;
            return (
              <Card key={slotNum} className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-[#F4F6FF] flex items-center gap-2">
                      <Zap className="w-4 h-4" style={{ color }} />
                      {agent.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs capitalize"
                        style={{ borderColor: `${color}40`, color }}
                      >
                        {agent.status}
                      </Badge>
                      {!isPermanent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAgent(agent)}
                          className="text-[#A7ACB8] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-7 w-7 p-0"
                          title="Remove agent"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-[#05050A] border border-[#7B61FF]/10">
                      <div className="text-xs text-[#A7ACB8] mb-1">Completed</div>
                      <div className="text-xl font-bold text-[#61FF7B] font-mono">{agent.tasks_completed}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#05050A] border border-[#7B61FF]/10">
                      <div className="text-xs text-[#A7ACB8] mb-1">Failed</div>
                      <div className="text-xl font-bold text-[#FF6161] font-mono">{agent.tasks_failed}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-[#A7ACB8] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Slot {slotNum} &middot; Created {formatTime(agent.created_at)}
                  </div>
                </CardContent>
              </Card>
            );
          }

          // Empty slot — show create button or inline form
          if (creatingSlot === slotNum) {
            return (
              <Card key={slotNum} className="bg-[#0B0B10] border-[#7B61FF]/30 border-dashed">
                <CardContent className="p-6 flex flex-col items-center justify-center gap-3 min-h-[180px]">
                  <p className="text-sm text-[#A7ACB8]">Name your agent</p>
                  <Input
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g. Scout, Relay..."
                    className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF] max-w-[200px]"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateAgent()}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setCreatingSlot(null); setNewAgentName(''); }}
                      className="border-[#7B61FF]/30 text-[#A7ACB8]"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateAgent}
                      disabled={!newAgentName.trim() || savingAgent}
                      className="bg-[#7B61FF] hover:bg-[#6B51EF]"
                    >
                      {savingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deploy'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }

          return (
            <Card
              key={slotNum}
              className="bg-[#0B0B10] border-[#7B61FF]/20 border-dashed hover:border-[#7B61FF]/40 transition-all cursor-pointer group"
              onClick={() => setCreatingSlot(slotNum)}
            >
              <CardContent className="p-6 flex flex-col items-center justify-center gap-3 min-h-[180px]">
                <div className="w-12 h-12 rounded-xl bg-[#7B61FF]/10 flex items-center justify-center group-hover:bg-[#7B61FF]/20 transition-colors">
                  <Plus className="w-6 h-6 text-[#7B61FF]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[#F4F6FF]">Deploy Agent</p>
                  <p className="text-xs text-[#A7ACB8]">Slot {slotNum} available</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Task */}
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-[#F4F6FF] flex items-center gap-2">
            <Send className="w-4 h-4 text-[#7B61FF]" />
            Quick Task
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-3">
            <Input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Describe a task in natural language..."
              className="flex-1 bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
              onKeyDown={(e) => e.key === 'Enter' && !planning && handlePlanTask()}
              disabled={planning}
            />
            <Button
              onClick={handlePlanTask}
              disabled={!taskInput.trim() || planning}
              className="bg-[#7B61FF] hover:bg-[#6B51EF] min-w-[100px]"
            >
              {planning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Plan
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-[#A7ACB8] mt-2">
            The planner will break your request into tasks and assign them to available agents.
          </p>
        </CardContent>
      </Card>

      {/* Task History */}
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-[#F4F6FF] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#A7ACB8]" />
            Task History
            <Badge variant="outline" className="ml-2 border-[#7B61FF]/20 text-[#A7ACB8] text-xs">
              {tasks.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {tasks.length === 0 ? (
            <div className="text-center py-10">
              <AlertCircle className="w-10 h-10 text-[#7B61FF]/30 mx-auto mb-3" />
              <p className="text-[#A7ACB8] text-sm">No tasks yet. Use Quick Task above to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const isExpanded = expandedTaskId === task.id;
                return (
                  <div key={task.id}>
                    <button
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="w-full text-left p-3 rounded-lg bg-[#05050A] border border-[#7B61FF]/10 hover:border-[#7B61FF]/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {/* Status icon */}
                        <StatusIcon status={task.status} />

                        {/* Type badge */}
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0"
                          style={{
                            borderColor: `${getStatusColor(task.status)}30`,
                            color: getStatusColor(task.status),
                          }}
                        >
                          {task.task_type}
                        </Badge>

                        {/* Description */}
                        <span className="flex-1 text-sm text-[#F4F6FF] truncate">
                          {task.description}
                        </span>

                        {/* Agent name */}
                        <span className="text-xs text-[#A7ACB8] hidden sm:block shrink-0">
                          {task.agent_name}
                        </span>

                        {/* Timestamp */}
                        <span className="text-xs text-[#A7ACB8] hidden md:block shrink-0 min-w-[70px] text-right">
                          {formatTime(task.created_at)}
                        </span>

                        {/* Cancel button for queued tasks */}
                        {task.status === 'queued' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelTask(task.id);
                            }}
                            className="text-[#A7ACB8] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-7 w-7 p-0 shrink-0"
                            title="Cancel task"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {/* Expand chevron */}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#A7ACB8] shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#A7ACB8] shrink-0" />
                        )}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-1 ml-4 p-4 rounded-lg bg-[#05050A]/80 border border-[#7B61FF]/10 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                          <div>
                            <div className="text-xs text-[#A7ACB8]">Status</div>
                            <div className="text-sm font-medium capitalize" style={{ color: getStatusColor(task.status) }}>
                              {task.status}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-[#A7ACB8]">Agent</div>
                            <div className="text-sm text-[#F4F6FF]">{task.agent_name}</div>
                          </div>
                          <div>
                            <div className="text-xs text-[#A7ACB8]">Started</div>
                            <div className="text-sm text-[#F4F6FF]">{formatTime(task.started_at)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-[#A7ACB8]">Completed</div>
                            <div className="text-sm text-[#F4F6FF]">{formatTime(task.completed_at)}</div>
                          </div>
                        </div>
                        {task.result && (
                          <div>
                            <div className="text-xs text-[#A7ACB8] mb-1">Result</div>
                            <pre className="text-sm text-[#F4F6FF] bg-[#0B0B10] p-3 rounded-lg border border-[#7B61FF]/10 overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                              {task.result}
                            </pre>
                          </div>
                        )}
                        {!task.result && task.status !== 'queued' && task.status !== 'running' && (
                          <div className="text-xs text-[#A7ACB8] italic">No result data available.</div>
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
    </div>
  );
}
