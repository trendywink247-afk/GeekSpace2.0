import { useState, useEffect } from 'react';
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Mail,
  Smartphone,
  Key,
  Save,
  Check,
  AlertTriangle,
  Upload,
  Eye,
  Palette,
  Plus,
  Trash2,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useThemeStore } from '@/stores/themeStore';
import { userService, apiKeyService } from '@/services/api';
import type { ApiProvider } from '@/types';

export function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const user = useAuthStore((s) => s.user);
  const usage = useDashboardStore((s) => s.usage);
  const { accentColor, accentPresets, setAccentColor } = useThemeStore();

  const [profile, setProfile] = useState({
    name: user?.name || 'Alex Chen',
    username: user?.username || 'alex',
    email: user?.email || 'alex@example.com',
    bio: user?.bio || 'Full-stack developer and AI enthusiast.',
    location: user?.location || 'San Francisco, CA',
    website: user?.website || 'alexchen.dev',
  });

  const [notifications, setNotifications] = useState({
    emailReminders: true,
    pushNotifications: true,
    weeklyDigest: true,
    marketingEmails: false,
    securityAlerts: true,
  });

  const [privacy, setPrivacy] = useState({
    showInDirectory: true,
    showAvatar: true,
    showLocation: true,
    showProjects: true,
    showActivity: true,
  });

  const [apiKeys, setApiKeys] = useState<{ id: string; provider: ApiProvider; label: string; maskedKey: string }[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState<ApiProvider>('openai');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showAddKey, setShowAddKey] = useState(false);

  // Load API keys from backend on mount
  useEffect(() => {
    apiKeyService.list().then(({ data }) => {
      setApiKeys(data.map(k => ({ id: k.id, provider: k.provider, label: k.label, maskedKey: k.maskedKey })));
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await userService.updateProfile(profile);
    } catch {
      // keep local state on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddKey = async () => {
    if (!newKeyValue) return;
    try {
      const { data } = await apiKeyService.create({
        provider: newKeyProvider,
        label: newKeyProvider.charAt(0).toUpperCase() + newKeyProvider.slice(1),
        key: newKeyValue,
      });
      setApiKeys([...apiKeys, { id: data.id, provider: data.provider, label: data.label, maskedKey: data.maskedKey }]);
    } catch {
      // Fallback: add locally
      const masked = newKeyValue.slice(0, 3) + '...' + newKeyValue.slice(-4);
      setApiKeys([...apiKeys, {
        id: Date.now().toString(),
        provider: newKeyProvider,
        label: newKeyProvider.charAt(0).toUpperCase() + newKeyProvider.slice(1),
        maskedKey: masked,
      }]);
    }
    setNewKeyValue('');
    setShowAddKey(false);
  };

  const providerColors: Record<string, string> = {
    openai: '#10a37f',
    anthropic: '#d4a574',
    qwen: '#6366f1',
    openrouter: '#ef4444',
    custom: '#7B61FF',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Settings
          </h1>
          <p className="text-[#A7ACB8]">Manage your account preferences</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
          {isSaving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Saving...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Save Changes</>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#0B0B10] border border-[#7B61FF]/20 p-1 flex-wrap">
          <TabsTrigger value="profile" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <User className="w-4 h-4 mr-2" />Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <Bell className="w-4 h-4 mr-2" />Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <Shield className="w-4 h-4 mr-2" />Security
          </TabsTrigger>
          <TabsTrigger value="apikeys" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <Key className="w-4 h-4 mr-2" />API Keys
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 mr-2" />Billing
          </TabsTrigger>
          <TabsTrigger value="privacy" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <Eye className="w-4 h-4 mr-2" />Privacy
          </TabsTrigger>
          <TabsTrigger value="theme" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <Palette className="w-4 h-4 mr-2" />Theme
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
              <CardContent className="p-6 text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center text-3xl font-bold">
                    {profile.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#7B61FF] flex items-center justify-center hover:bg-[#6B51EF] transition-colors">
                    <Upload className="w-4 h-4 text-white" />
                  </button>
                </div>
                <h3 className="font-semibold text-[#F4F6FF]">{profile.name}</h3>
                <p className="text-sm text-[#A7ACB8]">@{profile.username}</p>
                <Badge variant="outline" className="mt-3 border-[#61FF7B]/30 text-[#61FF7B]">Pro Plan</Badge>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 bg-[#0B0B10] border-[#7B61FF]/20">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription className="text-[#A7ACB8]">Update your public profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#A7ACB8] mb-2 block">Display Name</label>
                    <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]" />
                  </div>
                  <div>
                    <label className="text-sm text-[#A7ACB8] mb-2 block">Username</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A7ACB8]">@</span>
                      <Input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF] pl-8" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#A7ACB8] mb-2 block">Email</label>
                  <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]" />
                </div>
                <div>
                  <label className="text-sm text-[#A7ACB8] mb-2 block">Bio</label>
                  <textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} className="w-full p-3 rounded-xl bg-[#05050A] border border-[#7B61FF]/30 text-[#F4F6FF] min-h-[100px] resize-none focus:outline-none focus:border-[#7B61FF]" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#A7ACB8] mb-2 block">Location</label>
                    <Input value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]" />
                  </div>
                  <div>
                    <label className="text-sm text-[#A7ACB8] mb-2 block">Website</label>
                    <Input value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} className="bg-[#05050A] border-[#7B61FF]/30 text-[#F4F6FF]" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription className="text-[#A7ACB8]">Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { key: 'emailReminders', icon: Mail, title: 'Email Reminders', desc: 'Get reminders via email' },
                { key: 'pushNotifications', icon: Smartphone, title: 'Push Notifications', desc: 'Browser push notifications' },
                { key: 'weeklyDigest', icon: Globe, title: 'Weekly Digest', desc: 'Weekly summary of activity' },
                { key: 'securityAlerts', icon: Shield, title: 'Security Alerts', desc: 'Important security notifications' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#7B61FF]/10 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-[#7B61FF]" />
                    </div>
                    <div>
                      <div className="font-medium text-[#F4F6FF]">{item.title}</div>
                      <div className="text-sm text-[#A7ACB8]">{item.desc}</div>
                    </div>
                  </div>
                  <Switch checked={notifications[item.key as keyof typeof notifications]} onCheckedChange={(checked) => setNotifications({ ...notifications, [item.key]: checked })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription className="text-[#A7ACB8]">Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-[#61FF7B]/10 border border-[#61FF7B]/30 flex items-center gap-3">
                <Check className="w-5 h-5 text-[#61FF7B]" />
                <div>
                  <div className="font-medium text-[#F4F6FF]">Two-Factor Authentication</div>
                  <div className="text-sm text-[#A7ACB8]">Enabled via authenticator app</div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#05050A] border border-[#7B61FF]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-[#FFD761]" />
                    <div>
                      <div className="font-medium text-[#F4F6FF]">Active Sessions</div>
                      <div className="text-sm text-[#A7ACB8]">2 active sessions</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="border-[#7B61FF]/30">View All</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="apikeys" className="space-y-6">
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription className="text-[#A7ACB8]">Manage provider keys for &quot;Bring Your Own&quot; mode</CardDescription>
                </div>
                <Button onClick={() => setShowAddKey(true)} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
                  <Plus className="w-4 h-4 mr-2" />Add Key
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKeys.length === 0 && !showAddKey && (
                <div className="text-center py-8">
                  <Key className="w-10 h-10 text-[#7B61FF]/30 mx-auto mb-3" />
                  <p className="text-[#A7ACB8] mb-2">No API keys added yet</p>
                  <p className="text-sm text-[#A7ACB8]">Add your provider keys to use your own credits</p>
                </div>
              )}

              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-4 rounded-xl bg-[#05050A] border border-[#7B61FF]/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${providerColors[key.provider]}20` }}>
                      <Key className="w-5 h-5" style={{ color: providerColors[key.provider] }} />
                    </div>
                    <div>
                      <div className="font-medium text-[#F4F6FF]">{key.label}</div>
                      <div className="text-sm text-[#A7ACB8] font-mono">{key.maskedKey}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setApiKeys(apiKeys.filter(k => k.id !== key.id))} className="text-[#FF6161] hover:text-[#FF6161]">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {showAddKey && (
                <div className="p-4 rounded-xl bg-[#05050A] border border-[#7B61FF]/30 space-y-3">
                  <div>
                    <label className="text-sm text-[#A7ACB8] mb-2 block">Provider</label>
                    <div className="flex gap-2">
                      {(['openai', 'anthropic', 'qwen', 'openrouter'] as ApiProvider[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => setNewKeyProvider(p)}
                          className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-all ${
                            newKeyProvider === p
                              ? 'bg-[#7B61FF]/20 border border-[#7B61FF] text-[#7B61FF]'
                              : 'bg-[#0B0B10] border border-[#7B61FF]/20 text-[#A7ACB8]'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-[#A7ACB8] mb-2 block">API Key</label>
                    <Input
                      type="password"
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      placeholder="sk-..."
                      className="bg-[#0B0B10] border-[#7B61FF]/30 text-[#F4F6FF] font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setShowAddKey(false); setNewKeyValue(''); }} className="border-[#7B61FF]/30">
                      Cancel
                    </Button>
                    <Button onClick={handleAddKey} disabled={!newKeyValue} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
                      Save Key
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-6 rounded-xl bg-gradient-to-br from-[#7B61FF]/20 to-[#0B0B10] border border-[#7B61FF]/30 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#F4F6FF]">Pro Plan</h3>
                    <p className="text-sm text-[#A7ACB8]">$50/year billed annually</p>
                  </div>
                  <Badge className="bg-[#7B61FF]">Active</Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-[#05050A]">
                    <div className="text-2xl font-bold text-[#F4F6FF]">12,450</div>
                    <div className="text-xs text-[#A7ACB8]">Credits</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#05050A]">
                    <div className="text-2xl font-bold text-[#F4F6FF]">15K</div>
                    <div className="text-xs text-[#A7ACB8]">Monthly</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#05050A]">
                    <div className="text-2xl font-bold text-[#F4F6FF]">Mar 1</div>
                    <div className="text-xs text-[#A7ACB8]">Resets</div>
                  </div>
                </div>
              </div>

              {/* Spend Breakdown */}
              <h3 className="font-semibold text-[#F4F6FF] mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#7B61FF]" />
                Usage This Month
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#05050A]">
                  <span className="text-sm text-[#A7ACB8]">Total Spend</span>
                  <span className="font-mono font-bold text-[#F4F6FF]">${usage.totalCostUSD.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#05050A]">
                  <span className="text-sm text-[#A7ACB8]">Forecast</span>
                  <span className="font-mono text-[#FFD761]">${usage.forecastUSD.toFixed(2)}</span>
                </div>
                <Separator className="bg-[#7B61FF]/20" />
                <div className="text-sm text-[#A7ACB8] mb-2">By Provider</div>
                {Object.entries(usage.byProvider).map(([provider, cost]) => (
                  <div key={provider} className="flex items-center justify-between p-2 rounded-lg">
                    <span className="text-sm text-[#F4F6FF] capitalize">{provider}</span>
                    <span className="font-mono text-sm text-[#A7ACB8]">${cost.toFixed(2)}</span>
                  </div>
                ))}
                <Separator className="bg-[#7B61FF]/20" />
                <div className="text-sm text-[#A7ACB8] mb-2">Top Tools by Cost</div>
                {Object.entries(usage.byTool).sort(([,a], [,b]) => b - a).slice(0, 5).map(([tool, cost]) => (
                  <div key={tool} className="flex items-center justify-between p-2 rounded-lg">
                    <span className="text-sm text-[#F4F6FF] font-mono">{tool}</span>
                    <span className="font-mono text-sm text-[#A7ACB8]">${cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader>
              <CardTitle>Privacy Controls</CardTitle>
              <CardDescription className="text-[#A7ACB8]">Control what is visible on your public portfolio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { key: 'showInDirectory', title: 'Show in Public Directory', desc: 'Allow others to discover you via Explore' },
                { key: 'showAvatar', title: 'Show Avatar', desc: 'Display your profile picture publicly' },
                { key: 'showLocation', title: 'Show Location', desc: 'Display city/timezone on profile' },
                { key: 'showProjects', title: 'Show Projects', desc: 'Display portfolio projects publicly' },
                { key: 'showActivity', title: 'Show Recent Activity', desc: 'Show milestones and activity on portfolio' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[#F4F6FF]">{item.title}</div>
                    <div className="text-sm text-[#A7ACB8]">{item.desc}</div>
                  </div>
                  <Switch
                    checked={privacy[item.key as keyof typeof privacy]}
                    onCheckedChange={(checked) => setPrivacy({ ...privacy, [item.key]: checked })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-[#7B61FF]/10 to-transparent border-[#7B61FF]/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-[#7B61FF] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-[#F4F6FF] mb-1">What We Never Show</h4>
                  <p className="text-xs text-[#A7ACB8]">
                    Raw chat logs, internal system data, precise location (only city if enabled), and API keys are never exposed publicly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Theme Tab */}
        <TabsContent value="theme" className="space-y-6">
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription className="text-[#A7ACB8]">Customize the look of your dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Theme Mode</label>
                <div className="flex gap-3">
                  {(['dark', 'light', 'system'] as const).map((mode) => (
                    <button
                      key={mode}
                      className={`flex-1 p-4 rounded-xl border-2 capitalize transition-all ${
                        mode === 'dark'
                          ? 'border-[#7B61FF] bg-[#7B61FF]/10 text-[#7B61FF]'
                          : 'border-[#7B61FF]/20 text-[#A7ACB8]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-[#A7ACB8] mb-3 block">Accent Color</label>
                <div className="flex gap-3 flex-wrap">
                  {accentPresets.map((color) => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className={`w-10 h-10 rounded-xl transition-all ${
                        accentColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0B0B10] scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-[#A7ACB8]">Custom:</label>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent"
                  />
                  <span className="text-sm font-mono text-[#A7ACB8]">{accentColor}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
