// ---- Fleet agent types ----
export interface FleetAgent {
  id: string;
  user_id: string;
  slot: number;
  name: string;
  personality: string;
  status: string;
  tasks_completed: number;
  tasks_failed: number;
  created_at: string;
}

export interface FleetTask {
  id: string;
  agent_slot: number;
  agent_name: string;
  task_type: string;
  description: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export const MAX_ASSIGNED = 4;

export const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export const statusMeta: Record<string, { color: string; label: string }> = {
  active: { color: '#00FF88', label: 'Active' },
  idle: { color: 'var(--ag-text-muted)', label: 'Idle' },
  disabled: { color: '#FF6161', label: 'Offline' },
};

export function getStatusColor(status: string): string {
  return statusMeta[status]?.color ?? '#6B7280';
}

export function formatTimeAgo(ts: string | null): string {
  if (!ts) return '--';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  const hrs = Math.floor(diff / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getPersonalityEmoji(personality: string): string {
  if (personality === 'edith') return '⚡';
  if (personality === 'jarvis') return '🎩';
  return '🤖';
}
