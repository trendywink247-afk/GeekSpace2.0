/**
 * ReAct Loop -- Multi-turn Tool-Use Reasoning
 *
 * Implements a Reason + Act (ReAct) agent loop that alternates between
 * LLM inference and tool execution for up to {@link MAX_REACT_ITERATIONS}
 * iterations. Each iteration:
 *
 *  1. Sends the conversation (including prior observations) to the LLM
 *     via `routeChat`.
 *  2. Parses the response for `<<<ACTION ... ACTION>>>` tool-call blocks.
 *  3. If no actions are found, the loop terminates and returns the final text.
 *  4. Otherwise, each action is executed via {@link executeAction} and the
 *     resulting observations are appended to the working message history
 *     as assistant/user turn pairs, then the loop repeats.
 *
 * The loop emits {@link ThinkingStep} callbacks (via `opts.onStep`) and
 * SSE events (via `agent-state-bus`) so the frontend can display a
 * real-time "thinking" indicator with tool names and progress.
 *
 * Actions whose execution requires the HTTP base URL (e.g. `generate_code`)
 * are collected into `deferredActions` and returned to the caller for
 * post-processing by the HTTP/channel layer.
 *
 * @module services/react-loop
 */

import { routeChat, type ChatMessage, type Provider } from './llm.js';
import { parseActions, type ParsedAction } from '../../../services/action-parser.js';
import { executeAction, type ActionResult } from './action-executor.js';
import { logger } from '../../../logger.js';
import { emitThinking, emitToolCall, emitToolResult, emitResponding, emitDone } from './agent-state-bus.js';
import { needsConfirmation } from './confirm-action.js';

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
  onConfirmNeeded?: (tool: string, params: Record<string, unknown>) => Promise<{ approved: boolean; editedParams?: Record<string, unknown>; rejectReason?: string }>;
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
 * Run a multi-turn ReAct (Reason + Act) loop over the given conversation.
 *
 * Iterates up to `MAX_REACT_ITERATIONS` (5) times, calling the LLM,
 * parsing tool-call actions from its response, executing them, and
 * feeding observations back. Terminates early when the LLM produces
 * a response with no action blocks, indicating it is ready to answer.
 *
 * Token counts, credit costs, and action results are accumulated across
 * all iterations and returned in a single {@link ReactLoopResult}.
 *
 * @param messages - The conversation history so far. The system prompt is
 *                   **not** included here; pass it via `opts.systemPrompt`.
 * @param opts     - Loop configuration: system prompt, user ID, optional
 *                   provider override, and an `onStep` callback for
 *                   streaming thinking indicators to the frontend.
 * @returns Aggregated result containing the final reply text, all action
 *          outcomes, deferred actions, token usage, and cost.
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

      // Human-in-the-loop: check if this tool needs confirmation
      if (opts.onConfirmNeeded && needsConfirmation(action.tool, action.params)) {
        opts.onStep?.({ type: 'tool_call', content: `Requesting confirmation for ${action.tool}...`, tool: action.tool, iteration: i + 1 });
        const confirmation = await opts.onConfirmNeeded(action.tool, action.params);
        if (!confirmation.approved) {
          const reason = confirmation.rejectReason || 'User declined';
          observations.push(`Tool ${action.tool} was REJECTED by user: ${reason}. Do not retry this action. Adjust your approach.`);
          opts.onStep?.({ type: 'tool_result', content: `${action.tool} rejected: ${reason}`, tool: action.tool, iteration: i + 1 });
          continue;
        }
        if (confirmation.editedParams) {
          action.params = { ...action.params, ...confirmation.editedParams };
        }
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
