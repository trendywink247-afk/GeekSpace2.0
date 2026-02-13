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
};

const triggerLabels: Record<AutomationTrigger, string> = {
  time: 'Scheduled',
  event: 'Event-based',
  webhook: 'Webhook',
};

const triggerColors: Record<AutomationTrigger, string> = {
  time: '#FFD761',
  event: '#61FF7B',
  webhook: '#7B61FF',
};

const actionIcons: Record<AutomationAction, typeof Send> = {
  'n8n-webhook': Globe,
  'telegram-message': Send,
  'portfolio-update': RefreshCw,
  'manychat-broadcast': MessageSquare,
};

const actionLabels: Record<AutomationAction, string> = {
  'n8n-webhook': 'n8n Webhook',
  'telegram-message': 'Telegram Message',
  'portfolio-update': 'Portfolio Update',
  'manychat-broadcast': 'ManyChat Broadcast',
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

  const resetForm = () => {
    setForm({ name: '', description: '', triggerType: 'time', actionType: 'telegram-message', enabled: true });
    setEditingId(null);
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Automations
          </h1>
          <p className="text-[#A7ACB8]">
            <span className="text-[#7B61FF] font-medium">{enabledCount}</span> active of {automations.length} total
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
          <Plus className="w-4 h-4 mr-2" />New Automation
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#7B61FF]/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#7B61FF]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F4F6FF]">{automations.length}</div>
                <div className="text-xs text-[#A7ACB8]">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#61FF7B]/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-[#61FF7B]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F4F6FF]">{enabledCount}</div>
                <div className="text-xs text-[#A7ACB8]">Active</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFD761]/10 flex items-center justify-center">
                <Play className="w-5 h-5 text-[#FFD761]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F4F6FF]">{totalRuns}</div>
                <div className="text-xs text-[#A7ACB8]">Total Runs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF61DC]/10 flex items-center justify-center">
                <Webhook className="w-5 h-5 text-[#FF61DC]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F4F6FF]">
                  {automations.filter((a) => a.triggerType === 'webhook').length}
                </div>
                <div className="text-xs text-[#A7ACB8]">Webhooks</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A7ACB8]" />
          <Input
            placeholder="Search automations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF]"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="bg-[#0B0B10] border border-[#7B61FF]/20">
            <TabsTrigger value="all" className="data-[state=active]:bg-[#7B61FF]">All</TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-[#7B61FF]">Active</TabsTrigger>
            <TabsTrigger value="inactive" className="data-[state=active]:bg-[#7B61FF]">Inactive</TabsTrigger>
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
                className={`bg-[#0B0B10] border-[#7B61FF]/20 transition-all duration-300 hover:border-[#7B61FF]/40 ${
                  !auto.enabled ? 'opacity-60' : ''
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(auto.id, auto.enabled)}
                      className="flex-shrink-0 mt-1"
                    >
                      {auto.enabled ? (
                        <ToggleRight className="w-8 h-5 text-[#61FF7B]" />
                      ) : (
                        <ToggleLeft className="w-8 h-5 text-[#A7ACB8]" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#F4F6FF]">{auto.name}</h3>
                        {auto.enabled && (
                          <div className="w-2 h-2 rounded-full bg-[#61FF7B] animate-pulse" />
                        )}
                      </div>
                      <p className="text-sm text-[#A7ACB8] mb-3">{auto.description}</p>

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
                        <span className="text-[#A7ACB8]">&rarr;</span>

                        {/* Action badge */}
                        <Badge variant="outline" className="border-[#7B61FF]/30 text-[#A7ACB8]">
                          <ActionIcon className="w-3 h-3 mr-1" />
                          {actionLabels[auto.actionType]}
                        </Badge>

                        {/* Run count */}
                        <Badge variant="outline" className="border-[#7B61FF]/20 text-[#A7ACB8]">
                          <Play className="w-3 h-3 mr-1" />
                          {auto.runCount} runs
                        </Badge>

                        {/* Last run */}
                        <span className="text-xs text-[#A7ACB8]">
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
                        className="text-[#61FF7B] hover:text-[#61FF7B] hover:bg-[#61FF7B]/10 h-8 w-8 p-0"
                        title="Run now"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(auto.id)}
                        className="text-[#7B61FF] hover:text-[#7B61FF] hover:bg-[#7B61FF]/10 h-8 w-8 p-0"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(auto.id)}
                        className="text-[#A7ACB8] hover:text-[#FF6161] hover:bg-[#FF6161]/10 h-8 w-8 p-0"
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
            <Zap className="w-12 h-12 text-[#7B61FF]/30 mx-auto mb-4" />
            <p className="text-[#A7ACB8] mb-4">
              {searchQuery || filter !== 'all' ? 'No automations match your filters' : 'No automations yet'}
            </p>
            {!searchQuery && filter === 'all' && (
              <Button onClick={handleOpenAdd} variant="outline" className="border-[#7B61FF]/30 hover:bg-[#7B61FF]/10">
                Create your first automation
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-[#0B0B10] border border-[#7B61FF]/30 text-[#F4F6FF] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#7B61FF]" />
              {editingId ? 'Edit Automation' : 'New Automation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm text-[#A7ACB8] mb-2 block">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Morning briefing, Deploy webhook..."
                className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
              />
            </div>
            <div>
              <label className="text-sm text-[#A7ACB8] mb-2 block">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this automation do?"
                className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Trigger</label>
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm({ ...form, triggerType: e.target.value as AutomationTrigger })}
                  className="w-full p-2 rounded-lg bg-[#05050A] border border-[#7B61FF]/30 text-[#F4F6FF]"
                >
                  <option value="time">Scheduled (Time)</option>
                  <option value="event">Event-based</option>
                  <option value="webhook">Webhook</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-[#A7ACB8] mb-2 block">Action</label>
                <select
                  value={form.actionType}
                  onChange={(e) => setForm({ ...form, actionType: e.target.value as AutomationAction })}
                  className="w-full p-2 rounded-lg bg-[#05050A] border border-[#7B61FF]/30 text-[#F4F6FF]"
                >
                  <option value="telegram-message">Telegram Message</option>
                  <option value="n8n-webhook">n8n Webhook</option>
                  <option value="portfolio-update">Portfolio Update</option>
                  <option value="manychat-broadcast">ManyChat Broadcast</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setIsAddDialogOpen(false); resetForm(); }}
                className="flex-1 border-[#7B61FF]/30"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!form.name}
                className="flex-1 bg-[#7B61FF] hover:bg-[#6B51EF]"
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
