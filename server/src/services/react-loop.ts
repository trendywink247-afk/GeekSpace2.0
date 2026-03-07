// ============================================================
// ReAct Loop — Multi-turn Tool-Use Reasoning
//
// Runs up to MAX_REACT_ITERATIONS of: LLM → parse actions →
// execute actions → inject observations → repeat.
// Returns when no actions in response or max iterations hit.
// ============================================================

import { routeChat, type ChatMessage, type Provider } from './llm.js';
import { parseActions } from './action-parser.js';
import { executeAction, type ActionResult } from './action-executor.js';
import { logger } from '../logger.js';

const MAX_REACT_ITERATIONS = 5;

export interface ReactLoopOptions {
  systemPrompt: string;
  agentName?: string;
  userCredits?: number;
  userId: string;
  forceProvider?: Provider;
}

export interface ReactLoopResult {
  text: string;
  actions: ActionResult[];
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

  let finalText = '';
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCreditCost = 0;
  let lastProvider = '';
  let lastModel = '';

  for (let i = 0; i < MAX_REACT_ITERATIONS; i++) {
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
        // generate_code needs baseUrl injected by the HTTP layer — skip in loop
        continue;
      }
      const actionResult = await executeAction(opts.userId, action);
      allActionResults.push(actionResult);

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

    // If all actions were skipped (e.g. only generate_code), stop looping
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
      finalText = cleanText || result.reply;
    }
  }

  return {
    text: finalText,
    actions: allActionResults,
    provider: lastProvider,
    model: lastModel,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    creditCost: totalCreditCost,
  };
}
