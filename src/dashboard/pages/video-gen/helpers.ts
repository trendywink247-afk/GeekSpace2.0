// Shared types, constants, and utilities for the VideoGen feature

export interface FleetAgent {
  id: string;
  slot: number;
  name: string;
  personality: string;
  status: string;
  tasks_completed: number;
}

export const statusColor: Record<string, string> = {
  active: '#00FF88',
  idle: '#6B7280',
  disabled: '#FF6161',
};

// Free video providers blocked from this server region
export const BROKEN_VIDEO_PROVIDERS = [
  'pollinations-video',
  'seedance-lite',
  'veo2',
  'veo2-openrouter',
  'pollinations',
  'auto',
  '',
];

export const durationPresets = [
  { label: '3s', val: 3 },
  { label: '5s', val: 5 },
  { label: '8s', val: 8 },
  { label: '10s', val: 10 },
];

export function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}
