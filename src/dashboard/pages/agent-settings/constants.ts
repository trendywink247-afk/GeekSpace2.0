import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AgentPersonality } from '@/types';
import {
  Shield,
  Bot,
  Sparkles,
  Search,
  Calculator,
  CalendarDays,
  Bell,
  ImageIcon,
  Code,
} from 'lucide-react';

// ─── Agent definitions ────────────────────────────────────────────────────────

export interface AgentDef {
  id: AgentPersonality;
  name: string;
  color: string;
  description: string;
}

export const AGENTS: AgentDef[] = [
  { id: 'weebo', name: 'Weebo', color: 'var(--ag-weebo)', description: 'Balanced all-rounder' },
  { id: 'edith', name: 'Edith', color: 'var(--ag-edith)', description: 'Strategic & focused' },
  { id: 'jarvis', name: 'Jarvis', color: 'var(--ag-jarvis)', description: 'Professional & efficient' },
];

// ─── Model definitions ────────────────────────────────────────────────────────

export interface ModelDef {
  id: string;
  label: string;
  tier: 'free' | 'pro';
}

export const MODELS: ModelDef[] = [
  { id: 'auto', label: 'Auto', tier: 'free' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', tier: 'free' },
  { id: 'claude-3-haiku', label: 'Claude Haiku', tier: 'free' },
  { id: 'gpt-4o', label: 'GPT-4o', tier: 'pro' },
  { id: 'claude-3.5-sonnet', label: 'Claude Sonnet', tier: 'pro' },
  { id: 'claude-3-opus', label: 'Claude Opus', tier: 'pro' },
];

// ─── Tool definitions ─────────────────────────────────────────────────────────

export interface ToolDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const TOOLS: ToolDef[] = [
  { id: 'web_search', label: 'Web Search', description: 'Search the internet for information', icon: Search },
  { id: 'calculator', label: 'Calculator', description: 'Perform math calculations', icon: Calculator },
  { id: 'calendar', label: 'Calendar Access', description: 'Read and manage your calendar', icon: CalendarDays },
  { id: 'reminders', label: 'Reminder Creation', description: 'Set and manage reminders', icon: Bell },
  { id: 'image_gen', label: 'Image Generation', description: 'Generate images from prompts', icon: ImageIcon },
  { id: 'code_exec', label: 'Code Execution', description: 'Run code snippets', icon: Code },
];

// ─── Slider labels ────────────────────────────────────────────────────────────

export const TONE_LABELS = ['Very Formal', 'Formal', 'Balanced', 'Casual', 'Very Casual'];
export const VERBOSITY_LABELS = ['Terse', 'Brief', 'Balanced', 'Detailed', 'Very Detailed'];
export const CREATIVITY_LABELS = ['Precise', 'Focused', 'Balanced', 'Creative', 'Exploratory'];
export const HUMOR_LABELS = ['Serious', 'Neutral', 'Balanced', 'Witty', 'Very Humorous'];
export const EMPATHY_LABELS = ['Direct', 'Factual', 'Balanced', 'Warm', 'Very Empathetic'];

// ─── Autonomy levels ──────────────────────────────────────────────────────────

export interface AutonomyLevel {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const AUTONOMY_LEVELS: AutonomyLevel[] = [
  {
    id: 'ask',
    label: 'Ask me first',
    icon: Shield,
    description: 'Agent proposes actions and waits for your approval before executing.',
  },
  {
    id: 'assisted',
    label: 'Assisted',
    icon: Bot,
    description: 'Agent acts on routine tasks, asks for important ones.',
  },
  {
    id: 'auto',
    label: 'Just do it',
    icon: Sparkles,
    description: 'Agent executes without asking. You can always undo.',
  },
];

// ─── Agent feature assignments ────────────────────────────────────────────────

export const AGENT_ASSIGNMENTS: Record<string, string[]> = {
  weebo: ['Creative', 'Social', 'Chat'],
  edith: ['Code', 'Systems', 'Terminal'],
  jarvis: ['Calendar', 'Reminders', 'Email'],
};

// ─── Motion variants ──────────────────────────────────────────────────────────

export const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const EASE_SMOOTH = [0.4, 0, 0.2, 1] as [number, number, number, number];

export const itemVariants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: EASE_SMOOTH },
  },
};

// ─── Shared style helpers ─────────────────────────────────────────────────────

export const GLASS_CARD_STYLE: CSSProperties = {
  background: 'var(--ag-bg-surface)',
  backdropFilter: 'blur(var(--ag-glass-blur))',
  WebkitBackdropFilter: 'blur(var(--ag-glass-blur))',
  boxShadow:
    '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.28), var(--ag-glow-sm)',
  borderRadius: 16,
};

export const GLASS_CARD_HOVER_SHADOW =
  '0 0 0 1px rgba(255,255,255,0.09), 0 8px 32px rgba(0,0,0,0.35), var(--ag-glow-md)';
