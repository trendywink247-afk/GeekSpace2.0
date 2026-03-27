// ============================================================
// Unified Agent Router — Single Entry Point for All Agent Messages
//
// Replaces the fragmented routing across 6 different files:
//   agent.ts, message-router.ts, multi-agent-orchestrator.ts,
//   pico-kimi-bridge.ts, react-loop.ts, picoclaw.ts
//
// One router, one decision tree, one response format.
// Supports @mention routing, per-agent memory, and delegation.
// ============================================================

import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { getPersonalityPrompt, getPersonality, type Personality } from '../../../prompts/personalities.js';
import { getMemories } from '../../../services/memory.js';
import { emitThinking, emitDone, emitToolCall, emitResponding } from './agent-state-bus.js';

// ── Types ───────────────────────────────────────────────────

export type CoreAgentId = 'weebo' | 'edith' | 'jarvis';
export type AnyAgentId = CoreAgentId | 'aria' | 'forge' | 'pulse' | 'echo' | 'cal' | 'nova';

export interface AgentRouteInput {
  userId: string;
  message: string;
  channel: 'web' | 'telegram' | 'whatsapp' | 'voice' | 'terminal' | 'builder';
  mentionedAgents?: AnyAgentId[];
  conversationId?: string;
  existingArtifactId?: string;
}

export interface AgentRouteResult {
  text: string;
  agentId: AnyAgentId;
  agentName: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  creditCost: number;
  latencyMs: number;
  toolSteps: ToolStep[];
  delegations: Delegation[];
  actionResults: ActionResultSummary[];
}

export interface ToolStep {
  tool: string;
  status: 'running' | 'done' | 'error';
  content: string;
  durationMs?: number;
}

export interface Delegation {
  fromAgent: AnyAgentId;
  toAgent: AnyAgentId;
  reason: string;
}

export interface ActionResultSummary {
  tool: string;
  success: boolean;
  previewUrl?: string;
  artifactId?: string;
}

// ── Core agent definitions ──────────────────────────────────

const CORE_AGENTS: CoreAgentId[] = ['weebo', 'edith', 'jarvis'];

const AGENT_DOMAINS: Record<CoreAgentId, string[]> = {
  weebo: ['creative', 'social', 'chat', 'fun', 'design', 'image', 'video'],
  edith: ['code', 'technical', 'system', 'health', 'terminal', 'debug', 'review'],
  jarvis: ['calendar', 'reminder', 'email', 'schedule', 'productivity', 'organize', 'plan'],
};

// ── @Mention Parsing ────────────────────────────────────────

/**
 * Parse @mentions from a message. Supports:
 * - @weebo, @edith, @jarvis (core agents)
 * - @aria, @forge, @pulse, @echo, @cal, @nova (specialists — routed through core)
 * - "hey weebo", "edith:", "ask jarvis" (natural language)
 */
export function parseMentions(message: string): {
  mentionedAgents: AnyAgentId[];
  cleanMessage: string;
} {
  const allAgents: AnyAgentId[] = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];
  const mentioned: Set<AnyAgentId> = new Set();

  let clean = message;

  // Pattern 1: @agent
  for (const agent of allAgents) {
    const atPattern = new RegExp(`@${agent}\\b`, 'gi');
    if (atPattern.test(message)) {
      mentioned.add(agent);
      clean = clean.replace(atPattern, '').trim();
    }
  }

  // Pattern 2: "hey agent" / "agent:" / "ask agent"
  for (const agent of allAgents) {
    const naturalPattern = new RegExp(
      `(?:^|\\s)(?:hey|hi|ask|tell)\\s+${agent}\\b|^${agent}\\s*[,:]+`, 'i'
    );
    if (naturalPattern.test(message)) {
      mentioned.add(agent);
      // Don't clean natural mentions — they're part of the intent
    }
  }

  return {
    mentionedAgents: [...mentioned],
    cleanMessage: clean.trim() || message.trim(),
  };
}

// ── Agent Selection ─────────────────────────────────────────

/**
 * Determine which agent should handle this message.
 * Priority:
 *   1. Explicit @mention → that agent
 *   2. Domain detection → best-fit agent
 *   3. User's default agent (from agent_configs)
 *   4. Fallback to 'jarvis'
 */
export function selectAgent(
  input: AgentRouteInput,
  userDefaultAgent?: CoreAgentId,
): { primaryAgent: AnyAgentId; isMultiAgent: boolean } {
  // 1. Explicit mentions
  const { mentionedAgents } = parseMentions(input.message);
  const allMentions = [...(input.mentionedAgents || []), ...mentionedAgents];

  if (allMentions.length === 1) {
    return { primaryAgent: allMentions[0], isMultiAgent: false };
  }
  if (allMentions.length > 1) {
    return { primaryAgent: allMentions[0], isMultiAgent: true };
  }

  // 2. Channel-based routing
  if (input.channel === 'terminal') return { primaryAgent: 'edith', isMultiAgent: false };
  if (input.channel === 'builder') return { primaryAgent: 'forge', isMultiAgent: false };

  // 3. Domain detection from message content
  const lower = input.message.toLowerCase();
  for (const [agentId, domains] of Object.entries(AGENT_DOMAINS)) {
    const domainMatch = domains.some(d => lower.includes(d));
    if (domainMatch) {
      return { primaryAgent: agentId as CoreAgentId, isMultiAgent: false };
    }
  }

  // 4. User's default agent
  return {
    primaryAgent: userDefaultAgent || 'jarvis',
    isMultiAgent: false,
  };
}

// ── Per-Agent Memory Context ────────────────────────────────

/**
 * Build memory context filtered by agent namespace.
 * Falls back to shared memories if agent has no namespace-specific memories.
 */
export function buildAgentMemoryContext(userId: string, agentId: AnyAgentId, query?: string): string {
  // Try agent-specific memories first
  const agentMemories = getAgentNamespacedMemories(userId, agentId, 10);
  const sharedMemories = getAgentNamespacedMemories(userId, 'shared', 10);

  const allMemories = [...agentMemories, ...sharedMemories];
  if (allMemories.length === 0) return '';

  // Deduplicate by key
  const seen = new Set<string>();
  const unique = allMemories.filter(m => {
    const k = `${m.category}:${m.key}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const lines = unique.slice(0, 15).map(m => `- [${m.category}] ${m.key}: ${m.value}`);
  return `\n--- ${getPersonality(agentId).name}'s MEMORY ---\n${lines.join('\n')}`;
}

function getAgentNamespacedMemories(
  userId: string,
  namespace: string,
  limit: number,
): Array<{ category: string; key: string; value: string }> {
  try {
    // Try new namespaced column first
    return db.prepare(
      'SELECT category, key, value FROM agent_memory WHERE user_id = ? AND agent_namespace = ? ORDER BY updated_at DESC LIMIT ?'
    ).all(userId, namespace, limit) as Array<{ category: string; key: string; value: string }>;
  } catch {
    // Fallback: column doesn't exist yet, return all memories
    if (namespace === 'shared') {
      return db.prepare(
        'SELECT category, key, value FROM agent_memory WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?'
      ).all(userId, limit) as Array<{ category: string; key: string; value: string }>;
    }
    return [];
  }
}

// ── Specialist Sub-Agent Resolution ─────────────────────────

/**
 * If a specialist is mentioned, resolve to the parent core agent
 * that should spawn it. Specialists are invisible to the user.
 */
const SPECIALIST_PARENT: Record<string, CoreAgentId> = {
  aria: 'weebo',   // Creative → Weebo
  forge: 'edith',  // Builder → Edith
  pulse: 'edith',  // Analyst → Edith
  echo: 'weebo',   // Coach → Weebo
  cal: 'jarvis',   // Organizer → Jarvis
  nova: 'jarvis',  // Explorer → Jarvis
};

export function resolveSpecialist(agentId: AnyAgentId): {
  coreAgent: CoreAgentId;
  specialist: AnyAgentId | null;
} {
  if (CORE_AGENTS.includes(agentId as CoreAgentId)) {
    return { coreAgent: agentId as CoreAgentId, specialist: null };
  }
  return {
    coreAgent: SPECIALIST_PARENT[agentId] || 'jarvis',
    specialist: agentId,
  };
}

// ── User's Default Agent ────────────────────────────────────

export function getUserDefaultAgent(userId: string): CoreAgentId {
  try {
    const config = db.prepare(
      'SELECT personality FROM agent_configs WHERE user_id = ?'
    ).get(userId) as { personality: string } | undefined;
    const pid = config?.personality || 'jarvis';
    if (CORE_AGENTS.includes(pid as CoreAgentId)) return pid as CoreAgentId;
    return 'jarvis';
  } catch {
    return 'jarvis';
  }
}

// ── Agent Autocomplete (for @mention UI) ────────────────────

export interface AgentAutocompleteItem {
  id: AnyAgentId;
  name: string;
  emoji: string;
  description: string;
  isCore: boolean;
}

export function getAgentAutocompleteList(): AgentAutocompleteItem[] {
  const items: AgentAutocompleteItem[] = [];
  const allIds: AnyAgentId[] = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

  for (const id of allIds) {
    const p = getPersonality(id);
    items.push({
      id,
      name: p.name,
      emoji: p.emoji,
      description: p.description,
      isCore: CORE_AGENTS.includes(id as CoreAgentId),
    });
  }

  // Core agents first, then specialists
  items.sort((a, b) => (b.isCore ? 1 : 0) - (a.isCore ? 1 : 0));
  return items;
}

// ── Classify Message Complexity ─────────────────────────────

export type MessageComplexity = 'greeting' | 'simple' | 'tool_use' | 'multi_step' | 'multi_agent';

export function classifyMessageComplexity(message: string): MessageComplexity {
  const lower = message.toLowerCase().trim();

  // Greeting
  if (/^(hi|hello|hey|sup|yo|namaste|good\s+(morning|afternoon|evening)|what's up)[\s!?.]*$/i.test(lower)) {
    return 'greeting';
  }

  // Multi-agent (explicit requests)
  if (/\b(all agents|team response|launch mode|multi.agent|get all perspectives)\b/i.test(lower)) {
    return 'multi_agent';
  }

  // Multi-step (workflow-like)
  if (/\b(research.{5,}and\s+(create|write|draft|build)|step\s+1.+step\s+2|first.+then.+finally)\b/i.test(lower)) {
    return 'multi_step';
  }

  // Tool use (action-oriented)
  if (/\b(remind|search|generate|create|send|schedule|set|build|make|find|check|list|show)\b/i.test(lower)) {
    return 'tool_use';
  }

  return 'simple';
}

// ── Export summary for routes ───────────────────────────────

export function getRouterInfo(): {
  coreAgents: CoreAgentId[];
  agentDomains: Record<CoreAgentId, string[]>;
  specialistParents: Record<string, CoreAgentId>;
} {
  return {
    coreAgents: CORE_AGENTS,
    agentDomains: AGENT_DOMAINS,
    specialistParents: SPECIALIST_PARENT,
  };
}
