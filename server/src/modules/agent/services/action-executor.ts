/**
 * Action Executor -- Dispatches tool actions to domain-specific executors.
 *
 * The public entry point is {@link executeAction}, which routes to one of:
 * - `content-media-executor` — code gen, portfolio, image/video/avatar
 * - `web-executor` — web search, crawling, screenshots, monitoring
 * - `tools-executor` — reminders, notes, habits, email, calendar, goals, etc.
 *
 * @module services/action-executor
 */

import { logger } from '../../../logger.js';
import { getRecoveryStrategy, applyRecoveryStrategy, getRetryDelay } from './error-recovery.js';
import type { ParsedAction } from '../../../services/action-parser.js';
import { executeContentMediaAction } from './executors/content-media-executor.js';
import { executeWebAction } from './executors/web-executor.js';
import { executeToolsAction } from './executors/tools-executor.js';

export { needsConfirmation, CONFIRM_REQUIRED } from './confirm-action.js';

// ── Types ───────────────────────────────────────────────────

export interface ActionResult {
  tool: string;
  success: boolean;
  message: string;
  artifactId?: string;
  previewUrl?: string;
  imageUrl?: string;
  imageId?: string;
  videoUrl?: string;
  data?: Record<string, unknown>;
  receipt?: import('../../../services/receipts.js').ReceiptItem;
  cardSent?: boolean;
}

// ── Dispatcher ──────────────────────────────────────────────

async function runAction(userId: string, tool: string, params: ParsedAction['params']): Promise<ActionResult> {
  return (
    await executeContentMediaAction(userId, tool, params as Record<string, unknown>)
    ?? await executeWebAction(userId, tool, params as Record<string, unknown>)
    ?? await executeToolsAction(userId, tool, params as Record<string, unknown>)
    ?? await fallbackToGeekOS(userId, tool, params as Record<string, unknown>)
  );
}

async function fallbackToGeekOS(userId: string, tool: string, params: Record<string, unknown>): Promise<ActionResult> {
  try {
    const { forwardToGeekOS } = await import('../../../routes/geekos-bridge.js');
    const bridgeResult = await forwardToGeekOS(userId, tool, params);
    if (bridgeResult) {
      return { tool, success: true, message: bridgeResult };
    }
  } catch (err) {
    logger.debug({ err, tool }, 'GeekOS plugin fallback unavailable');
  }
  return { tool, success: false, message: `Unknown tool "${tool}"` };
}

// ── Public API ──────────────────────────────────────────────

/**
 * Execute a single parsed tool action on behalf of a user.
 * Never throws — returns a safe error result on failure.
 */
export async function executeAction(userId: string, action: ParsedAction): Promise<ActionResult> {
  const { tool, params } = action;
  const actionStart = Date.now();

  logger.info({ actionType: tool, userId }, 'action:executing');

  try {
    const result = await runAction(userId, tool, params);
    const duration = Date.now() - actionStart;
    logger.info({ actionType: tool, userId, duration, success: result.success }, 'action:completed');
    return result;
  } catch (err) {
    const duration = Date.now() - actionStart;
    logger.error({ actionType: tool, error: err instanceof Error ? err.message : String(err), userId, duration }, 'action:failed');
    return {
      tool,
      success: false,
      message: `Action "${tool}" failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Execute an action with automatic error recovery.
 * Tries fallback tools when the primary tool fails.
 */
export async function executeActionWithRecovery(
  userId: string,
  action: ParsedAction,
  maxAttempts = 2,
): Promise<ActionResult> {
  let currentAction = action;
  let lastResult: ActionResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await executeAction(userId, currentAction);

    if (lastResult.success) {
      return lastResult;
    }

    const strategy = getRecoveryStrategy(currentAction.tool, lastResult.message, attempt);
    if (!strategy || !strategy.shouldRetry) {
      break;
    }

    logger.info(
      { userId, original: currentAction.tool, alternative: strategy.alternativeTool, reason: strategy.reason },
      'error-recovery: trying alternative',
    );

    if (strategy.alternativeTool) {
      currentAction = applyRecoveryStrategy(currentAction, strategy);
    } else {
      await new Promise(r => setTimeout(r, getRetryDelay(attempt)));
    }
  }

  if (lastResult) {
    return {
      ...lastResult,
      message: `${lastResult.message} (tried ${maxAttempts} alternative${maxAttempts > 1 ? 's' : ''})`,
    };
  }

  return {
    tool: action.tool,
    success: false,
    message: 'All recovery attempts failed',
  };
}
