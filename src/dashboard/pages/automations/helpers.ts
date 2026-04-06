// helpers.ts — shared types, constants, and pure utilities for Automations sub-components
import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  Activity,
  Webhook,
  Hand,
  Hash,
  HeartPulse,
  Send,
  Globe,
  RefreshCw,
  Bell,
  FileText,
} from 'lucide-react';
import type { AutomationTrigger, AutomationAction, Automation } from '@/types';

// ---------------------------------------------------------------------------
// Meta maps
// ---------------------------------------------------------------------------

export const TRIGGER_META: Record<
  AutomationTrigger,
  { icon: LucideIcon; label: string; color: string; description: string }
> = {
  time: { icon: CalendarClock, label: 'Scheduled', color: '#FFB800', description: 'Run on a schedule' },
  event: { icon: Activity, label: 'Event', color: '#00FF88', description: 'When an event fires' },
  webhook: { icon: Webhook, label: 'Webhook', color: 'var(--ag-cyan)', description: 'When a URL is called' },
  manual: { icon: Hand, label: 'Manual', color: 'var(--ag-text-muted)', description: 'Trigger by hand' },
  keyword: { icon: Hash, label: 'Keyword', color: '#FF2D78', description: 'When a message matches' },
  health_down: { icon: HeartPulse, label: 'Health Check', color: '#FF6161', description: 'When a URL is down' },
};

export const ACTION_META: Record<
  AutomationAction,
  { icon: LucideIcon; label: string; description: string }
> = {
  'telegram-message': { icon: Send, label: 'Telegram Message', description: 'Send a Telegram message' },
  'n8n-webhook': { icon: Globe, label: 'n8n Webhook', description: 'Call an n8n webhook URL' },
  'call_api': { icon: Globe, label: 'API Call', description: 'Call any HTTP endpoint' },
  'create_reminder': { icon: Bell, label: 'Create Reminder', description: 'Set a new reminder' },
  'portfolio-update': { icon: RefreshCw, label: 'Portfolio Update', description: 'Update your portfolio' },
  'whatsapp-message': { icon: Send, label: 'WhatsApp Message', description: 'Send a WhatsApp message' },
  'manychat-broadcast': { icon: Send, label: 'ManyChat Broadcast', description: 'Send a broadcast message' },
  'log': { icon: FileText, label: 'Log', description: 'Log a message' },
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface TemplateItem {
  name: string;
  description: string;
  icon: string;
  triggerType: AutomationTrigger;
  triggerConfig: Record<string, unknown>;
  actionType: AutomationAction;
  actionConfig: Record<string, string>;
}

export const TEMPLATES: TemplateItem[] = [
  {
    name: 'Morning Brief',
    description: 'Daily AI briefing to Telegram at 7am',
    icon: '☀️',
    triggerType: 'time',
    triggerConfig: { interval_minutes: 1440 },
    actionType: 'telegram-message',
    actionConfig: { message: 'Good morning! Here is your daily briefing.' },
  },
  {
    name: 'Expense Alert',
    description: 'Alert when you log an expense over ₹1000',
    icon: '💸',
    triggerType: 'keyword',
    triggerConfig: { keyword: 'spent' },
    actionType: 'telegram-message',
    actionConfig: { message: '💸 New expense logged. Check your budget!' },
  },
  {
    name: 'Site Monitor',
    description: 'Check if a URL is down every hour',
    icon: '🔍',
    triggerType: 'health_down',
    triggerConfig: { target_url: 'https://your-site.com' },
    actionType: 'telegram-message',
    actionConfig: { message: '🚨 Site is down! {{url}} returned error.' },
  },
  {
    name: 'Weekly Summary',
    description: 'Weekly habit and expense report',
    icon: '📊',
    triggerType: 'time',
    triggerConfig: { interval_minutes: 10080 },
    actionType: 'telegram-message',
    actionConfig: { message: 'Here is your weekly summary...' },
  },
  {
    name: 'Webhook → Telegram',
    description: 'Forward webhook payloads to Telegram',
    icon: '🔗',
    triggerType: 'webhook',
    triggerConfig: {},
    actionType: 'telegram-message',
    actionConfig: { message: 'Webhook received: {{payload}}' },
  },
];

// ---------------------------------------------------------------------------
// Schedule presets
// ---------------------------------------------------------------------------

export const SCHEDULE_PRESETS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '6 hours', value: 360 },
  { label: 'Daily', value: 1440 },
  { label: 'Weekly', value: 10080 },
] as const;

// ---------------------------------------------------------------------------
// Form state type
// ---------------------------------------------------------------------------

export interface FormState {
  name: string;
  description: string;
  triggerType: AutomationTrigger;
  actionType: AutomationAction;
  enabled: boolean;
  intervalMinutes: number;
  webhookUrl: string;
  keywordValue: string;
  healthUrl: string;
  actionConfig: Record<string, string>;
}

export const DEFAULT_FORM: FormState = {
  name: '',
  description: '',
  triggerType: 'time',
  actionType: 'telegram-message',
  enabled: true,
  intervalMinutes: 60,
  webhookUrl: '',
  keywordValue: '',
  healthUrl: '',
  actionConfig: {},
};

// ---------------------------------------------------------------------------
// Test result type
// ---------------------------------------------------------------------------

export interface TestResult {
  id: string;
  success: boolean;
  message: string;
  statusCode?: number;
  latencyMs?: number;
  responseBody?: string;
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

export function tryParseJSON(str: string | undefined | null): Record<string, unknown> | null {
  if (!str) return null;
  try { return JSON.parse(str) as Record<string, unknown>; } catch { return null; }
}

export function resolveActionConfig(auto: Automation): Record<string, string> {
  if (auto.actionConfig && Object.keys(auto.actionConfig).length > 0) return auto.actionConfig;
  const parsed = tryParseJSON(auto.action_config);
  return (parsed as Record<string, string>) ?? {};
}

export function getTriggerSummary(auto: Automation): string {
  if (auto.triggerType === 'time') {
    const cfg = auto.triggerConfig ?? tryParseJSON((auto as unknown as Record<string, unknown>).trigger_config as string);
    const mins = (cfg?.interval_minutes as number) || 60;
    if (mins < 60) return `Every ${mins} minutes`;
    if (mins === 60) return 'Every hour';
    if (mins === 1440) return 'Every day';
    if (mins === 10080) return 'Every week';
    return `Every ${Math.round(mins / 60)} hours`;
  }
  if (auto.triggerType === 'webhook') return 'When webhook is called';
  if (auto.triggerType === 'manual') return 'Manual trigger';
  if (auto.triggerType === 'keyword') {
    const cfg = auto.triggerConfig ?? tryParseJSON((auto as unknown as Record<string, unknown>).trigger_config as string);
    return `When message contains "${(cfg?.keyword as string) || '...'}"`;
  }
  if (auto.triggerType === 'health_down') {
    const cfg = auto.triggerConfig ?? tryParseJSON((auto as unknown as Record<string, unknown>).trigger_config as string);
    return `When ${(cfg?.target_url as string) || 'URL'} is down`;
  }
  if (auto.triggerType === 'event') return 'When an event fires';
  return auto.triggerType;
}

export function getActionSummary(auto: Automation): string {
  if (auto.actionType === 'telegram-message') return 'Send Telegram message';
  if (auto.actionType === 'whatsapp-message') return 'Send WhatsApp message';
  if (auto.actionType === 'n8n-webhook' || auto.actionType === 'call_api') {
    const cfg = resolveActionConfig(auto);
    return `Call ${cfg.url || 'webhook'}`;
  }
  if (auto.actionType === 'create_reminder') return 'Create a reminder';
  if (auto.actionType === 'portfolio-update') return 'Update portfolio';
  if (auto.actionType === 'log') return 'Log message';
  if (auto.actionType === 'manychat-broadcast') return 'Send broadcast';
  return auto.actionType;
}

export function getStatusBadge(auto: Automation): { label: string; color: string; bg: string } {
  if (!auto.enabled) return { label: 'Paused', color: 'var(--ag-text-muted)', bg: 'rgba(107,114,128,0.12)' };
  if (auto.lastStatus === 'error' || auto.lastStatus === 'failed')
    return { label: 'Error', color: '#FF6161', bg: 'rgba(255,97,97,0.12)' };
  return { label: 'Active', color: '#00FF88', bg: 'rgba(0,255,136,0.12)' };
}

export function fmtRelativeTime(ts: string | null | undefined): string {
  if (!ts) return 'Never';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function parseHttpStatus(output: string): number | null {
  const match = output.match(/^HTTP (\d{3})/);
  return match ? parseInt(match[1], 10) : null;
}

export function getHttpStatusBg(status: number): string {
  if (status >= 200 && status < 300) return 'bg-[#00FF88]/10 border-[#00FF88]/20 text-[#00FF88]';
  if (status >= 400) return 'bg-[#FF6161]/10 border-[#FF6161]/20 text-[#FF6161]';
  return 'bg-[#6B7280]/10 border-[#6B7280]/20 text-[var(--ag-text-muted)]';
}

export const TRIGGER_BORDER_COLORS: Record<string, string> = {
  time: '#A78BFA',
  keyword: '#00FF88',
  webhook: '#8B5CF6',
  manual: '#6B7280',
  event: '#00FF88',
  health_down: '#FF6161',
};
