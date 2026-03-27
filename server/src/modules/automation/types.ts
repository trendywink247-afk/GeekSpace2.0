// ============================================================
// Automation module types
// ============================================================

// ── Automations ─────────────────────────────────────────────

/** Trigger types supported by the automation engine. */
export type AutomationTriggerType = 'manual' | 'webhook' | 'schedule' | 'event';

/** Action types an automation can execute. */
export type AutomationActionType =
  | 'telegram-message'
  | 'whatsapp-message'
  | 'n8n-webhook'
  | 'call_api'
  | 'create_reminder'
  | 'log'
  | string;

/** Row shape returned from the `automations` SQLite table. */
export interface Automation {
  id: string;
  user_id: string;
  name: string;
  description: string;
  trigger_type: AutomationTriggerType;
  trigger_config: string;
  action_type: AutomationActionType;
  action_config: string;
  enabled: number;
  created_at: string;
}

/** Camel-cased automation returned by GET endpoints (enabled normalised to boolean). */
export interface AutomationResponse extends Omit<Automation, 'enabled'> {
  enabled: boolean;
}

/** Body for POST /api/automations. */
export interface CreateAutomationBody {
  name: string;
  description?: string;
  triggerType?: AutomationTriggerType;
  triggerConfig?: Record<string, unknown>;
  actionType?: AutomationActionType;
  actionConfig?: Record<string, unknown>;
}

/** Body for PATCH /api/automations/:id. */
export interface UpdateAutomationBody {
  name?: string;
  description?: string;
  triggerType?: AutomationTriggerType;
  triggerConfig?: Record<string, unknown>;
  actionType?: AutomationActionType;
  actionConfig?: Record<string, unknown>;
  enabled?: boolean;
}

/** Stats returned by GET /api/automations/stats. */
export interface AutomationStats {
  total: number;
  enabled: number;
  disabled: number;
  byTrigger: Array<{ trigger_type: string; cnt: number }>;
  recentRuns: number;
}

/** Result of triggering or testing an automation. */
export interface AutomationTriggerResult {
  success: boolean;
  output: string;
}

/** Dry-run simulation response. */
export interface AutomationDryRunResponse {
  dryRun: true;
  automationId: string;
  automationName: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  simulatedOutput: string;
  enabled: boolean;
}

/** Webhook test-fire response. */
export interface WebhookTestResponse {
  success: boolean;
  statusCode: number;
  message: string;
  latencyMs: number;
  contentType: string;
  responseBody: string;
}

/** Dead-letter entry from the `webhook_dead_letters` table. */
export interface DeadLetterEntry {
  id: string;
  automation_id: string;
  url: string;
  error: string;
  payload: string | null;
  failed_at: number;
  retry_count: number;
  last_error: string | null;
}

/** Automation execution log filter status. */
export type AutomationLogStatus = 'success' | 'failed' | 'error';

// ── Workflows ───────────────────────────────────────────────

/** Workflow trigger type. */
export type WorkflowTrigger = 'manual' | string;

/** Row shape for a user workflow. */
export interface Workflow {
  id: number;
  user_id: string;
  name: string;
  description: string;
  steps: string;
  trigger: WorkflowTrigger;
  enabled: number;
  last_run: number | null;
  created_at: number;
}

/** Parsed workflow returned by API endpoints. */
export interface WorkflowResponse extends Omit<Workflow, 'enabled' | 'steps'> {
  enabled: boolean;
  steps: WorkflowStepDef[];
}

/** Step definition within a workflow (mirrors workflow-runner). */
export interface WorkflowStepDef {
  type: string;
  config: Record<string, unknown>;
}

/** Body for POST /api/workflows. */
export interface CreateWorkflowBody {
  name: string;
  description?: string;
  steps: WorkflowStepDef[];
  trigger?: WorkflowTrigger;
}

/** Body for PATCH /api/workflows/:id. */
export interface UpdateWorkflowBody {
  name?: string;
  description?: string;
  steps?: WorkflowStepDef[];
  trigger?: WorkflowTrigger;
  enabled?: boolean;
}

/** Workflow run status. */
export interface WorkflowRunStatus {
  runId: number;
  status: 'running' | 'done' | 'failed';
}

// ── Planner ─────────────────────────────────────────────────

/** Category for a planner time-block. */
export type PlannerCategory = 'work' | 'personal' | 'health' | 'learning' | string;

/** Source of a planner block. */
export type PlannerSource = 'manual' | 'ai' | 'calendar' | string;

/** Row shape for a planner block. */
export interface PlannerBlock {
  id: string;
  user_id: string;
  date: string;
  title: string;
  duration: number;
  color: string;
  category: PlannerCategory;
  completed: 0 | 1;
  sort_order: number;
  source: PlannerSource;
  source_id: string | null;
  created_at: string;
  updated_at: string | null;
}

/** Body for POST /api/planner. */
export interface CreatePlannerBlockBody {
  title: string;
  date: string;
  duration?: number;
  color?: string;
  category?: PlannerCategory;
  completed?: 0 | 1;
  sort_order?: number;
  source?: PlannerSource;
  source_id?: string | null;
}

/** Body for PATCH /api/planner/:id. */
export interface UpdatePlannerBlockBody {
  title?: string;
  date?: string;
  duration?: number;
  color?: string;
  category?: PlannerCategory;
  completed?: 0 | 1;
  sort_order?: number;
  source?: PlannerSource;
  source_id?: string | null;
}

// ── Jobs ────────────────────────────────────────────────────

/** Job status values. */
export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';

/** Job polling response from GET /api/jobs/:id. */
export interface JobStatusResponse {
  id: string;
  type: string;
  status: JobStatus;
  result?: unknown;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// ── Proactive ───────────────────────────────────────────────

/** Autonomy level for the proactive engine. */
export type AutonomyLevel = 'manual' | 'assisted' | 'proactive' | 'autonomous';

/** Proactive settings response. */
export interface ProactiveSettings {
  enabled: boolean;
  autonomy_level: AutonomyLevel;
  quiet_start: string;
  quiet_end: string;
}

/** Body for PATCH /api/proactive/settings. */
export interface UpdateProactiveSettingsBody {
  autonomy_level?: AutonomyLevel;
  quiet_start?: string;
  quiet_end?: string;
}
