// ============================================================
// AgentChatPanel types & constants — extracted from AgentChatPanel.tsx
// ============================================================

import type { AgentPersonality } from '@/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  provider?: string;
  model?: string;
  isStreaming?: boolean;
  retryContent?: string;
  actions?: Array<{
    tool: string;
    success: boolean;
    message: string;
    artifactId?: string;
    data?: Record<string, unknown>;
    receipt?: { icon: string; text: string; details?: string; link?: string };
  }>;
  receipts?: Array<{ icon: string; text: string; details?: string; link?: string }>;
  /** 81.7: URL of generated image to render as inline image bubble */
  imageUrl?: string;
  /** Visible thinking steps from ReAct loop */
  thinkingSteps?: Array<{ type: string; content: string; tool?: string; iteration: number }>;
  /** Multi-agent council responses */
  agentResponses?: Array<{ agent: string; role: string; text: string }>;
  isMultiAgent?: boolean;
}

export interface AgentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: agent belongs to another user (portfolio chat mode) */
  agentOwner?: string;
  /** Optional: message to auto-send when the panel opens (used by QuickChatInput on dashboard) */
  initialMessage?: string;
  /** Called once initialMessage has been consumed so the parent can clear it */
  onInitialMessageConsumed?: () => void;
}

export const personalityMeta: Record<AgentPersonality, { emoji: string; name: string; greeting: string }> = {
  edith: { emoji: '🔷', name: 'Edith', greeting: "What do you need? I'm ready." },
  jarvis: { emoji: '🟣', name: 'Jarvis', greeting: "Good day. How may I assist you?" },
  weebo: { emoji: '💚', name: 'Weebo', greeting: "Hiii! What are we working on today?!" },
  aria: { emoji: '🎨', name: 'Aria', greeting: "Hey! Let's create something amazing." },
  forge: { emoji: '🔧', name: 'Forge', greeting: "Forge here. What are we building?" },
  pulse: { emoji: '📊', name: 'Pulse', greeting: "Pulse online. What data do you need?" },
  echo: { emoji: '💙', name: 'Echo', greeting: "Hey, Echo here. What are we working on?" },
  cal: { emoji: '📅', name: 'Cal', greeting: "Cal here. Let's get organized." },
  nova: { emoji: '🔭', name: 'Nova', greeting: "Nova here! Ready to explore." },
};

export const providerLabels: Record<string, string> = {
  picoclaw: 'Weebo Engine',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  'openrouter-free': 'Cloud Engine',
  edith: 'Premium Engine',
  builtin: 'Built-in',
};

export function formatModelName(model: string): string {
  if (!model || model === 'builtin-fallback' || model === 'error-fallback' || model === 'picoclaw-haiku') return '';
  const base = model.replace(/:free$/, '').split('/').pop() || '';
  return base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

export const PLAN_DISPLAY: Record<string, string> = {
  free: 'Free', pilot: 'Pilot', intro: 'Intro', monthly: 'Monthly',
  halfyear: 'Half-Year', yearly: 'Yearly', basic: 'Basic', pro: 'Pro',
};

export const suggestedPrompts = [
  "What's on my schedule today?",
  "Show me my usage stats",
  "Create a reminder for tomorrow",
  "Help me with a code review",
];

export const USE_CASE_TIPS: Record<string, string[]> = {
  creator: [
    '/image a futuristic city at sunset',
    'Write a YouTube script for [your topic]',
    'Remind me every day at 9am to post content',
  ],
  student: [
    'Explain quantum entanglement simply',
    'Quiz me on the French Revolution',
    'Remind me to review notes at 8pm',
  ],
  developer: [
    'Review this code: [paste snippet]',
    'Write a Python script to parse a CSV',
    'Remind me to push commits at 6pm',
  ],
  business: [
    'Draft a follow-up email to a client about [project]',
    'Summarize these meeting notes: [paste]',
    'Remind me about my 3pm standup',
  ],
};
