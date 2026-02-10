import { useState } from 'react';
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
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [profile, setProfile] = useState({
    name: 'Alex Chen',
    username: 'alex',
    email: 'alex@example.com',
    bio: 'Full-stack developer and AI enthusiast.',
    location: 'San Francisco, CA',
    website: 'alexchen.dev',
  });

  const [notifications, setNotifications] = useState({
    emailReminders: true,
    pushNotifications: true,
    weeklyDigest: true,
    marketingEmails: false,
    securityAlerts: true,
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
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
        <TabsList className="bg-[#0B0B10] border border-[#7B61FF]/20 p-1">
          <TabsTrigger value="profile" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <User className="w-4 h-4 mr-2" />Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <Bell className="w-4 h-4 mr-2" />Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <Shield className="w-4 h-4 mr-2" />Security
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-[#7B61FF] data-[state=active]:text-white">
            <CreditCard className="w-4 h-4 mr-2" />Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
              <CardContent className="p-6 text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#7B61FF] to-[#FF61DC] flex items-center justify-center text-3xl font-bold">
                    AC
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#7B61FF] flex items-center justify-center hover:bg-[#6B51EF] transition-colors">
                    <Upload className="w-4 h-4 text-white" />
                  </button>
                </div>
                <h3 className="font-semibold text-[#F4F6FF]">Alex Chen</h3>
                <p className="text-sm text-[#A7ACB8]">@alex</p>
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Key className="w-5 h-5 text-[#7B61FF]" />
                    <div>
                      <div className="font-medium text-[#F4F6FF]">API Keys</div>
                      <div className="text-sm text-[#A7ACB8]">Manage your API access</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="border-[#7B61FF]/30">Manage</Button>
                </div>
                <Separator className="bg-[#7B61FF]/20" />
                <div className="flex items-center justify-between mt-4">
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

        <TabsContent value="billing" className="space-y-6">
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-6 rounded-xl bg-gradient-to-br from-[#7B61FF]/20 to-[#0B0B10] border border-[#7B61FF]/30">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}