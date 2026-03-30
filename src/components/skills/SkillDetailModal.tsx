import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { Skill, UserSkill } from './SkillCard';

// ----- Badge helpers ------------------------------------------

const tierBadge: Record<string, { bg: string; text: string; label: string }> = {
  free: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Free' },
  pro: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pro' },
  teams: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Teams' },
};

const typeBadge: Record<string, { bg: string; text: string; label: string }> = {
  knowledge: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Knowledge' },
  tool: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Tool' },
  hybrid: { bg: 'bg-violet-500/20', text: 'text-violet-400', label: 'Hybrid' },
};

// ----- Component -----------------------------------------------

interface SkillDetailModalProps {
  skill: Skill | null;
  userSkill: UserSkill | null;
  open: boolean;
  onClose: () => void;
  onInstall: (skillId: string) => void;
  onUninstall: (skillId: string) => void;
  onToggleAgent: (skillId: string, agentId: string, enabled: boolean) => void;
  actionLoading: boolean;
}

export function SkillDetailModal({
  skill,
  userSkill,
  open,
  onClose,
  onInstall,
  onUninstall,
  onToggleAgent,
  actionLoading,
}: SkillDetailModalProps) {
  if (!skill) return null;

  const installed = !!userSkill;
  const tier = tierBadge[skill.tier] ?? tierBadge.free;
  const type = typeBadge[skill.type] ?? typeBadge.knowledge;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="text-3xl" role="img" aria-label={skill.name}>
              {skill.icon}
            </span>
            <div>
              <DialogTitle className="text-lg font-bold text-[#E8E8F0]">
                {skill.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#9CA3AF]">
                v1.0 &middot; Agentin
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-1">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${tier.bg} ${tier.text}`}>
            {tier.label}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${type.bg} ${type.text}`}>
            {type.label}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-[#C4C4D4] leading-relaxed mt-2">
          {skill.description}
        </p>

        {/* Tags */}
        {skill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {skill.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/5 text-[#9CA3AF] border border-white/10"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Compatible Agents */}
        {installed && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-[#E8E8F0] uppercase tracking-wide mb-2">
              Compatible Agents
            </h4>
            <div className="space-y-2">
              {skill.compatibleAgents.map((agent) => {
                const checked = userSkill.agentOverrides[agent] !== false;
                return (
                  <label
                    key={agent}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/[0.07] transition-colors min-h-[44px]"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        onToggleAgent(skill.id, agent, v === true)
                      }
                    />
                    <span className="text-sm text-[#E8E8F0] capitalize">{agent}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="mt-4 flex gap-2">
          {installed ? (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => onUninstall(skill.id)}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors duration-150 disabled:opacity-50 min-h-[44px]"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Uninstall'}
            </button>
          ) : (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => onInstall(skill.id)}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] hover:bg-[#8B5CF6]/20 transition-colors duration-150 disabled:opacity-50 min-h-[44px]"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Install'}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
