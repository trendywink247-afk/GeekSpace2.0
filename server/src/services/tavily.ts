// ============================================================
// Tavily Web Search Integration
//
// Provides real-time web search for user queries that require
// current information. Gracefully no-ops if key not configured.
// ============================================================

const TAVILY_BASE = 'https://api.tavily.com';

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
  if (!apiKey) return { results: [], query };

  try {
    const res = await fetch(`${TAVILY_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
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
  const patterns = [
    /\b(search|find|look up|google|what is|who is)\b/i,
    /\b(latest|current|recent|today|news|update)\b/i,
    /\b(price of|how much is|where is|when is)\b/i,
    /\b(weather|stock|score|result)\b/i,
  ];
  return patterns.some((p) => p.test(message));
}
