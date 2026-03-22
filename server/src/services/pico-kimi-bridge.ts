// ============================================================
// Pico-Kimi Bridge — Orchestration Layer
//
// The intelligence layer between PicoClaw (fast dispatcher) and
// Kimi (deep reasoning). PicoClaw handles triage and simple
// tasks locally. When deeper reasoning, multi-step planning, or
// specialist agents are needed, it escalates to Kimi through
// this bridge.
//
// Flow:
//   1. User message arrives
//   2. PicoClaw triages: simple → handle locally, complex → escalate
//   3. Bridge classifies complexity and selects agent(s)
//   4. If multi-step → creates a workflow (plan → execute → review)
//   5. If single-step → dispatches to the right specialist agent
//   6. Results flow back through the bridge to the user
//
// The bridge maintains conversation context and can spawn
// follow-up tasks based on agent DELEGATES output.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { routeChat, type ChatMessage, type Provider } from './llm.js';
import { edithChat } from './edith.js';
import { isPicoClawAvailable, queryPicoClaw, picoCircuitBreakerTrip, picoCircuitBreakerReset } from './picoclaw.js';
import {
  type AgentRole,
  getAgentDefinition,
  selectAgents,
  parseDelegates,
  tierToProvider,
} from './agent-registry.js';
import {
  createWorkflow,
  addWorkflowStep,
  executeWorkflow,
  getWorkflowStatus,
  type WorkflowStatus,
} from './workflow-engine.js';

// ---- Types ----

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'multi-step';

export interface BridgeRequest {
  userId: string;
  message: string;
  systemPrompt?: string;
  conversationHistory?: ChatMessage[];
  forceAgent?: AgentRole;
  forceWorkflow?: boolean;
  userCredits?: number;
}

export interface BridgeResponse {
  text: string;
  provider: string;
  model: string;
  route: 'pico-direct' | 'kimi-agent' | 'kimi-workflow' | 'hybrid';
  complexity: TaskComplexity;
  agentsUsed: AgentRole[];
  workflowId?: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  creditCost: number;
  steps?: Array<{
    agent: AgentRole;
    status: string;
    summary: string;
  }>;
}

// ---- Complexity Classification ----

const MULTI_STEP_SIGNALS = [
  'and then', 'after that', 'first.*then', 'step by step',
  'multiple', 'several', 'build.*and.*deploy', 'create.*and.*test',
  'plan.*and.*execute', 'research.*and.*implement',
  'set up.*and.*configure', 'design.*and.*build',
];

const COMPLEX_SIGNALS = [
  'architect', 'design system', 'full implementation', 'end to end',
  'comprehensive', 'production ready', 'scalable', 'enterprise',
  'migrate', 'refactor entire', 'overhaul',
];

/**
 * Classify the complexity of a user request.
 * This determines whether PicoClaw handles it directly or escalates to Kimi.
 */
export function classifyComplexity(message: string): TaskComplexity {
  const lower = message.toLowerCase();
  const wordCount = message.split(/\s+/).length;
  const sentenceCount = message.split(/[.!?]+/).filter(s => s.trim()).length;

  // Very short messages are trivial
  if (wordCount <= 5) return 'trivial';

  // Check for multi-step signals
  const multiStepScore = MULTI_STEP_SIGNALS.filter(s => {
    const regex = new RegExp(s, 'i');
    return regex.test(lower);
  }).length;

  if (multiStepScore >= 2 || (multiStepScore >= 1 && wordCount > 40)) {
    return 'multi-step';
  }

  // Check for complex signals
  const complexScore = COMPLEX_SIGNALS.filter(s => lower.includes(s)).length;
  if (complexScore >= 2 || (complexScore >= 1 && wordCount > 60)) {
    return 'complex';
  }

  // Multiple sentences with technical content suggest moderate complexity
  if (sentenceCount >= 3 && wordCount > 25) return 'moderate';

  // Moderate length with some structure
  if (wordCount > 15) return 'simple';

  return 'trivial';
}

/**
 * Determine if PicoClaw should handle this request directly
 * or if it needs to be escalated to Kimi via the bridge.
 */
export function shouldEscalateToKimi(
  message: string,
  complexity: TaskComplexity,
  picoAvailable: boolean,
): boolean {
  // If auto-escalation is disabled, never auto-escalate — only explicit /bridge triggers it
  if (!config.bridgeAutoEscalate) return false;

  // Multi-step and complex always go to Kimi
  if (complexity === 'multi-step' || complexity === 'complex') return true;

  // Moderate goes to Kimi if available, otherwise Pico handles it
  if (complexity === 'moderate') return true;

  // Code/build requests need a capable model — PicoClaw 1.5b can't generate quality code
  const lower = message.toLowerCase();
  if (/\b(?:write|build|create|code|generate|make)\b.*\b(?:function|script|app|website|page|component|api|program|class)\b/i.test(lower) ||
      /\b(?:function|script|app|website|page|component)\b.*\b(?:write|build|create|code|generate|make)\b/i.test(lower)) {
    return true;
  }

  // Long-form content requests need a capable model — PicoClaw truncates at ~256 tokens
  // Covers: workout plans, meal plans, recipes, guides, tutorials, schedules, routines, comparisons, etc.
  if (/\b(?:give|create|make|write|list|provide|share|suggest|recommend)\b.*\b(?:workout|exercise|meal|diet|recipe|plan|routine|schedule|guide|tutorial|steps|comparison|overview|summary|breakdown|split|program|itinerary|roadmap|checklist)\b/i.test(lower) ||
      /\b(?:workout|exercise|meal|diet|recipe|plan|routine|schedule|guide|tutorial|split|program|itinerary|roadmap|checklist)\b.*\b(?:for|to|that)\b/i.test(lower)) {
    return true;
  }

  // Simple can be handled by Pico if available
  if (complexity === 'simple' && picoAvailable) return false;

  // Trivial always stays with Pico/local
  if (complexity === 'trivial') return false;

  // Default: escalate
  return true;
}

// ---- Bridge Core ----

/**
 * Build a context-aware system prompt for a specialist agent.
 * Combines the agent's base prompt with user context and task context.
 */
function buildAgentSystemPrompt(
  agentRole: AgentRole,
  userContext: string,
  taskContext?: string,
  previousResults?: Array<{ agent: string; output: string }>,
): string {
  const agentDef = getAgentDefinition(agentRole);
  let prompt = agentDef.systemPrompt;

  if (userContext) {
    prompt += `\n\n--- USER CONTEXT ---\n${userContext}`;
  }

  if (taskContext) {
    prompt += `\n\n--- TASK CONTEXT ---\n${taskContext}`;
  }

  if (previousResults && previousResults.length > 0) {
    const resultsText = previousResults
      .map(r => `[${r.agent}]: ${r.output.slice(0, 500)}`)
      .join('\n\n');
    prompt += `\n\n--- PREVIOUS AGENT RESULTS ---\n${resultsText}`;
  }

  return prompt;
}

/**
 * Execute a single agent task via the appropriate model.
 */
async function executeAgentTask(
  agentRole: AgentRole,
  input: string,
  systemPrompt: string,
  userCredits: number,
  history?: ChatMessage[],
): Promise<{
  output: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  creditCost: number;
}> {
  const agentDef = getAgentDefinition(agentRole);
  const preferredProvider = tierToProvider(agentDef.preferredTier) as Provider;
  const fallbackProvider = tierToProvider(agentDef.fallbackTier) as Provider;

  const messages: ChatMessage[] = [
    ...(history ?? []),
    { role: 'user', content: input },
  ];

  // Try preferred provider first
  try {
    const result = await routeChat(messages, {
      systemPrompt,
      forceProvider: preferredProvider,
      userCredits,
    });

    return {
      output: result.reply,
      provider: result.provider,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs: result.latencyMs,
      creditCost: Math.ceil(result.creditCost * agentDef.costMultiplier),
    };
  } catch (err) {
    logger.warn({ agentRole, preferredProvider, error: (err as Error).message }, 'Preferred provider failed, trying fallback');

    // Fallback
    const result = await routeChat(messages, {
      systemPrompt,
      forceProvider: fallbackProvider,
      userCredits,
    });

    return {
      output: result.reply,
      provider: result.provider,
      model: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs: result.latencyMs,
      creditCost: Math.ceil(result.creditCost * agentDef.costMultiplier),
    };
  }
}

/**
 * Main bridge entry point. Routes user messages through the
 * Pico-Kimi ecosystem based on complexity analysis.
 */
export async function bridgeChat(req: BridgeRequest): Promise<BridgeResponse> {
  const start = Date.now();
  const { userId, message, systemPrompt, conversationHistory, forceAgent, forceWorkflow, userCredits } = req;

  const complexity = classifyComplexity(message);

  // Bridge skip optimisation: only check PicoClaw availability when the message
  // *might* stay local (trivial/simple). For moderate/complex/multi-step the bridge
  // always escalates, so the availability check is wasted latency (~3s on cold).
  const mightStayLocal = !forceWorkflow && !forceAgent &&
    (complexity === 'trivial' || complexity === 'simple');
  const picoAvailable = mightStayLocal ? await isPicoClawAvailable() : false;
  const escalate = forceWorkflow || forceAgent || shouldEscalateToKimi(message, complexity, picoAvailable);

  logger.info({ userId, complexity, escalate, picoAvailable, mightStayLocal, forceAgent }, 'Pico-Kimi bridge processing');

  // ---- Path 1: PicoClaw handles directly (trivial/simple) ----
  if (!escalate && picoAvailable) {
    try {
      const picoResult = await queryPicoClaw(message, systemPrompt);
      const latencyMs = Date.now() - start;

      // Query succeeded — reset circuit breaker
      picoCircuitBreakerReset();

      // Log the bridge decision
      logBridgeEvent(userId, 'pico-direct', complexity, ['executor'], latencyMs);

      return {
        text: picoResult.text,
        provider: 'picoclaw',
        model: 'picoclaw-haiku',
        route: 'pico-direct',
        complexity,
        agentsUsed: [],
        tokensIn: picoResult.tokensIn,
        tokensOut: picoResult.tokensOut,
        latencyMs,
        creditCost: 1,
      };
    } catch (err) {
      // Trip circuit breaker — after 2 consecutive failures, skip PicoClaw for 5 min
      picoCircuitBreakerTrip();
      logger.warn({ error: (err as Error).message }, 'PicoClaw direct handling failed, escalating to Kimi');
      // Fall through to Kimi escalation
    }
  }

  // ---- Path 2: Single-agent Kimi dispatch ----
  if (!forceWorkflow && (complexity === 'simple' || complexity === 'moderate' || complexity === 'trivial')) {
    const selectedAgents = forceAgent ? [{ role: forceAgent, score: 1 }] : selectAgents(message, 1);
    const primaryAgent = selectedAgents[0];
    const agentPrompt = buildAgentSystemPrompt(
      primaryAgent.role,
      systemPrompt || '',
      undefined,
      undefined,
    );

    const result = await executeAgentTask(
      primaryAgent.role,
      message,
      agentPrompt,
      userCredits || 0,
      conversationHistory,
    );

    const latencyMs = Date.now() - start;

    // Log the bridge decision
    logBridgeEvent(userId, 'kimi-agent', complexity, [primaryAgent.role], latencyMs);

    return {
      text: result.output,
      provider: result.provider,
      model: result.model,
      route: 'kimi-agent',
      complexity,
      agentsUsed: [primaryAgent.role],
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      latencyMs,
      creditCost: result.creditCost,
    };
  }

  // ---- Path 3: Multi-agent workflow (complex/multi-step) ----
  return executeMultiAgentWorkflow(req, complexity, start);
}

/**
 * Execute a multi-agent workflow for complex/multi-step tasks.
 *
 * Workflow pattern:
 *   1. Planner decomposes the task into steps
 *   2. Each step is assigned to the appropriate specialist agent
 *   3. Results from each step feed into the next
 *   4. Reviewer validates the final output
 *   5. Synthesize all results into a coherent response
 */
async function executeMultiAgentWorkflow(
  req: BridgeRequest,
  complexity: TaskComplexity,
  startTime: number,
): Promise<BridgeResponse> {
  const { userId, message, systemPrompt, userCredits } = req;
  const agentsUsed: AgentRole[] = [];
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCreditCost = 0;
  let lastProvider = '';
  let lastModel = '';

  // Step 1: Use Kimi (planner) to decompose the task
  const plannerPrompt = buildAgentSystemPrompt('planner', systemPrompt || '', message);
  const planResult = await executeAgentTask(
    'planner',
    `Decompose this user request into actionable steps:\n\n${message}`,
    plannerPrompt,
    userCredits || 0,
  );
  agentsUsed.push('planner');
  totalTokensIn += planResult.tokensIn;
  totalTokensOut += planResult.tokensOut;
  totalCreditCost += planResult.creditCost;
  lastProvider = planResult.provider;
  lastModel = planResult.model;

  // Create a workflow record
  const workflowId = createWorkflow(userId, message, complexity);
  addWorkflowStep(workflowId, 'planner', message, planResult.output, 'completed');

  // Step 2: Parse delegates from the planner's output
  const delegates = parseDelegates(planResult.output);
  const executionResults: Array<{ agent: string; output: string }> = [
    { agent: 'planner', output: planResult.output },
  ];

  // Step 3: Execute delegated tasks (capped by config)
  const maxDelegates = Math.min(delegates.length, config.bridgeMaxWorkflowSteps);
  for (let i = 0; i < maxDelegates; i++) {
    const delegate = delegates[i];

    // Check if we still have credits
    const remainingCredits = (userCredits || 0) - totalCreditCost;
    if (remainingCredits <= 0) {
      logger.warn({ userId, workflowId }, 'Workflow stopped: out of credits');
      addWorkflowStep(workflowId, delegate.role, delegate.task, 'Skipped: insufficient credits', 'skipped');
      break;
    }

    const agentPrompt = buildAgentSystemPrompt(
      delegate.role,
      systemPrompt || '',
      delegate.task,
      executionResults,
    );

    try {
      const stepResult = await executeAgentTask(
        delegate.role,
        delegate.task,
        agentPrompt,
        remainingCredits,
      );

      agentsUsed.push(delegate.role);
      totalTokensIn += stepResult.tokensIn;
      totalTokensOut += stepResult.tokensOut;
      totalCreditCost += stepResult.creditCost;
      lastProvider = stepResult.provider;
      lastModel = stepResult.model;

      executionResults.push({ agent: delegate.role, output: stepResult.output });
      addWorkflowStep(workflowId, delegate.role, delegate.task, stepResult.output, 'completed');
    } catch (err) {
      const errorMsg = (err as Error).message;
      logger.warn({ agentRole: delegate.role, error: errorMsg }, 'Workflow step failed');
      addWorkflowStep(workflowId, delegate.role, delegate.task, errorMsg, 'failed');
      executionResults.push({ agent: delegate.role, output: `Error: ${errorMsg}` });
    }
  }

  // Step 4: Synthesize all results into a coherent user-facing response
  const synthesisPrompt = `You are synthesizing the results of a multi-agent workflow into a clear, coherent response for the user.

The user asked: "${message}"

Multiple specialist agents worked on this. Combine their outputs into a single, well-organized response.
Do NOT mention agents, workflows, or internal systems. Just present the final answer naturally.
Keep it concise but complete. No markdown bold or headers. Plain conversational text with code blocks where appropriate.`;

  const synthesisInput = executionResults
    .map(r => `[${r.agent} output]:\n${r.output}`)
    .join('\n\n---\n\n');

  const synthesisResult = await executeAgentTask(
    'researcher',  // Use researcher agent for synthesis (good at summarization)
    `Synthesize these specialist outputs into a final response:\n\n${synthesisInput}`,
    synthesisPrompt,
    Math.max(0, (userCredits || 0) - totalCreditCost),
  );

  totalTokensIn += synthesisResult.tokensIn;
  totalTokensOut += synthesisResult.tokensOut;
  totalCreditCost += synthesisResult.creditCost;

  // Complete the workflow
  completeWorkflow(workflowId, 'completed');

  const latencyMs = Date.now() - startTime;

  // Log the bridge decision
  logBridgeEvent(userId, 'kimi-workflow', complexity, agentsUsed, latencyMs, workflowId);

  return {
    text: synthesisResult.output,
    provider: lastProvider,
    model: lastModel,
    route: 'kimi-workflow',
    complexity,
    agentsUsed,
    workflowId,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    latencyMs,
    creditCost: totalCreditCost,
    steps: executionResults.map(r => ({
      agent: r.agent as AgentRole,
      status: 'completed',
      summary: r.output.slice(0, 200),
    })),
  };
}

// ---- Workflow DB helpers ----

function completeWorkflow(workflowId: string, status: string): void {
  try {
    db.prepare(
      "UPDATE workflows SET status = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(status, workflowId);
  } catch (err) {
    logger.warn({ workflowId, error: (err as Error).message }, 'Failed to complete workflow');
  }
}

// ---- Logging ----

function logBridgeEvent(
  userId: string,
  route: string,
  complexity: TaskComplexity,
  agents: AgentRole[],
  latencyMs: number,
  workflowId?: string,
): void {
  try {
    db.prepare(`
      INSERT INTO bridge_events (id, user_id, route, complexity, agents_used, workflow_id, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), userId, route, complexity, JSON.stringify(agents), workflowId || null, latencyMs);
  } catch (err) {
    // Table might not exist yet during first run — log but don't crash
    logger.debug({ error: (err as Error).message }, 'Failed to log bridge event (table may not exist yet)');
  }
}

// ---- Public API for workflow status ----

export function getBridgeWorkflowStatus(workflowId: string, userId: string): WorkflowStatus | null {
  return getWorkflowStatus(workflowId, userId);
}

/**
 * Get recent bridge events for a user (for analytics/debugging).
 */
export function getRecentBridgeEvents(userId: string, limit = 20): unknown[] {
  try {
    return db.prepare(
      'SELECT * FROM bridge_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(userId, limit);
  } catch {
    return [];
  }
}
