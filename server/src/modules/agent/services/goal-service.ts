// ============================================================
// Goal Service — CRUD + Planning + Autonomous Step Execution
//
// The core of the agentic experience. Goals are user-defined
// objectives that agents decompose into steps, pursue
// autonomously, and report progress on.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { routeChat, type ChatMessage } from './llm.js';
import { getPersonalityPrompt } from '../../../prompts/personalities.js';
import { emitThinking, emitResponding, emitDone, emitDelegation } from './agent-state-bus.js';
import { sendAgentComm } from './agent-comms.js';
import {
  notifyGoalProgress, notifyStepCompleted, sendAgentNotification,
} from './agent-notifications.js';
import type {
  Goal, GoalStep, GoalEvent, GoalWithSteps, GoalPlan,
  GoalStatus, StepStatus, GoalCategory, GoalEventType,
  AnyAgentId, CreateGoalRequest, UpdateGoalRequest, CreateStepRequest,
  WorkspaceArtifact, DelegationLogEntry,
} from '../types/goals.js';

// ── Agent-to-domain mapping for auto-assignment ─────────────

const CATEGORY_AGENTS: Record<GoalCategory, AnyAgentId> = {
  general: 'cal',
  career: 'echo',
  health: 'echo',
  finance: 'pulse',
  learning: 'nova',
  creative: 'aria',
  technical: 'forge',
  personal: 'weebo',
};

// ── Goal CRUD ───────────────────────────────────────────────

export function createGoal(userId: string, req: CreateGoalRequest): Goal {
  const id = uuid();
  const now = new Date().toISOString();
  const category = req.category || 'general';
  const assignedAgent = CATEGORY_AGENTS[category] || 'cal';

  db.prepare(`
    INSERT INTO goals (id, user_id, title, description, category, assigned_agent, target_date, priority, parent_goal_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, req.title, req.description || '', category, assignedAgent, req.target_date || null, req.priority || 5, req.parent_goal_id || null, now, now);

  recordGoalEvent(id, userId, 'created', assignedAgent, null, `Goal created: "${req.title}"`);
  logger.info({ userId, goalId: id, title: req.title, agent: assignedAgent }, 'goal:created');
  return getGoal(id)!;
}

export function getGoal(goalId: string): Goal | null {
  return (db.prepare('SELECT * FROM goals WHERE id = ?').get(goalId) as Goal) || null;
}

export function getGoalWithSteps(goalId: string, userId?: string): GoalWithSteps | null {
  const goal = getGoal(goalId);
  if (!goal) return null;
  if (userId && goal.user_id !== userId) return null;

  const steps = db.prepare('SELECT * FROM goal_steps WHERE goal_id = ? ORDER BY step_order ASC').all(goalId) as GoalStep[];
  const eventCount = (db.prepare('SELECT COUNT(*) as c FROM goal_events WHERE goal_id = ?').get(goalId) as { c: number }).c;

  return { ...goal, steps, event_count: eventCount };
}

export function getUserGoals(userId: string, status?: GoalStatus, limit = 50): Goal[] {
  if (status) {
    return db.prepare('SELECT * FROM goals WHERE user_id = ? AND status = ? ORDER BY priority DESC, updated_at DESC LIMIT ?')
      .all(userId, status, limit) as Goal[];
  }
  return db.prepare('SELECT * FROM goals WHERE user_id = ? AND status != ? ORDER BY priority DESC, updated_at DESC LIMIT ?')
    .all(userId, 'archived', limit) as Goal[];
}

export function updateGoal(goalId: string, userId: string, updates: UpdateGoalRequest): Goal | null {
  const goal = getGoal(goalId);
  if (!goal || goal.user_id !== userId) return null;

  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const params: (string | number | null)[] = [now];

  if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title); }
  if (updates.description !== undefined) { fields.push('description = ?'); params.push(updates.description); }
  if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status); }
  if (updates.priority !== undefined) { fields.push('priority = ?'); params.push(updates.priority); }
  if (updates.category !== undefined) { fields.push('category = ?'); params.push(updates.category); }
  if (updates.target_date !== undefined) { fields.push('target_date = ?'); params.push(updates.target_date); }
  if (updates.assigned_agent !== undefined) { fields.push('assigned_agent = ?'); params.push(updates.assigned_agent); }

  params.push(goalId);
  db.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  if (updates.status && updates.status !== goal.status) {
    recordGoalEvent(goalId, userId, updates.status as GoalEventType, goal.assigned_agent, null,
      `Goal status changed: ${goal.status} → ${updates.status}`);
  }

  return getGoal(goalId);
}

export function deleteGoal(goalId: string, userId: string): boolean {
  const result = db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(goalId, userId);
  return result.changes > 0;
}

// ── Goal Steps CRUD ─────────────────────────────────────────

export function addStep(goalId: string, userId: string, req: CreateStepRequest): GoalStep | null {
  const goal = getGoal(goalId);
  if (!goal || goal.user_id !== userId) return null;

  const id = uuid();
  const now = new Date().toISOString();
  const maxOrder = (db.prepare('SELECT MAX(step_order) as m FROM goal_steps WHERE goal_id = ?').get(goalId) as { m: number | null }).m ?? -1;

  db.prepare(`
    INSERT INTO goal_steps (id, goal_id, user_id, title, description, assigned_agent, step_order, depends_on, effort, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, goalId, userId, req.title, req.description || '', req.assigned_agent || goal.assigned_agent,
    maxOrder + 1, JSON.stringify(req.depends_on || []), req.effort || 'medium', now, now);

  recordGoalEvent(goalId, userId, 'step_created', req.assigned_agent || goal.assigned_agent, id, `Step added: "${req.title}"`);
  recalculateProgress(goalId);
  return getStep(id);
}

export function getStep(stepId: string): GoalStep | null {
  return (db.prepare('SELECT * FROM goal_steps WHERE id = ?').get(stepId) as GoalStep) || null;
}

export function getGoalSteps(goalId: string): GoalStep[] {
  return db.prepare('SELECT * FROM goal_steps WHERE goal_id = ? ORDER BY step_order ASC').all(goalId) as GoalStep[];
}

export function updateStepStatus(stepId: string, userId: string, status: StepStatus, result?: string): GoalStep | null {
  const step = getStep(stepId);
  if (!step || step.user_id !== userId) return null;

  const now = new Date().toISOString();
  const updates: Record<string, string | null> = { status, updated_at: now };
  if (status === 'in_progress' && !step.started_at) updates.started_at = now;
  if (status === 'completed' || status === 'failed') updates.completed_at = now;
  if (result !== undefined) updates.result = result;

  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE goal_steps SET ${fields} WHERE id = ?`).run(...Object.values(updates), stepId);

  const eventType = `step_${status}` as GoalEventType;
  recordGoalEvent(step.goal_id, userId, eventType, step.assigned_agent, stepId, `Step "${step.title}": ${status}${result ? ` — ${result}` : ''}`);
  recalculateProgress(step.goal_id);

  // Auto-complete goal if all steps done
  const steps = getGoalSteps(step.goal_id);
  const allDone = steps.length > 0 && steps.every(s => s.status === 'completed' || s.status === 'skipped');
  if (allDone) {
    const goal = getGoal(step.goal_id);
    db.prepare("UPDATE goals SET status = 'completed', progress = 100, updated_at = ? WHERE id = ?").run(now, step.goal_id);
    recordGoalEvent(step.goal_id, userId, 'completed', step.assigned_agent, null, 'All steps completed — goal achieved!');

    // Celebration notification
    if (goal) {
      sendAgentNotification(userId, goal.assigned_agent as AnyAgentId, 'celebration',
        'Goal achieved!', `Congratulations! "${goal.title}" is complete. All ${steps.length} steps done.`,
        { actionUrl: `/goals/${goal.id}`, sendTelegram: true },
      ).catch(() => { /* non-critical */ });
    }
  }

  // Notify step completion
  if (status === 'completed') {
    const goal = getGoal(step.goal_id);
    if (goal) {
      notifyStepCompleted(userId, step.assigned_agent as AnyAgentId, step.title, goal.title)
        .catch(() => { /* non-critical */ });
    }
  }

  return getStep(stepId);
}

function recalculateProgress(goalId: string): void {
  const steps = getGoalSteps(goalId);
  if (steps.length === 0) return;
  const done = steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  const oldGoal = getGoal(goalId);
  const progress = Math.round((done / steps.length) * 100);
  db.prepare('UPDATE goals SET progress = ?, updated_at = ? WHERE id = ?').run(progress, new Date().toISOString(), goalId);

  // Fire milestone notifications at 25%, 50%, 75%, 100%
  if (oldGoal) {
    const oldProgress = oldGoal.progress;
    const milestones = [25, 50, 75, 100];
    for (const milestone of milestones) {
      if (progress >= milestone && oldProgress < milestone) {
        // Fire-and-forget notification (don't block progress update)
        notifyGoalProgress(oldGoal.user_id, oldGoal.assigned_agent as AnyAgentId, oldGoal.title, milestone, goalId)
          .catch(() => { /* non-critical */ });
        break; // Only one notification per recalculation
      }
    }
  }
}

// ── Goal Events ─────────────────────────────────────────────

export function recordGoalEvent(
  goalId: string, userId: string, eventType: GoalEventType,
  agentId: AnyAgentId | string | null, stepId: string | null, message: string,
  metadata: Record<string, unknown> = {},
): GoalEvent {
  const id = uuid();
  db.prepare(`
    INSERT INTO goal_events (id, goal_id, user_id, event_type, agent_id, step_id, message, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, goalId, userId, eventType, agentId, stepId, message, JSON.stringify(metadata));
  return db.prepare('SELECT * FROM goal_events WHERE id = ?').get(id) as GoalEvent;
}

export function getGoalEvents(goalId: string, limit = 50): GoalEvent[] {
  return db.prepare('SELECT * FROM goal_events WHERE goal_id = ? ORDER BY created_at DESC LIMIT ?').all(goalId, limit) as GoalEvent[];
}

// ── AI-Powered Goal Planning ────────────────────────────────

const PLAN_SYSTEM_PROMPT = `You are Cal, the planning specialist in the Agentin AI team.
Your job is to decompose a user's goal into concrete, actionable steps.

For each step, specify:
- title: short action item (imperative verb)
- description: 1-2 sentences of detail
- agent: which specialist should handle it (weebo, edith, jarvis, aria, forge, pulse, echo, cal, nova)
- effort: low, medium, or high
- depends_on: step numbers this depends on (0-indexed), or empty array

Agent roles:
- cal: scheduling, organization, planning
- forge: coding, technical implementation
- aria: creative writing, design, content
- pulse: data analysis, metrics, finance
- nova: research, exploration, learning
- echo: coaching, habits, motivation
- edith: system admin, reviews, oversight
- jarvis: automation, execution, productivity
- weebo: social, fun, general assistance

Respond ONLY with valid JSON:
{
  "steps": [
    { "title": "...", "description": "...", "agent": "...", "effort": "...", "depends_on": [] }
  ],
  "estimated_duration": "...",
  "key_risks": ["..."]
}`;

export async function planGoal(goalId: string, userId: string): Promise<GoalPlan | null> {
  const goal = getGoal(goalId);
  if (!goal || goal.user_id !== userId) return null;

  emitThinking(userId, 'cal', `Planning steps for: "${goal.title}"`);

  const messages: ChatMessage[] = [{
    role: 'user',
    content: `Decompose this goal into 3-8 actionable steps:\n\nGoal: ${goal.title}\nDescription: ${goal.description || 'No additional details'}\nCategory: ${goal.category}\nTarget date: ${goal.target_date || 'No deadline set'}`,
  }];

  try {
    const result = await routeChat(messages, {
      systemPrompt: PLAN_SYSTEM_PROMPT,
      userId,
      agentName: 'cal',
    });

    emitResponding(userId, 'cal', 'Creating step plan...');

    // Parse JSON from response
    const jsonMatch = result.reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ goalId }, 'goal:plan failed to parse JSON');
      emitDone(userId, 'cal');
      return null;
    }

    const plan = JSON.parse(jsonMatch[0]) as {
      steps: Array<{ title: string; description: string; agent: AnyAgentId; effort: string; depends_on: number[] }>;
      estimated_duration: string;
      key_risks: string[];
    };

    // Atomic re-plan: clear old pending steps + insert new ones in a transaction
    const createdSteps: GoalStep[] = [];
    const stepIdMap: Record<number, string> = {};
    const agents = [...new Set(plan.steps.map(s => s.agent))];

    const runPlanTransaction = db.transaction(() => {
      // Remove old pending/planned steps (preserve completed/in_progress)
      db.prepare("DELETE FROM goal_steps WHERE goal_id = ? AND status = 'pending'").run(goalId);

      // First pass: generate all step IDs
      for (let i = 0; i < plan.steps.length; i++) {
        stepIdMap[i] = uuid();
      }

      // Second pass: insert steps with resolved dependencies
      for (let i = 0; i < plan.steps.length; i++) {
        const s = plan.steps[i];
        const stepId = stepIdMap[i];
        const dependsOn = (s.depends_on || []).map(idx => stepIdMap[idx]).filter(Boolean);
        const now = new Date().toISOString();

        db.prepare(`
          INSERT INTO goal_steps (id, goal_id, user_id, title, description, assigned_agent, step_order, depends_on, effort, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(stepId, goalId, userId, s.title, s.description || '', s.agent || 'cal', i, JSON.stringify(dependsOn), s.effort || 'medium', now, now);
      }

      // Update goal with assigned agent
      if (agents.length > 0) {
        db.prepare('UPDATE goals SET assigned_agent = ?, updated_at = ? WHERE id = ?')
          .run(agents[0], new Date().toISOString(), goalId);
      }
    });

    runPlanTransaction();

    // Fetch created steps outside transaction
    for (let i = 0; i < plan.steps.length; i++) {
      createdSteps.push(getStep(stepIdMap[i])!);
    }

    recordGoalEvent(goalId, userId, 'updated', 'cal', null,
      `Cal planned ${createdSteps.length} steps. Estimated: ${plan.estimated_duration || 'unknown'}. Risks: ${(plan.key_risks || []).join(', ') || 'none identified'}`,
      { estimated_duration: plan.estimated_duration || 'unknown', key_risks: plan.key_risks || [] });

    recalculateProgress(goalId);
    emitDone(userId, 'cal');

    logger.info({ goalId, stepCount: createdSteps.length, agents }, 'goal:planned');

    return {
      goal: getGoal(goalId)!,
      steps: createdSteps,
      estimated_agents: agents as AnyAgentId[],
      estimated_effort: plan.estimated_duration,
    };
  } catch (err) {
    logger.error({ err, goalId }, 'goal:plan failed');
    emitDone(userId, 'cal');
    return null;
  }
}

// ── Autonomous Step Execution ───────────────────────────────

export async function executeNextStep(goalId: string, userId: string): Promise<GoalStep | null> {
  const steps = getGoalSteps(goalId);
  const goal = getGoal(goalId);
  if (!goal || goal.status !== 'active') return null;
  if (goal.user_id !== userId) return null;

  // Find the next actionable step (pending + all dependencies met)
  const completedIds = new Set(steps.filter(s => s.status === 'completed' || s.status === 'skipped').map(s => s.id));
  const nextStep = steps.find(s => {
    if (s.status !== 'pending') return false;
    const deps: string[] = JSON.parse(s.depends_on || '[]');
    return deps.every(depId => completedIds.has(depId));
  });

  if (!nextStep) return null;

  // Atomic claim: only one caller can claim this step (prevents race conditions)
  const now = new Date().toISOString();
  const claimed = db.prepare(
    "UPDATE goal_steps SET status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'"
  ).run(now, now, nextStep.id);
  if (claimed.changes === 0) return null; // Another caller already claimed it
  const agent = nextStep.assigned_agent as AnyAgentId;

  emitThinking(userId, agent, `Working on: "${nextStep.title}"`);
  emitDelegation(userId, 'cal', agent, nextStep.title);

  // Log delegation
  const delegationId = uuid();
  db.prepare(`
    INSERT INTO delegation_log (id, user_id, goal_id, step_id, from_agent, to_agent, task_description, status, started_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?, datetime('now'))
  `).run(delegationId, userId, goalId, nextStep.id, 'cal', agent, nextStep.title, new Date().toISOString());

  // Send inter-agent communication
  sendAgentComm(userId, 'jarvis' as 'weebo' | 'edith' | 'jarvis', (agent === 'weebo' || agent === 'edith' || agent === 'jarvis' ? agent : 'jarvis') as 'weebo' | 'edith' | 'jarvis',
    `Cal delegated: "${goal.title}" — step: ${nextStep.title}`, 'delegation');

  try {
    const personalityPrompt = getPersonalityPrompt(agent);
    const messages: ChatMessage[] = [{
      role: 'user',
      content: `You are working on a goal step autonomously.\n\nGoal: ${goal.title}\nStep: ${nextStep.title}\nDescription: ${nextStep.description}\n\nProvide a concise result of completing this step. Be specific and actionable. If this step produces an artifact (code, plan, analysis), include it.`,
    }];

    const result = await routeChat(messages, {
      systemPrompt: personalityPrompt,
      userId,
      agentName: agent,
    });

    emitResponding(userId, agent, `Completed: "${nextStep.title}"`);
    updateStepStatus(nextStep.id, userId, 'completed', result.reply.slice(0, 2000));

    // Save result as workspace artifact if substantial
    if (result.reply.length > 200) {
      createWorkspaceArtifact(userId, goalId, `Step result: ${nextStep.title}`, result.reply, 'note', agent);
    }

    // Update delegation log
    db.prepare("UPDATE delegation_log SET status = 'completed', result = ?, completed_at = ? WHERE id = ?")
      .run(result.reply.slice(0, 1000), new Date().toISOString(), delegationId);

    emitDone(userId, agent);
    logger.info({ goalId, stepId: nextStep.id, agent }, 'goal:step-executed');
    return getStep(nextStep.id);
  } catch (err) {
    logger.error({ err, goalId, stepId: nextStep.id }, 'goal:step-execution-failed');
    updateStepStatus(nextStep.id, userId, 'failed', String(err));
    db.prepare("UPDATE delegation_log SET status = 'failed', result = ?, completed_at = ? WHERE id = ?")
      .run(String(err).slice(0, 1000), new Date().toISOString(), delegationId);
    emitDone(userId, agent);
    return getStep(nextStep.id);
  }
}

// ── Workspace Artifacts ─────────────────────────────────────

export function createWorkspaceArtifact(
  userId: string, goalId: string | null, title: string, content: string,
  artifactType: WorkspaceArtifact['artifact_type'] = 'note', createdByAgent?: string,
): WorkspaceArtifact {
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO workspace_artifacts (id, user_id, goal_id, title, content, artifact_type, created_by_agent, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, goalId, title, content, artifactType, createdByAgent || null, now, now);
  return db.prepare('SELECT * FROM workspace_artifacts WHERE id = ?').get(id) as WorkspaceArtifact;
}

export function getWorkspaceArtifacts(userId: string, goalId?: string, limit = 30): WorkspaceArtifact[] {
  if (goalId) {
    return db.prepare('SELECT * FROM workspace_artifacts WHERE user_id = ? AND goal_id = ? ORDER BY updated_at DESC LIMIT ?')
      .all(userId, goalId, limit) as WorkspaceArtifact[];
  }
  return db.prepare('SELECT * FROM workspace_artifacts WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?')
    .all(userId, limit) as WorkspaceArtifact[];
}

export function updateWorkspaceArtifact(artifactId: string, userId: string, content: string, title?: string): WorkspaceArtifact | null {
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE workspace_artifacts SET content = ?, title = COALESCE(?, title), version = version + 1, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(content, title || null, now, artifactId, userId);
  if (result.changes === 0) return null;
  return db.prepare('SELECT * FROM workspace_artifacts WHERE id = ?').get(artifactId) as WorkspaceArtifact;
}

export function deleteWorkspaceArtifact(artifactId: string, userId: string): boolean {
  return db.prepare('DELETE FROM workspace_artifacts WHERE id = ? AND user_id = ?').run(artifactId, userId).changes > 0;
}

// ── Goal Statistics ─────────────────────────────────────────

export function getGoalStats(userId: string): {
  total: number;
  active: number;
  completed: number;
  paused: number;
  avgProgress: number;
  topAgent: string;
} {
  const rows = db.prepare('SELECT status, COUNT(*) as c FROM goals WHERE user_id = ? GROUP BY status').all(userId) as Array<{ status: string; c: number }>;
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = r.c;

  const avgProgress = (db.prepare("SELECT AVG(progress) as avg FROM goals WHERE user_id = ? AND status = 'active'").get(userId) as { avg: number | null })?.avg ?? 0;

  const topAgentRow = db.prepare(
    "SELECT assigned_agent, COUNT(*) as c FROM goals WHERE user_id = ? AND status = 'completed' GROUP BY assigned_agent ORDER BY c DESC LIMIT 1"
  ).get(userId) as { assigned_agent: string; c: number } | undefined;

  return {
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    active: counts.active || 0,
    completed: counts.completed || 0,
    paused: counts.paused || 0,
    avgProgress: Math.round(avgProgress),
    topAgent: topAgentRow?.assigned_agent || 'cal',
  };
}

// ── Proactive Goal Check-in ─────────────────────────────────

export async function proactiveGoalCheckIn(userId: string): Promise<string | null> {
  const activeGoals = getUserGoals(userId, 'active', 5);
  if (activeGoals.length === 0) return null;

  // Find goals that haven't had a check-in in the last 24h
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const staleGoals = activeGoals.filter(g => {
    const lastEvent = db.prepare(
      "SELECT created_at FROM goal_events WHERE goal_id = ? AND event_type = 'agent_checkin' ORDER BY created_at DESC LIMIT 1"
    ).get(g.id) as { created_at: string } | undefined;
    return !lastEvent || lastEvent.created_at < dayAgo;
  });

  if (staleGoals.length === 0) return null;

  const goal = staleGoals[0];
  const steps = getGoalSteps(goal.id);
  const pendingSteps = steps.filter(s => s.status === 'pending' || s.status === 'in_progress');
  const completedSteps = steps.filter(s => s.status === 'completed');

  const checkInMessage = [
    `📋 Goal check-in: "${goal.title}"`,
    `Progress: ${goal.progress}% (${completedSteps.length}/${steps.length} steps)`,
    pendingSteps.length > 0 ? `Next up: ${pendingSteps[0].title}` : 'All steps planned are done!',
    goal.target_date ? `Target: ${goal.target_date}` : '',
  ].filter(Boolean).join('\n');

  recordGoalEvent(goal.id, userId, 'agent_checkin', goal.assigned_agent, null, checkInMessage);
  logger.info({ userId, goalId: goal.id }, 'goal:proactive-checkin');
  return checkInMessage;
}

// ── Get next actionable goals for proactive execution ───────

export function getActionableGoals(userId: string): Array<{ goal: Goal; nextStep: GoalStep }> {
  const activeGoals = getUserGoals(userId, 'active', 10);
  const actionable: Array<{ goal: Goal; nextStep: GoalStep }> = [];

  for (const goal of activeGoals) {
    const steps = getGoalSteps(goal.id);
    const completedIds = new Set(steps.filter(s => s.status === 'completed' || s.status === 'skipped').map(s => s.id));
    const nextStep = steps.find(s => {
      if (s.status !== 'pending') return false;
      const deps: string[] = JSON.parse(s.depends_on || '[]');
      return deps.every(depId => completedIds.has(depId));
    });
    if (nextStep) {
      actionable.push({ goal, nextStep });
    }
  }

  return actionable;
}
