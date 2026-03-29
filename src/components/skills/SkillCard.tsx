import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

// ----- Types ---------------------------------------------------

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'knowledge' | 'tool' | 'hybrid';
  tier: 'free' | 'pro' | 'teams';
  category: string;
  compatibleAgents: string[];
  icon: string;
  tags: string[];
}

export interface UserSkill {
  skillId: string;
  enabled: boolean;
  agentOverrides: Record<string, boolean>;
  installedAt: string;
}

// ----- Tier badge colours -------------------------------------

const tierBadge: Record<string, { bg: string; text: string; label: string }> = {
  free: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Free' },
  pro: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pro' },
  teams: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Teams' },
};

// ----- Agent colours (deterministic from name) ----------------

const AGENT_COLORS = [
  '#8B5CF6', '#8B5CF6', '#FFB800', '#00FF88', '#FF2D78',
  '#FF6B6B', '#36D399', '#F472B6', '#A78BFA',
];

function agentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

// ----- Component -----------------------------------------------

interface SkillCardProps {
  skill: Skill;
  installed: boolean;
  enabled: boolean;
  loading?: boolean;
  onInstall: (skillId: string) => void;
  onToggle: (skillId: string, enabled: boolean) => void;
  onClick: (skill: Skill) => void;
}

export function SkillCard({
  skill,
  installed,
  enabled,
  loading,
  onInstall,
  onToggle,
  onClick,
}: SkillCardProps) {
  const badge = tierBadge[skill.tier] ?? tierBadge.free;

  return (
    <button
      type="button"
      onClick={() => onClick(skill)}
      className="w-full text-left rounded-xl border border-white/10 bg-white/5 p-4 transition-all duration-200 hover:scale-[1.02] hover:border-[#8B5CF6]/30 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50"
    >
      {/* Top: icon + name + tier */}
      <div className="flex items-start gap-3 mb-2">
        <span className="text-2xl flex-shrink-0 leading-none mt-0.5" role="img" aria-label={skill.name}>
          {skill.icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[#E8E8F0] truncate">{skill.name}</h3>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Description (2-line clamp) */}
      <p className="text-xs text-[#B8C4D4] line-clamp-2 mb-3 leading-relaxed">
        {skill.description}
      </p>

      {/* Bottom: agent avatars + action */}
      <div className="flex items-center justify-between">
        {/* Agent avatars */}
        <div className="flex -space-x-1.5">
          {skill.compatibleAgents.slice(0, 5).map((agent) => (
            <div
              key={agent}
              title={agent}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-black border border-black/30"
              style={{ backgroundColor: agentColor(agent) }}
            >
              {agent.charAt(0).toUpperCase()}
            </div>
          ))}
          {skill.compatibleAgents.length > 5 && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium text-[#B8C4D4] bg-white/10 border border-white/10">
              +{skill.compatibleAgents.length - 5}
            </div>
          )}
        </div>

        {/* Action */}
        {installed ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggle(skill.id, !enabled);
            }}
            className="flex items-center"
          >
            <Switch checked={enabled} aria-label={`Toggle ${skill.name}`} />
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              onInstall(skill.id);
            }}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] hover:bg-[#8B5CF6]/20 transition-colors duration-150 disabled:opacity-50 min-h-[32px]"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Install'}
          </button>
        )}
      </div>
    </button>
  );
}
