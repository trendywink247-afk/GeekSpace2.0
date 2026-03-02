// ============================================================
// Firecrawl Research Integration
//
// Scrapes web pages and URLs shared in chat, converting them
// to clean markdown for LLM context injection.
// Gracefully no-ops if API key not configured.
// ============================================================

export interface FirecrawlResult {
  title: string;
  content: string;
  error?: string;
}

export async function firecrawlScrape(url: string): Promise<FirecrawlResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { title: '', content: '', error: 'No API key' };

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
    });

    if (!res.ok) return { title: url, content: '', error: `HTTP ${res.status}` };

    const data = await res.json() as {
      data?: { metadata?: { title?: string }; markdown?: string };
    };
    return {
      title: data.data?.metadata?.title || url,
      // Truncate to 1500 chars to save tokens
      content: data.data?.markdown?.slice(0, 1500) || '',
    };
  } catch (err) {
    return { title: url, content: '', error: (err as Error).message };
  }
}

/**
 * Extracts the first URL from a message string, if any.
 */
export function extractUrl(message: string): string | null {
  const match = message.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}
