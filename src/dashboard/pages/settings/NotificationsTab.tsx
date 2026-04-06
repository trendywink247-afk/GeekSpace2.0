import { Bell, Mail, Smartphone, Globe, Shield, Users, CalendarDays, Loader2, RotateCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export interface NotificationsState {
  emailReminders: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  marketingEmails: boolean;
  securityAlerts: boolean;
  reminderNotifs: boolean;
  connectionAlerts: boolean;
  weeklyDigestToggle: boolean;
}

export interface AgentNotifsState {
  notif_reminders: number;
  notif_escalations: number;
  notif_agents: number;
  notif_daily_briefing: number;
  notif_connections: number;
}

interface NotificationsTabProps {
  notifications: NotificationsState;
  setNotifications: (n: NotificationsState) => void;
  agentNotifs: AgentNotifsState;
  setAgentNotifs: (n: AgentNotifsState) => void;
  snoozePresets: string[];
  setSnoozePresets: (p: string[]) => void;
  isResettingAgent: boolean;
  handleResetAgentConfig: () => void;
  showSavedToast: () => void;
  saveNotification: (field: string, value: boolean) => Promise<void>;
  onAgentNotifChange: (key: keyof AgentNotifsState, value: number) => void;
  onSnoozePresetChange: (preset: string, enabled: boolean) => void;
}

const NOTIF_ITEMS = [
  { key: 'emailReminders', icon: Mail, title: 'Email Reminders', desc: 'Get reminders via email' },
  { key: 'pushNotifications', icon: Smartphone, title: 'Push Notifications', desc: 'Browser push notifications' },
  { key: 'reminderNotifs', icon: Bell, title: 'Reminder Notifications', desc: 'Alerts when reminders are due' },
  { key: 'weeklyDigest', icon: Globe, title: 'Weekly Digest', desc: 'Weekly summary of activity' },
  { key: 'securityAlerts', icon: Shield, title: 'Security Alerts', desc: 'Important security notifications' },
  { key: 'connectionAlerts', icon: Users, title: 'Connection Request Alerts', desc: 'Notifications for new connection requests' },
  { key: 'weeklyDigestToggle', icon: CalendarDays, title: 'Weekly Digest Email', desc: 'Weekly activity digest delivered to your inbox' },
] as const;

const TELEGRAM_ITEMS = [
  { key: 'notif_reminders' as const, title: 'Reminder alerts', desc: 'Get notified when a reminder fires' },
  { key: 'notif_escalations' as const, title: 'Escalation alerts', desc: 'Receive replies to Telegram escalations' },
  { key: 'notif_agents' as const, title: 'Agent activity alerts', desc: 'Notifications for agent actions and tasks' },
  { key: 'notif_daily_briefing' as const, title: 'Daily briefing', desc: 'Deliver your daily AI briefing via Telegram' },
  { key: 'notif_connections' as const, title: 'Connection alerts', desc: 'Get notified when someone accepts your invite' },
];

const SNOOZE_LABELS: Record<string, string> = {
  '1h': '1 hour',
  '3h': '3 hours',
  tomorrow: 'Tomorrow 9am',
  'next-week': 'Next week 9am',
};

export function NotificationsTab({
  notifications,
  setNotifications,
  agentNotifs,
  snoozePresets,
  isResettingAgent,
  handleResetAgentConfig,
  saveNotification,
  onAgentNotifChange,
  onSnoozePresetChange,
}: NotificationsTabProps) {
  return (
    <div className="space-y-6">
      {/* Main notification preferences */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">Choose how you want to be notified</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {NOTIF_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#A78BFA]/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[var(--ag-cyan)]" />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--ag-text-primary)]">{item.title}</div>
                    <div className="text-sm text-[var(--ag-text-muted)]">{item.desc}</div>
                  </div>
                </div>
                <Switch
                  checked={notifications[item.key]}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, [item.key]: checked });
                    void saveNotification(item.key, checked);
                  }}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Telegram preferences */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <CardTitle>Telegram Alerts</CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">Choose which alerts are sent to your Telegram</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {TELEGRAM_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--ag-text-primary)] text-sm">{item.title}</div>
                <div className="text-xs text-[var(--ag-text-muted)] mt-0.5">{item.desc}</div>
              </div>
              <Switch
                checked={agentNotifs[item.key] === 1}
                onCheckedChange={(checked) => onAgentNotifChange(item.key, checked ? 1 : 0)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Snooze presets */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <CardTitle>Snooze Presets</CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">
            Choose which snooze options appear when delaying a reminder
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(['1h', '3h', 'tomorrow', 'next-week'] as const).map((preset) => (
            <div key={preset} className="flex items-center justify-between">
              <div className="font-medium text-[var(--ag-text-primary)] text-sm">{SNOOZE_LABELS[preset]}</div>
              <Switch
                checked={snoozePresets.includes(preset)}
                onCheckedChange={(checked) => onSnoozePresetChange(preset, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reset agent config */}
      <Card className="border-[#FF6161]/20">
        <CardHeader>
          <CardTitle className="text-[var(--ag-text-primary)]">Reset Agent Configuration</CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">
            Restore all agent notification and snooze settings to their defaults
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="ghost"
            onClick={handleResetAgentConfig}
            disabled={isResettingAgent}
            data-testid="reset-agent-config-btn"
            className="flex items-center gap-2 text-[#FF6161] hover:text-[#FF6161] hover:bg-[#FF6161]/10 border border-[#FF6161]/30"
          >
            {isResettingAgent ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Reset to Defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
