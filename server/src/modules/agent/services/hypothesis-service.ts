/**
 * Multi-Hypothesis Reasoning Service
 *
 * For ambiguous user messages, generate 2-3 interpretations with probabilities.
 * If the top hypothesis is confident enough (>0.65), proceed normally.
 * Otherwise, transform the response into a clarifying question.
 */

import { logger } from '../../../logger.js';
import { routeChat, type ChatMessage, type Provider } from './llm.js';

export interface Hypothesis {
  interpretation: string;
  probability: number;
  response_strategy: string;
}

export interface HypothesisResult {
  hypotheses: Hypothesis[];
  topConfidence: number;
  shouldClarify: boolean;
  clarifyingQuestion: string | null;
}

/**
 * Decide whether a message is ambiguous enough to warrant multi-hypothesis analysis.
 * Heuristics: short messages, vague pronouns, emotional content, no clear action.
 */
export function isAmbiguous(message: string): boolean {
  if (message.length < 8) return false;   // Too short to be meaningfully ambiguous
  if (message.length > 200) return false; // Long messages usually have enough context

  const lower = message.toLowerCase();

  // Vague pronoun openers
  if (/^(it|this|that|they|them|those)\s/i.test(lower)) return true;

  // Emotional/state messages without a clear action
  if (/^(i('?m| am)?\s+(worried|anxious|stressed|tired|excited|nervous|confused))/i.test(lower)) return true;
  if (/^(help|hmm|hey|so|well|um)\b/i.test(lower) && lower.length < 50) return true;

  // Vague open-ended questions
  if (/^(what (do you think|should i)|any (ideas|thoughts))/i.test(lower)) return true;

  return false;
}

/**
 * Generate hypotheses for an ambiguous message using a fast cloud model.
 */
export async function generateHypotheses(
  userId: string,
  message: string,
  recentContext: string,
): Promise<HypothesisResult> {
  try {
    const prompt = `The user sent this message: "${message}"

Recent conversation context:
${recentContext.slice(0, 1500)}

Generate 2-3 possible interpretations of what they mean, with probability estimates.

Return JSON:
{
  "hypotheses": [
    {
      "interpretation": "what the user might mean",
      "probability": 0.0-1.0,
      "response_strategy": "how to respond if this is right"
    }
  ],
  "clarifying_question": "if probabilities are spread out, what's a single question to ask?"
}

Probabilities should sum to ~1.0. JSON only:`;

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You analyze user message intent. Return JSON only.' },
      { role: 'user', content: prompt },
    ];

    const result = await routeChat(messages, { userId, forceProvider: 'groq' as Provider });

    const jsonMatch = result.reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { hypotheses: [], topConfidence: 1, shouldClarify: false, clarifyingQuestion: null };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      hypotheses: Hypothesis[];
      clarifying_question: string | null;
    };

    const hypotheses = (parsed.hypotheses || []).slice(0, 3);
    const topConfidence = hypotheses.length > 0 ? Math.max(...hypotheses.map(h => h.probability)) : 1;
    const shouldClarify = topConfidence < 0.65 && hypotheses.length >= 2;

    return {
      hypotheses,
      topConfidence,
      shouldClarify,
      clarifyingQuestion: shouldClarify ? (parsed.clarifying_question ?? null) : null,
    };
  } catch (err) {
    logger.debug({ err }, 'hypothesis: generation failed');
    return { hypotheses: [], topConfidence: 1, shouldClarify: false, clarifyingQuestion: null };
  }
}

/**
 * Format hypotheses as a context block to inject into the system prompt.
 * The agent will see multiple interpretations and can address or ask for clarification.
 */
export function formatHypothesesForPrompt(result: HypothesisResult): string {
  if (result.hypotheses.length === 0 || !result.shouldClarify) return '';

  const lines = ['## Multi-Hypothesis Analysis (the user message is ambiguous)'];
  for (const h of result.hypotheses) {
    lines.push(`- (${(h.probability * 100).toFixed(0)}%) ${h.interpretation}`);
  }
  if (result.clarifyingQuestion) {
    lines.push(`\nSuggested clarifying question: "${result.clarifyingQuestion}"`);
    lines.push('Consider asking this rather than guessing.');
  }

  return '\n' + lines.join('\n');
}
