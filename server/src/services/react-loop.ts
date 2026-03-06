// ============================================================
// ReAct Loop — Reasoning + Acting Multi-Turn Tool Use
//
// Wraps routeChat() in a loop:
//   1. LLM generates text (possibly with <<<ACTION>>> blocks)
//   2. Parse and execute each action
//   3. Inject results as [OBSERVATION] messages
//   4. Repeat until no actions remain or max iterations hit
//   5. If max hit: return accumulated observations summary
//
// Status messages are emitted via onStatus callback so callers
// can notify the user in real-time (SSE write / Telegram send).
// ============================================================

import { routeChat, type ChatMessage, type Provider } from './llm.js';
import { parseActions } from './action-parser.js';
import { executeAction, type ActionResult } from './action-executor.js';
import { logger } from '../logger.js';

const MAX_REACT_ITERATIONS = 5;

export interface ReActResult {
  text: string;
  iterations: number;
  observations: string[];
  actionResults: ActionResult[];
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  creditCost: number;
}

export type StatusCallback = (msg: string) => void | Promise<void>;

export interface ReActOpts {
  onStatus: StatusCallback;
  systemPrompt?: string;
  agentName?: string;
  userCredits?: number;
  forceProvider?: Provider;
  userId?: string;
  userPlan?: string;
  generateCodeBaseUrl?: string;
  generateCodeExistingArtifactId?: string;
}

// Map tool name → user-visible status message
function toolStatusMessage(tool: string): string {
  switch (tool) {
    case 'web_search': return '🔍 Searching the web…';
    case 'set_reminder': return '⏰ Setting reminder…';
    case 'telegram_notify': return '📨 Sending Telegram notification…';
    case 'send_email': return '📧 Sending email…';
    case 'generate_image': return '🎨 Generating image…';
    case 'generate_code': return '💻 Building website…';
    default: return `🔧 Running ${tool}…`;
  }
}

export async function runReActLoop(
  initialMessages: ChatMessage[],
  userId: string,
  opts: ReActOpts,
): Promise<ReActResult> {
  const {
    onStatus,
    systemPrompt,
    agentName,
    userCredits,
    forceProvider,
    userPlan,
  } = opts;

  const messages = [...initialMessages];
  const observations: string[] = [];
  const allActionResults: ActionResult[] = [];
  let lastProvider = 'ollama';
  let lastModel = '';
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCreditCost = 0;

  for (let i = 0; i < MAX_REACT_ITERATIONS; i++) {
    // Call LLM
    const result = await routeChat(messages, {
      systemPrompt,
      agentName,
      userCredits,
      forceProvider,
      userId,
      userPlan,
    });

    lastProvider = result.provider;
    lastModel = result.model;
    totalTokensIn += result.tokensIn;
    totalTokensOut += result.tokensOut;
    totalCreditCost += result.creditCost;

    // Parse any tool actions from the response
    const { text: cleanText, actions } = parseActions(result.reply);

    if (actions.length === 0) {
      // No tool calls — we're done
      logger.debug({ iterations: i + 1, userId }, 'react-loop: done (no actions)');
      return {
        text: cleanText || result.reply,
        iterations: i + 1,
        observations,
        actionResults: allActionResults,
        provider: lastProvider,
        model: lastModel,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        creditCost: totalCreditCost,
      };
    }

    // Append assistant message (with action blocks) to history
    messages.push({ role: 'assistant', content: result.reply });

    // Execute each action and collect observations
    const observationParts: string[] = [];
    for (const action of actions) {
      await onStatus(toolStatusMessage(action.tool));
      // Inject baseUrl for generate_code actions (needed for preview URL generation)
      if (action.tool === 'generate_code' && opts.generateCodeBaseUrl) {
        action.params.baseUrl = opts.generateCodeBaseUrl;
      }
      if (action.tool === 'generate_code' && opts.generateCodeExistingArtifactId) {
        action.params.existingArtifactId = opts.generateCodeExistingArtifactId;
      }
      const actionResult = await executeAction(userId, action);
      allActionResults.push(actionResult);

      // For web_search, use the pre-formatted summary from executor
      const resultDetail = actionResult.success
        ? (actionResult.data?.summary as string | undefined) || actionResult.message
        : `Error: ${actionResult.message}`;

      const obsText = `[OBSERVATION tool="${action.tool}"]: ${resultDetail}`;
      observationParts.push(obsText);
      observations.push(obsText);
      logger.debug({ tool: action.tool, success: actionResult.success, userId }, 'react-loop: tool executed');
    }

    // Inject observations as a user message for next LLM turn
    const observationMessage = observationParts.join('\n\n') +
      '\n\nNow continue answering the user based on the above results. Do not emit more tool calls unless truly necessary.';
    messages.push({ role: 'user', content: observationMessage });
  }

  // Max iterations reached — compose summary from observations
  logger.warn({ userId, iterations: MAX_REACT_ITERATIONS }, 'react-loop: max iterations reached');
  const summary = observations.length > 0
    ? `I gathered the following information while working on your request:\n\n${observations.join('\n\n')}`
    : 'I was unable to complete that request after several attempts. Please try rephrasing.';

  return {
    text: summary,
    iterations: MAX_REACT_ITERATIONS,
    observations,
    actionResults: allActionResults,
    provider: lastProvider,
    model: lastModel,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    creditCost: totalCreditCost,
  };
}
