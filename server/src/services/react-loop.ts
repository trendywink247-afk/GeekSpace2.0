// ============================================================
// ReAct Loop — Multi-turn Tool-Use Reasoning
//
// Runs up to MAX_REACT_ITERATIONS of: LLM → parse actions →
// execute actions → inject observations → repeat.
// Returns when no actions in response or max iterations hit.
// Supports onStep callback for visible thinking (SSE streaming).
// ============================================================

import { routeChat, type ChatMessage, type Provider } from './llm.js';
import { parseActions, type ParsedAction } from './action-parser.js';
import { executeAction, type ActionResult } from './action-executor.js';
import { logger } from '../logger.js';
import { emitThinking, emitToolCall, emitToolResult, emitResponding, emitDone } from './agent-state-bus.js';

const MAX_REACT_ITERATIONS = 5;

export interface ThinkingStep {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'drafting';
  content: string;
  tool?: string;
  iteration: number;
}

export interface ReactLoopOptions {
  systemPrompt: string;
  agentName?: string;
  agentId?: string;
  userCredits?: number;
  userId: string;
  forceProvider?: Provider;
  onStep?: (step: ThinkingStep) => void;
}

export interface ReactLoopResult {
  text: string;
  actions: ActionResult[];
  /** Actions that need baseUrl injection — deferred to the HTTP/channel layer */
  deferredActions: ParsedAction[];
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  creditCost: number;
}

/**
 * Run a multi-turn ReAct loop.
 *
 * @param messages - The conversation so far (system prompt NOT included — pass via opts.systemPrompt)
 * @param opts     - LLM routing options including userId (required for action execution)
 */
export async function runReactLoop(
  messages: ChatMessage[],
  opts: ReactLoopOptions,
): Promise<ReactLoopResult> {
  const workingMessages = [...messages];
  const allActionResults: ActionResult[] = [];
  const allDeferredActions: ParsedAction[] = [];

  let finalText = '';
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCreditCost = 0;
  let lastProvider = '';
  let lastModel = '';

  for (let i = 0; i < MAX_REACT_ITERATIONS; i++) {
    // Emit thinking step
    opts.onStep?.({ type: 'thinking', content: i === 0 ? 'Analyzing your request...' : 'Reasoning about results...', iteration: i });
    if (opts.agentId) emitThinking(opts.userId, opts.agentId, i === 0 ? 'Analyzing request...' : 'Reasoning about results...');

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

    // No actions → LLM is done reasoning
    if (actions.length === 0) {
      finalText = cleanText || result.reply;
      opts.onStep?.({ type: 'drafting', content: 'Writing response...', iteration: i });
      if (opts.agentId) emitResponding(opts.userId, opts.agentId, 'Writing response...');
      break;
    }

    logger.debug(
      { iteration: i + 1, tools: actions.map((a) => a.tool) },
      'react-loop:iteration',
    );

    // Execute all actions in this iteration and collect observations
    const observations: string[] = [];
    for (const action of actions) {
      if (action.tool === 'generate_code') {
        // generate_code needs baseUrl injected by the HTTP/channel layer — defer it
        allDeferredActions.push(action);
        opts.onStep?.({ type: 'tool_call', content: 'Generating code...', tool: action.tool, iteration: i });
        continue;
      }

      // Emit tool call step
      const toolDesc = action.tool === 'web_search' ? `Searching: "${action.params?.query || ''}"` :
        action.tool === 'crawl_url' ? `Reading: ${action.params?.url || ''}` :
        action.tool === 'take_screenshot' ? `Screenshotting: ${action.params?.url || ''}` :
        action.tool === 'generate_image' ? `Generating image: "${action.params?.prompt || ''}"` :
        `Running ${action.tool}...`;
      opts.onStep?.({ type: 'tool_call', content: toolDesc, tool: action.tool, iteration: i });
      if (opts.agentId) emitToolCall(opts.userId, opts.agentId, action.tool, toolDesc);

      const actionResult = await executeAction(opts.userId, action);
      allActionResults.push(actionResult);

      // Emit tool result step
      const resultSummary = actionResult.success
        ? actionResult.data?.summary ? String(actionResult.data.summary).slice(0, 200) : actionResult.message.slice(0, 200)
        : `Error: ${actionResult.message.slice(0, 200)}`;
      opts.onStep?.({ type: 'tool_result', content: resultSummary, tool: action.tool, iteration: i });
      if (opts.agentId) emitToolResult(opts.userId, opts.agentId, action.tool, resultSummary);

      // Format observation for LLM context
      const obs = actionResult.success
        ? `[TOOL RESULT: ${action.tool}]\n${actionResult.message}${
            actionResult.data?.summary
              ? '\n\n' + String(actionResult.data.summary)
              : actionResult.data
              ? '\n' + JSON.stringify(actionResult.data, null, 2).slice(0, 1000)
              : ''
          }`
        : `[TOOL ERROR: ${action.tool}]\n${actionResult.message}`;

      observations.push(obs);
    }

    // If all actions were skipped/deferred (e.g. only generate_code), stop looping
    if (observations.length === 0) {
      finalText = cleanText || result.reply;
      break;
    }

    // Inject assistant turn + tool observations back into message history
    workingMessages.push({ role: 'assistant', content: result.reply });
    workingMessages.push({
      role: 'user',
      content: observations.join('\n\n---\n\n') + '\n\nBased on the above results, continue.',
    });

    // On final iteration, capture whatever the LLM says
    if (i === MAX_REACT_ITERATIONS - 1) {
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
    provider: lastProvider,
    model: lastModel,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    creditCost: totalCreditCost,
  };
}
