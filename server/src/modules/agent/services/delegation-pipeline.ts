// ============================================================
// Inter-Agent Delegation Pipeline
//
// Agents autonomously hand off work to each other. When an
// agent detects a subtask outside its expertise, it delegates
// to a specialist, waits for the result, and incorporates it
// into its own response.
//
// Pipeline: detect delegation → route to specialist →
//   execute with ReAct → return result → synthesize
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { type ChatMessage } from './llm.js';
import { runReactLoop } from './react-loop.js';
import { getPersonalityPrompt, getPersonality } from '../../../prompts/personalities.js';
import { sendAgentComm, type AgentId } from './agent-comms.js';
import { emitThinking, emitResponding, emitDone, emitDelegation, emitCommSent } from './agent-state-bus.js';
import { parseDelegates, type AgentRole } from './agent-registry.js';
import type { AnyAgentId } from '../types/goals.js';

// ── Types ───────────────────────────────────────────────────

export interface DelegationRequest {
  userId: string;
  fromAgent: AnyAgentId;
  toAgent: AnyAgentId;
  task: string;
  context?: string;
  goalId?: string;
  stepId?: string;
}

export interface DelegationResult {
  id: string;
  fromAgent: AnyAgentId;
  toAgent: AnyAgentId;
  task: string;
  result: string;
  success: boolean;
  durationMs: number;
  narration?: string;
}

// ── Agent Expertise Mapping ─────────────────────────────────

const AGENT_EXPERTISE: Record<AnyAgentId, string[]> = {
  forge: ['code', 'technical', 'debug', 'implement', 'build', 'deploy', 'api', 'database', 'architecture'],
  aria: ['creative', 'design', 'write', 'content', 'brand', 'ux', 'copy', 'story', 'visual'],
  pulse: ['data', 'analytics', 'metrics', 'finance', 'budget', 'numbers', 'report', 'chart', 'roi'],
  nova: ['research', 'learn', 'explore', 'compare', 'history', 'science', 'trend', 'news'],
  echo: ['coach', 'habit', 'motivation', 'wellness', 'mindset', 'growth', 'feedback'],
  cal: ['schedule', 'plan', 'organize', 'prioritize', 'timeline', 'deadline', 'milestone'],
  edith: ['review', 'audit', 'security', 'system', 'admin', 'optimize', 'qa'],
  jarvis: ['automate', 'execute', 'notify', 'integrate', 'webhook', 'monitor', 'email'],
  weebo: ['chat', 'social', 'fun', 'general', 'help', 'support'],
};

// ── Detect Delegation Need ──────────────────────────────────

export function detectDelegationNeed(
  currentAgent: AnyAgentId,
  message: string,
): { shouldDelegate: boolean; targetAgent: AnyAgentId; reason: string } | null {
  const lower = message.toLowerCase();
  const currentExpertise = AGENT_EXPERTISE[currentAgent] || [];

  // Check if message contains keywords outside current agent's expertise
  let bestMatch: { agent: AnyAgentId; score: number; reason: string } | null = null;

  for (const [agentId, keywords] of Object.entries(AGENT_EXPERTISE)) {
    if (agentId === currentAgent) continue;

    let score = 0;
    const matchedKeywords: string[] = [];
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        // Only count if this keyword is NOT in current agent's expertise
        if (!currentExpertise.includes(keyword)) {
          score += keyword.length > 5 ? 2 : 1;
          matchedKeywords.push(keyword);
        }
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = {
        agent: agentId as AnyAgentId,
        score,
        reason: `Detected ${matchedKeywords.join(', ')} — delegating to ${getPersonality(agentId as AnyAgentId).name}`,
      };
    }
  }

  if (bestMatch && bestMatch.score >= 2) {
    return { shouldDelegate: true, targetAgent: bestMatch.agent, reason: bestMatch.reason };
  }

  return null;
}

// ── Execute Delegation ──────────────────────────────────────

export async function executeDelegation(req: DelegationRequest): Promise<DelegationResult> {
  const delegationId = uuid();
  const startTime = Date.now();
  const fromName = getPersonality(req.fromAgent).name;
  const toName = getPersonality(req.toAgent).name;

  logger.info({ delegationId, from: req.fromAgent, to: req.toAgent, task: req.task.slice(0, 100) }, 'delegation:start');

  // Record in delegation_log
  db.prepare(`
    INSERT INTO delegation_log (id, user_id, goal_id, step_id, from_agent, to_agent, task_description, status, started_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', datetime('now'), datetime('now'))
  `).run(delegationId, req.userId, req.goalId || null, req.stepId || null, req.fromAgent, req.toAgent, req.task);

  // Emit real-time events
  emitDelegation(req.userId, req.fromAgent, req.toAgent, req.task);
  emitThinking(req.userId, req.toAgent, `${toName} received task from ${fromName}`);

  // Send inter-agent comm
  const coreFrom = toCoreAgent(req.fromAgent);
  const coreTo = toCoreAgent(req.toAgent);
  sendAgentComm(req.userId, coreFrom, coreTo, `Delegation: ${req.task}`, 'delegation');
  emitCommSent(req.userId, req.fromAgent, req.toAgent, `Task handoff: ${req.task.slice(0, 80)}`);

  try {
    const personalityPrompt = getPersonalityPrompt(req.toAgent);
    const contextBlock = req.context ? `\n\nContext from ${fromName}:\n${req.context}` : '';

    const messages: ChatMessage[] = [{
      role: 'user',
      content: `${fromName} has delegated this task to you:\n\n${req.task}${contextBlock}\n\nProvide your specialist response. Be thorough but concise.`,
    }];

    const result = await runReactLoop(messages, {
      systemPrompt: personalityPrompt,
      userId: req.userId,
      agentName: req.toAgent,
      agentId: req.toAgent,
    });

    emitResponding(req.userId, req.toAgent, `${toName} completed task`);

    // Update delegation_log
    const durationMs = Date.now() - startTime;
    db.prepare("UPDATE delegation_log SET status = 'completed', result = ?, completed_at = datetime('now') WHERE id = ?")
      .run(result.text.slice(0, 2000), delegationId);

    // Send response comm
    sendAgentComm(req.userId, coreTo, coreFrom, `Result: ${result.text.slice(0, 200)}`, 'response');
    emitDone(req.userId, req.toAgent);

    logger.info({ delegationId, durationMs, success: true }, 'delegation:complete');

    // Generate in-character narration for the handoff
    const toP = getPersonality(req.toAgent);
    let narration = '';
    switch (req.fromAgent) {
      case 'weebo':
        narration = `Ooh, this needs ${toP.name}'s expertise! Passing it over~`;
        break;
      case 'edith':
        narration = `Routing to ${toP.name}. They'll handle this.`;
        break;
      case 'jarvis':
        narration = `I've brought in ${toP.name} to assist with this, sir.`;
        break;
      default:
        narration = `Delegating to ${toP.name} — ${toP.description.toLowerCase()}`;
        break;
    }

    return {
      id: delegationId,
      fromAgent: req.fromAgent,
      toAgent: req.toAgent,
      task: req.task,
      result: result.text,
      success: true,
      durationMs,
      narration,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    db.prepare("UPDATE delegation_log SET status = 'failed', result = ?, completed_at = datetime('now') WHERE id = ?")
      .run(errorMsg.slice(0, 1000), delegationId);
    emitDone(req.userId, req.toAgent);

    logger.error({ err, delegationId }, 'delegation:failed');

    return {
      id: delegationId,
      fromAgent: req.fromAgent,
      toAgent: req.toAgent,
      task: req.task,
      result: errorMsg,
      success: false,
      durationMs,
    };
  }
}

// ── Chain Delegation (multi-agent pipeline) ─────────────────

export async function chainDelegation(
  userId: string,
  initialAgent: AnyAgentId,
  tasks: Array<{ agent: AnyAgentId; task: string }>,
  goalId?: string,
): Promise<DelegationResult[]> {
  const results: DelegationResult[] = [];
  let previousContext = '';

  for (const { agent, task } of tasks) {
    const fromAgent = results.length === 0 ? initialAgent : results[results.length - 1].toAgent;
    const result = await executeDelegation({
      userId,
      fromAgent,
      toAgent: agent,
      task,
      context: previousContext,
      goalId,
    });
    results.push(result);

    if (result.success) {
      previousContext = `Previous result from ${getPersonality(result.toAgent).name}:\n${result.result.slice(0, 500)}`;
    } else {
      // Stop chain on failure
      break;
    }
  }

  return results;
}

// ── Parse and Execute Delegations from Agent Response ───────

export async function processAgentDelegations(
  userId: string,
  currentAgent: AnyAgentId,
  agentResponse: string,
  goalId?: string,
): Promise<DelegationResult[]> {
  const delegates = parseDelegates(agentResponse);
  if (delegates.length === 0) return [];

  const results: DelegationResult[] = [];

  // Execute delegations in parallel (up to 3)
  const delegationPromises = delegates.slice(0, 3).map(d =>
    executeDelegation({
      userId,
      fromAgent: currentAgent,
      toAgent: roleToAgent(d.role),
      task: d.task,
      goalId,
    })
  );

  const delegationResults = await Promise.allSettled(delegationPromises);
  for (const settled of delegationResults) {
    if (settled.status === 'fulfilled') {
      results.push(settled.value);
    } else {
      logger.warn({ reason: settled.reason }, 'delegation:rejected');
    }
  }

  return results;
}

// ── Get Delegation History ──────────────────────────────────

export function getDelegationHistory(userId: string, limit = 30): DelegationLogEntry[] {
  const clampedLimit = Math.max(1, Math.min(limit, 100));
  return db.prepare(
    'SELECT * FROM delegation_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, clampedLimit) as DelegationLogEntry[];
}

export function getDelegationStats(userId: string): {
  total: number;
  completed: number;
  failed: number;
  avgDurationMs: number;
  topDelegator: string;
  topReceiver: string;
} {
  const total = (db.prepare('SELECT COUNT(*) as c FROM delegation_log WHERE user_id = ?').get(userId) as { c: number }).c;
  const completed = (db.prepare("SELECT COUNT(*) as c FROM delegation_log WHERE user_id = ? AND status = 'completed'").get(userId) as { c: number }).c;
  const failed = (db.prepare("SELECT COUNT(*) as c FROM delegation_log WHERE user_id = ? AND status = 'failed'").get(userId) as { c: number }).c;

  const topFrom = db.prepare(
    'SELECT from_agent, COUNT(*) as c FROM delegation_log WHERE user_id = ? GROUP BY from_agent ORDER BY c DESC LIMIT 1'
  ).get(userId) as { from_agent: string; c: number } | undefined;

  const topTo = db.prepare(
    'SELECT to_agent, COUNT(*) as c FROM delegation_log WHERE user_id = ? GROUP BY to_agent ORDER BY c DESC LIMIT 1'
  ).get(userId) as { to_agent: string; c: number } | undefined;

  const avgDuration = db.prepare(
    "SELECT AVG((julianday(completed_at) - julianday(started_at)) * 86400000) as avg_ms FROM delegation_log WHERE user_id = ? AND completed_at IS NOT NULL AND started_at IS NOT NULL"
  ).get(userId) as { avg_ms: number | null } | undefined;

  return {
    total,
    completed,
    failed,
    avgDurationMs: Math.round(avgDuration?.avg_ms ?? 0),
    topDelegator: topFrom?.from_agent || 'cal',
    topReceiver: topTo?.to_agent || 'forge',
  };
}

// ── Helpers ─────────────────────────────────────────────────

interface DelegationLogEntry {
  id: string;
  user_id: string;
  from_agent: string;
  to_agent: string;
  task_description: string;
  status: string;
  result: string | null;
  created_at: string;
}

function toCoreAgent(agentId: AnyAgentId): AgentId {
  const mapping: Record<string, AgentId> = {
    weebo: 'weebo', edith: 'edith', jarvis: 'jarvis',
    aria: 'weebo', forge: 'edith', pulse: 'edith',
    echo: 'weebo', cal: 'jarvis', nova: 'jarvis',
  };
  return mapping[agentId] || 'jarvis';
}

function roleToAgent(role: AgentRole): AnyAgentId {
  const mapping: Record<AgentRole, AnyAgentId> = {
    analyst: 'pulse',
    coder: 'forge',
    planner: 'cal',
    researcher: 'nova',
    executor: 'jarvis',
    reviewer: 'edith',
  };
  return mapping[role] || 'cal';
}
