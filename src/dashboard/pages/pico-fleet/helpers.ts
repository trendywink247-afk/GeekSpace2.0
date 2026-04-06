// helpers.ts — shared types, constants, and pure utilities for PicoFleet sub-components
import type { LucideIcon } from 'lucide-react';
import { ChefHat, Image, Video, Globe, Share2 } from 'lucide-react';

// ---- Design token constant ----
export const BORDER_SUBTLE = 'rgba(139,92,246,0.08)';

// ---- Types ----

export interface PicoTask {
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

export interface RecentTask {
  id: string;
  description: string;
  status: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
}

// ---- Agent Colors ----

const AGENT_COLORS: Record<string, string> = {
  weebo: '#A78BFA',
  edith: '#8B5CF6',
  jarvis: '#ADFF2F',
};

export function getAgentColor(personality: string): string {
  return AGENT_COLORS[personality] || '#A78BFA';
}

// ---- Task Types & Intervals ----

export const TASK_TYPES = [
  { value: 'create_reminder', label: 'Create Reminder' },
  { value: 'telegram_message', label: 'Telegram Message' },
  { value: 'call_api', label: 'Call API' },
  { value: 'n8n_webhook', label: 'n8n Webhook' },
  { value: 'portfolio_deploy', label: 'Portfolio Deploy' },
  { value: 'social_media_post', label: 'Social Media Post' },
];

export const INTERVAL_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '24 hours' },
  { value: 10080, label: 'Weekly' },
];

export type ToolId = 'recipes' | 'image-gen' | 'video-gen' | 'website-builder' | 'social-media';

export const TOOL_OPTIONS: Array<{ id: ToolId; label: string; short: string; icon: LucideIcon; color: string }> = [
  { id: 'recipes', label: 'Recipes', short: 'RCP', icon: ChefHat, color: '#00FF88' },
  { id: 'image-gen', label: 'Image Gen', short: 'IMG', icon: Image, color: 'var(--ag-cyan)' },
  { id: 'video-gen', label: 'Video Gen', short: 'VID', icon: Video, color: '#FFB800' },
  { id: 'website-builder', label: 'Website Builder', short: 'WEB', icon: Globe, color: '#A855F7' },
  { id: 'social-media', label: 'Social Media', short: 'SOC', icon: Share2, color: '#FF2D78' },
];

// ---- Status Colors ----

const statusColors: Record<string, string> = {
  active: '#00FF88',
  completed: '#00FF88',
  idle: '#6B7280',
  cancelled: '#6B7280',
  disabled: '#FF6161',
  failed: '#FF6161',
  queued: '#A78BFA',
  running: '#FFB800',
  paused: '#FFB800',
};

export function getStatusColor(status: string): string {
  return statusColors[status] || '#6B7280';
}

// ---- Time Formatting ----

export function formatTime(ts: string | null | undefined): string {
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

// ---- Tool Helpers ----

export function parseAssignedTools(raw: string): string[] {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}
