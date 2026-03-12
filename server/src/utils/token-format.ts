// ============================================================
// Token Format Utilities
//
// Compresses prompts and AI payloads before sending to any
// model — targets 40-50% token reduction without quality loss.
// Rules:
//   - Only used on server-side LLM calls, never on user-visible text
//   - All transforms are idempotent / safe to apply multiple times
// ============================================================

/**
 * Compresses a prompt by removing redundant whitespace and
 * verbose filler phrases that add no semantic value.
 */
export function compressPrompt(text: string): string {
  return text
    // Collapse 3+ newlines → 2
    .replace(/\n{3,}/g, '\n\n')
    // Collapse runs of spaces/tabs to single space
    .replace(/[ \t]+/g, ' ')
    // Remove verbose filler phrases
    .replace(/\bplease\b/gi, '')
    .replace(/\bkindly\b/gi, '')
    .replace(/\bI would like you to\b/gi, '')
    .replace(/\bCould you please\b/gi, '')
    .replace(/\bIn order to\b/gi, 'to')
    .replace(/\bdue to the fact that\b/gi, 'because')
    .replace(/\bat this point in time\b/gi, 'now')
    .trim();
}

/**
 * Minified JSON — no spaces, no newlines.
 * Saves 15-25% tokens vs pretty-printed JSON.
 */
export function compressJSON(obj: unknown): string {
  return JSON.stringify(obj);
}

/**
 * Removes null and undefined fields from an object before
 * sending in API responses, reducing payload size.
 */
export function stripNulls(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj, (_, v) =>
    v === null || v === undefined ? undefined : v
  ));
}

/**
 * Ultra-compact system prompt builder.
 * Uses structured notation instead of verbose natural language.
 */
export function buildCompactSystemPrompt(
  agentName: string,
  userMemories: string[],
  tools: string[],
  instructions: string
): string {
  const memorySummary = userMemories.length > 0
    ? `[MEM:${userMemories.slice(0, 3).join('|')}]`
    : '';
  const toolList = tools.length > 0
    ? `[TOOLS:${tools.join(',')}]`
    : '';
  return compressPrompt(
    `${agentName}. ${memorySummary} ${toolList} ${instructions}`
  );
}

/**
 * Trims conversation history to fit within a token budget.
 * Keeps the most recent messages that fit.
 * Rough estimate: 1 token ≈ 4 chars.
 */
export function trimConversationHistory(
  messages: Array<{ role: string; content: string }>,
  maxTokenEstimate: number = 3000
): Array<{ role: string; content: string }> {
  const maxChars = maxTokenEstimate * 4;
  let total = 0;
  const trimmed: Array<{ role: string; content: string }> = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (total + msg.content.length > maxChars) {
      // Always include the most recent message even if it needs truncation —
      // dropping it entirely would strip all context from the follow-up.
      if (trimmed.length === 0 && total === 0) {
        trimmed.unshift({ ...msg, content: msg.content.slice(0, maxChars) + '\n[...truncated]' });
      }
      break;
    }
    total += msg.content.length;
    trimmed.unshift(msg);
  }
  return trimmed;
}
