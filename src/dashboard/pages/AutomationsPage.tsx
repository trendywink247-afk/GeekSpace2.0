import { useState } from 'react';
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
import type { AutomationTrigger, AutomationAction } from '@/types';

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
  webhook: '#00FFD4',
  manual: '#6B7280',
  keyword: '#FF0080',
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

  const resetForm = () => {
    setForm({ name: '', description: '', triggerType: 'time', actionType: 'telegram-message', enabled: true });
    setEditingId(null);
    setSaveError('');
  };

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

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 px-1 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Automations
          </h1>
          <p className="text-sm md:text-base text-[#6B7280]">
            <span className="text-[#00FFD4] font-medium">{enabledCount}</span> active of {automations.length} total
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-[#00FFD4] hover:bg-[#00D4B0] press-scale min-h-[44px]">
          <Plus className="w-4 h-4 mr-2" />New Automation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00FFD4]/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#00FFD4]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#E8E8F0]">{automations.length}</div>
                <div className="text-xs text-[#6B7280]">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
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
        <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
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
        <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF0080]/10 flex items-center justify-center">
                <Webhook className="w-5 h-5 text-[#FF0080]" />
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
            className="pl-10 bg-[#0A0A0F] border-[#00FFD4]/30 text-[#E8E8F0] min-h-[44px]"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="bg-[#0A0A0F] border border-[#00FFD4]/20 overflow-x-auto flex-nowrap w-auto">
            <TabsTrigger value="all" className="data-[state=active]:bg-[#00FFD4] min-h-[44px] flex-none">All</TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-[#00FFD4] min-h-[44px] flex-none">Active</TabsTrigger>
            <TabsTrigger value="inactive" className="data-[state=active]:bg-[#00FFD4] min-h-[44px] flex-none">Inactive</TabsTrigger>
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
                className={`bg-[#0A0A0F] border-[#00FFD4]/20 transition-all duration-300 hover:border-[#00FFD4]/40 press-scale ${
                  !auto.enabled ? 'opacity-60' : ''
                }`}
              >
                <CardContent className="p-3 md:p-5">
                  <div className="flex items-start gap-3 md:gap-4">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(auto.id, auto.enabled)}
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
                      <p className="text-sm text-[#6B7280] mb-3">{auto.description}</p>

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
                        <Badge variant="outline" className="border-[#00FFD4]/30 text-[#6B7280]">
                          <ActionIcon className="w-3 h-3 mr-1" />
                          {actionLabels[auto.actionType]}
                        </Badge>

                        {/* Run count */}
                        <Badge variant="outline" className="border-[#00FFD4]/20 text-[#6B7280]">
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
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTrigger(auto.id)}
                        disabled={!auto.enabled || isLoading}
                        className="text-[#00FF88] hover:text-[#00FF88] hover:bg-[#00FF88]/10 h-10 w-10 md:h-8 md:w-8 p-0 press-scale"
                        title="Run now"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(auto.id)}
                        className="text-[#00FFD4] hover:text-[#00FFD4] hover:bg-[#00FFD4]/10 h-10 w-10 md:h-8 md:w-8 p-0 press-scale"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(auto.id)}
                        className="text-[#6B7280] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-10 w-10 md:h-8 md:w-8 p-0 press-scale"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-[#00FFD4]/30 mx-auto mb-4" />
            <p className="text-[#6B7280] mb-4">
              {searchQuery || filter !== 'all' ? 'No automations match your filters' : 'No automations yet'}
            </p>
            {!searchQuery && filter === 'all' && (
              <Button onClick={handleOpenAdd} variant="outline" className="border-[#00FFD4]/30 hover:bg-[#00FFD4]/10">
                Create your first automation
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-[#0A0A0F] border border-[#00FFD4]/30 text-[#E8E8F0] max-w-md mx-2 md:mx-auto p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#00FFD4]" />
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
                className="bg-[#030304] border-[#00FFD4]/30 text-[#E8E8F0]"
              />
            </div>
            <div>
              <label className="text-sm text-[#6B7280] mb-2 block">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this automation do?"
                className="bg-[#030304] border-[#00FFD4]/30 text-[#E8E8F0]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#6B7280] mb-2 block">Trigger</label>
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm({ ...form, triggerType: e.target.value as AutomationTrigger })}
                  className="w-full p-2 rounded-lg bg-[#030304] border border-[#00FFD4]/30 text-[#E8E8F0]"
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
                  className="w-full p-2 rounded-lg bg-[#030304] border border-[#00FFD4]/30 text-[#E8E8F0]"
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
                className="flex-1 border-[#00FFD4]/30 min-h-[44px] press-scale"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.name}
                className="flex-1 bg-[#00FFD4] hover:bg-[#00D4B0] min-h-[44px] press-scale"
              >
                {editingId ? 'Save Changes' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
