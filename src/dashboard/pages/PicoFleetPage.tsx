// PicoFleetPage — orchestrator: state + data fetching. UI split into pico-fleet/ sub-components.
import { useState, useEffect, useCallback } from 'react';
import { PageShell, PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { Zap, RefreshCw, Settings2, Timer, CheckCircle, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { picoService } from '@/services/api';
import type { PicoAgentFull, PicoCronJob } from '@/services/api';
import {
  AgentList,
  CreateTaskDialog,
  StatusPanel,
  TaskQueue,
  AgentConfigTab,
  CronJobsTab,
} from './pico-fleet';
import type { PicoTask, RecentTask } from './pico-fleet';

const BORDER_SUBTLE = 'rgba(139,92,246,0.08)';

export function PicoFleetPage() {
  const isMobile = useMobileDetect();
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'jarvis', page: 'pico-fleet' });

  // ---- Core data ----
  const [agents, setAgents] = useState<PicoAgentFull[]>([]);
  const [tasks, setTasks] = useState<PicoTask[]>([]);
  const [cronJobs, setCronJobs] = useState<PicoCronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ---- UI ----
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState('fleet');

  // ---- Quick task ----
  const [taskInput, setTaskInput] = useState('');
  const [planning, setPlanning] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [escalateRequest, setEscalateRequest] = useState('');
  const [escalateMessage, setEscalateMessage] = useState('');

  // ---- Agent create form ----
  const [creatingSlot, setCreatingSlot] = useState<number | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPersonality, setNewAgentPersonality] = useState<'edith' | 'jarvis' | 'weebo'>('weebo');
  const [savingAgent, setSavingAgent] = useState(false);

  // ---- Task history ----
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);

  // ---- Config tab ----
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // ---- Toast auto-dismiss ----
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
      const [agentsRes, tasksRes, cronRes] = await Promise.all([
        picoService.getAgents(),
        picoService.getTasks({ limit: 50 }),
        picoService.getCronJobs(),
      ]);
      setAgents(agentsRes.data);
      setTasks(tasksRes.data);
      setCronJobs(cronRes.data);
    } catch {
      showToast('Failed to load fleet data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => { loadData(true); }, [loadData]);

  // ---- Auto-refresh task list every 30 s when on fleet tab ----
  useEffect(() => {
    if (activeTab !== 'fleet') return;
    const refreshTasks = async () => {
      try {
        const res = await picoService.getTasks({ limit: 50 });
        setTasks(res.data);
        setRecentTasks(res.data.slice(0, 10).map(t => ({
          id: t.id,
          description: t.description,
          status: t.status,
          created_at: t.created_at,
        })));
      } catch { /* non-fatal */ }
    };
    const interval = setInterval(refreshTasks, 30_000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // ---- Auto-select first agent when switching to config tab ----
  useEffect(() => {
    if (activeTab === 'config' && !selectedAgentId && agents.length > 0) {
      setSelectedAgentId(agents[0].id);
    }
  }, [activeTab, selectedAgentId, agents]);

  // ---- Agent actions ----
  const handleCreateAgent = async () => {
    if (!newAgentName.trim() || creatingSlot === null) return;
    setSavingAgent(true);
    try {
      await picoService.createAgent(newAgentName.trim(), newAgentPersonality);
      showToast(`Agent "${newAgentName.trim()}" deployed as ${newAgentPersonality}`, 'success');
      setNewAgentName('');
      setNewAgentPersonality('weebo');
      setCreatingSlot(null);
      await loadData();
    } catch {
      showToast('Failed to create agent', 'error');
    } finally {
      setSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (agent: PicoAgentFull) => {
    try {
      await picoService.deleteAgent(agent.id);
      showToast(`Agent "${agent.name}" removed`, 'success');
      if (selectedAgentId === agent.id) setSelectedAgentId('');
      await loadData();
    } catch {
      showToast('Failed to remove agent', 'error');
    }
  };

  const handleToggleEnabled = async (agent: PicoAgentFull) => {
    if (agent.enabled) {
      const activeCount = agents.filter(a => a.enabled).length;
      if (activeCount <= 1) {
        showToast('At least one Weebo must remain active', 'error');
        return;
      }
    }
    try {
      await picoService.updateAgent(agent.id, { enabled: !agent.enabled });
      showToast(`${agent.name} ${agent.enabled ? 'disabled' : 'enabled'}`, 'success');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle agent';
      showToast(msg.includes('last active') ? 'At least one Weebo must remain active' : msg, 'error');
    }
  };

  // ---- Quick task ----
  const handlePlanTask = async () => {
    if (!taskInput.trim()) return;
    setPlanning(true);
    void notifyStart('fleet-task-plan');
    try {
      const res = await picoService.planTask(taskInput.trim());
      if (res.data.escalate) {
        setEscalateRequest(res.data.request || taskInput.trim());
        setEscalateMessage(res.data.message || "This task looks complex. Want Edith (Kimi) to handle it?");
        setShowEscalateDialog(true);
      } else {
        setShowEscalateDialog(false);
        const count = res.data.queued;
        showToast(`Planned ${count} task${count !== 1 ? 's' : ''} (${res.data.credits_used} credits)`, 'success');
        void notifyDone(`Planned ${count} task(s)`);
        setTaskInput('');
        await loadData();
      }
    } catch {
      showToast('Failed to plan task', 'error');
      void notifyFail('fleet-task-plan failed');
    } finally {
      setPlanning(false);
    }
  };

  const handleEscalateAccept = async () => {
    setShowEscalateDialog(false);
    setPlanning(true);
    try {
      const res = await picoService.planTaskPremium(escalateRequest);
      const count = res.data.queued;
      showToast(`Queued ${count} task${count !== 1 ? 's' : ''} with Edith! (${res.data.credits_used} credits)`, 'success');
      setTaskInput('');
      await loadData();
    } catch {
      showToast('Failed to plan task with Edith', 'error');
    } finally {
      setPlanning(false);
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await picoService.cancelTask(taskId);
      showToast('Task cancelled', 'success');
      await loadData();
    } catch {
      showToast('Failed to cancel task', 'error');
    }
  };

  // ---- Derived data ----
  const slots = [1, 2, 3, 4, 5, 6].map(slotNum => ({
    slotNum,
    agent: agents.find(a => a.slot === slotNum),
  }));
  const totalCompleted = agents.reduce((sum, a) => sum + a.tasks_completed, 0);

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#ADFF2F] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <DashboardPageWrapper>
      <PageShell>
        <PullToRefreshWrapper onRefresh={() => loadData()} className="space-y-6 animate-in fade-in duration-500">
          {/* Toast */}
          {toast && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-300">
              <div
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[var(--ag-bg-surface)]/95 backdrop-blur-sm border shadow-2xl"
                style={{ borderColor: toast.type === 'success' ? '#00FF8840' : '#FF616140' }}
              >
                {toast.type === 'success'
                  ? <CheckCircle className="w-4 h-4 text-[#00FF88] shrink-0" />
                  : <XCircle className="w-4 h-4 text-[#FF6161] shrink-0" />
                }
                <span className="text-sm text-[var(--ag-text-primary)]">{toast.message}</span>
                <button
                  onClick={() => setToast(null)}
                  className="ml-2 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <PageHeader
            icon={Zap}
            title="Pico Fleet"
            subtitle={`${agents.length} agent${agents.length !== 1 ? 's' : ''} deployed · ${totalCompleted} tasks completed`}
            badge={
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#ADFF2F]/10 border border-[#ADFF2F]/30 text-[#ADFF2F]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#ADFF2F] opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ADFF2F]" />
                </span>
                Jarvis
              </span>
            }
            actions={
              <Button
                variant="ghost"
                size="icon"
                onClick={() => loadData()}
                disabled={refreshing}
                aria-label="Refresh fleet"
                className="min-h-[44px] min-w-[44px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            }
          />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-[var(--ag-bg-surface)] border" style={{ borderColor: BORDER_SUBTLE }}>
              <TabsTrigger value="fleet" className="data-[state=active]:bg-[#8B5CF6]/10 data-[state=active]:text-[var(--ag-violet)] gap-2 min-h-[44px]">
                <Zap className="w-4 h-4" />
                Fleet
              </TabsTrigger>
              <TabsTrigger value="config" className="data-[state=active]:bg-[#8B5CF6]/10 data-[state=active]:text-[var(--ag-violet)] gap-2 min-h-[44px]">
                <Settings2 className="w-4 h-4" />
                Agent Config
              </TabsTrigger>
              <TabsTrigger value="cron" className="data-[state=active]:bg-[#8B5CF6]/10 data-[state=active]:text-[var(--ag-violet)] gap-2 min-h-[44px]">
                <Timer className="w-4 h-4" />
                Cron Jobs
              </TabsTrigger>
            </TabsList>

            {/* Fleet Tab */}
            <TabsContent value="fleet" className="mt-6 space-y-6">
              <AgentList
                slots={slots}
                agents={agents}
                creatingSlot={creatingSlot}
                newAgentName={newAgentName}
                newAgentPersonality={newAgentPersonality}
                savingAgent={savingAgent}
                isMobile={isMobile}
                onSetCreatingSlot={setCreatingSlot}
                onSetNewAgentName={setNewAgentName}
                onSetNewAgentPersonality={setNewAgentPersonality}
                onCreateAgent={handleCreateAgent}
                onDeleteAgent={handleDeleteAgent}
                onToggleEnabled={handleToggleEnabled}
                onConfigure={(id) => { setSelectedAgentId(id); setActiveTab('config'); }}
              />
              <CreateTaskDialog
                taskInput={taskInput}
                planning={planning}
                showEscalateDialog={showEscalateDialog}
                escalateMessage={escalateMessage}
                onSetTaskInput={setTaskInput}
                onPlanTask={handlePlanTask}
                onEscalateAccept={handleEscalateAccept}
                onEscalateCancel={() => setShowEscalateDialog(false)}
              />
              <StatusPanel recentTasks={recentTasks} />
              <TaskQueue
                tasks={tasks}
                agents={agents}
                expandedTaskId={expandedTaskId}
                onExpandTask={setExpandedTaskId}
                onCancelTask={handleCancelTask}
              />
            </TabsContent>

            {/* Agent Config Tab */}
            <TabsContent value="config" className="mt-6">
              <AgentConfigTab
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelectAgentId={setSelectedAgentId}
                onShowToast={showToast}
                onRefresh={loadData}
              />
            </TabsContent>

            {/* Cron Jobs Tab */}
            <TabsContent value="cron" className="mt-6">
              <CronJobsTab
                cronJobs={cronJobs}
                agents={agents}
                onShowToast={showToast}
                onRefresh={loadData}
              />
            </TabsContent>
          </Tabs>
        </PullToRefreshWrapper>
      </PageShell>
    </DashboardPageWrapper>
  );
}
