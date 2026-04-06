// ── Creative Studio — shared constants & types ──────────────────────────────
import { ImageIcon, Film, Sparkles, LayoutTemplate } from 'lucide-react';

export const STYLE_OPTIONS = [
  'Photorealistic', 'Anime', 'Oil Painting', 'Watercolor',
  'Cyberpunk', 'Minimalist', 'Pixel Art', 'Digital Art',
  '3D Render', 'Sketch', 'Pop Art', 'Art Nouveau',
] as const;

export type StyleOption = typeof STYLE_OPTIONS[number];

export type TabId = 'images' | 'videos' | 'templates' | 'gallery';

export const TABS: { id: TabId; label: string; icon: typeof ImageIcon }[] = [
  { id: 'images',    label: 'Images',    icon: ImageIcon },
  { id: 'videos',    label: 'Videos',    icon: Film },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'gallery',   label: 'Gallery',   icon: Sparkles },
];
