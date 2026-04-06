/**
 * Confidence Service — Uncertainty calibration on LLM responses
 *
 * Every LLM call asks the model to self-rate confidence (0.0-1.0).
 * Low confidence responses trigger clarifying questions instead of
 * confident-sounding hallucinations.
 */

import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';

export interface ParsedConfidence {
  cleanText: string;
  confidence: number | null; // 0.0-1.0, or null if not provided
}

/**
 * Parse a confidence marker from LLM output and strip it from the visible text.
 * Format: anywhere in the text, the LLM may include [CONFIDENCE: 0.0-1.0]
 * We extract it and remove it from what the user sees.
 */
export function parseConfidence(text: string): ParsedConfidence {
  // Match [CONFIDENCE: 0.85] or [CONFIDENCE: 0.7] etc.
  const match = text.match(/\[CONFIDENCE:\s*(0?\.\d+|1\.0|1|0)\s*\]/i);
  if (!match) {
    return { cleanText: text, confidence: null };
  }

  const confidence = Math.max(0, Math.min(1, parseFloat(match[1])));
  const cleanText = text.replace(match[0], '').trim();

  return { cleanText, confidence };
}

/**
 * Append the confidence instruction to a system prompt.
 */
export function withConfidenceInstruction(systemPrompt: string): string {
  return systemPrompt + `\n\n--- CONFIDENCE CALIBRATION ---
At the END of your response, on a new line, include your confidence in the answer:
[CONFIDENCE: 0.0-1.0]

Guidelines:
- 0.9-1.0: You're certain (clear facts, simple actions, things you just did)
- 0.7-0.9: Confident but not certain (reasonable inference, recent memory)
- 0.5-0.7: Moderate (you're guessing but it's an educated guess)
- 0.3-0.5: Uncertain (you don't really know but offering best guess)
- 0.0-0.3: Very uncertain (you should ask the user for clarification instead)

If your confidence is below 0.5, REPHRASE your response as a question or ask for clarification rather than stating something as fact. Better to ask than to hallucinate.`;
}

/**
 * Decide whether a response should be transformed into a clarifying question.
 * Some intents (creative, exploratory) tolerate lower confidence.
 */
export function shouldClarify(confidence: number | null, intent?: string): boolean {
  if (confidence === null) return false;
  // Creative tasks tolerate lower confidence
  if (intent === 'creative' || intent === 'planning') return confidence < 0.3;
  // Code/technical needs higher certainty
  if (intent === 'coding' || intent === 'automation') return confidence < 0.5;
  // Default threshold
  return confidence < 0.4;
}

/**
 * Store a confidence score for the most recently logged assistant message for a user.
 */
export function storeConfidence(userId: string, confidence: number | null): void {
  if (confidence === null) return;
  try {
    const lastMsg = db.prepare(`
      SELECT id FROM conversation_log
      WHERE user_id = ? AND role = 'assistant'
      ORDER BY created_at DESC LIMIT 1
    `).get(userId) as { id: string } | undefined;
    if (lastMsg) {
      db.prepare('UPDATE conversation_log SET confidence = ? WHERE id = ?').run(confidence, lastMsg.id);
    }
  } catch (err) {
    logger.debug({ err }, 'confidence: storeConfidence failed (non-fatal)');
  }
}

/**
 * Get user's average confidence over recent responses (for analytics).
 */
export function getUserAverageConfidence(userId: string, limit = 20): number | null {
  try {
    const result = db.prepare(`
      SELECT AVG(confidence) as avg FROM (
        SELECT confidence FROM conversation_log
        WHERE user_id = ? AND role = 'assistant' AND confidence IS NOT NULL
        ORDER BY created_at DESC LIMIT ?
      )
    `).get(userId, limit) as { avg: number | null } | undefined;
    return result?.avg ?? null;
  } catch (err) {
    logger.debug({ err }, 'confidence: avg query failed');
    return null;
  }
}
