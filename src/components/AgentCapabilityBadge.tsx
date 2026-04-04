// ============================================================
// Agent Capability Badge — Shows what each agent can do
//
// Displayed when an agent is selected/delegated, showing their
// tool capabilities as compact, branded pill badges.
// Mobile-first, touch-friendly.
// ============================================================

import { motion } from 'framer-motion';
import {
  Code2, Image, BarChart3, Heart, Calendar, Shield,
  Zap, Search, Mic, type LucideIcon,
} from 'lucide-react';

// Tool capability groups (matches agent-tools-map.ts on backend)
const AGENT_CAPABILITIES: Record<string, { label: string; tools: string[]; icon: LucideIcon }[]> = {
  weebo: [
    { label: 'Everything', tools: ['*'], icon: Zap },
  ],
  forge: [
    { label: 'Code', tools: ['generate_code', 'code_review', 'github_pr'], icon: Code2 },
    { label: 'Research', tools: ['web_search', 'crawl_url'], icon: Search },
  ],
  aria: [
    { label: 'Creative', tools: ['generate_image', 'generate_video', 'generate_avatar'], icon: Image },
    { label: 'Social', tools: ['generate_social_post'], icon: Mic },
    { label: 'Portfolio', tools: ['portfolio_add_project', 'portfolio_update_bio'], icon: Zap },
  ],
  pulse: [
    { label: 'Research', tools: ['web_search', 'crawl_url', 'seo_audit'], icon: Search },
    { label: 'Analytics', tools: ['youtube_summarize', 'get_briefing'], icon: BarChart3 },
  ],
  echo: [
    { label: 'Coaching', tools: ['track_habit', 'start_focus', 'create_flashcards'], icon: Heart },
  ],
  cal: [
    { label: 'Organize', tools: ['meeting_notes', 'trigger_workflow'], icon: Calendar },
    { label: 'Automate', tools: ['create_automation', 'run_workflow'], icon: Zap },
  ],
  edith: [
    { label: 'Audit', tools: ['code_review', 'seo_audit'], icon: Shield },
    { label: 'Code', tools: ['generate_code', 'github_pr'], icon: Code2 },
  ],
  jarvis: [
    { label: 'Automate', tools: ['trigger_workflow', 'create_automation'], icon: Zap },
    { label: 'Research', tools: ['web_search', 'crawl_url'], icon: Search },
  ],
  nova: [
    { label: 'Research', tools: ['web_search', 'crawl_url', 'youtube_summarize'], icon: Search },
    { label: 'Learn', tools: ['create_flashcards'], icon: Heart },
  ],
};

const AGENT_COLORS: Record<string, string> = {
  weebo: 'var(--ag-weebo, #00F0FF)',
  edith: 'var(--ag-edith, #8B5CF6)',
  jarvis: 'var(--ag-jarvis, #ADFF2F)',
  aria: 'var(--ag-aria, #FF6B9D)',
  forge: 'var(--ag-forge, #F59E0B)',
  pulse: 'var(--ag-pulse, #10B981)',
  echo: 'var(--ag-echo, #6366F1)',
  cal: 'var(--ag-cal, #84CC16)',
  nova: 'var(--ag-nova, #EC4899)',
};

interface AgentCapabilityBadgeProps {
  agentId: string;
  variant?: 'inline' | 'expanded';
  className?: string;
}

export function AgentCapabilityBadge({ agentId, variant = 'inline', className = '' }: AgentCapabilityBadgeProps) {
  const capabilities = AGENT_CAPABILITIES[agentId] || AGENT_CAPABILITIES.weebo;
  const color = AGENT_COLORS[agentId] || AGENT_COLORS.weebo;

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-1 flex-wrap ${className}`}>
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
            <motion.span
              key={cap.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                background: `${color}10`,
                color: color,
                border: `1px solid ${color}20`,
              }}
            >
              <Icon className="w-2.5 h-2.5" />
              {cap.label}
            </motion.span>
          );
        })}
      </div>
    );
  }

  // Expanded variant — for agent selector / settings
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {capabilities.map((cap) => {
        const Icon = cap.icon;
        return (
          <div
            key={cap.label}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{
              background: `${color}06`,
              border: `1px solid ${color}12`,
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${color}15` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium" style={{ color }}>{cap.label}</p>
              <p className="text-[10px] text-[var(--ag-text-muted)] truncate">
                {cap.tools.length === 1 && cap.tools[0] === '*'
                  ? 'All tools available'
                  : `${cap.tools.length} tools`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
