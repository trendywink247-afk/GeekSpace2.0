// ============================================================
// Tavily Web Search Integration
//
// Provides real-time web search for user queries that require
// current information. Returns error if key not configured.
// ============================================================

import { logger } from '../logger.js';

const TAVILY_BASE = 'https://api.tavily.com';

// FIX P1-9: Warn at module load time so admins know search is disabled
if (!process.env.TAVILY_API_KEY) {
  logger.warn('TAVILY_API_KEY not set — web_search tool will return empty results. Add key to .env to enable.');
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export interface TavilySearchResponse {
  results: TavilyResult[];
  query: string;
}

export async function tavilySearch(
  query: string,
  maxResults: number = 3
): Promise<TavilySearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  // FIX P1-9: Throw so action-executor returns a visible error instead of silent empty results
  if (!apiKey) throw new Error('Web search is unavailable: TAVILY_API_KEY not configured. Add it to .env to enable search.');

  try {
    const res = await fetch(`${TAVILY_BASE}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: 'basic',
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!res.ok) return { results: [], query };

    const data = await res.json() as { results?: Array<{ title: string; url: string; content?: string }> };
    return {
      query,
      results: (data.results || []).map((r) => ({
        title: r.title,
        url: r.url,
        // Truncate content to save tokens
        content: r.content?.slice(0, 300) || '',
      })),
    };
  } catch {
    return { results: [], query };
  }
}

/**
 * Detects whether a user message has search intent —
 * questions about current events, lookups, prices, news, etc.
 */
export function isSearchIntent(message: string): boolean {
  const lower = message.trim();
  // NEVER search: pure math expressions
  if (/^[\d\s+\-*/().^%=,]+$/.test(lower)) return false;
  // NEVER search: word math like "15 times 7" or "what is 2+2"
  if (/^(what\s+is\s+)?[\d]+\s*([+\-*/x×÷]|plus|minus|times|divided by|mod)\s*[\d]+[\s?]*$/i.test(lower)) return false;
  // NEVER search: ultra-short with no question mark
  if (lower.split(/\s+/).length <= 2 && !lower.includes('?')) return false;
  // NEVER search: simple greetings and interjections
  if (/^(hi|hey|hello|thanks|thank you|what time|what day|what date|good morning|good night|bye)[\s!.?]*$/i.test(lower)) return false;
  // NEVER search: pure definition requests (handled by LLM knowledge)
  if (/^define\s+\w+[\s?]*$/i.test(lower)) return false;
  // NEVER search: personal/agent meta questions
  if (/^what\s+is\s+your\s+/i.test(lower)) return false;
  if (/^what\s+(is|are)\s+(my|our)\s+(?!(?:latest|current|recent|news|stock|price|weather))/i.test(lower)) return false;
  // NEVER search: "what is [well-known concept]" without current-event signals
  if (/^what\s+is\s+[a-z]+[\s?]*$/i.test(lower) && !/\b(latest|current|recent|today|news|update|price|stock|weather|score|result)\b/i.test(lower)) return false;
  // NEVER search: "how does X work" / "explain X" / "tell me about" — LLM knowledge
  if (/^(how\s+does|explain|tell\s+me\s+about|describe)\s+/i.test(lower)) return false;
  // NEVER search: habit completions ("gym done", "did my running today", "log meditation")
  if (/\b(done|completed?|finished?|logged?|tracked?|kiya|ki|kara)\b/i.test(lower) && /\b(gym|yoga|meditation|workout|running|exercise|walk|reading|study|stretching|journal|pushup|plank|water|habit)\b/i.test(lower)) return false;
  // NEVER search: expense tracking ("spent 200 on uber", "swiggy pe 350")
  if (/\b(spent|paid|expense|kharcha|kharche|rupay|rupees?)\b/i.test(lower) && /\d/.test(lower)) return false;
  // NEVER search: reminders ("remind me to X", "set a reminder")
  if (/\b(remind\s+me|set\s+(?:a\s+)?reminder|yaad\s+dila)\b/i.test(lower)) return false;
  // NEVER search: focus sessions ("start a 25 min focus", "pomodoro")
  if (/\b(focus\s+session|pomodoro|deep\s+work)\b/i.test(lower)) return false;

  const patterns = [
    /\b(search|find|look up|google|what is|who is)\b/i,
    /\b(latest|current|recent|today|news|update)\b/i,
    /\b(price of|how much is|where is|when is)\b/i,
    /\b(weather|stock|score|result)\b/i,
  ];
  return patterns.some((p) => p.test(message));
}
