// ============================================================
// image-creator/helpers.ts — constants, types, style configs
// ============================================================

export const STYLE_OPTIONS = [
  'Photorealistic', 'Anime', 'Oil Painting', 'Watercolor',
  'Cyberpunk', 'Minimalist', 'Pixel Art', 'Digital Art',
  '3D Render', 'Sketch', 'Pop Art', 'Art Nouveau',
] as const;

export const LIGHTING_OPTIONS = [
  'Natural', 'Studio', 'Dramatic', 'Neon', 'Golden Hour',
  'Cinematic', 'Soft Ambient', 'Backlit', 'Moonlight',
] as const;

export const MOOD_OPTIONS = [
  'Happy', 'Dark', 'Serene', 'Epic', 'Mysterious',
  'Whimsical', 'Nostalgic', 'Futuristic', 'Romantic',
] as const;

export const SIZE_PRESETS = [
  { label: 'Square',    w: 1024, h: 1024 },
  { label: 'Landscape', w: 1280, h: 720  },
  { label: 'Portrait',  w: 720,  h: 1280 },
  { label: 'Wide',      w: 1536, h: 640  },
] as const;

export const STATUS_COLOR: Record<string, string> = {
  active:   '#00FF88',
  idle:     '#6B7280',
  disabled: '#FF6161',
};

export type GenerationPhase = 'idle' | 'submitting' | 'generating' | 'done' | 'error';
export type TabId           = 'generate' | 'gallery';

export interface FleetAgent {
  id:               string;
  slot:             number;
  name:             string;
  personality:      string;
  status:           string;
  tasks_completed:  number;
}

export function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hrs  = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}
