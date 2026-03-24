// ============================================================
// Skill Engine — Type definitions
// ============================================================

export type SkillType = 'knowledge' | 'tool' | 'hybrid';
export type SkillTier = 'free' | 'pro' | 'teams';
export type SkillCategory =
  | 'india-business'
  | 'productivity'
  | 'communication'
  | 'development'
  | 'data-analysis'
  | 'research'
  | 'finance'
  | 'security'
  | 'automation'
  | 'creative';

export type AgentId =
  | 'weebo'
  | 'edith'
  | 'jarvis'
  | 'aria'
  | 'forge'
  | 'pulse'
  | 'echo'
  | 'cal'
  | 'nova';

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  type: SkillType;
  tier: SkillTier;
  category: SkillCategory;
  compatibleAgents: AgentId[];
  icon: string;
  tags: string[];
  skillContent: string;
}

export interface UserSkillRow {
  user_id: string;
  skill_id: string;
  enabled: number;
  agent_overrides: string;
  config: string;
  installed_at: string;
  last_used_at: string | null;
}

export interface SkillRow {
  id: string;
  name: string;
  description: string;
  type: string;
  tier: string;
  category: string;
  compatible_agents: string;
  icon: string;
  tags: string;
  skill_content: string;
  is_active: number;
  created_at: string;
}
