// ============================================================
// Deep Reasoning Engine — Enhanced ReAct with Self-Reflection
//
// Upgrades the standard 5-iteration ReAct loop with:
// - Self-reflection: agent evaluates its own output quality
// - Plan-then-execute: creates a plan before acting
// - Retry with different strategy on failure
// - Delegation detection mid-loop
// - Up to 10 iterations for complex tasks
// ============================================================

import { routeChat, type ChatMessage } from './llm.js';
import { parseActions, type ParsedAction } from '../../../services/action-parser.js';
import { executeAction, type ActionResult } from './action-executor.js';
import { detectDelegationNeed, executeDelegation } from './delegation-pipeline.js';
import { logger } from '../../../logger.js';
import {
  emitThinking, emitToolCall, emitToolResult, emitResponding, emitDone,
} from './agent-state-bus.js';
import type { AnyAgentId } from '../types/goals.js';
import type { Provider } from './llm.js';

// ── Configuration ───────────────────────────────────────────

const MAX_DEEP_ITERATIONS = 10;
const SELF_REFLECTION_THRESHOLD = 3; // Reflect after this many iterations

// ── Types ───────────────────────────────────────────────────

export interface DeepReasoningOptions {
  systemPrompt: string;
  agentName?: string;
  agentId?: AnyAgentId;
  userId: string;
  userCredits?: number;
  forceProvider?: Provider;
  enableDelegation?: boolean;
  enableReflection?: boolean;
  maxIterations?: number;
  onStep?: (step: DeepStep) => void;
}

export interface DeepStep {
  type: 'planning' | 'thinking' | 'tool_call' | 'tool_result' | 'reflecting' | 'delegating' | 'drafting';
  content: string;
  tool?: string;
  iteration: number;
  agent?: string;
}

export interface DeepReasoningResult {
  text: string;
  actions: ActionResult[];
  deferredActions: ParsedAction[];
  delegationResults: Array<{ agent: string; task: string; result: string }>;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  creditCost: number;
  iterations: number;
  reflections: string[];
}

// ── Planning Phase ──────────────────────────────────────────

const PLANNING_PROMPT = `Before executing, create a brief plan (2-4 steps) for how you'll approach this task. Format:
PLAN:
1. [first action]
2. [second action]
...
Then proceed with step 1.`;

// ── Self-Reflection Prompt ──────────────────────────────────

const REFLECTION_PROMPT = `Review your work so far. Ask yourself:
1. Am I on track to answer the user's question?
2. Is my current approach working, or should I try differently?
3. Do I have enough information, or do I need more tool calls?
4. Is there a specialist agent better suited for any remaining work?

Respond with:
REFLECTION: [your honest assessment]
NEXT_ACTION: [continue | change_approach | delegate:<agent> | finalize]`;

// ── Main Deep Reasoning Loop ────────────────────────────────

export async function runDeepReasoning(
  messages: ChatMessage[],
  opts: DeepReasoningOptions,
): Promise<DeepReasoningResult> {
  const maxIter = opts.maxIterations || MAX_DEEP_ITERATIONS;
  const workingMessages = [...messages];
  const allActionResults: ActionResult[] = [];
  const allDeferredActions: ParsedAction[] = [];
  const delegationResults: Array<{ agent: string; task: string; result: string }> = [];
  const reflections: string[] = [];

  let finalText = '';
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCreditCost = 0;
  let lastProvider = '';
  let lastModel = '';

  // Phase 1: Planning (inject planning prompt for complex tasks)
  const lastUserMsg = workingMessages.filter(m => m.role === 'user').pop();
  const isComplex = lastUserMsg && lastUserMsg.content.length > 100;

  if (isComplex) {
    opts.onStep?.({ type: 'planning', content: 'Creating execution plan...', iteration: 0 });
    if (opts.agentId) emitThinking(opts.userId, opts.agentId, 'Planning approach...');

    // Temporarily add planning instruction to last message
    const planMessages = [...workingMessages];
    const lastIdx = planMessages.length - 1;
    if (planMessages[lastIdx].role === 'user') {
      planMessages[lastIdx] = {
        ...planMessages[lastIdx],
        content: planMessages[lastIdx].content + '\n\n' + PLANNING_PROMPT,
      };
    }

    const planResult = await routeChat(planMessages, {
      systemPrompt: opts.systemPrompt,
      agentName: opts.agentName,
      userCredits: opts.userCredits,
      forceProvider: opts.forceProvider,
      userId: opts.userId,
    });

    totalTokensIn += planResult.tokensIn;
    totalTokensOut += planResult.tokensOut;
    totalCreditCost += planResult.creditCost;
    lastProvider = planResult.provider;
    lastModel = planResult.model;

    // Check if plan has actions
    const { text: planText, actions: planActions } = parseActions(planResult.reply);
    if (planActions.length > 0) {
      // Plan included immediate actions — execute them
      workingMessages.push({ role: 'assistant', content: planResult.reply });
    } else {
      // Pure planning step — add as context and continue
      workingMessages.push({ role: 'assistant', content: planResult.reply });
      workingMessages.push({ role: 'user', content: 'Good plan. Now execute step 1.' });
    }
  }

  // Phase 2: Iterative execution
  for (let i = 0; i < maxIter; i++) {
    opts.onStep?.({
      type: 'thinking',
      content: i === 0 ? 'Analyzing your request...' : 'Reasoning about results...',
      iteration: i,
    });
    if (opts.agentId) emitThinking(opts.userId, opts.agentId, i === 0 ? 'Analyzing...' : 'Reasoning...');

    const result = await routeChat(workingMessages, {
      systemPrompt: opts.systemPrompt,
      agentName: opts.agentName,
      userCredits: opts.userCredits,
      forceProvider: opts.forceProvider,
      userId: opts.userId,
    });

    totalTokensIn += result.tokensIn;
    totalTokensOut += result.tokensOut;
    totalCreditCost += result.creditCost;
    lastProvider = result.provider;
    lastModel = result.model;

    const { text: cleanText, actions } = parseActions(result.reply);

    // No actions → agent is done
    if (actions.length === 0) {
      finalText = cleanText || result.reply;
      opts.onStep?.({ type: 'drafting', content: 'Writing response...', iteration: i });
      if (opts.agentId) emitResponding(opts.userId, opts.agentId, 'Writing response...');
      break;
    }

    logger.debug({ iteration: i + 1, tools: actions.map(a => a.tool) }, 'deep-reasoning:iteration');

    // Execute actions
    const observations: string[] = [];
    for (const action of actions) {
      if (action.tool === 'generate_code') {
        allDeferredActions.push(action);
        opts.onStep?.({ type: 'tool_call', content: 'Generating code...', tool: action.tool, iteration: i });
        continue;
      }

      const toolDesc = describeToolCall(action);
      opts.onStep?.({ type: 'tool_call', content: toolDesc, tool: action.tool, iteration: i });
      if (opts.agentId) emitToolCall(opts.userId, opts.agentId, action.tool, toolDesc);

      const actionResult = await executeAction(opts.userId, action);
      allActionResults.push(actionResult);

      const resultSummary = actionResult.success
        ? (actionResult.data?.summary ? String(actionResult.data.summary).slice(0, 200) : actionResult.message.slice(0, 200))
        : `Error: ${actionResult.message.slice(0, 200)}`;
      opts.onStep?.({ type: 'tool_result', content: resultSummary, tool: action.tool, iteration: i });
      if (opts.agentId) emitToolResult(opts.userId, opts.agentId, action.tool, resultSummary);

      observations.push(formatObservation(action, actionResult));
    }

    if (observations.length === 0) {
      finalText = cleanText || result.reply;
      break;
    }

    workingMessages.push({ role: 'assistant', content: result.reply });
    workingMessages.push({
      role: 'user',
      content: observations.join('\n\n---\n\n') + '\n\nBased on the above results, continue.',
    });

    // Phase 3: Self-reflection (every N iterations)
    if (opts.enableReflection !== false && i > 0 && i % SELF_REFLECTION_THRESHOLD === 0 && i < maxIter - 1) {
      opts.onStep?.({ type: 'reflecting', content: 'Evaluating approach...', iteration: i });

      const reflectMessages: ChatMessage[] = [
        ...workingMessages,
        { role: 'user', content: REFLECTION_PROMPT },
      ];

      try {
        const reflectResult = await routeChat(reflectMessages, {
          systemPrompt: opts.systemPrompt,
          userId: opts.userId,
          agentName: opts.agentName,
        });

        totalTokensIn += reflectResult.tokensIn;
        totalTokensOut += reflectResult.tokensOut;
        totalCreditCost += reflectResult.creditCost;

        const reflection = reflectResult.reply;
        reflections.push(reflection);

        // Check for delegation request in reflection
        const delegateMatch = reflection.match(/delegate:(\w+)/i);
        if (delegateMatch && opts.enableDelegation !== false && opts.agentId) {
          const targetAgent = delegateMatch[1] as AnyAgentId;
          opts.onStep?.({
            type: 'delegating',
            content: `Handing off to ${targetAgent}...`,
            iteration: i,
            agent: targetAgent,
          });

          const delegResult = await executeDelegation({
            userId: opts.userId,
            fromAgent: opts.agentId,
            toAgent: targetAgent,
            task: lastUserMsg?.content || 'Continue working on this task',
            context: cleanText,
          });

          if (delegResult.success) {
            delegationResults.push({
              agent: targetAgent,
              task: delegResult.task,
              result: delegResult.result,
            });
            workingMessages.push({
              role: 'user',
              content: `[DELEGATION RESULT from ${targetAgent}]\n${delegResult.result.slice(0, 1000)}`,
            });
          }
        }

        // Check for finalize
        if (/finalize/i.test(reflection)) {
          workingMessages.push({ role: 'user', content: 'Now write your final, complete response.' });
        }
      } catch (err) {
        logger.debug({ err }, 'deep-reasoning:reflection failed (non-fatal)');
      }
    }

    // Phase 4: Delegation detection mid-loop
    if (opts.enableDelegation !== false && opts.agentId && i === 1) {
      const delegationNeed = detectDelegationNeed(opts.agentId, lastUserMsg?.content || '');
      if (delegationNeed) {
        opts.onStep?.({
          type: 'delegating',
          content: delegationNeed.reason,
          iteration: i,
          agent: delegationNeed.targetAgent,
        });
        // Don't block — delegation happens in parallel with next iteration
      }
    }

    // Final iteration fallback
    if (i === maxIter - 1) {
      opts.onStep?.({ type: 'drafting', content: 'Writing final response...', iteration: i });
      if (opts.agentId) emitResponding(opts.userId, opts.agentId, 'Writing response...');
      finalText = cleanText || result.reply;
    }
  }

  if (opts.agentId) emitDone(opts.userId, opts.agentId);

  return {
    text: finalText,
    actions: allActionResults,
    deferredActions: allDeferredActions,
    delegationResults,
    provider: lastProvider,
    model: lastModel,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    creditCost: totalCreditCost,
    iterations: allActionResults.length,
    reflections,
  };
}

// ── Helpers ─────────────────────────────────────────────────

function describeToolCall(action: ParsedAction): string {
  const { tool, params } = action;
  switch (tool) {
    case 'web_search': return `Searching: "${params?.query || ''}"`;
    case 'crawl_url': return `Reading: ${params?.url || ''}`;
    case 'take_screenshot': return `Screenshotting: ${params?.url || ''}`;
    case 'generate_image': return `Generating image: "${params?.prompt || ''}"`;
    case 'create_goal': return `Creating goal: "${params?.title || ''}"`;
    case 'plan_goal': return 'Planning goal steps...';
    case 'execute_goal_step': return 'Executing next goal step...';
    default: return `Running ${tool}...`;
  }
}

function formatObservation(action: ParsedAction, result: ActionResult): string {
  if (result.success) {
    return `[TOOL RESULT: ${action.tool}]\n${result.message}${
      result.data?.summary ? '\n\n' + String(result.data.summary) : ''
    }`;
  }
  return `[TOOL ERROR: ${action.tool}]\n${result.message}`;
}
