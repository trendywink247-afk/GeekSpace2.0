// ============================================================
// Roadmap helpers — data, interfaces, pure utility functions
// No JSX here; icons stored as LucideIcon refs
// ============================================================

import type { LucideIcon } from 'lucide-react';
import {
  Rocket,
  Users,
  Palette,
  Puzzle,
  Zap,
  Globe,
  Shield,
  Sparkles,
  Clock,
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status: 'planned' | 'in-progress' | 'completed';
  quarter: string;
  category: string;
}

export interface ReleaseNote {
  phase: string;
  title: string;
  date: string;
  items: string[];
  color: string;
}

export type Suggestion = {
  id: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
  upvotes?: number;
  downvotes?: number;
  trending?: number;
};

export type Reward = {
  id: string;
  eventType: string;
  credits: number;
  createdAt: string;
};

export type Cluster = {
  id: string;
  name?: string;
  canonical_summary: string;
  total_votes?: number;
  overall_score: number | null;
};

// ─── Data ────────────────────────────────────────────────────────────────────

export const releaseNotes: ReleaseNote[] = [
  {
    phase: 'Phase 6',
    title: 'Performance & Monitoring',
    date: 'Mar 2026',
    color: 'var(--ag-cyan)',
    items: [
      'Expense fast-path — auto-categorizes spending in 660ms, zero AI credits',
      'Focus session fast-path — instant Pomodoro start via regex parser',
      'Portfolio visitor AI now responds in 4.8s (was 30s+ timeout)',
      'AI sidecar timeout reduced 60s → 10s (5.5x latency improvement)',
      'Uptime Kuma monitoring deployed at status.agentin.chat',
      'Freed 900MB RAM by stopping unused containers',
    ],
  },
  {
    phase: 'Phase 5',
    title: 'The Agentic Leap',
    date: 'Mar 2026',
    color: '#BF5FFF',
    items: [
      'Daily Operator Mode — morning briefing as Telegram voice note',
      'Habit Coach — compassionate nudge with reschedule/skip buttons',
      'Smart Expense Categorizer — photo of receipt → Groq vision → auto-logs',
      'Telegram Memory Capture — LLM extracts facts from every conversation',
      'Agentic Portfolio — visitor intent detection sends Telegram alert',
      'Ctrl+K Global Search across notes, reminders, habits, memories',
      'FTS5 Context Threading + search_memory tool',
      'Agent-as-Researcher — async Tavily research with Telegram delivery',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'Indian Intelligence',
    date: 'Mar 2026',
    color: '#00FF88',
    items: [
      'Hinglish routing — 15+ trigger patterns for expenses, habits, reminders',
      'Indian merchant auto-categorization (Swiggy→food, Uber→transport)',
      'Habit Intelligence V2 with streak tracking and status icons',
      'Proactive Engine V3 — reminder previews 30min ahead + habit nudges',
      'Brand purge — zero user-visible legacy references',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'Productivity Suite',
    date: 'Mar 2026',
    color: '#F59E0B',
    items: [
      'Expense Tracker with budgets and monthly reports',
      'Smart Reminders V2 with recurrence (daily/weekly/monthly)',
      'Global Search across notes, reminders, habits, memories',
      '17 new tools: flashcards, focus, code review, PR description, and more',
      '9 agent personalities: Aria, Forge, Pulse, Echo, Cal + base 3',
    ],
  },
  {
    phase: 'Phase 72',
    title: 'Suggestion Intelligence Polish',
    date: 'Feb 2026',
    color: 'var(--ag-cyan)',
    items: [
      'Status change notifications for suggestion owners',
      'Status timeline in suggestion detail modal',
      'Loading skeleton cards and error handling',
    ],
  },
  {
    phase: 'Phase 71',
    title: 'Suggestion Editing & Voting',
    date: 'Feb 2026',
    color: '#BF5FFF',
    items: [
      'Edit your own suggestions (new status only)',
      'Vote rate limiting and soft-delete cleanup',
      'Admin bulk status updates and trending decay',
    ],
  },
  {
    phase: 'Phase 70',
    title: 'Release Train R3',
    date: 'Feb 2026',
    color: '#00FF88',
    items: [
      'Production deployment v3.1.0',
      'Suggestion clusters and trending badges',
      'Admin audit logging and ops cleanup',
    ],
  },
];

export const roadmapItems: RoadmapItem[] = [
  {
    id: 'pwa',
    title: 'PWA Support',
    description: 'Install Agentin as an app, offline mode, push notifications for reminders',
    icon: Globe,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'Platform',
  },
  {
    id: 'oauth',
    title: 'Social Login',
    description: 'Sign up and login with Google and GitHub accounts',
    icon: Shield,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'Auth',
  },
  {
    id: 'memory',
    title: 'Memory Manager',
    description: 'Search, browse, and manage what your AI remembers about you',
    icon: Sparkles,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'AI',
  },
  {
    id: 'quick-actions',
    title: 'Quick Actions & Command Palette',
    description: 'One-click shortcuts and Ctrl+K command search',
    icon: Zap,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'UX',
  },
  {
    id: 'session-mgmt',
    title: 'Session Management',
    description: 'View and revoke active sessions; preferred AI engine picker',
    icon: Shield,
    status: 'completed',
    quarter: 'Q1 2026',
    category: 'Security',
  },
  {
    id: 'team-workspaces',
    title: 'Team Workspaces',
    description: 'Collaborate with team members, share agents, and manage projects together',
    icon: Users,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'Collaboration',
  },
  {
    id: 'live-editor',
    title: 'Live Site Editor',
    description: 'WYSIWYG editing for your portfolio - drag, drop, and customize in real-time',
    icon: Palette,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'Portfolio',
  },
  {
    id: 'plugin-system',
    title: 'Plugin System',
    description: "Build and install custom tools to extend your agent's capabilities",
    icon: Puzzle,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'Extensibility',
  },
  {
    id: 'api-sdk',
    title: 'API & SDK',
    description: 'Programmatic access to your agent with Python, JavaScript, and Go SDKs',
    icon: Rocket,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'Developer',
  },
  {
    id: 'custom-domains',
    title: 'Custom Domains',
    description: 'Use your own domain for your portfolio with SSL automatically configured',
    icon: Globe,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'Portfolio',
  },
  {
    id: 'marketplace',
    title: 'Agent Marketplace',
    description: 'Discover and install community-created agents, templates, and plugins',
    icon: Sparkles,
    status: 'planned',
    quarter: 'Q4 2026',
    category: 'Community',
  },
  {
    id: 'searxng',
    title: 'Self-Hosted Web Search',
    description:
      'Replace paid Tavily API with free SearXNG metasearch engine for unlimited web research',
    icon: Globe,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'AI',
  },
  {
    id: 'semantic-memory',
    title: 'Semantic Memory (Vector Search)',
    description:
      'Qdrant vector database for meaning-based memory recall — "what did I say about my startup?" actually works',
    icon: Sparkles,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'AI',
  },
  {
    id: 'instant-search',
    title: 'Typo-Tolerant Instant Search',
    description: 'Meilisearch-powered Ctrl+K with typo correction — "expences" finds "expenses"',
    icon: Zap,
    status: 'planned',
    quarter: 'Q2 2026',
    category: 'UX',
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Integration',
    description: 'Full two-way agent chat on WhatsApp via official Meta Business API',
    icon: Globe,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'Connect',
  },
  {
    id: 'voice-v2',
    title: 'Voice Intelligence V2',
    description:
      'Real-time voice conversations with your agent — no more text-only, speak naturally',
    icon: Sparkles,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'AI',
  },
  {
    id: 'smart-scheduling',
    title: 'Smart Scheduling',
    description: 'AI-powered calendar management — finds optimal meeting times, blocks focus hours',
    icon: Clock,
    status: 'planned',
    quarter: 'Q3 2026',
    category: 'Productivity',
  },
];

// ─── Category helpers ─────────────────────────────────────────────────────────

/** Sorted unique category list derived from roadmap items */
export function getCategories(items: RoadmapItem[]): string[] {
  return Array.from(new Set(items.map((i) => i.category))).sort();
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export function getStatusColor(status: string): string {
  switch (status) {
    case 'accepted':
      return 'var(--ag-green)';
    case 'triaged':
      return 'var(--ag-cyan)';
    case 'rejected':
      return 'var(--ag-pink)';
    case 'shipped_main':
      return 'var(--ag-violet)';
    case 'shipped_prod':
      return 'var(--ag-amber)';
    default:
      return 'var(--ag-text-muted)';
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'Submitted',
    triaged: 'Reviewed',
    accepted: 'Accepted',
    rejected: 'Not Accepted',
    shipped_main: 'Shipped',
    shipped_prod: 'Live',
  };
  return labels[status] ?? status;
}

export function getRewardLabel(eventType: string): string {
  const labels: Record<string, string> = {
    ACCEPTED_EXPERIMENT: 'Idea accepted',
    SHIPPED_MAIN: 'Feature shipped',
    SHIPPED_PROD: 'Feature live',
    ADOPTION_MILESTONE: 'Milestone reached',
  };
  return labels[eventType] ?? eventType;
}

/** Returns className + label for roadmap item status badge (no JSX, use with <Badge>) */
export function getStatusBadgeProps(status: string): { className: string; label: string } {
  switch (status) {
    case 'completed':
      return {
        className:
          'bg-[var(--ag-green)]/15 text-[var(--ag-green)] border-[var(--ag-green)]/30 shadow-[0_0_8px_rgba(16,185,129,0.1)]',
        label: 'Shipped',
      };
    case 'in-progress':
      return {
        className:
          'bg-[var(--ag-violet)]/15 text-[var(--ag-violet)] border-[var(--ag-violet)]/30 shadow-[0_0_8px_rgba(139,92,246,0.1)]',
        label: 'In Progress',
      };
    default:
      return {
        className:
          'bg-[var(--ag-text-muted)]/15 text-[var(--ag-text-secondary)] border-[var(--ag-text-muted)]/30',
        label: 'Planned',
      };
  }
}
