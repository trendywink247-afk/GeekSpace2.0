// ─── Shared helpers, constants and types for the Connections feature ─────────
import {
  MessageSquare,
  Calendar,
  MapPin,
  Github,
  Twitter,
  Linkedin,
  Mail,
  Image as ImageIcon,
  Send,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type TelegramStep =
  | 'idle'
  | 'generating'
  | 'open-bot'
  | 'send-code'
  | 'waiting'
  | 'success'
  | 'error'
  | 'timeout';

export type CustomBotStatus = 'idle' | 'verifying' | 'connected' | 'error';

export interface TestResultEntry {
  status: 'pass' | 'fail';
  message: string;
  at: string;
}

export interface TelegramLinkData {
  code?: string;
  deepLink?: string | null;
  botUsername?: string | null;
  message?: string;
  linked?: boolean;
}

export interface CustomBotInfo {
  botName: string;
  botUsername: string;
}

// ─── Icon + Color maps ────────────────────────────────────────────────────────
export const iconMap: Record<string, LucideIcon> = {
  telegram: Send,
  'google-calendar': Calendar,
  location: MapPin,
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
  email: Mail,
  whatsapp: MessageSquare,
  image: ImageIcon,
};

export const colorMap: Record<string, string> = {
  telegram: '#0088cc',
  'google-calendar': '#4285f4',
  location: '#00FF88',
  github: '#f0f6fc',
  twitter: '#1da1f2',
  linkedin: '#0a66c2',
  n8n: '#ff6d5a',
  manychat: '#0084ff',
  whatsapp: '#25d366',
  'custom-webhook': '#A78BFA',
  email: '#00FF88',
  image: '#FF2D78',
};

// ─── Shadow presets ───────────────────────────────────────────────────────────
export const SHADOW = {
  card: '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.07), 0 6px 20px rgba(0,0,0,0.25)',
  cardHover:
    '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.15), 0 8px 28px rgba(0,0,0,0.3), 0 0 24px rgba(139,92,246,0.06)',
  cardConnected:
    '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,255,136,0.1), 0 6px 20px rgba(0,0,0,0.25), 0 0 24px rgba(0,255,136,0.04)',
  cardTelegram:
    '0 1px 2px rgba(0,0,0,0.5), 0 0 0 1px rgba(167,139,250,0.2), 0 6px 20px rgba(0,0,0,0.25), 0 0 32px rgba(139,92,246,0.07)',
  stat: '0 1px 2px rgba(0,0,0,0.4), 0 0 0 1px rgba(139,92,246,0.06), 0 4px 12px rgba(0,0,0,0.18)',
  pill: '0 0 0 1px rgba(139,92,246,0.25), 0 0 12px rgba(139,92,246,0.12)',
};

// ─── Motion ───────────────────────────────────────────────────────────────────
export const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.35, ease: EASE },
  }),
};

export const slideDown = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: 'auto', transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2, ease: EASE } },
};

// ─── Utilities ────────────────────────────────────────────────────────────────
export function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function getIcon(type: string): LucideIcon {
  return iconMap[type] ?? Zap;
}

export function getColor(type: string): string {
  return colorMap[type] ?? '#A78BFA';
}
