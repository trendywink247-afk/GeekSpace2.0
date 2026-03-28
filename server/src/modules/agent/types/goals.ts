// ============================================================
// Goal System Types — Agentic Experience
// ============================================================

export type GoalStatus = 'active' | 'paused' | 'completed' | 'failed' | 'archived';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'blocked';
export type StepEffort = 'low' | 'medium' | 'high';
export type GoalCategory = 'general' | 'career' | 'health' | 'finance' | 'learning' | 'creative' | 'technical' | 'personal';
export type GoalEventType =
  | 'created' | 'updated' | 'paused' | 'resumed' | 'completed' | 'failed' | 'archived'
  | 'step_created' | 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped'
  | 'agent_assigned' | 'agent_delegated' | 'agent_checkin' | 'agent_insight'
  | 'progress_update' | 'user_note';

export type AnyAgentId = 'weebo' | 'edith' | 'jarvis' | 'aria' | 'forge' | 'pulse' | 'echo' | 'cal' | 'nova';

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: GoalStatus;
  priority: number;
  category: GoalCategory;
  assigned_agent: AnyAgentId;
  target_date: string | null;
  progress: number;
  outcome: string | null;
  parent_goal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalStep {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  description: string;
  status: StepStatus;
  assigned_agent: AnyAgentId;
  step_order: number;
  depends_on: string; // JSON array of step IDs
  effort: StepEffort;
  result: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalEvent {
  id: string;
  goal_id: string;
  user_id: string;
  event_type: GoalEventType;
  agent_id: string | null;
  step_id: string | null;
  message: string;
  metadata: string; // JSON
  created_at: string;
}

export interface WorkspaceArtifact {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  content: string;
  artifact_type: 'note' | 'draft' | 'research' | 'code' | 'plan' | 'analysis';
  created_by_agent: string | null;
  tags: string; // JSON array
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DelegationLogEntry {
  id: string;
  user_id: string;
  goal_id: string | null;
  step_id: string | null;
  from_agent: string;
  to_agent: string;
  task_description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// -- API request/response types --

export interface CreateGoalRequest {
  title: string;
  description?: string;
  category?: GoalCategory;
  target_date?: string;
  priority?: number;
  parent_goal_id?: string;
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  status?: GoalStatus;
  priority?: number;
  category?: GoalCategory;
  target_date?: string | null;
  assigned_agent?: AnyAgentId;
}

export interface CreateStepRequest {
  title: string;
  description?: string;
  assigned_agent?: AnyAgentId;
  effort?: StepEffort;
  depends_on?: string[];
}

export interface GoalWithSteps extends Goal {
  steps: GoalStep[];
  event_count: number;
}

export interface GoalPlan {
  goal: Goal;
  steps: GoalStep[];
  estimated_agents: AnyAgentId[];
  estimated_effort: string;
}
# CI trigger
