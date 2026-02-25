import { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Play,
  Trash2,
  Clock,
  Webhook,
  CalendarClock,
  Activity,
  Search,
  ToggleLeft,
  ToggleRight,
  Edit3,
  Send,
  Globe,
  MessageSquare,
  RefreshCw,
  Hand,
  Hash,
  HeartPulse,
  FileText,
  Phone,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardStore } from '@/stores/dashboardStore';
import { automationLogService, automationService } from '@/services/api';
import type { AutomationTrigger, AutomationAction, AutomationLog } from '@/types';

const triggerIcons: Record<AutomationTrigger, typeof Clock> = {
  time: CalendarClock,
  event: Activity,
  webhook: Webhook,
  manual: Hand,
  keyword: Hash,
  health_down: HeartPulse,
};

const triggerLabels: Record<AutomationTrigger, string> = {
  time: 'Scheduled',
  event: 'Event-based',
  webhook: 'Webhook',
  manual: 'Manual',
  keyword: 'Keyword',
  health_down: 'Health Check',
};

const triggerColors: Record<AutomationTrigger, string> = {
  time: '#FFB800',
  event: '#00FF88',
  webhook: '#00F0FF',
  manual: '#6B7280',
  keyword: '#FF2D78',
  health_down: '#FF6161',
};

const actionIcons: Record<AutomationAction, typeof Send> = {
  'n8n-webhook': Globe,
  'telegram-message': Send,
  'whatsapp-message': Send,
  'portfolio-update': RefreshCw,
  'manychat-broadcast': MessageSquare,
  'call_api': Phone,
  'create_reminder': Bell,
  'log': FileText,
};

const actionLabels: Record<AutomationAction, string> = {
  'n8n-webhook': 'n8n Webhook',
  'telegram-message': 'Telegram Message',
  'whatsapp-message': 'WhatsApp Message',
  'portfolio-update': 'Portfolio Update',
  'manychat-broadcast': 'ManyChat Broadcast',
  'call_api': 'API Call',
  'create_reminder': 'Create Reminder',
  'log': 'Log',
};

export function AutomationsPage() {
  const {
    automations,
    addAutomation,
    updateAutomation,
    deleteAutomation,
    triggerAutomation,
    isLoading,
  } = useDashboardStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    triggerType: 'time' as AutomationTrigger,
    actionType: 'telegram-message' as AutomationAction,
    enabled: true,
  });
  const [saveError, setSaveError] = useState('');
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  // 37.4: Dead-letter log
  const [deadLetters, setDeadLetters] = useState<Array<{ id: string; automation_id: string; url: string; error: string; payload: string | null; failed_at: number }>>([]);

  const resetForm = () => {
    setForm({ name: '', description: '', triggerType: 'time', actionType: 'telegram-message', enabled: true });
    setEditingId(null);
    setSaveError('');
  };

  useEffect(() => {
    automationLogService.list(20).then((r) => setLogs(r.data)).catch(() => setLogs([]));
    automationService.getDeadLetters().then((r) => setDeadLetters(r.data)).catch(() => setDeadLetters([]));
  }, []);

  const handleOpenAdd = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (id: string) => {
    const auto = automations.find((a) => a.id === id);
    if (!auto) return;
    setForm({
      name: auto.name,
      description: auto.description,
      triggerType: auto.triggerType,
      actionType: auto.actionType,
      enabled: auto.enabled,
    });
    setEditingId(id);
    setIsAddDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaveError('');
    try {
      if (editingId) {
        await updateAutomation(editingId, {
          name: form.name,
          description: form.description,
          triggerType: form.triggerType,
          actionType: form.actionType,
          enabled: form.enabled,
        });
      } else {
        await addAutomation({
          name: form.name,
          description: form.description,
          triggerType: form.triggerType,
          actionType: form.actionType,
          config: {},
          enabled: form.enabled,
        });
      }
      setIsAddDialogOpen(false);
      resetForm();
    } catch {
      setSaveError('Failed to save automation. Please try again.');
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await updateAutomation(id, { enabled: !enabled });
  };

  const handleDelete = async (id: string) => {
    await deleteAutomation(id);
  };

  const handleTrigger = async (id: string) => {
    await triggerAutomation(id);
  };

  const handleTestFire = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await automationService.testFire(id);
      setTestResult({ id, success: res.data.success, message: res.data.message });
    } catch {
      setTestResult({ id, success: false, message: 'Test request failed' });
    } finally {
      setTestingId(null);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const filtered = automations
    .filter((a) => {
      if (filter === 'active') return a.enabled;
      if (filter === 'inactive') return !a.enabled;
      return true;
    })
    .filter((a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const enabledCount = automations.filter((a) => a.enabled).length;
  const totalRuns = automations.reduce((acc, a) => acc + a.runCount, 0);

  const formatLastRun = (lastRun?: string) => {
    if (!lastRun) return 'Never';
    const date = new Date(lastRun);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const fmtRunTime = (ts: string | null | undefined): string => {
    if (!ts) return 'never';
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return 'yesterday';
    return `${Math.floor(diff / 86400)}d ago`;
  };


  // Extract HTTP status code from output string like "HTTP 200 OK" or "HTTP 404 Not Found"
  const parseHttpStatus = (output: string): number | null => {
    const match = output.match(/^HTTP (\d{3})/);
    return match ? parseInt(match[1], 10) : null;
  };

  const getHttpStatusBg = (status: number): string => {
    if (status >= 200 && status < 300) return 'bg-[#00FF88]/10 border-[#00FF88]/20 text-[#00FF88]';
    if (status >= 400) return 'bg-[#FF6161]/10 border-[#FF6161]/20 text-[#FF6161]';
    return 'bg-[#6B7280]/10 border-[#6B7280]/20 text-[#6B7280]';
  };

  return (
    <div data-testid="automations-page" className="space-y-4 md:space-y-6 animate-in fade-in duration-500 px-1 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Automations
          </h1>
          <p className="text-sm md:text-base text-[#6B7280]">
            <span className="text-[#00F0FF] font-medium">{enabledCount}</span> active of {automations.length} total
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-[#00F0FF] hover:bg-[#00D4B0] press-scale min-h-[44px]">
          <Plus className="w-4 h-4 mr-2" />New Automation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00F0FF]/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#00F0FF]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">{automations.length}</div>
                <div className="text-xs text-[#6B7280]">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00FF88]/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-[#00FF88]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">{enabledCount}</div>
                <div className="text-xs text-[#6B7280]">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFB800]/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-[#FFB800]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">{totalRuns}</div>
                <div className="text-xs text-[#6B7280]">Total Runs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF2D78]/10 flex items-center justify-center">
                <Webhook className="w-5 h-5 text-[#FF2D78]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">
                  {automations.filter((a) => a.triggerType === 'webhook').length}
                </div>
                <div className="text-xs text-[#6B7280]">Webhooks</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0C0C18] border-[#00F0FF]/30 text-[#E8E8F0] min-h-[44px]"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="bg-[#0C0C18] border border-[#00F0FF]/20 overflow-x-auto flex-nowrap w-auto">
            <TabsTrigger value="all" className="data-[state=active]:bg-[#00F0FF] min-h-[44px] flex-none">All</TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-[#00F0FF] min-h-[44px] flex-none">Active</TabsTrigger>
            <TabsTrigger value="inactive" className="data-[state=active]:bg-[#00F0FF] min-h-[44px] flex-none">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Automation List */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((auto) => {
            const TriggerIcon = triggerIcons[auto.triggerType];
            const ActionIcon = actionIcons[auto.actionType];
            const triggerColor = triggerColors[auto.triggerType];
            return (
              <Card
                key={auto.id}
                className={`bg-[#0C0C18] border-[#00F0FF]/20 transition-all duration-300 hover:border-[#00F0FF]/40 press-scale ${
                  !auto.enabled ? 'opacity-60' : ''
                }`}
              >
                <CardContent className="p-3 md:p-5">
                  <div className="flex items-start gap-3 md:gap-4">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(auto.id, auto.enabled)}
                      aria-label={auto.enabled ? `Disable ${auto.name}` : `Enable ${auto.name}`}
                      className="flex-shrink-0 mt-1 press-scale min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      {auto.enabled ? (
                        <ToggleRight className="w-8 h-5 text-[#00FF88]" />
                      ) : (
                        <ToggleLeft className="w-8 h-5 text-[#6B7280]" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#E8E8F0]">{auto.name}</h3>
                        {auto.enabled && (
                          <div className="w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" />
                        )}
                      </div>
                      <p className="text-sm text-[#6B7280] mb-1">{auto.description}</p>

                      {(auto.run_count ?? 0) > 0 && (
                        <p className="text-xs text-[#8888AA] mb-2">
                          Ran {auto.run_count} time{auto.run_count !== 1 ? 's' : ''}
                          {' · '}Last run: {fmtRunTime(auto.last_run)}
                        </p>
                      )}

                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Trigger badge */}
                        <Badge
                          variant="outline"
                          style={{ borderColor: `${triggerColor}40`, color: triggerColor }}
                        >
                          <TriggerIcon className="w-3 h-3 mr-1" />
                          {triggerLabels[auto.triggerType]}
                        </Badge>

                        {/* Arrow */}
                        <span className="text-[#6B7280]">&rarr;</span>

                        {/* Action badge */}
                        <Badge variant="outline" className="border-[#00F0FF]/30 text-[#6B7280]">
                          <ActionIcon className="w-3 h-3 mr-1" />
                          {actionLabels[auto.actionType]}
                        </Badge>

                        {/* Run count */}
                        <Badge variant="outline" className="border-[#00F0FF]/20 text-[#6B7280]">
                          <Play className="w-3 h-3 mr-1" />
                          {auto.runCount} runs
                        </Badge>

                        {/* Last run */}
                        <span className="text-xs text-[#6B7280]">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatLastRun(auto.lastRun)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {testResult?.id === auto.id && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${testResult.success ? 'bg-[#00FF88]/10 border-[#00FF88]/30 text-[#00FF88]' : 'bg-[#FF6161]/10 border-[#FF6161]/30 text-[#FF6161]'}`}>
                          {testResult.message}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                      {auto.triggerType === 'webhook' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestFire(auto.id)}
                          disabled={testingId === auto.id}
                          aria-label={`Test ${auto.name}`}
                          className="text-[#00F0FF] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 h-10 w-10 p-0 press-scale"
                        >
                          {testingId === auto.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTrigger(auto.id)}
                        disabled={!auto.enabled || isLoading}
                        aria-label={`Run ${auto.name}`}
                        className="text-[#00FF88] hover:text-[#00FF88] hover:bg-[#00FF88]/10 h-10 w-10 p-0 press-scale"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(auto.id)}
                        aria-label={`Edit ${auto.name}`}
                        className="text-[#00F0FF] hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 h-10 w-10 p-0 press-scale"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(auto.id)}
                        aria-label={`Delete ${auto.name}`}
                        className="text-[#6B7280] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-10 w-10 p-0 press-scale"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-[#00F0FF]/30 mx-auto mb-4" />
            <p className="text-[#6B7280] mb-4">
              {searchQuery || filter !== 'all' ? 'No automations match your filters' : 'No automations yet'}
            </p>
            {!searchQuery && filter === 'all' && (
              <Button onClick={handleOpenAdd} variant="outline" className="border-[#00F0FF]/30 hover:bg-[#00F0FF]/10">
                Create your first automation
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="glass-card-v2 border border-[#00F0FF]/30 text-[#E8E8F0] max-w-md mx-2 md:mx-auto p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#00F0FF]" />
              {editingId ? 'Edit Automation' : 'New Automation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3 md:pt-4">
            <div>
              <label className="text-sm text-[#6B7280] mb-2 block">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Morning briefing, Deploy webhook..."
                className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
              />
            </div>
            <div>
              <label className="text-sm text-[#6B7280] mb-2 block">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this automation do?"
                className="bg-[#06060B] border-[#00F0FF]/30 text-[#E8E8F0]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#6B7280] mb-2 block">Trigger</label>
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm({ ...form, triggerType: e.target.value as AutomationTrigger })}
                  className="w-full p-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/30 text-[#E8E8F0]"
                >
                  <option value="time">Scheduled (Time)</option>
                  <option value="event">Event-based</option>
                  <option value="webhook">Webhook</option>
                  <option value="manual">Manual</option>
                  <option value="keyword">Keyword Match</option>
                  <option value="health_down">Health Check</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-[#6B7280] mb-2 block">Action</label>
                <select
                  value={form.actionType}
                  onChange={(e) => setForm({ ...form, actionType: e.target.value as AutomationAction })}
                  className="w-full p-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/30 text-[#E8E8F0]"
                >
                  <option value="telegram-message">Telegram Message</option>
                  <option value="n8n-webhook">n8n Webhook</option>
                  <option value="portfolio-update">Portfolio Update</option>
                  <option value="manychat-broadcast">ManyChat Broadcast</option>
                  <option value="call_api">API Call</option>
                  <option value="create_reminder">Create Reminder</option>
                  <option value="log">Log</option>
                </select>
              </div>
            </div>
            {saveError && (
              <p className="text-sm text-[#FF6161] mt-2">{saveError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setIsAddDialogOpen(false); resetForm(); }}
                className="flex-1 border-[#00F0FF]/30 min-h-[44px] press-scale"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.name}
                className="flex-1 bg-[#00F0FF] hover:bg-[#00D4B0] min-h-[44px] press-scale"
              >
                {editingId ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent Runs */}
      <div className="mt-6">
        <h2 className="text-lg font-bold text-[#E8E8F0] mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
          Recent Runs
        </h2>
        {logs.length === 0 ? (
          <Card className="border-[#00F0FF]/20">
            <CardContent className="py-10 text-center">
              <Clock className="w-10 h-10 text-[#00F0FF]/20 mx-auto mb-3" />
              <p className="text-[#6B7280]">No automation runs yet</p>
              <p className="text-sm text-[#6B7280]">Trigger an automation to see its history here</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#00F0FF]/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#00F0FF]/10 bg-[#06060B]">
                    <th className="text-left px-4 py-3 text-[#6B7280] font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-[#6B7280] font-medium">Output</th>
                    <th className="text-left px-4 py-3 text-[#6B7280] font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-[#6B7280] font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const rawLog = log as unknown as Record<string, unknown>;
                    const status = (rawLog.status as string) ?? log.status ?? 'unknown';
                    const output = (rawLog.output as string) ?? log.output ?? '';
                    const durationMs = (rawLog.duration_ms as number) ?? log.durationMs ?? 0;
                    const createdAt = (rawLog.created_at as string) ?? log.createdAt ?? '';
                    return (
                      <tr key={log.id} className="border-b border-[#00F0FF]/10 hover:bg-[#00F0FF]/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                            status === 'success'
                              ? 'bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20'
                              : 'bg-[#FF6161]/10 text-[#FF6161] border border-[#FF6161]/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status === 'success' ? 'bg-[#00FF88]' : 'bg-[#FF6161]'}`} />
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {(() => {
                            const httpCode = parseHttpStatus(output);
                            if (!httpCode) return <span className="text-[#6B7280] text-xs">—</span>;
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${getHttpStatusBg(httpCode)}`}>
                                {httpCode}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] max-w-[200px] truncate text-xs">
                          {output || '—'}
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] font-mono text-xs hidden md:table-cell">
                          {durationMs > 0 ? `${durationMs}ms` : '—'}
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] text-xs whitespace-nowrap">
                          {createdAt ? new Date(createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* 37.4: Dead-letter panel — only shown when there are failures */}
        {deadLetters.length > 0 && (
          <Card style={{ background: 'rgba(255,97,97,0.04)', border: '1px solid rgba(255,97,97,0.2)' }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-[#FF6161]" />
                <span className="text-sm font-semibold text-[#FF6161]">Failed Webhook Deliveries</span>
                <Badge style={{ background: 'rgba(255,97,97,0.15)', color: '#FF6161', border: '1px solid rgba(255,97,97,0.3)' }}>{deadLetters.length}</Badge>
              </div>
              <div className="space-y-2">
                {deadLetters.slice(0, 5).map((dl) => {
                  const auto = automations.find((a) => a.id === dl.automation_id);
                  return (
                    <div key={dl.id} className="flex flex-col gap-0.5 bg-[#0C0C18] rounded-lg px-3 py-2 border border-[#FF6161]/10">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#E8E8F0] truncate">{auto?.name ?? dl.automation_id.slice(0, 8)}</span>
                        <span className="text-xs text-[#6B7280] whitespace-nowrap">{new Date(dl.failed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <span className="text-xs text-[#FF6161] truncate">{dl.error}</span>
                      <span className="text-xs text-[#6B7280] truncate font-mono">{dl.url}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
