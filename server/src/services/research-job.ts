// ============================================================
// Async Research Job
//
// Detects research-intent messages and runs a Tavily search
// in the background, delivering formatted results to Telegram
// when complete. Used by the async research fast-path in
// message-router.ts.
// ============================================================

import { logger } from '../logger.js';
import { sendTelegramMessage } from './telegram.js';
import { tavilySearch } from './tavily.js';

// ---- Research intent detection ----
// Patterns that indicate the user wants external research, not a local tool action.
// Intentionally does NOT match phrases already covered by hasToolTrigger
// (reminders, expenses, habits, notes, focus, etc.)
const RESEARCH_PATTERNS: RegExp[] = [
  // Explicit research verbs
  /\b(?:research|investigate|analyse?|analyze)\b.{5,}/i,
  // Compare / contrast
  /\bcompare\b.{5,}/i,
  /\bdifference between\b.{5,}/i,
  /\bpros\s+and\s+cons\b/i,
  /\badvantages\s+(and\s+disadvantages\s+)?of\b/i,
  /\bvs\.?\b.{5,}/i,
  // "find the best / top N" queries
  /\bfind\s+the\s+best\b.{3,}/i,
  /\btop\s+\d+\b.{5,}/i,
  /\bbest\s+\w+\s+(?:for|to|in|on)\b/i,
  // "what's the best / what is the best"
  /\bwhat(?:'s| is)\s+the\s+best\b.{3,}/i,
  // Reviews / overviews
  /\breview\s+of\b.{5,}/i,
  /\boverview\s+of\b.{5,}/i,
  /\bsummarize\b.{5,}/i,
  /\bsummarise\b.{5,}/i,
  // "tell me about" + long query (short ones handled by LLM)
  /\btell\s+me\s+about\b.{10,}/i,
];

// Phrases that look like research but are tool actions — never intercept these
const TOOL_EXCLUSIONS: RegExp[] = [
  /\b(remind|reminder|set\s+reminder|schedule)\b/i,
  /\b(track|log)\s+(expense|spending|money|budget)\b/i,
  /\b(create|save|write)\s+note\b/i,
  /\b(start\s+focus|pomodoro)\b/i,
];

/**
 * Returns true if the message is a research / comparison request that
 * should be handled asynchronously via Tavily, not by the LLM.
 */
export function isResearchRequest(text: string): boolean {
  if (text.length < 20) return false;
  if (TOOL_EXCLUSIONS.some((p) => p.test(text))) return false;
  return RESEARCH_PATTERNS.some((p) => p.test(text));
}

/**
 * Runs a Tavily search for `query` and sends the formatted results
 * to `chatId` via Telegram. All errors are caught internally so the
 * fire-and-forget caller never crashes.
 */
export async function runResearchJob(opts: {
  query: string;
  chatId: string;
}): Promise<void> {
  const { query, chatId } = opts;

  try {
    const searchResult = await tavilySearch(query, 5);

    if (!searchResult.results || searchResult.results.length === 0) {
      await sendTelegramMessage(chatId, `🔍 No results found for: "${query.slice(0, 80)}"`);
      return;
    }

    // Build numbered result list (each result capped at 250 chars to stay readable)
    const resultLines = searchResult.results
      .map((r, i) => `${i + 1}. *${r.title}*\n${r.content.slice(0, 250)}${r.content.length > 250 ? '…' : ''}\n🔗 ${r.url}`)
      .join('\n\n');

    const header = `🔍 *Research: ${query.slice(0, 60)}${query.length > 60 ? '…' : ''}*`;
    const reply = `${header}\n\n${resultLines}`;

    await sendTelegramMessage(chatId, reply);
    logger.info({ chatId, query: query.slice(0, 60), results: searchResult.results.length }, 'Research job delivered');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg, query: query.slice(0, 60) }, 'Research job failed');
    await sendTelegramMessage(
      chatId,
      `❌ Research failed for "${query.slice(0, 50)}". Please try again.`,
    ).catch(() => {});
  }
}
