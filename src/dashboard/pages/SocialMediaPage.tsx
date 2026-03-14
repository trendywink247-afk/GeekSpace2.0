import { useState, useEffect } from 'react';
import {
  Share2, Plus, Trash2, CheckCircle, XCircle, Clock, Loader2,
  Instagram, Facebook, Webhook, Key, Send, Calendar,
  ToggleLeft, ToggleRight, Edit3, Eye, AlertCircle, Image, Film,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { socialMediaService } from '@/services/api';
import type { SocialAccount, ContentPlan, ContentPlanItem } from '@/services/api';

// ---- Status helpers ----

const statusColors: Record<string, string> = {
  active: '#00FF88',
  paused: '#FFB800',
  draft: '#6B7280',
  scheduled: '#00F0FF',
  posting: '#FFB800',
  posted: '#00FF88',
  failed: '#FF6161',
  completed: '#00FF88',
  cancelled: '#6B7280',
};

function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] || '#6B7280';
  return (
    <Badge variant="outline" className="text-xs border-current" style={{ color }}>
      {status}
    </Badge>
  );
}

function StatusIcon({ status }: { status: string }) {
  const color = statusColors[status] || '#6B7280';
  switch (status) {
    case 'posted':
    case 'completed':
    case 'active':
      return <CheckCircle className="w-4 h-4" style={{ color }} />;
    case 'failed':
      return <XCircle className="w-4 h-4" style={{ color }} />;
    case 'posting':
      return <Loader2 className="w-4 h-4 animate-spin" style={{ color }} />;
    case 'scheduled':
      return <Clock className="w-4 h-4" style={{ color }} />;
    default:
      return <AlertCircle className="w-4 h-4" style={{ color }} />;
  }
}

// ---- Accounts Tab ----

function AccountsTab() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Form state
  const [platform, setPlatform] = useState<string>('instagram');
  const [accountName, setAccountName] = useState('');
  const [postingMethod, setPostingMethod] = useState<string>('webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadAccounts = async () => {
    try {
      const res = await socialMediaService.getAccounts();
      setAccounts(res.data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await socialMediaService.createAccount({
        platform,
        account_name: accountName,
        posting_method: postingMethod,
        webhook_url: postingMethod === 'webhook' ? webhookUrl : undefined,
        page_id: postingMethod === 'api' ? pageId : undefined,
        access_token: postingMethod === 'api' ? accessToken : undefined,
      });
      setShowForm(false);
      setAccountName('');
      setWebhookUrl('');
      setPageId('');
      setAccessToken('');
      loadAccounts();
    } catch {
      setSaveError('Failed to save account. Please check your details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await socialMediaService.deleteAccount(id);
      loadAccounts();
    } catch (err) {
      console.error('Failed to delete account:', err);
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await socialMediaService.testAccount(id);
      setTestResult({ id, ...res.data });
    } catch {
      setTestResult({ id, success: false, message: 'Test request failed' });
    } finally {
      setTesting(null);
    }
  };

  const handleToggleStatus = async (account: SocialAccount) => {
    try {
      await socialMediaService.updateAccount(account.id, {
        status: account.status === 'active' ? 'paused' : 'active',
      });
      loadAccounts();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#00F0FF]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#9CA3AF]">Connect your social media accounts for automated posting.</p>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/20">
          <Plus className="w-4 h-4 mr-1" /> Add Account
        </Button>
      </div>

      {/* Add Account Form */}
      {showForm && (
        <Card className="bg-[#0C0C18] border-[#00F0FF]/20">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Platform</label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="bg-[#06060B] border-[#1a1a2e]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Account Name</label>
                <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="My Business Account" className="bg-[#06060B] border-[#1a1a2e]" />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Posting Method</label>
              <Select value={postingMethod} onValueChange={setPostingMethod}>
                <SelectTrigger className="bg-[#06060B] border-[#1a1a2e]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="api">Direct API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {postingMethod === 'webhook' && (
              <div>
                <label className="text-xs text-[#9CA3AF] mb-1 block">Webhook URL</label>
                <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-webhook.example.com/post" className="bg-[#06060B] border-[#1a1a2e]" />
              </div>
            )}

            {postingMethod === 'api' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Page ID</label>
                  <Input value={pageId} onChange={(e) => setPageId(e.target.value)} placeholder="Page/Account ID" className="bg-[#06060B] border-[#1a1a2e]" />
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Access Token</label>
                  <Input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Long-lived access token" className="bg-[#06060B] border-[#1a1a2e]" />
                </div>
              </div>
            )}

            {saveError && (
              <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{saveError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setSaveError(''); }}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={saving || !accountName}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Cards */}
      {accounts.length === 0 && !showForm && (
        <div className="text-center py-12 text-[#9CA3AF]">
          <Share2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No social accounts connected yet.</p>
        </div>
      )}

      <div className="grid gap-3">
        {accounts.map((account) => (
          <Card key={account.id} className="bg-[#0C0C18] border-[#1a1a2e] hover:border-[#00F0FF]/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {/* Platform icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: account.platform === 'instagram'
                      ? 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCAF45)'
                      : '#1877F2',
                  }}
                >
                  {account.platform === 'instagram' ? (
                    <Instagram className="w-5 h-5 text-white" />
                  ) : (
                    <Facebook className="w-5 h-5 text-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#E8E8F0] truncate">{account.account_name}</span>
                    <StatusBadge status={account.status} />
                    <Badge variant="outline" className="text-xs text-[#9CA3AF] border-[#1a1a2e]">
                      {account.posting_method === 'webhook' ? <Webhook className="w-3 h-3 mr-1" /> : <Key className="w-3 h-3 mr-1" />}
                      {account.posting_method}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#9CA3AF]">
                    <span>{account.posts_count} posts</span>
                    {account.last_post_at && (
                      <span>Last: {new Date(account.last_post_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handleToggleStatus(account)} aria-label={account.status === 'active' ? 'Pause ' + account.account_name : 'Activate ' + account.account_name}>
                    {account.status === 'active' ? <ToggleRight className="w-4 h-4 text-[#00FF88]" /> : <ToggleLeft className="w-4 h-4 text-[#9CA3AF]" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handleTest(account.id)} disabled={testing === account.id} aria-label={'Test ' + account.account_name}>
                    {testing === account.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-[#00F0FF]" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handleDelete(account.id)} aria-label={'Delete ' + account.account_name}>
                    <Trash2 className="w-4 h-4 text-[#FF6161]" />
                  </Button>
                </div>
              </div>

              {/* Test result */}
              {testResult && testResult.id === account.id && (
                <div className={`mt-2 p-2 rounded-lg text-xs ${testResult.success ? 'bg-[#00FF88]/10 text-[#00FF88]' : 'bg-[#FF6161]/10 text-[#FF6161]'}`}>
                  {testResult.success ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <XCircle className="w-3 h-3 inline mr-1" />}
                  {testResult.message}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---- Content Plan Tab ----

function ContentPlanTab() {
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [activePlan, setActivePlan] = useState<ContentPlan | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Generate form
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('');

  // Activate form
  const [showActivate, setShowActivate] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [activating, setActivating] = useState(false);

  // Editing state
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editMediaId, setEditMediaId] = useState('');

  // Posting
  const [postingItem, setPostingItem] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [plansRes, accountsRes] = await Promise.all([
        socialMediaService.getPlans(),
        socialMediaService.getAccounts(),
      ]);
      setPlans(plansRes.data);
      setAccounts(accountsRes.data);

      // Load first plan details if exists
      if (plansRes.data.length > 0) {
        const planRes = await socialMediaService.getPlan(plansRes.data[0].id);
        setActivePlan(planRes.data);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await socialMediaService.generatePlan(topic, niche);
      setActivePlan(res.data);
      setTopic('');
      setNiche('');
      loadData();
    } catch (err) {
      console.error('Failed to generate plan:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleActivate = async () => {
    if (!activePlan || !startDate || !selectedAccountId) return;
    setActivating(true);
    try {
      const res = await socialMediaService.activatePlan(activePlan.id, {
        start_date: startDate,
        social_account_id: selectedAccountId,
      });
      setActivePlan(res.data);
      setShowActivate(false);
      loadData();
    } catch (err) {
      console.error('Failed to activate plan:', err);
    } finally {
      setActivating(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!activePlan) return;
    try {
      await socialMediaService.deletePlan(activePlan.id);
      setActivePlan(null);
      loadData();
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  const handleSaveItem = async (item: ContentPlanItem) => {
    try {
      await socialMediaService.updatePlanItem(item.plan_id, item.id, {
        caption: editCaption,
        media_id: editMediaId || undefined,
      });
      setEditingItem(null);
      // Reload plan
      if (activePlan) {
        const res = await socialMediaService.getPlan(activePlan.id);
        setActivePlan(res.data);
      }
    } catch (err) {
      console.error('Failed to update item:', err);
    }
  };

  const handleToggleItem = async (item: ContentPlanItem) => {
    try {
      await socialMediaService.updatePlanItem(item.plan_id, item.id, {
        enabled: !item.enabled,
      });
      if (activePlan) {
        const res = await socialMediaService.getPlan(activePlan.id);
        setActivePlan(res.data);
      }
    } catch (err) {
      console.error('Failed to toggle item:', err);
    }
  };

  const handlePostNow = async (item: ContentPlanItem) => {
    setPostingItem(item.id);
    try {
      await socialMediaService.postItem(item.plan_id, item.id);
      if (activePlan) {
        const res = await socialMediaService.getPlan(activePlan.id);
        setActivePlan(res.data);
      }
    } catch (err) {
      console.error('Manual post failed:', err);
    } finally {
      setPostingItem(null);
    }
  };

  const selectPlan = async (plan: ContentPlan) => {
    try {
      const res = await socialMediaService.getPlan(plan.id);
      setActivePlan(res.data);
    } catch (err) {
      console.error('Failed to load plan:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#00F0FF]" />
      </div>
    );
  }

  // No plan view — show generator
  if (!activePlan) {
    return (
      <div className="space-y-4">
        <Card className="bg-[#0C0C18] border-[#00F0FF]/20">
          <CardHeader>
            <CardTitle className="text-sm text-[#E8E8F0]">Generate 10-Day Content Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Topic</label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., AI tools for developers" className="bg-[#06060B] border-[#1a1a2e]" />
            </div>
            <div>
              <label className="text-xs text-[#9CA3AF] mb-1 block">Niche</label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g., Tech startups" className="bg-[#06060B] border-[#1a1a2e]" />
            </div>
            <Button onClick={handleGenerate} disabled={generating || !topic || !niche} className="w-full bg-gradient-to-r from-[#00F0FF]/20 to-[#FF2D78]/20 border border-[#00F0FF]/20 hover:border-[#00F0FF]/40">
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
              ) : (
                <><Share2 className="w-4 h-4 mr-2" /> Generate Plan</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Existing plans */}
        {plans.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-[#E8E8F0] mb-2">Existing Plans</h3>
            <div className="grid gap-2">
              {plans.map((plan) => (
                <button key={plan.id} onClick={() => selectPlan(plan)} className="w-full text-left p-3 rounded-xl bg-[#0C0C18] border border-[#1a1a2e] hover:border-[#00F0FF]/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[#E8E8F0]">{plan.title}</span>
                    <StatusBadge status={plan.status} />
                  </div>
                  <span className="text-xs text-[#9CA3AF]">{new Date(plan.created_at).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Plan detail view
  const items = activePlan.items || [];
  const dayGroups = new Map<number, ContentPlanItem[]>();
  for (const item of items) {
    const existing = dayGroups.get(item.day_number) || [];
    existing.push(item);
    dayGroups.set(item.day_number, existing);
  }

  return (
    <div className="space-y-4">
      {/* Plan header */}
      <Card className="bg-[#0C0C18] border-[#00F0FF]/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-medium text-[#E8E8F0]">{activePlan.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={activePlan.status} />
                <span className="text-xs text-[#9CA3AF]">{items.length} items</span>
                {activePlan.start_date && (
                  <span className="text-xs text-[#9CA3AF]">Starts: {new Date(activePlan.start_date).toLocaleDateString()}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {activePlan.status === 'draft' && (
                <Button size="sm" onClick={() => setShowActivate(!showActivate)} className="bg-[#00FF88]/10 text-[#00FF88] hover:bg-[#00FF88]/20 border border-[#00FF88]/20">
                  <Calendar className="w-4 h-4 mr-1" /> Activate
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setActivePlan(null); loadData(); }}>
                Back
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDeletePlan} className="text-[#FF6161] min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" aria-label="Delete plan">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Activate form */}
          {showActivate && (
            <div className="mt-3 p-3 rounded-lg bg-[#06060B] border border-[#1a1a2e] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Start Date</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-[#0C0C18] border-[#1a1a2e]" />
                </div>
                <div>
                  <label className="text-xs text-[#9CA3AF] mb-1 block">Social Account</label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className="bg-[#0C0C18] border-[#1a1a2e]"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.account_name} ({a.platform})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={handleActivate} disabled={activating || !startDate || !selectedAccountId}>
                {activating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                Activate Schedule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day cards */}
      {Array.from(dayGroups.entries()).sort(([a], [b]) => a - b).map(([dayNum, dayItems]) => (
        <Card key={dayNum} className="bg-[#0C0C18] border-[#1a1a2e]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#00F0FF]">Day {dayNum}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dayItems.map((item) => (
              <div key={item.id} className={`p-3 rounded-lg border transition-colors ${item.enabled ? 'bg-[#06060B] border-[#1a1a2e]' : 'bg-[#06060B]/50 border-[#1a1a2e]/50 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#9CA3AF]">Slot {item.slot}</span>
                    <StatusIcon status={item.status} />
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={!!item.enabled} onCheckedChange={() => handleToggleItem(item)} />
                    {editingItem === item.id ? (
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handleSaveItem(item)} aria-label="Save changes">
                        <CheckCircle className="w-4 h-4 text-[#00FF88]" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => { setEditingItem(item.id); setEditCaption(item.caption); setEditMediaId(item.media_id); }} aria-label="Edit item">
                        <Edit3 className="w-4 h-4 text-[#9CA3AF]" />
                      </Button>
                    )}
                    {item.enabled && activePlan.status === 'active' && item.status !== 'posted' && (
                      <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50" onClick={() => handlePostNow(item)} disabled={postingItem === item.id} aria-label="Post now">
                        {postingItem === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-[#00F0FF]" />}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Caption */}
                {editingItem === item.id ? (
                  <div className="space-y-2">
                    <Textarea value={editCaption} onChange={(e) => setEditCaption(e.target.value)} className="bg-[#0C0C18] border-[#1a1a2e] text-sm min-h-[80px]" maxLength={2200} />
                    <div className="flex items-center gap-2">
                      <Input value={editMediaId} onChange={(e) => setEditMediaId(e.target.value)} placeholder="Media ID (img-xxx or vid-xxx)" className="bg-[#0C0C18] border-[#1a1a2e] text-xs flex-1" />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#E8E8F0] whitespace-pre-wrap">{item.caption}</p>
                )}

                {/* Media preview */}
                {item.media_id && editingItem !== item.id && (
                  <div className="mt-2 flex items-center gap-2">
                    {item.media_type === 'image' ? <Image className="w-4 h-4 text-[#00F0FF]" /> : item.media_type === 'video' ? <Film className="w-4 h-4 text-[#FFB800]" /> : null}
                    <span className="text-xs text-[#9CA3AF] font-mono">{item.media_id}</span>
                    {item.media_url && (
                      <a href={item.media_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00F0FF] hover:underline">
                        <Eye className="w-3 h-3 inline mr-1" />preview
                      </a>
                    )}
                  </div>
                )}

                {/* Scheduled time */}
                {item.scheduled_at && (
                  <div className="mt-1 text-xs text-[#9CA3AF]">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(item.scheduled_at).toLocaleString()}
                  </div>
                )}

                {/* Error message */}
                {item.error_message && (
                  <div className="mt-1 text-xs text-[#FF6161]">
                    <XCircle className="w-3 h-3 inline mr-1" />{item.error_message}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Posts Tab ----

function PostsTab() {
  const [allItems, setAllItems] = useState<ContentPlanItem[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await socialMediaService.getPlans();

        // Load all plan items in parallel
        const planResponses = await Promise.all(res.data.map(plan => socialMediaService.getPlan(plan.id)));
        const items: ContentPlanItem[] = planResponses.flatMap(planRes => planRes.data.items?.filter(i => i.status !== 'draft') ?? []);
        setAllItems(items.sort((a, b) => {
          const aTime = a.scheduled_at || a.created_at;
          const bTime = b.scheduled_at || b.created_at;
          return bTime.localeCompare(aTime);
        }));
      } catch (err) {
        console.error('Failed to load posts:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#00F0FF]" />
      </div>
    );
  }

  const filtered = filter === 'all' ? allItems : allItems.filter(i => i.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'scheduled', 'posted', 'failed'].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'ghost'} onClick={() => setFilter(f)} className={filter === f ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'text-[#9CA3AF]'}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1 text-xs opacity-60">({allItems.filter(i => f === 'all' || i.status === f).length})</span>
            )}
          </Button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[#9CA3AF]">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No posts to show.</p>
        </div>
      )}

      <div className="grid gap-2">
        {filtered.map((item) => (
          <Card key={item.id} className="bg-[#0C0C18] border-[#1a1a2e]">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <StatusIcon status={item.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-[#9CA3AF]">Day {item.day_number}</span>
                    <StatusBadge status={item.status} />
                    {item.media_type && (
                      <Badge variant="outline" className="text-xs text-[#9CA3AF] border-[#1a1a2e]">
                        {item.media_type === 'image' ? <Image className="w-3 h-3 mr-1" /> : <Film className="w-3 h-3 mr-1" />}
                        {item.media_type}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-[#E8E8F0] mt-1 line-clamp-2">{item.caption}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[#9CA3AF]">
                    {item.scheduled_at && <span><Clock className="w-3 h-3 inline mr-1" />{new Date(item.scheduled_at).toLocaleString()}</span>}
                    {item.posted_at && <span><CheckCircle className="w-3 h-3 inline mr-1" />Posted {new Date(item.posted_at).toLocaleString()}</span>}
                  </div>
                  {item.error_message && (
                    <p className="text-xs text-[#FF6161] mt-1"><XCircle className="w-3 h-3 inline mr-1" />{item.error_message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---- Main Page ----

export function SocialMediaPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF2D78]/20 to-[#00F0FF]/20 border border-[#FF2D78]/20 flex items-center justify-center">
          <Share2 className="w-5 h-5 text-[#FF2D78]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#E8E8F0]">Social Media Handler</h1>
          <p className="text-sm text-[#9CA3AF]">Connect accounts, generate content plans, and auto-post on schedule.</p>
        </div>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <TabsList className="bg-[#0C0C18] border border-[#1a1a2e]">
          <TabsTrigger value="accounts" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF]">Accounts</TabsTrigger>
          <TabsTrigger value="plan" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF]">Content Plan</TabsTrigger>
          <TabsTrigger value="posts" className="data-[state=active]:bg-[#00F0FF]/10 data-[state=active]:text-[#00F0FF]">Posts</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <AccountsTab />
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <ContentPlanTab />
        </TabsContent>

        <TabsContent value="posts" className="mt-4">
          <PostsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
