// ============================================================
// Browser Agent Client — Connects to the headless Chromium service
// Gives the AI agent "hands" to navigate, fill forms, take screenshots
// ============================================================

import { logger } from '../logger.js';

const BROWSER_URL = process.env.BROWSER_URL || 'http://geekspace-browser:3010';
const BROWSER_SECRET = process.env.BROWSER_SECRET || 'agentin-browser-2026';

// ── Types ────────────────────────────────────────────────────

interface BrowserAction {
  type: 'click' | 'fill' | 'wait' | 'scroll' | 'select';
  selector?: string;
  value?: string;
  ms?: number;
  direction?: 'up' | 'down';
}

export interface BrowserResult {
  title: string;
  text: string;
  links: Array<{ text: string; href: string }>;
  screenshot?: string; // base64
  url: string;
  error?: string;
}

// ── HTTP helper ──────────────────────────────────────────────

async function browserFetch(endpoint: string, body: Record<string, unknown>): Promise<BrowserResult> {
  try {
    const res = await fetch(`${BROWSER_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Browser-Secret': BROWSER_SECRET,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { title: '', text: '', links: [], url: '', error: `${res.status}: ${errText.slice(0, 200)}` };
    }

    // Screenshot endpoint returns raw image
    if (endpoint === '/screenshot') {
      const buf = Buffer.from(await res.arrayBuffer());
      return { title: '', text: '', links: [], url: body.url as string, screenshot: buf.toString('base64') };
    }

    return await res.json() as BrowserResult;
  } catch (err) {
    const msg = (err as Error).message || 'Browser agent unreachable';
    logger.warn({ err, endpoint, url: body.url }, 'Browser agent request failed');
    return { title: '', text: '', links: [], url: '', error: msg };
  }
}

// ── Public API ───────────────────────────────────────────────

export async function navigatePage(url: string, actions?: BrowserAction[]): Promise<BrowserResult> {
  return browserFetch('/navigate', { url, actions });
}

export async function extractPageContent(url: string, selector?: string): Promise<BrowserResult> {
  return browserFetch('/extract', { url, selector });
}

export async function fillForm(url: string, fields: Record<string, string>): Promise<BrowserResult> {
  return browserFetch('/fill', { url, fields });
}

export async function takePageScreenshot(url: string): Promise<BrowserResult> {
  return browserFetch('/screenshot', { url });
}

// ── Health check ─────────────────────────────────────────────

export async function isBrowserAgentHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${BROWSER_URL}/health`, {
      headers: { 'X-Browser-Secret': BROWSER_SECRET },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
