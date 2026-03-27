// ============================================================
// Automation module — barrel export + AppModule registration
//
// Groups automation-pipeline routes:
//   /api/automations  — automation CRUD, triggers, webhooks, dead-letters
//   /api/workflows    — multi-step workflow CRUD and runs
//   /api/planner      — daily time-block planner
//   /api/jobs         — async job status polling
//   /api/proactive    — proactive message settings and logs
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export route routers
export { automationsRouter } from '../../routes/automations.js';
export { workflowsRouter } from '../../routes/workflows.js';
export { plannerRouter } from '../../routes/planner.js';
export { jobsRouter } from '../../routes/jobs.js';
export { proactiveRouter } from '../../routes/proactive.js';

// Re-export types
export type {
  // Automations
  AutomationTriggerType,
  AutomationActionType,
  Automation,
  AutomationResponse,
  CreateAutomationBody,
  UpdateAutomationBody,
  AutomationStats,
  AutomationTriggerResult,
  AutomationDryRunResponse,
  WebhookTestResponse,
  DeadLetterEntry,
  AutomationLogStatus,
  // Workflows
  WorkflowTrigger,
  Workflow,
  WorkflowResponse,
  WorkflowStepDef,
  CreateWorkflowBody,
  UpdateWorkflowBody,
  WorkflowRunStatus,
  // Planner
  PlannerCategory,
  PlannerSource,
  PlannerBlock,
  CreatePlannerBlockBody,
  UpdatePlannerBlockBody,
  // Jobs
  JobStatus,
  JobStatusResponse,
  // Proactive
  AutonomyLevel,
  ProactiveSettings,
  UpdateProactiveSettingsBody,
} from './types.js';

// Import routers for module registration
import { automationsRouter } from '../../routes/automations.js';
import { workflowsRouter } from '../../routes/workflows.js';
import { plannerRouter } from '../../routes/planner.js';
import { jobsRouter } from '../../routes/jobs.js';
import { proactiveRouter } from '../../routes/proactive.js';

export const automationModule: AppModule = {
  name: 'automation',

  registerRoutes(app: Application) {
    app.use('/api/automations', automationsRouter);
    app.use('/api/workflows', workflowsRouter);
    app.use('/api/planner', plannerRouter);
    app.use('/api/jobs', jobsRouter);
    app.use('/api/proactive', proactiveRouter);
  },
};
