// ============================================================
// Proactive Goal Engine — Autonomous Goal Pursuit
//
// Runs on a schedule (integrated with the proactive engine)
// to autonomously check in on goals, execute next steps,
// send progress updates, and nudge users when goals stall.
// ============================================================

import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import {
  getActionableGoals, executeNextStep, proactiveGoalCheckIn,
  getUserGoals, getGoalSteps, recordGoalEvent,
} from './goal-service.js';
import { sendAgentNotification } from './agent-notifications.js';
import { executeDelegation, detectDelegationNeed } from './delegation-pipeline.js';
import { emitThinking, emitDone } from './agent-state-bus.js';
import type { AnyAgentId } from '../types/goals.js';

// ── Configuration ───────────────────────────────────────────

const MAX_AUTO_STEPS_PER_CYCLE = 2;    // Max steps to auto-execute per user per cycle
const GOAL_CHECK_INTERVAL_MS = 30 * 60_000; // 30 minutes
const STALE_GOAL_DAYS = 3;              // Nudge if no progress in N days

let proactiveGoalTimer: ReturnType<typeof setInterval> | null = null;

// ── Autonomy Level Check ────────────────────────────────────

type AutonomyLevel = 'manual' | 'suggest' | 'semi_auto' | 'full_auto';

const VALID_AUTONOMY_LEVELS: Set<string> = new Set(['manual', 'suggest', 'semi_auto', 'full_auto']);

function getUserAutonomyLevel(userId: string): AutonomyLevel {
  try {
    const config = db.prepare('SELECT autonomy_level FROM agent_configs WHERE user_id = ?')
      .get(userId) as { autonomy_level: string | null } | undefined;
    const level = config?.autonomy_level;
    if (level && VALID_AUTONOMY_LEVELS.has(level)) return level as AutonomyLevel;
    return 'suggest';
  } catch {
    return 'suggest';
  }
}

// ── Main Proactive Cycle ────────────────────────────────────

let isCycleRunning = false;

export async function runGoalProactiveCycle(): Promise<void> {
  if (isCycleRunning) return; // Prevent overlapping cycles
  isCycleRunning = true;

  try {
    let users: Array<{ id: string }> = [];
    try {
      users = db.prepare("SELECT id FROM users WHERE proactive_enabled != 0").all() as Array<{ id: string }>;
    } catch {
      users = db.prepare("SELECT id FROM users").all() as Array<{ id: string }>;
    }

    for (const user of users) {
      try {
        await processUserGoals(user.id);
      } catch (err) {
        logger.warn({ err, userId: user.id }, 'proactive-goals:cycle failed for user');
      }
    }
  } finally {
    isCycleRunning = false;
  }
}

async function processUserGoals(userId: string): Promise<void> {
  const autonomy = getUserAutonomyLevel(userId);
  if (autonomy === 'manual') return;

  const activeGoals = getUserGoals(userId, 'active', 10);
  if (activeGoals.length === 0) return;

  // 1. Send check-ins for stale goals
  await sendStaleGoalNudges(userId);

  // 2. Auto-execute steps (only in semi_auto or full_auto mode)
  if (autonomy === 'semi_auto' || autonomy === 'full_auto') {
    await autoExecuteSteps(userId);
  }

  // 3. Send progress updates (daily)
  await sendDailyGoalSummary(userId);
}

// ── Stale Goal Nudges ───────────────────────────────────────

async function sendStaleGoalNudges(userId: string): Promise<void> {
  const activeGoals = getUserGoals(userId, 'active', 10);
  const staleThreshold = new Date(Date.now() - STALE_GOAL_DAYS * 86_400_000).toISOString();

  for (const goal of activeGoals) {
    if (goal.updated_at > staleThreshold) continue;

    // Check if we already nudged recently
    const recentNudge = db.prepare(
      "SELECT id FROM goal_events WHERE goal_id = ? AND event_type = 'agent_checkin' AND created_at > datetime('now', '-1 day') LIMIT 1"
    ).get(goal.id) as { id: string } | undefined;
    if (recentNudge) continue;

    const steps = getGoalSteps(goal.id);
    const pending = steps.filter(s => s.status === 'pending');
    const agent = goal.assigned_agent as AnyAgentId;

    emitThinking(userId, agent, `Checking in on: "${goal.title}"`);

    const nudgeMessage = pending.length > 0
      ? `Hey! Your goal "${goal.title}" hasn't had progress in ${STALE_GOAL_DAYS} days. Next step: "${pending[0].title}". Want me to work on it?`
      : `Your goal "${goal.title}" is ${goal.progress}% complete but hasn't moved recently. Need help getting unstuck?`;

    recordGoalEvent(goal.id, userId, 'agent_checkin', agent, null, nudgeMessage);

    // Send via notification service (respects notif_agents + quiet hours)
    await sendAgentNotification(userId, agent, 'checkin', 'Goal check-in', nudgeMessage, { actionUrl: `/goals/${goal.id}` })
      .catch(() => { /* non-critical */ });

    emitDone(userId, agent);
    logger.info({ userId, goalId: goal.id }, 'proactive-goals:stale-nudge sent');
  }
}

// ── Auto-Execute Steps ──────────────────────────────────────

async function autoExecuteSteps(userId: string): Promise<void> {
  const actionable = getActionableGoals(userId);
  let stepsExecuted = 0;

  for (const { goal, nextStep } of actionable) {
    if (stepsExecuted >= MAX_AUTO_STEPS_PER_CYCLE) break;

    // Only auto-execute low/medium effort steps
    if (nextStep.effort === 'high') continue;

    try {
      const result = await executeNextStep(goal.id, userId);
      if (result) {
        stepsExecuted++;
        logger.info({ userId, goalId: goal.id, stepId: result.id }, 'proactive-goals:auto-executed step');
      }
    } catch (err) {
      logger.warn({ err, goalId: goal.id }, 'proactive-goals:auto-execute failed');
    }
  }
}

// ── Daily Goal Summary ──────────────────────────────────────

async function sendDailyGoalSummary(userId: string): Promise<void> {
  // Only send once per day
  const todayKey = new Date().toISOString().slice(0, 10);
  try {
    const alreadySent = db.prepare(
      "SELECT id FROM goal_events WHERE user_id = ? AND event_type = 'agent_insight' AND message LIKE ? AND created_at > datetime('now', 'start of day') LIMIT 1"
    ).get(userId, `%daily_summary:${todayKey}%`) as { id: string } | undefined;
    if (alreadySent) return;
  } catch { /* table may not exist yet */ }

  const activeGoals = getUserGoals(userId, 'active', 10);
  if (activeGoals.length === 0) return;

  const lines = activeGoals.slice(0, 5).map(g => {
    const emoji = g.progress >= 75 ? '🟢' : g.progress >= 25 ? '🟡' : '🔴';
    return `${emoji} ${g.title}: ${g.progress}%`;
  });

  const summary = `📊 Daily Goal Summary:\n${lines.join('\n')}`;

  // Record as event on first active goal
  recordGoalEvent(activeGoals[0].id, userId, 'agent_insight', 'cal', null,
    `daily_summary:${todayKey}\n${summary}`);

  // Send via notification service (respects notif_agents + quiet hours)
  try {
    await sendAgentNotification(userId, 'cal', 'agent_insight', 'Daily Goal Summary', summary);
  } catch { /* non-critical */ }
}

// ── Initialize Proactive Goal Engine ────────────────────────

export function initProactiveGoalEngine(): void {
  if (proactiveGoalTimer) return;

  proactiveGoalTimer = setInterval(() => {
    void runGoalProactiveCycle().catch(err =>
      logger.warn({ err }, 'proactive-goals:cycle error')
    );
  }, GOAL_CHECK_INTERVAL_MS);

  logger.info({ intervalMs: GOAL_CHECK_INTERVAL_MS }, 'Proactive goal engine started');
}

export function stopProactiveGoalEngine(): void {
  if (proactiveGoalTimer) {
    clearInterval(proactiveGoalTimer);
    proactiveGoalTimer = null;
  }
}
