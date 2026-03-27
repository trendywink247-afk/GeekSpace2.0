/**
 * Phase 86 — Autonomous Ecosystem + Token Efficiency + New Tools Tests
 * Verifies A-series token utils, B-series Tavily, C-series Firecrawl,
 * D-series AgentMail, E/F-series scripts, G-series JSON formatter,
 * H-series token dashboard, and env key additions.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../../');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(root, 'src', rel), 'utf-8');
}

function readServer(rel: string): string {
  return fs.readFileSync(path.join(root, 'server/src', rel), 'utf-8');
}

function readRoot(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf-8');
}

// ─── A1: token-format.ts ──────────────────────────────────────

import {
  compressPrompt,
  compressJSON,
  stripNulls,
  trimConversationHistory,
} from '../utils/token-format.js';

describe('A1: compressPrompt', () => {
  it('collapses 3+ consecutive newlines to 2', () => {
    const result = compressPrompt('line1\n\n\n\nline2');
    expect(result).toBe('line1\n\nline2');
  });

  it('collapses multiple spaces to single space', () => {
    const result = compressPrompt('hello   world');
    expect(result).toBe('hello world');
  });

  it('removes filler phrase: please', () => {
    const result = compressPrompt('please help me');
    expect(result).toMatch(/help me/);
    expect(result).not.toMatch(/please/i);
  });

  it('removes filler phrase: kindly', () => {
    const result = compressPrompt('kindly respond');
    expect(result).not.toMatch(/kindly/i);
  });

  it('replaces "In order to" with "to"', () => {
    const result = compressPrompt('In order to do this');
    expect(result).toContain('to do this');
    expect(result).not.toContain('In order to');
  });

  it('replaces "due to the fact that" with "because"', () => {
    const result = compressPrompt('due to the fact that it works');
    expect(result).toContain('because it works');
  });

  it('replaces "at this point in time" with "now"', () => {
    const result = compressPrompt('at this point in time we should proceed');
    expect(result).toContain('now we should proceed');
  });

  it('trims leading/trailing whitespace', () => {
    const result = compressPrompt('  hello  ');
    expect(result).toBe('hello');
  });
});

describe('A1: compressJSON', () => {
  it('produces minified JSON (no spaces)', () => {
    const result = compressJSON({ a: 1, b: 'hello' });
    expect(result).not.toContain('  ');
    expect(result).toBe('{"a":1,"b":"hello"}');
  });

  it('handles nested objects', () => {
    const result = compressJSON({ x: { y: [1, 2, 3] } });
    expect(result).toBe('{"x":{"y":[1,2,3]}}');
  });
});

describe('A1: stripNulls', () => {
  it('removes null fields from object', () => {
    const result = stripNulls({ a: 1, b: null, c: 'hello' }) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect(result.c).toBe('hello');
    expect('b' in result).toBe(false);
  });

  it('removes undefined fields', () => {
    const result = stripNulls({ a: 1, b: undefined }) as Record<string, unknown>;
    expect('b' in result).toBe(false);
  });
});

describe('A1: trimConversationHistory', () => {
  it('returns all messages when under token budget', () => {
    const msgs = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    const result = trimConversationHistory(msgs, 3000);
    expect(result).toHaveLength(2);
  });

  it('respects token budget (drops oldest messages)', () => {
    // 1 token ≈ 4 chars, so 100 token budget = 400 chars max
    const long = 'x'.repeat(200);
    const msgs = [
      { role: 'user', content: long },
      { role: 'assistant', content: long },
      { role: 'user', content: 'short' },
    ];
    const result = trimConversationHistory(msgs, 100);
    // Only most-recent messages that fit should be kept
    expect(result.length).toBeLessThan(msgs.length);
    // Last message should always be kept
    expect(result[result.length - 1].content).toBe('short');
  });

  it('returns empty array for empty input', () => {
    expect(trimConversationHistory([], 3000)).toHaveLength(0);
  });
});

// ─── B1: tavily.ts ────────────────────────────────────────────

describe('B: Tavily service', () => {
  it('tavilySearch throws when no API key configured', async () => {
    const { tavilySearch } = await import('../services/tavily.js');
    // Without TAVILY_API_KEY, search should throw a descriptive error
    await expect(tavilySearch('test query')).rejects.toThrow('TAVILY_API_KEY');
  });

  it('isSearchIntent detects search patterns', async () => {
    const { isSearchIntent } = await import('../services/tavily.js');
    expect(isSearchIntent('what is the latest news')).toBe(true);
    expect(isSearchIntent('search for React tutorials')).toBe(true);
    expect(isSearchIntent('price of Bitcoin today')).toBe(true);
    expect(isSearchIntent('weather in London')).toBe(true);
  });

  it('isSearchIntent returns false for non-search', async () => {
    const { isSearchIntent } = await import('../services/tavily.js');
    expect(isSearchIntent('write me a poem')).toBe(false);
    expect(isSearchIntent('hello how are you')).toBe(false);
  });
});

// ─── C1: firecrawl.ts ────────────────────────────────────────

describe('C: Firecrawl service', () => {
  it('firecrawlScrape returns error when no API key', async () => {
    const { firecrawlScrape } = await import('../services/firecrawl.js');
    const result = await firecrawlScrape('https://example.com');
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('content');
    // When no key, returns error property
    expect(result.error).toBeTruthy();
  });

  it('extractUrl extracts first URL from message', async () => {
    const { extractUrl } = await import('../services/firecrawl.js');
    expect(extractUrl('check out https://example.com for more')).toBe('https://example.com');
    expect(extractUrl('no url here')).toBeNull();
  });
});

// ─── D1: agentmail.ts ────────────────────────────────────────

describe('D: AgentMail service', () => {
  it('sendAgentMail returns success: false when no API key', async () => {
    const { sendAgentMail } = await import('../services/agentmail.js');
    const result = await sendAgentMail('test@example.com', 'Test Subject', 'Hello');
    expect(result.success).toBe(false);
  });

  it('sendAgentMail returns success boolean', async () => {
    const { sendAgentMail } = await import('../services/agentmail.js');
    const result = await sendAgentMail('test@example.com', 'Test', 'Body');
    expect(typeof result.success).toBe('boolean');
  });
});

// ─── E+F: Scripts ─────────────────────────────────────────────

describe('E+F: Autonomous runner scripts', () => {
  it('openclaw-auto.sh exists and is executable', () => {
    const p = path.join(root, 'scripts/openclaw-auto.sh');
    expect(fs.existsSync(p)).toBe(true);
    const stat = fs.statSync(p);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it('write-phase-prompt.sh exists and is executable', () => {
    const p = path.join(root, 'scripts/write-phase-prompt.sh');
    expect(fs.existsSync(p)).toBe(true);
    const stat = fs.statSync(p);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it('publish-handoff.sh exists and is executable', () => {
    const p = path.join(root, 'scripts/publish-handoff.sh');
    expect(fs.existsSync(p)).toBe(true);
    const stat = fs.statSync(p);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it('openclaw-auto.sh reads from ops/current-phase-prompt.txt', () => {
    const content = fs.readFileSync(path.join(root, 'scripts/openclaw-auto.sh'), 'utf-8');
    expect(content).toContain('current-phase-prompt.txt');
  });

  it('openclaw-auto.sh sends Telegram notification', () => {
    const content = fs.readFileSync(path.join(root, 'scripts/openclaw-auto.sh'), 'utf-8');
    expect(content).toContain('telegram.org');
  });

  it('cronicle job JSON exists and is disabled by default', () => {
    const p = path.join(root, 'ops/cronicle-jobs/openclaw-auto.json');
    expect(fs.existsSync(p)).toBe(true);
    const job = JSON.parse(fs.readFileSync(p, 'utf-8'));
    expect(job.enabled).toBe(false);
  });

  it('publish-handoff.sh publishes AI_HANDOFF.md', () => {
    const content = fs.readFileSync(path.join(root, 'scripts/publish-handoff.sh'), 'utf-8');
    expect(content).toContain('AI_HANDOFF.md');
  });
});

// ─── G: JSON Formatter ───────────────────────────────────────

describe('G: JSON Formatter component', () => {
  it('JsonFormatterPage.tsx exists', () => {
    const p = path.join(root, 'src/dashboard/pages/tools/JsonFormatterPage.tsx');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('AISpecialistPage.tsx exists and imports JsonFormatterPage', () => {
    const p = path.join(root, 'src/dashboard/pages/AISpecialistPage.tsx');
    expect(fs.existsSync(p)).toBe(true);
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('JsonFormatterPage');
  });

  it('JSON formatter has Format button', () => {
    const content = readSrc('dashboard/pages/tools/JsonFormatterPage.tsx');
    expect(content).toContain('Format');
  });

  it('JSON formatter has Minify button', () => {
    const content = readSrc('dashboard/pages/tools/JsonFormatterPage.tsx');
    expect(content).toContain('Minify');
  });

  it('token estimator uses chars/4 formula', () => {
    const content = readSrc('dashboard/pages/tools/JsonFormatterPage.tsx');
    expect(content).toContain('/ 4');
  });

  it('JSON formatter has keyboard shortcuts', () => {
    const content = readSrc('dashboard/pages/tools/JsonFormatterPage.tsx');
    expect(content).toContain('Ctrl+Shift+F');
  });

  it('DashboardApp includes tools page type', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain("'tools'");
    expect(content).toContain('AISpecialistPage');
  });
});

// ─── H: Token stats endpoint ─────────────────────────────────

describe('H: Token stats admin endpoint', () => {
  it('admin.ts has /token-stats route', () => {
    const content = readServer('routes/admin.ts');
    expect(content).toContain('/token-stats');
    expect(content).toContain('compressionRate');
  });

  it('Overview page renders dashboard stats', () => {
    const content = readSrc('dashboard/pages/OverviewPage.tsx');
    // Overhauled page uses greeting + stats cards
    expect(content).toContain('useAuthStore');
    expect(content).toContain('useDashboardStore');
  });
});

// ─── Env keys ────────────────────────────────────────────────

describe('Environment keys', () => {
  it('TAVILY_API_KEY is in .env.example', () => {
    const content = readRoot('.env.example');
    expect(content).toContain('TAVILY_API_KEY');
  });

  it('FIRECRAWL_API_KEY is in .env.example', () => {
    const content = readRoot('.env.example');
    expect(content).toContain('FIRECRAWL_API_KEY');
  });

  it('AGENTMAIL_API_KEY is in .env.example', () => {
    const content = readRoot('.env.example');
    expect(content).toContain('AGENTMAIL_API_KEY');
  });
});

// ─── Message router wiring ────────────────────────────────────

describe('Message router wiring', () => {
  it('imports compressPrompt and trimConversationHistory', () => {
    const content = readServer('modules/agent/services/message-router.ts');
    expect(content).toContain('compressPrompt');
    expect(content).toContain('trimConversationHistory');
  });

  it('imports isSearchIntent and tavilySearch', () => {
    const content = readServer('modules/agent/services/message-router.ts');
    expect(content).toContain('isSearchIntent');
    expect(content).toContain('tavilySearch');
  });

  it('imports extractUrl and web-research for URL scraping', () => {
    const content = readServer('modules/agent/services/message-router.ts');
    expect(content).toContain('extractUrl');
    expect(content).toContain('fetchAndExtract');
  });

  it('compresses systemPrompt before LLM call', () => {
    const content = readServer('modules/agent/services/message-router.ts');
    expect(content).toContain('compressPrompt(systemPrompt)');
  });

  it('logs LLM call stats with token info', () => {
    const content = readServer('modules/agent/services/message-router.ts');
    expect(content).toContain('LLM call stats');
    expect(content).toContain('promptTokens');
    expect(content).toContain('completionTokens');
  });

  it('adds web search results to system prompt', () => {
    const content = readServer('modules/agent/services/message-router.ts');
    expect(content).toContain('WEB_SEARCH_RESULTS');
  });

  it('handles /research command for Firecrawl', () => {
    const content = readServer('modules/agent/services/message-router.ts');
    expect(content).toContain('/research');
    expect(content).toContain('PAGE_CONTENT');
  });
});
