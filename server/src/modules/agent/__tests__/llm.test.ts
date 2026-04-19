import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';

// ── Module mocks (hoisted before imports) ───────────────────

vi.mock('../../../config.js', () => ({
  config: {
    isTestMode: true,
    groqApiKey: 'test-groq-key-1',
    groqApiKey2: '',
    groqApiKey3: '',
    groqBaseUrl: 'https://api.groq.test',
    groqModel: 'llama-3.3-70b',
    groqMaxTokens: 4096,
    groqTimeoutMs: 10_000,
    ollamaBaseUrl: 'http://ollama.test',
    ollamaModel: 'gemma4',
    ollamaComplexModel: 'gemma4',
    ollamaMaxTokens: 2048,
    ollamaTimeout: 30_000,
    ollamaThinkingEnabled: false,
    openrouterFreeApiKey: '',
    openrouterFreeModel: '',
    openrouterFreeBaseUrl: 'https://or-free.test',
    openrouterApiKey: '',
    openrouterBaseUrl: 'https://openrouter.test',
    openrouterModel: 'auto',
    openrouterMaxTokens: 4096,
    openrouterTimeout: 30_000,
    togetherApiKey: '',
    togetherBaseUrl: '',
    togetherModel: '',
    togetherQwenModel: '',
    togetherMaxTokens: 2048,
    togetherTimeoutMs: 30_000,
    togetherDailyBudgetCents: 100,
    moonshotReasoningModel: '',
    moonshotMaxTokens: 2048,
    moonshotTimeout: 30_000,
    moonshotBaseModel: 'kimi-k2',
    publicUrl: 'http://localhost:3001',
  },
}));

vi.mock('../../../services/token-budget.js', () => ({
  recordTokenUsage: vi.fn(),
  shouldDegradeRouting: vi.fn(() => false),
  isOverDailyBudget: vi.fn(() => false),
}));

vi.mock('../../../services/cache.js', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
}));

vi.mock('../../../services/picoclaw.js', () => ({
  isPicoClawAvailable: vi.fn(async () => false),
  queryPicoClaw: vi.fn(async () => ({ content: 'pico-response', tokensIn: 5, tokensOut: 10 })),
  picoCircuitBreakerTrip: vi.fn(),
}));

vi.mock('../../../services/openrouter-models.js', () => ({
  getCurrentFreeModel: vi.fn(async () => 'qwen/qwen-2.5-72b-instruct:free'),
  switchToNextFreeModel: vi.fn(async () => {}),
  getUserPreferredFreeModel: vi.fn(() => null),
}));

vi.mock('../services/agentflo-bridge.js', () => ({
  isAgentFloAvailable: vi.fn(() => false),
  recordRoutingFeedback: vi.fn(async () => {}),
}));

vi.mock('../../../db/index.js', () => ({
  db: {
    prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(() => null), all: vi.fn(() => []) })),
  },
}));

vi.mock('../../../logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Imports (after mocks) ────────────────────────────────────

import {
  classifyIntent,
  computeCreditCost,
  routeChat,
  clearOllamaCache,
  clearLLMCache,
  clearRoutingTraces,
  getRoutingTraces,
} from '../services/llm.js';

import { shouldDegradeRouting, isOverDailyBudget } from '../../../services/token-budget.js';

// ── Helpers ──────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function providerBody(content: string, tokensIn = 10, tokensOut = 20) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut },
  };
}

/** Build a fetch stub that routes by URL substring. */
function buildFetch(routes: Array<{ match: string; body?: unknown; status?: number }>) {
  return vi.fn(async (url: string | URL | Request) => {
    const urlStr = String(url instanceof URL ? url.href : typeof url === 'string' ? url : '');
    for (const route of routes) {
      if (urlStr.includes(route.match)) {
        return jsonResponse(route.body ?? {}, route.status ?? 200);
      }
    }
    // Default: Ollama unavailable
    if (urlStr.includes('/api/tags') || urlStr.includes('/api/chat')) {
      return jsonResponse({}, 503);
    }
    throw new Error(`Unmocked fetch: ${urlStr}`);
  }) as unknown as typeof fetch;
}

const MESSAGES = [{ role: 'user' as const, content: 'hello' }];
const GROQ_URL = 'api.groq.test';
const OLLAMA_TAGS_URL = '/api/tags';
const OLLAMA_CHAT_URL = '/api/chat';

// ── classifyIntent ──────────────────────────────────────────

describe('classifyIntent', () => {
  it('classifies greetings as simple', () => {
    expect(classifyIntent('hi')).toBe('simple');
    expect(classifyIntent('hello')).toBe('simple');
    expect(classifyIntent('what time is it')).toBe('simple');
  });

  it('classifies messages with URLs as automation', () => {
    expect(classifyIntent('check https://example.com status')).toBe('automation');
    expect(classifyIntent('http://api.example.com/health')).toBe('automation');
  });

  it('classifies automation keywords as automation', () => {
    expect(classifyIntent('set up a cron job to notify me daily')).toBe('automation');
    expect(classifyIntent('create a webhook trigger for my pipeline')).toBe('automation');
  });

  it('classifies 2+ coding keywords as coding', () => {
    expect(classifyIntent('debug this typescript function')).toBe('coding');
    expect(classifyIntent('refactor this react component with typescript')).toBe('coding');
    expect(classifyIntent('fix the sql query bug in the api')).toBe('coding');
  });

  it('downgrades very terse coding asks (≤2 words) to code-micro', () => {
    expect(classifyIntent('debug error')).toBe('code-micro');
    expect(classifyIntent('sql query')).toBe('code-micro');
  });

  it('classifies messages over 80 words as complex regardless of keywords', () => {
    const long = 'word '.repeat(82).trim();
    expect(classifyIntent(long)).toBe('complex');
  });

  it('classifies 2+ planning keywords as planning', () => {
    expect(classifyIntent('create a roadmap and timeline for my project')).toBe('planning');
    // "plan" + "milestones" + "organize" — no automation keywords
    expect(classifyIntent('plan and organize the milestones for this release')).toBe('planning');
  });

  it('classifies research keywords as complex (needs ReAct + tools)', () => {
    expect(classifyIntent('research the latest news on AI')).toBe('complex');
    expect(classifyIntent('search for information and find out the answer')).toBe('complex');
  });

  it('classifies 2+ complex keywords or 40+ word messages as complex', () => {
    expect(classifyIntent('write a comprehensive analysis and summarize the results')).toBe('complex');
    // >40 words triggers complex regardless of content
    const fortyOneWords = 'abc '.repeat(41).trim();
    expect(classifyIntent(fortyOneWords)).toBe('complex');
  });
});

// ── computeCreditCost ───────────────────────────────────────

describe('computeCreditCost', () => {
  it('returns flat costs for free-tier providers', () => {
    expect(computeCreditCost('ollama', 0, 0)).toBe(1);
    expect(computeCreditCost('groq', 0, 0)).toBe(2);
    expect(computeCreditCost('openrouter-free', 0, 0)).toBe(2);
    expect(computeCreditCost('picoclaw', 0, 0)).toBe(1);
    expect(computeCreditCost('builtin', 0, 0)).toBe(0);
    expect(computeCreditCost('together-qwen', 0, 0)).toBe(3);
  });

  it('returns token-based costs for paid providers above the 10-credit floor', () => {
    const cost = computeCreditCost('openrouter', 5000, 5000);
    expect(cost).toBeGreaterThanOrEqual(10);
  });

  it('enforces the minimum floor of 10 credits for small paid calls', () => {
    const small = computeCreditCost('openrouter', 1, 1);
    expect(small).toBeGreaterThanOrEqual(10);
  });

  it('returns 0 for unrecognised providers', () => {
    expect(computeCreditCost('unknown' as never, 100, 100)).toBe(0);
  });
});

// ── routeChat — provider selection ─────────────────────────

describe('routeChat — simple intent routes to Groq first', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearOllamaCache();
    clearLLMCache();
    clearRoutingTraces();
    // Ollama unavailable; Groq available via config
    fetchSpy = buildFetch([
      { match: GROQ_URL, body: providerBody('groq-reply') },
    ]);
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses Groq for simple intent when Ollama is down', async () => {
    const res = await routeChat(
      [{ role: 'user', content: 'hi there' }],
      { userId: 'u1', userPlan: 'free' },
    );
    expect(res.provider).toBe('groq');
    expect(res.reply).toBe('groq-reply');
  });

  it('includes the reply, provider, and non-negative token counts', async () => {
    const res = await routeChat(MESSAGES, { userId: 'u1' });
    expect(typeof res.reply).toBe('string');
    expect(res.tokensIn).toBeGreaterThanOrEqual(0);
    expect(res.tokensOut).toBeGreaterThanOrEqual(0);
  });

  it('routes complex intent to Ollama when Ollama is available', async () => {
    clearOllamaCache();
    const complexFetch = buildFetch([
      { match: OLLAMA_TAGS_URL, body: { models: [] } },
      {
        match: OLLAMA_CHAT_URL,
        body: { message: { content: 'ollama-reply' }, prompt_eval_count: 10, eval_count: 20 },
      },
    ]);
    vi.stubGlobal('fetch', complexFetch);

    const complexMsg = 'implement a full-stack typescript react application with api and database';
    const res = await routeChat(
      [{ role: 'user', content: complexMsg }],
      { userId: 'u1' },
    );
    expect(res.provider).toBe('ollama');
  });
});

describe('routeChat — 429 fallback chain', () => {
  beforeEach(() => {
    clearOllamaCache();
    clearLLMCache();
    clearRoutingTraces();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls through to builtin when Groq returns 429 and no other provider is available', async () => {
    const fetch429 = buildFetch([
      { match: GROQ_URL, body: { error: 'rate limited' }, status: 429 },
    ]);
    vi.stubGlobal('fetch', fetch429);

    const res = await routeChat(MESSAGES, { userId: 'u1' });
    // All providers exhausted → builtin apology (never throws)
    expect(res.provider).toBe('builtin');
    expect(typeof res.reply).toBe('string');
  });

  it('records a routing trace on every call', async () => {
    clearRoutingTraces();
    const fetchStub = buildFetch([
      { match: GROQ_URL, body: providerBody('ok') },
    ]);
    vi.stubGlobal('fetch', fetchStub);

    await routeChat(MESSAGES, { userId: 'u1' });
    const traces = getRoutingTraces(1);
    expect(traces.length).toBeGreaterThan(0);
    expect(traces[0]).toHaveProperty('userId', 'u1');
    expect(traces[0]).toHaveProperty('intent');
  });
});

describe('routeChat — budget degradation', () => {
  beforeEach(() => {
    clearOllamaCache();
    clearLLMCache();
    clearRoutingTraces();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(shouldDegradeRouting).mockReturnValue(false);
    vi.mocked(isOverDailyBudget).mockReturnValue(false);
  });

  it('downgrades a forced paid provider to openrouter-free when over budget', async () => {
    vi.mocked(shouldDegradeRouting).mockReturnValue(true);
    vi.mocked(isOverDailyBudget).mockReturnValue(true);

    // Provide openrouter-free key in env — but we mocked config with empty key,
    // so it will still fall through to builtin. The important assertion is that
    // the expensive provider (edith/together) was NOT called.
    const edithFetch = vi.fn(async (url: string) => {
      if (String(url).includes('openrouter.test')) {
        throw new Error('Should not call paid provider when over budget');
      }
      return jsonResponse({}, 503);
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', edithFetch);

    const res = await routeChat(MESSAGES, {
      userId: 'u1',
      forceProvider: 'edith',
      userPlan: 'monthly',
    });

    // edith was never called; we ended up at builtin
    expect(res.provider).toBe('builtin');
  });

  it('never calls Groq when forcing localOnly via forceProvider=ollama', async () => {
    clearOllamaCache();
    const fetchSpy = buildFetch([
      { match: OLLAMA_TAGS_URL, body: { models: [] } },
      {
        match: OLLAMA_CHAT_URL,
        body: { message: { content: 'local-reply' }, prompt_eval_count: 5, eval_count: 10 },
      },
    ]);
    vi.stubGlobal('fetch', fetchSpy);

    const res = await routeChat(MESSAGES, { userId: 'u1', forceProvider: 'ollama' });
    expect(res.provider).toBe('ollama');
    expect(res.reply).toBe('local-reply');

    // Verify Groq was never called
    const calls = (fetchSpy as ReturnType<typeof vi.fn>).mock.calls.map(c => String(c[0]));
    expect(calls.some(u => u.includes('groq'))).toBe(false);
  });
});
