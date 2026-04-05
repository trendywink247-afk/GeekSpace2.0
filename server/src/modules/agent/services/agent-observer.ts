/**
 * Agent Observer — Autonomous Observation → Reasoning → Action loop
 *
 * Replaces hardcoded proactive rules with LLM-driven autonomous reasoning.
 * Every cycle:
 *  1. OBSERVE: Gather signals from goals, habits, reminders, health, activity
 *  2. REASON: Ask PicoClaw (fast, free) whether to act and what to do
 *  3. ACT: Execute the decision (notify, execute goal step, suggest, or wait)
 *
 * This is what makes the agent *truly* agentic — it reasons about whether
 * to act, rather than following hardcoded rules.
 *
 * Integrates with the existing proactive-goals.ts and proactive-engine.ts
 * but adds the LLM reasoning layer on top.
 *
 * @module services/agent-observer
 */

import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { isPicoClawAvailable, queryPicoClaw } from '../../../services/picoclaw.js';
import { routeChat, type ChatMessage } from './llm.js';
import { getActionableGoals, getUserGoals, getGoalSteps, executeNextStep } from './goal-service.js';
import { sendAgentNotification, type NotificationType } from './agent-notifications.js';
import { emitThinking, emitDone } from './agent-state-bus.js';
import { logActivity } from '../../../services/activity-log.js';
import type { AnyAgentId } from '../types/goals.js';

// ── Types ────────────────────────────────────────────────────

interface Signal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  summary: string;
  data?: Record<string, unknown>;
}

interface ObserverDecision {
  action: 'notify' | 'execute_step' | 'suggest' | 'celebrate' | 'wait';
  agent: AnyAgentId;
  reason: string;
  message: string;
  goalId?: string;
  notificationType?: NotificationType;
}

// ── Configuration ────────────────────────────────────────────

const OBSERVER_INTERVAL_MS = 30 * 60_000;  // 30 minutes
const MAX_ACTIONS_PER_CYCLE = 3;            // Don't overwhelm the user
const STALE_GOAL_DAYS = 3;
const HABIT_IDLE_DAYS = 2;

let observerTimer: ReturnType<typeof setInterval> | null = null;
let isCycleRunning = false;

// ── Autonomy Check ───────────────────────────────────────────

type AutonomyLevel = 'manual' | 'suggest' | 'semi_auto' | 'full_auto';

function getUserAutonomyLevel(userId: string): AutonomyLevel {
  try {
    const config = db.prepare('SELECT autonomy_level FROM agent_configs WHERE user_id = ?')
      .get(userId) as { autonomy_level: string | null } | undefined;
    const level = config?.autonomy_level;
    if (level && ['manual', 'suggest', 'semi_auto', 'full_auto'].includes(level)) {
      return level as AutonomyLevel;
    }
    return 'suggest';
  } catch {
    return 'suggest';
  }
}

function isThrottled(userId: string): boolean {
  try {
    const dayAgo = Date.now() - 86_400_000;
    const todayCount = (db.prepare(
      'SELECT COUNT(*) as c FROM agent_notifications WHERE user_id = ? AND created_at > datetime(?, \'unixepoch\')'
    ).get(userId, Math.floor(dayAgo / 1000)) as { c: number })?.c ?? 0;
    return todayCount >= 8; // Max 8 notifications per day
  } catch {
    return false;
  }
}

function isQuietHours(userId: string): boolean {
  try {
    const config = db.prepare('SELECT quiet_start, quiet_end, timezone FROM agent_configs ac JOIN users u ON u.id = ac.user_id WHERE ac.user_id = ?')
      .get(userId) as { quiet_start: string | null; quiet_end: string | null; timezone: string | null } | undefined;
    if (!config?.quiet_start || !config?.quiet_end) return false;
    const tz = config.timezone || 'Asia/Kolkata';
    const [startH, startM] = config.quiet_start.split(':').map(Number);
    const [endH, endM] = config.quiet_end.split(':').map(Number);
    let nowH: number, nowM: number;
    try {
      const nowStr = new Date().toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false });
      const parts = nowStr.split(':');
      nowH = parseInt(parts[0], 10);
      nowM = parseInt(parts[1], 10);
    } catch {
      nowH = new Date().getUTCHours();
      nowM = new Date().getUTCMinutes();
    }
    const nowMin = nowH * 60 + nowM;
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin;
  } catch {
    return false;
  }
}

// ── Signal Gathering (OBSERVE) ───────────────────────────────

function gatherSignals(userId: string): Signal[] {
  const signals: Signal[] = [];
  const now = Date.now();

  // 1. Stale goals (no progress in N days)
  try {
    const goals = getUserGoals(userId, 'active', 10);
    const staleThreshold = now - STALE_GOAL_DAYS * 86_400_000;
    for (const goal of goals) {
      const updatedAt = new Date(goal.updated_at).getTime();
      if (updatedAt < staleThreshold) {
        const steps = getGoalSteps(goal.id);
        const pending = steps.filter(s => s.status === 'pending');
        signals.push({
          type: 'stale_goal',
          severity: 'medium',
          summary: `Goal "${goal.title}" hasn't had progress in ${Math.floor((now - updatedAt) / 86_400_000)} days. ${pending.length} steps pending.`,
          data: { goalId: goal.id, title: goal.title, progress: goal.progress, pendingSteps: pending.length, agent: goal.assigned_agent },
        });
      }
    }

    // 2. Goals near completion (high progress, could celebrate)
    for (const goal of goals) {
      if (goal.progress >= 75 && goal.progress < 100) {
        signals.push({
          type: 'goal_almost_done',
          severity: 'low',
          summary: `Goal "${goal.title}" is ${goal.progress}% complete — almost there!`,
          data: { goalId: goal.id, title: goal.title, progress: goal.progress },
        });
      }
    }
  } catch { /* goals table may not exist */ }

  // 3. Actionable goal steps (ready to execute)
  try {
    const actionable = getActionableGoals(userId);
    if (actionable.length > 0) {
      const top = actionable[0];
      signals.push({
        type: 'actionable_step',
        severity: 'low',
        summary: `Goal "${top.goal.title}" has a ready step: "${top.nextStep.title}" (effort: ${top.nextStep.effort || 'unknown'})`,
        data: { goalId: top.goal.id, stepTitle: top.nextStep.title, effort: top.nextStep.effort },
      });
    }
  } catch { /* non-fatal */ }

  // 4. Overdue reminders
  try {
    const overdue = db.prepare(`
      SELECT text, scheduled_for FROM reminders
      WHERE user_id = ? AND completed = 0 AND scheduled_for < ?
      ORDER BY scheduled_for ASC LIMIT 3
    `).all(userId, now) as Array<{ text: string; scheduled_for: number }>;

    for (const r of overdue) {
      const hoursOverdue = Math.floor((now - r.scheduled_for) / 3_600_000);
      signals.push({
        type: 'overdue_reminder',
        severity: hoursOverdue > 24 ? 'high' : 'medium',
        summary: `Reminder "${r.text}" is ${hoursOverdue}h overdue`,
        data: { text: r.text, hoursOverdue },
      });
    }
  } catch { /* non-fatal */ }

  // 5. Habit streaks at risk
  try {
    const habits = db.prepare(`
      SELECT h.id, h.name, h.streak,
        (SELECT MAX(logged_at) FROM habit_logs WHERE habit_id = h.id) as last_logged
      FROM habits h
      WHERE h.user_id = ? AND h.streak > 0
    `).all(userId) as Array<{ id: number; name: string; streak: number; last_logged: string | null }>;

    for (const h of habits) {
      if (h.last_logged) {
        const lastLogged = new Date(h.last_logged).getTime();
        const daysSince = (now - lastLogged) / 86_400_000;
        if (daysSince >= HABIT_IDLE_DAYS && h.streak > 2) {
          signals.push({
            type: 'streak_at_risk',
            severity: h.streak > 7 ? 'high' : 'medium',
            summary: `"${h.name}" streak (${h.streak} days) at risk — not logged in ${Math.floor(daysSince)} days`,
            data: { habitName: h.name, streak: h.streak, daysSince: Math.floor(daysSince) },
          });
        }
      }
    }
  } catch { /* habits table may not exist */ }

  // 6. User idle (no messages in 48h+ but has active goals)
  try {
    const lastMsg = db.prepare(`
      SELECT created_at FROM conversation_log
      WHERE user_id = ? AND role = 'user'
      ORDER BY created_at DESC LIMIT 1
    `).get(userId) as { created_at: string } | undefined;

    if (lastMsg) {
      const hoursSinceMsg = (now - new Date(lastMsg.created_at).getTime()) / 3_600_000;
      if (hoursSinceMsg > 48) {
        const activeGoals = getUserGoals(userId, 'active', 1);
        if (activeGoals.length > 0) {
          signals.push({
            type: 'user_idle',
            severity: 'low',
            summary: `User hasn't chatted in ${Math.floor(hoursSinceMsg)}h but has ${activeGoals.length} active goal(s)`,
            data: { hoursSince: Math.floor(hoursSinceMsg) },
          });
        }
      }
    }
  } catch { /* non-fatal */ }

  // 7. Unread notifications piling up
  try {
    const unreadCount = (db.prepare(
      'SELECT COUNT(*) as c FROM agent_notifications WHERE user_id = ? AND read = 0'
    ).get(userId) as { c: number }).c;

    if (unreadCount > 10) {
      signals.push({
        type: 'unread_pileup',
        severity: 'low',
        summary: `${unreadCount} unread notifications — user may be disengaged`,
        data: { count: unreadCount },
      });
    }
  } catch { /* non-fatal */ }

  return signals;
}

// ── LLM Reasoning (REASON) ───────────────────────────────────

async function reasonAboutSignals(userId: string, signals: Signal[], autonomy: AutonomyLevel): Promise<ObserverDecision[]> {
  if (signals.length === 0) return [];

  // If PicoClaw isn't available, fall back to rule-based
  if (!(await isPicoClawAvailable())) {
    return reasonWithRules(signals, autonomy);
  }

  const signalSummary = signals
    .map((s, i) => `${i + 1}. [${s.severity}] ${s.type}: ${s.summary}`)
    .join('\n');

  const autonomyInstruction = {
    manual: 'User wants manual control. Only suggest, never execute.',
    suggest: 'User wants suggestions. Notify about important things, suggest actions, but do not execute.',
    semi_auto: 'User allows semi-auto. You can execute low-effort goal steps. Notify for medium/high effort.',
    full_auto: 'User allows full autonomy. Execute goal steps, send updates, take action proactively.',
  }[autonomy];

  const prompt = `You are an AI agent assistant observing a user's data. Based on these signals, decide what action(s) to take.

User autonomy level: ${autonomy}
${autonomyInstruction}

Current signals:
${signalSummary}

For each signal worth acting on, respond with a JSON array of actions. Max ${MAX_ACTIONS_PER_CYCLE} actions.
Each action: {"action":"notify|execute_step|suggest|celebrate|wait","agent":"weebo|forge|aria|pulse|echo|cal|edith|jarvis|nova","reason":"why","message":"user-facing message","goalId":"if applicable"}

If no action needed, respond: []

JSON only, no markdown:`;

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are an AI agent assistant. Respond with a JSON array only, no markdown.' },
      { role: 'user', content: prompt },
    ];
    const result = await routeChat(messages, { userId, forceProvider: 'groq' as any });
    const jsonMatch = result.reply.match(/\[\s\S]*\]/);
    if (jsonMatch) {
      const decisions = JSON.parse(jsonMatch[0]) as ObserverDecision[];
      return decisions
        .filter(d => d.action && d.message)
        .slice(0, MAX_ACTIONS_PER_CYCLE);
    }
  } catch (err) {
    logger.debug({ err }, 'agent-observer: LLM reasoning failed, using rules');
  }

  return reasonWithRules(signals, autonomy);
}

// ── Rule-Based Fallback (when PicoClaw is unavailable) ───────

function reasonWithRules(signals: Signal[], autonomy: AutonomyLevel): ObserverDecision[] {
  const decisions: ObserverDecision[] = [];

  for (const signal of signals) {
    if (decisions.length >= MAX_ACTIONS_PER_CYCLE) break;

    switch (signal.type) {
      case 'stale_goal': {
        const agent = (signal.data?.agent as AnyAgentId) || 'weebo';
        if (autonomy === 'full_auto' || autonomy === 'semi_auto') {
          decisions.push({
            action: 'suggest',
            agent,
            reason: signal.summary,
            message: `Your goal "${signal.data?.title}" hasn't moved in a while. Next step has ${signal.data?.pendingSteps} items pending — want me to tackle one?`,
            goalId: signal.data?.goalId as string,
            notificationType: 'checkin',
          });
        } else if (autonomy === 'suggest') {
          decisions.push({
            action: 'notify',
            agent,
            reason: signal.summary,
            message: `Heads up: "${signal.data?.title}" hasn't had progress in ${STALE_GOAL_DAYS}+ days.`,
            goalId: signal.data?.goalId as string,
            notificationType: 'checkin',
          });
        }
        break;
      }

      case 'streak_at_risk': {
        if (signal.severity === 'high' || autonomy !== 'manual') {
          decisions.push({
            action: 'notify',
            agent: 'echo',
            reason: signal.summary,
            message: `Your "${signal.data?.habitName}" streak (${signal.data?.streak} days) is at risk! Don't break it now.`,
            notificationType: 'checkin',
          });
        }
        break;
      }

      case 'overdue_reminder': {
        decisions.push({
          action: 'notify',
          agent: 'cal',
          reason: signal.summary,
          message: `Overdue: "${signal.data?.text}" — was due ${signal.data?.hoursOverdue}h ago.`,
          notificationType: 'anomaly',
        });
        break;
      }

      case 'goal_almost_done': {
        decisions.push({
          action: 'celebrate',
          agent: 'weebo',
          reason: signal.summary,
          message: `You're so close! "${signal.data?.title}" is ${signal.data?.progress}% done. Let's finish this!`,
          goalId: signal.data?.goalId as string,
          notificationType: 'goal_progress',
        });
        break;
      }

      case 'actionable_step': {
        if (autonomy === 'full_auto') {
          decisions.push({
            action: 'execute_step',
            agent: 'forge',
            reason: signal.summary,
            message: `Auto-executing: "${signal.data?.stepTitle}" for your goal.`,
            goalId: signal.data?.goalId as string,
          });
        }
        break;
      }

      // user_idle and unread_pileup: only act on high autonomy
      case 'user_idle': {
        if (autonomy === 'full_auto' || autonomy === 'semi_auto') {
          decisions.push({
            action: 'suggest',
            agent: 'weebo',
            reason: signal.summary,
            message: `Hey! Haven't heard from you in a while. You have active goals — want me to update you on progress?`,
            notificationType: 'checkin',
          });
        }
        break;
      }
    }
  }

  return decisions;
}

// ── Action Execution (ACT) ───────────────────────────────────

async function executeDecision(userId: string, decision: ObserverDecision): Promise<void> {
  const agent = decision.agent || 'weebo';

  switch (decision.action) {
    case 'notify':
    case 'suggest':
    case 'celebrate': {
      emitThinking(userId, agent, decision.reason);

      await sendAgentNotification(
        userId,
        agent,
        decision.notificationType || 'agent_insight',
        decision.action === 'celebrate' ? '🎉 Almost There!' : 'Agent Update',
        decision.message,
        decision.goalId ? { actionUrl: `/goals/${decision.goalId}` } : undefined,
      );

      logActivity(userId, `${agent} observed`, decision.message.slice(0, 80), '🔭');
      emitDone(userId, agent);
      break;
    }

    case 'execute_step': {
      if (!decision.goalId) break;
      emitThinking(userId, agent, `Auto-executing goal step...`);

      try {
        const result = await executeNextStep(decision.goalId, userId);
        if (result) {
          await sendAgentNotification(userId, agent, 'step_completed',
            'Step auto-completed',
            `Completed "${result.title}" for your goal.`,
            { actionUrl: `/goals/${decision.goalId}` },
          );
          logActivity(userId, `${agent} auto-executed`, `Completed step: ${result.title}`, '⚡');
        }
      } catch (err) {
        logger.warn({ err, userId, goalId: decision.goalId }, 'agent-observer: step execution failed');
      }

      emitDone(userId, agent);
      break;
    }

    case 'wait':
    default:
      // Do nothing — the LLM decided to wait
      break;
  }
}

// ── Main Observation Cycle ───────────────────────────────────

async function runObservationCycle(): Promise<void> {
  if (isCycleRunning) return;
  isCycleRunning = true;

  try {
    let users: Array<{ id: string }> = [];
    try {
      users = db.prepare('SELECT id FROM users WHERE proactive_enabled != 0').all() as Array<{ id: string }>;
    } catch {
      users = db.prepare('SELECT id FROM users').all() as Array<{ id: string }>;
    }

    for (const user of users) {
      try {
        await observeUser(user.id);
      } catch (err) {
        logger.debug({ err, userId: user.id }, 'agent-observer: user cycle failed');
      }
    }
  } finally {
    isCycleRunning = false;
  }
}

async function observeUser(userId: string): Promise<void> {
  const autonomy = getUserAutonomyLevel(userId);
  if (autonomy === 'manual') return;
  if (isThrottled(userId)) return;
  if (isQuietHours(userId)) return;

  // 1. OBSERVE
  const signals = gatherSignals(userId);
  if (signals.length === 0) return;

  logger.debug({ userId, signalCount: signals.length, signals: signals.map(s => s.type) }, 'agent-observer: signals gathered');

  // 2. REASON
  const decisions = await reasonAboutSignals(userId, signals, autonomy);
  if (decisions.length === 0) return;

  logger.info({ userId, decisions: decisions.map(d => `${d.action}:${d.agent}`) }, 'agent-observer: decisions made');

  // 3. ACT
  for (const decision of decisions) {
    try {
      await executeDecision(userId, decision);
    } catch (err) {
      logger.warn({ err, userId, decision: decision.action }, 'agent-observer: action failed');
    }
  }
}

// ── Lifecycle ────────────────────────────────────────────────

export function initAgentObserver(): void {
  if (observerTimer) return;

  observerTimer = setInterval(() => {
    void runObservationCycle().catch(err =>
      logger.warn({ err }, 'agent-observer: cycle error')
    );
  }, OBSERVER_INTERVAL_MS);

  logger.info({ intervalMs: OBSERVER_INTERVAL_MS }, 'Agent Observer started (LLM-driven proactive reasoning)');
}

export function stopAgentObserver(): void {
  if (observerTimer) {
    clearInterval(observerTimer);
    observerTimer = null;
  }
}

// Export for testing
export { gatherSignals, reasonAboutSignals, observeUser };
