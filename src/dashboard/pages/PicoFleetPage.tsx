import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Plus, Trash2, Clock, CheckCircle, XCircle, AlertCircle,
  RefreshCw, Send, Loader2, ChevronDown, ChevronUp, X, Activity,
  Settings2, Timer, Check, Bot, Cpu, Brain, Sparkles, Image, Video, Globe, ChefHat,
  Edit3, Save, Share2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { picoService } from '@/services/api';
import type { PicoAgentFull, PicoCronJob } from '@/services/api';

// ---- Types ----

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

// ---- Constants ----

const TASK_TYPES = [
  { value: 'create_reminder', label: 'Create Reminder' },
  { value: 'telegram_message', label: 'Telegram Message' },
  { value: 'call_api', label: 'Call API' },
  { value: 'n8n_webhook', label: 'n8n Webhook' },
  { value: 'portfolio_deploy', label: 'Portfolio Deploy' },
  { value: 'social_media_post', label: 'Social Media Post' },
];

const INTERVAL_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '24 hours' },
  { value: 10080, label: 'Weekly' },
];

const TOOL_OPTIONS = [
  { id: 'recipes' as const, label: 'Recipes', short: 'RCP', icon: ChefHat, color: '#00FF88' },
  { id: 'image-gen' as const, label: 'Image Gen', short: 'IMG', icon: Image, color: '#00F0FF' },
  { id: 'video-gen' as const, label: 'Video Gen', short: 'VID', icon: Video, color: '#FFB800' },
  { id: 'website-builder' as const, label: 'Website Builder', short: 'WEB', icon: Globe, color: '#A855F7' },
  { id: 'social-media' as const, label: 'Social Media', short: 'SOC', icon: Share2, color: '#FF2D78' },
];

// ---- Status colors ----

const statusColors: Record<string, string> = {
  active: '#00FF88',
  completed: '#00FF88',
  idle: '#6B7280',
  cancelled: '#6B7280',
  disabled: '#FF6161',
  failed: '#FF6161',
  queued: '#00F0FF',
  running: '#FFB800',
  paused: '#FFB800',
};

function getStatusColor(status: string): string {
  return statusColors[status] || '#6B7280';
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

function parseAssignedTools(raw: string): string[] {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

// ---- Main Component ----

export function PicoFleetPage() {
  const isMobile = useMobileDetect();
  const [agents, setAgents] = useState<PicoAgentFull[]>([]);
  const [tasks, setTasks] = useState<PicoTask[]>([]);
  const [cronJobs, setCronJobs] = useState<PicoCronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState('fleet');

  // Quick task
  const [taskInput, setTaskInput] = useState('');
  const [planning, setPlanning] = useState(false);

  // Escalation dialog
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [escalateRequest, setEscalateRequest] = useState('');
  const [escalateMessage, setEscalateMessage] = useState('');

  // Create agent
  const [creatingSlot, setCreatingSlot] = useState<number | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPersonality, setNewAgentPersonality] = useState<'edith' | 'jarvis' | 'weebo'>('weebo');
  const [savingAgent, setSavingAgent] = useState(false);

  // Expanded task detail
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Recent activity
  const [recentTasks, setRecentTasks] = useState<Array<{ id: string; description: string; status: string; created_at?: string; started_at?: string; completed_at?: string }>>([]);

  // Agent Config tab state
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [configDirty, setConfigDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [cfgPersonality, setCfgPersonality] = useState('weebo');
  const [cfgMode, setCfgMode] = useState('builder');
  const [cfgVoice, setCfgVoice] = useState('friendly');
  const [cfgCreativity, setCfgCreativity] = useState([70]);
  const [cfgFormality, setCfgFormality] = useState([50]);
  const [cfgModelPref, setCfgModelPref] = useState('auto');
  const [cfgSystemPrompt, setCfgSystemPrompt] = useState('');
  const [cfgCustomCommands, setCfgCustomCommands] = useState('');
  const [cfgAssignedTools, setCfgAssignedTools] = useState<string[]>([]);
  const [cfgEnabled, setCfgEnabled] = useState(true);

  // Cron Jobs tab state
  const [showCronForm, setShowCronForm] = useState(false);
  const [editingCronId, setEditingCronId] = useState<string | null>(null);
  const [cronName, setCronName] = useState('');
  const [cronTaskType, setCronTaskType] = useState('create_reminder');
  const [cronInterval, setCronInterval] = useState(60);
  const [cronAgentSlot, setCronAgentSlot] = useState(2);
  const [cronConfig, setCronConfig] = useState('{}');
  const [savingCron, setSavingCron] = useState(false);

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

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // ---- Recent activity polling (every 30s) ----
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await picoService.getTasks({ limit: 10 });
        setRecentTasks(res.data.map(t => ({
          id: t.id,
          description: t.description,
          status: t.status,
          created_at: t.created_at,
        })));
      } catch { /* non-fatal */ }
    };
    fetchRecent();
    const interval = setInterval(fetchRecent, 30000);
    return () => clearInterval(interval);
  }, []);

  // ---- Load agent config when selected ----
  useEffect(() => {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) return;
    setCfgPersonality(agent.personality || 'weebo');
    setCfgMode(agent.mode || 'builder');
    setCfgVoice(agent.voice || 'friendly');
    setCfgCreativity([agent.creativity ?? 70]);
    setCfgFormality([agent.formality ?? 50]);
    setCfgModelPref(agent.model_preference || 'auto');
    setCfgSystemPrompt(agent.system_prompt || '');
    setCfgCustomCommands(agent.custom_commands || '');
    setCfgAssignedTools(parseAssignedTools(agent.assigned_tools));
    setCfgEnabled(agent.enabled !== 0);
    setConfigDirty(false);
  }, [selectedAgentId, agents]);

  // Auto-select first agent when switching to config tab
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
    // Block disabling the last active agent
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

  // ---- Save agent config ----

  const handleSaveConfig = async () => {
    if (!selectedAgentId) return;
    setSavingConfig(true);
    try {
      await picoService.updateAgent(selectedAgentId, {
        mode: cfgMode,
        voice: cfgVoice,
        creativity: cfgCreativity[0],
        formality: cfgFormality[0],
        model_preference: cfgModelPref,
        system_prompt: cfgSystemPrompt,
        custom_commands: cfgCustomCommands,
        assigned_tools: cfgAssignedTools,
        enabled: cfgEnabled,
      });
      showToast('Agent config saved', 'success');
      setConfigDirty(false);
      await loadData();
    } catch {
      showToast('Failed to save config', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // ---- Quick task ----

  const handlePlanTask = async () => {
    if (!taskInput.trim()) return;
    setPlanning(true);
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
        setTaskInput('');
        await loadData();
      }
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

  // ---- Cron job actions ----

  const resetCronForm = () => {
    setCronName('');
    setCronTaskType('create_reminder');
    setCronInterval(60);
    setCronAgentSlot(2);
    setCronConfig('{}');
    setEditingCronId(null);
    setShowCronForm(false);
  };

  const handleSaveCronJob = async () => {
    if (!cronName.trim()) return;
    setSavingCron(true);
    try {
      let parsedConfig: Record<string, unknown> = {};
      try { parsedConfig = JSON.parse(cronConfig); } catch { /* default */ }

      if (editingCronId) {
        await picoService.updateCronJob(editingCronId, {
          name: cronName,
          task_type: cronTaskType,
          task_config: parsedConfig,
          interval_minutes: cronInterval,
          agent_slot: cronAgentSlot,
        });
        showToast('Cron job updated', 'success');
      } else {
        await picoService.createCronJob({
          name: cronName,
          task_type: cronTaskType,
          task_config: parsedConfig,
          interval_minutes: cronInterval,
          agent_slot: cronAgentSlot,
        });
        showToast('Cron job created', 'success');
      }
      resetCronForm();
      await loadData();
    } catch {
      showToast('Failed to save cron job', 'error');
    } finally {
      setSavingCron(false);
    }
  };

  const handleEditCron = (job: PicoCronJob) => {
    setEditingCronId(job.id);
    setCronName(job.name);
    setCronTaskType(job.task_type);
    setCronInterval(job.interval_minutes);
    setCronAgentSlot(job.agent_slot);
    setCronConfig(job.task_config || '{}');
    setShowCronForm(true);
  };

  const handleToggleCron = async (job: PicoCronJob) => {
    try {
      await picoService.updateCronJob(job.id, { enabled: !job.enabled });
      showToast(`Cron job ${job.enabled ? 'disabled' : 'enabled'}`, 'success');
      await loadData();
    } catch {
      showToast('Failed to toggle cron job', 'error');
    }
  };

  const handleDeleteCron = async (jobId: string) => {
    try {
      await picoService.deleteCronJob(jobId);
      showToast('Cron job deleted', 'success');
      await loadData();
    } catch {
      showToast('Failed to delete cron job', 'error');
    }
  };

  // ---- Build slot data ----

  const slots = [1, 2, 3, 4, 5, 6].map((slotNum) => {
    const agent = agents.find((a) => a.slot === slotNum);
    return { slotNum, agent };
  });

  const totalCompleted = agents.reduce((sum, a) => sum + a.tasks_completed, 0);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PullToRefreshWrapper onRefresh={() => loadData()} className="space-y-6 animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-300">
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#0C0C18]/95 backdrop-blur-sm border shadow-2xl"
            style={{ borderColor: toast.type === 'success' ? '#00FF8840' : '#FF616140' }}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[#00FF88] shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-[#FF6161] shrink-0" />
            )}
            <span className="text-sm text-[#E8E8F0]">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-[#6B7280] hover:text-[#E8E8F0]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Weebo's
          </h1>
          <p className="text-[#6B7280]">
            <span className="text-[#00FF88] font-medium">{agents.length}</span> agent{agents.length !== 1 ? 's' : ''} deployed
            {' '}&middot;{' '}
            <span className="text-[#00F0FF] font-medium">{totalCompleted}</span> tasks completed
          </p>
        </div>
        <Button
          onClick={() => loadData()}
          disabled={refreshing}
          variant="outline"
          className="border-[#00F0FF]/30 hover:bg-[#00F0FF]/10 text-[#6B7280] hover:text-[#E8E8F0]"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#0C0C18] border border-[#00F0FF]/10">
          <TabsTrigger value="fleet" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF] gap-2">
            <Zap className="w-4 h-4" />
            Fleet
          </TabsTrigger>
          <TabsTrigger value="config" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF] gap-2">
            <Settings2 className="w-4 h-4" />
            Agent Config
          </TabsTrigger>
          <TabsTrigger value="cron" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF] gap-2">
            <Timer className="w-4 h-4" />
            Cron Jobs
          </TabsTrigger>
        </TabsList>

        {/* ============= TAB 1: FLEET ============= */}
        <TabsContent value="fleet" className="mt-6 space-y-6">
          {/* Agent Cards — 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {slots.map(({ slotNum, agent }) => {
              if (agent) {
                const color = getStatusColor(agent.enabled ? agent.status : 'disabled');
                const isPermanent = slotNum === 1;
                const tools = parseAssignedTools(agent.assigned_tools);
                return (
                  <Card key={slotNum} className={`border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all press-scale ${!agent.enabled ? 'opacity-60' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg text-[#E8E8F0] flex items-center gap-2">
                          <span>{agent.personality === 'edith' ? '⚡' : agent.personality === 'jarvis' ? '🎩' : '🤖'}</span>
                          {agent.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!agent.enabled}
                            onCheckedChange={() => handleToggleEnabled(agent)}
                            disabled={!!agent.enabled && agents.filter(a => a.enabled).length <= 1}
                            title={!!agent.enabled && agents.filter(a => a.enabled).length <= 1 ? 'At least one Weebo must remain active' : ''}
                            className="data-[state=checked]:bg-[#00FF88] data-[state=unchecked]:bg-[#FF6161]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                            style={{ borderColor: `${color}40`, color }}
                          >
                            {agent.enabled ? agent.status : 'disabled'}
                          </Badge>
                          {!isPermanent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAgent(agent)}
                              className="text-[#6B7280] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-10 w-10 p-0 press-scale"
                              title="Remove agent"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {/* Tool badges */}
                      {tools.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {tools.map(toolId => {
                            const tool = TOOL_OPTIONS.find(t => t.id === toolId);
                            if (!tool) return null;
                            return (
                              <span
                                key={toolId}
                                className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border"
                                style={{ borderColor: `${tool.color}40`, color: tool.color, backgroundColor: `${tool.color}10` }}
                              >
                                {tool.short}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-[#06060B] border border-[#00F0FF]/10">
                          <div className="text-xs text-[#6B7280] mb-1">Completed</div>
                          <div className="text-xl font-bold text-[#00FF88] font-mono">{agent.tasks_completed}</div>
                        </div>
                        <div className="p-3 rounded-lg bg-[#06060B] border border-[#00F0FF]/10">
                          <div className="text-xs text-[#6B7280] mb-1">Failed</div>
                          <div className="text-xl font-bold text-[#FF6161] font-mono">{agent.tasks_failed}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-[#6B7280] flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Slot {slotNum}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedAgentId(agent.id); setActiveTab('config'); }}
                          className="text-xs text-[#00F0FF] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 h-7 px-2"
                        >
                          <Settings2 className="w-3 h-3 mr-1" />
                          Config
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              // Empty slot — show create button or inline form
              if (creatingSlot === slotNum) {
                const personalities = [
                  { id: 'weebo' as const, emoji: '🤖', label: 'Weebo', color: '#00FF88' },
                  { id: 'jarvis' as const, emoji: '🎩', label: 'Jarvis', color: '#00F0FF' },
                  { id: 'edith' as const, emoji: '⚡', label: 'Edith', color: '#FFB800' },
                ];
                return (
                  <Card key={slotNum} className="border-[#00F0FF]/30 border-dashed">
                    <CardContent className={`flex flex-col items-center gap-3 min-h-[180px] ${isMobile ? 'p-3' : 'p-4'}`}>
                      <p className="text-sm text-[#6B7280]">Choose personality</p>
                      <div className="flex gap-2">
                        {personalities.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setNewAgentPersonality(p.id)}
                            className="flex flex-col items-center gap-1 p-3 sm:p-2 rounded-lg border transition-all min-w-[60px] min-h-[44px]"
                            style={{
                              borderColor: newAgentPersonality === p.id ? p.color : 'rgba(123,97,255,0.2)',
                              backgroundColor: newAgentPersonality === p.id ? `${p.color}10` : 'transparent',
                            }}
                          >
                            <span className="text-lg">{p.emoji}</span>
                            <span className="text-xs font-medium" style={{ color: newAgentPersonality === p.id ? p.color : '#6B7280' }}>{p.label}</span>
                          </button>
                        ))}
                      </div>
                      <Input
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        placeholder="Agent name..."
                        className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] max-w-[200px]"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateAgent()}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setCreatingSlot(null); setNewAgentName(''); setNewAgentPersonality('weebo'); }}
                          className="border-[#00F0FF]/30 text-[#6B7280]"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleCreateAgent}
                          disabled={!newAgentName.trim() || savingAgent}
                          className="bg-[#00F0FF] hover:bg-[#00D4B0]"
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
                  className="bg-[#0C0C18] border-[#00F0FF]/20 border-dashed hover:border-[#00F0FF]/40 transition-all cursor-pointer group press-scale"
                  onClick={() => setCreatingSlot(slotNum)}
                >
                  <CardContent className="p-6 flex flex-col items-center justify-center gap-3 min-h-[180px]">
                    <div className="w-12 h-12 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center group-hover:bg-[#00F0FF]/20 transition-colors">
                      <Plus className="w-6 h-6 text-[#00F0FF]" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-[#E8E8F0]">Deploy Agent</p>
                      <p className="text-xs text-[#6B7280]">Slot {slotNum} available</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Task */}
          <Card className="border-[#00F0FF]/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#E8E8F0] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#00F0FF]" />
                Quick Task
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-3">
                <Input
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Describe a task in natural language..."
                  className="flex-1 bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
                  onKeyDown={(e) => e.key === 'Enter' && !planning && handlePlanTask()}
                  disabled={planning}
                />
                <Button
                  onClick={handlePlanTask}
                  disabled={!taskInput.trim() || planning}
                  className="bg-[#00F0FF] hover:bg-[#00D4B0] min-w-[100px]"
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
              <p className="text-xs text-[#6B7280] mt-2">
                The planner will break your request into tasks and assign them to available agents.
              </p>
            </CardContent>
          </Card>

          {/* Escalation dialog */}
          {showEscalateDialog && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
              <p className="text-sm text-amber-400">{escalateMessage}</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
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
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-sm font-medium hover:bg-amber-400"
                >
                  Use Edith (Kimi)
                </button>
                <button
                  onClick={() => setShowEscalateDialog(false)}
                  className="px-3 py-1.5 rounded-lg border border-[#00F0FF]/30 text-[#6B7280] text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <Card className="border-[#00F0FF]/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#E8E8F0] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00FF88]" />
                Recent Activity
                <Badge variant="outline" className="ml-2 border-[#00F0FF]/20 text-[#6B7280] text-xs">
                  {recentTasks.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {recentTasks.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[#6B7280] text-sm">No recent activity.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 sm:p-2.5 rounded-lg bg-[#06060B] border border-[#00F0FF]/10 min-h-[44px]"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getStatusColor(task.status) }}
                      />
                      <span className="flex-1 text-sm text-[#E8E8F0] truncate">
                        {task.description}
                      </span>
                      <span
                        className="text-xs capitalize shrink-0"
                        style={{ color: getStatusColor(task.status) }}
                      >
                        {task.status}
                      </span>
                      <span className="text-xs text-[#6B7280] shrink-0 hidden sm:block">
                        {formatTime(task.completed_at || task.started_at || task.created_at || null)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task History */}
          <Card className="border-[#00F0FF]/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-[#E8E8F0] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#6B7280]" />
                Task History
                <Badge variant="outline" className="ml-2 border-[#00F0FF]/20 text-[#6B7280] text-xs">
                  {tasks.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {tasks.length === 0 ? (
                <div className="text-center py-10">
                  <AlertCircle className="w-10 h-10 text-[#00F0FF]/30 mx-auto mb-3" />
                  <p className="text-[#6B7280] text-sm">No tasks yet. Use Quick Task above to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const isExpanded = expandedTaskId === task.id;
                    return (
                      <div key={task.id}>
                        <button
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className="w-full text-left p-3 sm:p-3 py-4 rounded-lg bg-[#06060B] border border-[#00F0FF]/10 hover:border-[#00F0FF]/30 transition-all min-h-[44px]"
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
                            <span className="flex-1 text-sm text-[#E8E8F0] truncate">
                              {task.description}
                            </span>
                            <span className="text-xs text-[#6B7280] hidden sm:block shrink-0">
                              {task.agent_name}
                            </span>
                            <span className="text-xs text-[#6B7280] hidden md:block shrink-0 min-w-[70px] text-right">
                              {formatTime(task.completed_at || task.started_at || task.created_at)}
                            </span>
                            {task.status === 'queued' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleCancelTask(task.id); }}
                                className="text-[#6B7280] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-10 w-10 p-0 shrink-0 press-scale"
                                title="Cancel task"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-[#6B7280] shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#6B7280] shrink-0" />
                            )}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="mt-1 ml-4 p-4 rounded-lg bg-[#06060B]/80 border border-[#00F0FF]/10 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                              <div>
                                <div className="text-xs text-[#6B7280]">Status</div>
                                <div className="text-sm font-medium capitalize" style={{ color: getStatusColor(task.status) }}>
                                  {task.status}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-[#6B7280]">Agent</div>
                                <div className="text-sm text-[#E8E8F0]">{task.agent_name}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[#6B7280]">Started</div>
                                <div className="text-sm text-[#E8E8F0]">{formatTime(task.started_at)}</div>
                              </div>
                              <div>
                                <div className="text-xs text-[#6B7280]">Completed</div>
                                <div className="text-sm text-[#E8E8F0]">{formatTime(task.completed_at)}</div>
                              </div>
                            </div>
                            {task.result && (
                              <div>
                                <div className="text-xs text-[#6B7280] mb-1">Result</div>
                                <pre className="text-sm text-[#E8E8F0] bg-[#0C0C18] p-3 rounded-lg border border-[#00F0FF]/10 overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                                  {task.result}
                                </pre>
                              </div>
                            )}
                            {!task.result && task.status !== 'queued' && task.status !== 'running' && (
                              <div className="text-xs text-[#6B7280] italic">No result data available.</div>
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
        </TabsContent>

        {/* ============= TAB 2: AGENT CONFIG ============= */}
        <TabsContent value="config" className="mt-6 space-y-6">
          {/* Agent selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm text-[#6B7280] shrink-0">Configure agent:</label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] max-w-[300px]">
                <SelectValue placeholder="Select an agent..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0C0C18] border-[#00F0FF]/20">
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-[#E8E8F0]">
                    {a.personality === 'edith' ? '⚡' : a.personality === 'jarvis' ? '🎩' : '🤖'} {a.name} (Slot {a.slot})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedAgent ? (
            <div className="text-center py-16">
              <Bot className="w-12 h-12 text-[#00F0FF]/30 mx-auto mb-3" />
              <p className="text-[#6B7280]">Select an agent above to configure.</p>
            </div>
          ) : (
            <>
              {/* Personality Picker */}
              <div className="p-6 rounded-2xl bg-[#0C0C18] border border-[#00F0FF]/20">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#E8E8F0]">
                  <Sparkles className="w-5 h-5 text-[#00F0FF]" />
                  Personality
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { id: 'weebo', name: 'Weebo', desc: 'Enthusiastic helper, excited to assist', emoji: '🤖', color: '#00FF88' },
                    { id: 'jarvis', name: 'Jarvis', desc: 'Professional butler, polished and reliable', emoji: '🎩', color: '#00F0FF' },
                    { id: 'edith', name: 'Edith', desc: 'Sharp CTO, direct and efficient', emoji: '⚡', color: '#FFB800' },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setCfgPersonality(p.id); setConfigDirty(true); }}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        cfgPersonality === p.id
                          ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                          : 'border-[#00F0FF]/20 bg-[#06060B] hover:border-[#00F0FF]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{p.emoji}</span>
                        {cfgPersonality === p.id && (
                          <div className="w-6 h-6 rounded-full bg-[#00F0FF] flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-[#E8E8F0] mb-1">{p.name}</h3>
                      <p className="text-sm text-[#6B7280]">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Picker */}
              <div className="p-6 rounded-2xl bg-[#0C0C18] border border-[#00F0FF]/20">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#E8E8F0]">
                  <Cpu className="w-5 h-5 text-[#00F0FF]" />
                  Mode
                </h2>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { id: 'minimal', name: 'Minimal', desc: 'Simple responses, reminders & Q&A', color: '#00F0FF' },
                    { id: 'builder', name: 'Builder', desc: 'Code gen, portfolio updates, full toolset', color: '#00FF88' },
                    { id: 'operator', name: 'Operator', desc: 'Full automation, API calls, workflows', color: '#FFB800' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setCfgMode(m.id); setConfigDirty(true); }}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        cfgMode === m.id
                          ? `border-[#00F0FF] bg-[#00F0FF]/10`
                          : 'border-[#00F0FF]/20 bg-[#06060B] hover:border-[#00F0FF]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${m.color}20` }}>
                          <span className="text-sm font-bold" style={{ color: m.color }}>{m.id[0].toUpperCase()}</span>
                        </span>
                        {cfgMode === m.id && (
                          <div className="w-6 h-6 rounded-full bg-[#00F0FF] flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-[#E8E8F0] mb-1">{m.name}</h3>
                      <p className="text-sm text-[#6B7280]">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Preference */}
              <div className="p-6 rounded-2xl bg-[#0C0C18] border border-[#00F0FF]/20">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#E8E8F0]">
                  <Brain className="w-5 h-5 text-[#00F0FF]" />
                  Model Preference
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'auto', label: 'Auto', desc: 'Best engine for each task' },
                    { value: 'local', label: 'Local', desc: 'Always run locally (Ollama)' },
                    { value: 'cloud', label: 'Cloud', desc: 'Cloud models via OpenRouter' },
                    { value: 'premium', label: 'Premium', desc: 'Top-tier models (more credits)' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setCfgModelPref(opt.value); setConfigDirty(true); }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        cfgModelPref === opt.value
                          ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                          : 'border-[#00F0FF]/20 hover:border-[#00F0FF]/40'
                      }`}
                    >
                      <div className="text-sm font-medium text-[#E8E8F0]">{opt.label}</div>
                      <div className="text-xs text-[#6B7280]">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice & Tone */}
              <div className="p-6 rounded-2xl bg-[#0C0C18] border border-[#00F0FF]/20">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#E8E8F0]">
                  Voice & Tone
                </h2>
                <div className="space-y-2">
                  {[
                    { id: 'professional', name: 'Professional', desc: 'Formal and polished' },
                    { id: 'friendly', name: 'Friendly', desc: 'Warm and approachable' },
                    { id: 'witty', name: 'Witty', desc: 'Clever with personality' },
                  ].map(v => (
                    <button
                      key={v.id}
                      onClick={() => { setCfgVoice(v.id); setConfigDirty(true); }}
                      className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between ${
                        cfgVoice === v.id
                          ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                          : 'border-[#00F0FF]/20 bg-[#06060B] hover:border-[#00F0FF]/40'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-medium text-[#E8E8F0]">{v.name}</div>
                        <div className="text-sm text-[#6B7280]">{v.desc}</div>
                      </div>
                      {cfgVoice === v.id && (
                        <div className="w-5 h-5 rounded-full bg-[#00F0FF] flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders — Creativity & Formality */}
              <div className="p-6 rounded-2xl bg-[#0C0C18] border border-[#00F0FF]/20 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-[#6B7280]">Creativity</label>
                    <span className="text-sm text-[#E8E8F0] font-mono">{cfgCreativity[0]}%</span>
                  </div>
                  <Slider
                    value={cfgCreativity}
                    onValueChange={(v) => { setCfgCreativity(v); setConfigDirty(true); }}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-[#6B7280] mt-1">
                    <span>Conservative</span>
                    <span>Creative</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-[#6B7280]">Formality</label>
                    <span className="text-sm text-[#E8E8F0] font-mono">{cfgFormality[0]}%</span>
                  </div>
                  <Slider
                    value={cfgFormality}
                    onValueChange={(v) => { setCfgFormality(v); setConfigDirty(true); }}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-[#6B7280] mt-1">
                    <span>Casual</span>
                    <span>Formal</span>
                  </div>
                </div>
              </div>

              {/* System Prompt & Custom Commands */}
              <div className="p-6 rounded-2xl bg-[#0C0C18] border border-[#00F0FF]/20 space-y-4">
                <div>
                  <label className="text-sm text-[#6B7280] block mb-2">System Prompt</label>
                  <Textarea
                    value={cfgSystemPrompt}
                    onChange={(e) => { setCfgSystemPrompt(e.target.value); setConfigDirty(true); }}
                    className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] min-h-[120px] resize-none"
                    placeholder="Custom instructions for this agent..."
                  />
                </div>
                <div>
                  <label className="text-sm text-[#6B7280] block mb-2">Custom Commands</label>
                  <Textarea
                    value={cfgCustomCommands}
                    onChange={(e) => { setCfgCustomCommands(e.target.value); setConfigDirty(true); }}
                    className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] min-h-[100px] resize-none"
                    placeholder="Tell this agent how to behave, what to prioritize..."
                  />
                </div>
              </div>

              {/* Assigned Tools */}
              <div className="p-6 rounded-2xl bg-[#0C0C18] border border-[#00F0FF]/20">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#E8E8F0]">
                  Assigned Tools
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {TOOL_OPTIONS.map(tool => {
                    const isActive = cfgAssignedTools.includes(tool.id);
                    return (
                      <button
                        key={tool.id}
                        onClick={() => {
                          setCfgAssignedTools(prev =>
                            isActive ? prev.filter(t => t !== tool.id) : [...prev, tool.id]
                          );
                          setConfigDirty(true);
                        }}
                        className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
                          isActive
                            ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                            : 'border-[#00F0FF]/20 hover:border-[#00F0FF]/40'
                        }`}
                      >
                        <tool.icon className="w-5 h-5" style={{ color: isActive ? tool.color : '#6B7280' }} />
                        <span className={`text-sm font-medium ${isActive ? 'text-[#E8E8F0]' : 'text-[#6B7280]'}`}>
                          {tool.label}
                        </span>
                        {isActive && (
                          <Check className="w-4 h-4 text-[#00F0FF] ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Enable/Disable + Save */}
              <div className="p-6 rounded-2xl bg-[#0C0C18] border border-[#00F0FF]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={cfgEnabled}
                      onCheckedChange={(v) => {
                        if (!v && cfgEnabled && agents.filter(a => a.enabled).length <= 1) {
                          showToast('At least one Weebo must remain active', 'error');
                          return;
                        }
                        setCfgEnabled(v);
                        setConfigDirty(true);
                      }}
                      disabled={cfgEnabled && agents.filter(a => a.enabled).length <= 1}
                      className="data-[state=checked]:bg-[#00FF88] data-[state=unchecked]:bg-[#FF6161]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div>
                      <div className="text-sm font-medium text-[#E8E8F0]">
                        Agent {cfgEnabled ? 'Enabled' : 'Disabled'}
                      </div>
                      <div className="text-xs text-[#6B7280]">
                        {cfgEnabled && agents.filter(a => a.enabled).length <= 1
                          ? 'Last active agent — cannot be disabled'
                          : cfgEnabled ? 'This agent will process tasks' : 'This agent is paused and will not process tasks'}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveConfig}
                    disabled={!configDirty || savingConfig}
                    className="bg-[#00F0FF] hover:bg-[#00D4B0] min-w-[100px]"
                  >
                    {savingConfig ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ============= TAB 3: CRON JOBS ============= */}
        <TabsContent value="cron" className="mt-6 space-y-6">
          {/* Create / Edit form */}
          {showCronForm ? (
            <Card className="border-[#00F0FF]/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[#E8E8F0]">
                  {editingCronId ? 'Edit Cron Job' : 'New Cron Job'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div>
                  <label className="text-sm text-[#6B7280] block mb-1">Name</label>
                  <Input
                    value={cronName}
                    onChange={e => setCronName(e.target.value)}
                    placeholder="e.g., Daily standup reminder"
                    className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-[#6B7280] block mb-1">Task Type</label>
                    <Select value={cronTaskType} onValueChange={setCronTaskType}>
                      <SelectTrigger className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0C0C18] border-[#00F0FF]/20">
                        {TASK_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value} className="text-[#E8E8F0]">{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[#6B7280] block mb-1">Interval</label>
                    <Select value={String(cronInterval)} onValueChange={v => setCronInterval(Number(v))}>
                      <SelectTrigger className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0C0C18] border-[#00F0FF]/20">
                        {INTERVAL_OPTIONS.map(i => (
                          <SelectItem key={i.value} value={String(i.value)} className="text-[#E8E8F0]">{i.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[#6B7280] block mb-1">Agent Slot</label>
                    <Select value={String(cronAgentSlot)} onValueChange={v => setCronAgentSlot(Number(v))}>
                      <SelectTrigger className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0C0C18] border-[#00F0FF]/20">
                        {[2, 3, 4, 5, 6].map(s => {
                          const a = agents.find(ag => ag.slot === s);
                          return (
                            <SelectItem key={s} value={String(s)} className="text-[#E8E8F0]">
                              Slot {s}{a ? ` — ${a.name}` : ' (empty)'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#6B7280] block mb-1">Config (JSON)</label>
                  <Textarea
                    value={cronConfig}
                    onChange={e => setCronConfig(e.target.value)}
                    className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0] font-mono text-xs min-h-[80px] resize-none"
                    placeholder='{"reminder_text": "Check server health"}'
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={resetCronForm}
                    className="border-[#00F0FF]/30 text-[#6B7280]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveCronJob}
                    disabled={!cronName.trim() || savingCron}
                    className="bg-[#00F0FF] hover:bg-[#00D4B0]"
                  >
                    {savingCron ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingCronId ? 'Update' : 'Create')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button
              onClick={() => setShowCronForm(true)}
              className="bg-[#00F0FF] hover:bg-[#00D4B0]"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Cron Job
            </Button>
          )}

          {/* Cron Jobs List */}
          {cronJobs.length === 0 && !showCronForm ? (
            <div className="text-center py-16">
              <Timer className="w-12 h-12 text-[#00F0FF]/30 mx-auto mb-3" />
              <p className="text-[#6B7280] mb-2">No cron jobs yet.</p>
              <p className="text-xs text-[#6B7280]">Create recurring tasks that run on a schedule.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cronJobs.map(job => {
                const intervalLabel = INTERVAL_OPTIONS.find(i => i.value === job.interval_minutes)?.label || `${job.interval_minutes}m`;
                const typeLabel = TASK_TYPES.find(t => t.value === job.task_type)?.label || job.task_type;
                const slotAgent = agents.find(a => a.slot === job.agent_slot);
                return (
                  <Card key={job.id} className={`border-[#00F0FF]/20 ${!job.enabled ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-[#E8E8F0] truncate">{job.name}</span>
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0"
                              style={{ borderColor: '#00F0FF30', color: '#00F0FF' }}
                            >
                              {typeLabel}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280]">
                            <span className="flex items-center gap-1">
                              <Timer className="w-3 h-3" />
                              Every {intervalLabel}
                            </span>
                            <span>
                              Slot {job.agent_slot}{slotAgent ? ` (${slotAgent.name})` : ''}
                            </span>
                            <span>{job.run_count} runs</span>
                            {job.last_run_at && (
                              <span>Last: {formatTime(job.last_run_at)}</span>
                            )}
                            {job.next_run_at && (
                              <span className="text-[#00F0FF]">Next: {formatTime(job.next_run_at)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={!!job.enabled}
                            onCheckedChange={() => handleToggleCron(job)}
                            className="data-[state=checked]:bg-[#00FF88] data-[state=unchecked]:bg-[#FF6161]/40"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCron(job)}
                            className="text-[#6B7280] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 h-8 w-8 p-0"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCron(job.id)}
                            className="text-[#6B7280] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PullToRefreshWrapper>
  );
}
