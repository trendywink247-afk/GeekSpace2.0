import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mock handles (must be declared before vi.mock factories) ─────────

const { mockCacheGet, mockCacheSet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn<() => Promise<string | null>>(async () => null),
  mockCacheSet: vi.fn<() => Promise<void>>(async () => {}),
}));

// ── Module mocks ─────────────────────────────────────────────

vi.mock('../../../config.js', () => ({
  config: {
    isTestMode: true,
    groqApiKey: 'test-groq-key',
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
    openrouterApiKey: 'test-openrouter-key',
    openrouterBaseUrl: 'https://openrouter.test',
    openrouterModel: 'auto',
    openrouterMaxTokens: 4096,
    openrouterTimeout: 30_000,
    togetherApiKey: 'test-together-key',
    togetherBaseUrl: 'https://together.test',
    togetherModel: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    togetherQwenModel: 'Qwen/Qwen3.5-9B-Instruct-Turbo',
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
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

vi.mock('../../../services/picoclaw.js', () => ({
  isPicoClawAvailable: vi.fn(async () => false),
  queryPicoClaw: vi.fn(async () => ({ content: 'pico', tokensIn: 5, tokensOut: 10 })),
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
  isKimiWithinBudget,
  isKimiUserWithinDailyLimit,
  isTogetherWithinDailyBudget,
  resetBudgetWarnThrottle,
  clearOllamaCache,
  clearLLMCache,
  clearRoutingTraces,
  routeChat,
} from '../services/llm.js';
import { logger } from '../../../logger.js';

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

const MESSAGES = [{ role: 'user' as const, content: 'hello' }];
const GROQ_URL = 'api.groq.test';

// ── isKimiWithinBudget ──────────────────────────────────────

describe('isKimiWithinBudget', () => {
  beforeEach(() => {
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
  });

  it('returns true when no spend recorded (null key)', async () => {
    mockCacheGet.mockResolvedValue(null);
    expect(await isKimiWithinBudget()).toBe(true);
  });

  it('returns true when spend is below the monthly budget', async () => {
    mockCacheGet.mockResolvedValue('10000'); // well under 50_000
    expect(await isKimiWithinBudget()).toBe(true);
  });

  it('returns false when spend equals the budget ceiling', async () => {
    mockCacheGet.mockResolvedValue('50000');
    expect(await isKimiWithinBudget()).toBe(false);
  });

  it('returns false when spend exceeds the budget', async () => {
    mockCacheGet.mockResolvedValue('99999');
    expect(await isKimiWithinBudget()).toBe(false);
  });

  it('returns false (fail-closed) when Redis throws', async () => {
    mockCacheGet.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await isKimiWithinBudget()).toBe(false);
  });

  it('logs a warn with code budget_check_unavailable when Redis throws', async () => {
    resetBudgetWarnThrottle();
    const warnSpy = vi.mocked(logger.warn);
    warnSpy.mockClear();
    mockCacheGet.mockRejectedValue(new Error('Redis down'));
    await isKimiWithinBudget();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'budget_check_unavailable', context: 'kimi_monthly' }),
      expect.any(String),
    );
  });
});

// ── isKimiUserWithinDailyLimit ──────────────────────────────

describe('isKimiUserWithinDailyLimit', () => {
  beforeEach(() => {
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
  });

  it('returns true for undefined userId (guest)', async () => {
    expect(await isKimiUserWithinDailyLimit(undefined)).toBe(true);
  });

  it('returns true when user has made 0 calls today', async () => {
    mockCacheGet.mockResolvedValue(null);
    expect(await isKimiUserWithinDailyLimit('u1')).toBe(true);
  });

  it('returns true when user is under the daily limit', async () => {
    mockCacheGet.mockResolvedValue('2'); // limit is 3
    expect(await isKimiUserWithinDailyLimit('u1')).toBe(true);
  });

  it('returns false when user has reached the daily limit', async () => {
    mockCacheGet.mockResolvedValue('3'); // at limit
    expect(await isKimiUserWithinDailyLimit('u1')).toBe(false);
  });

  it('returns false when user has exceeded the daily limit', async () => {
    mockCacheGet.mockResolvedValue('5');
    expect(await isKimiUserWithinDailyLimit('u1')).toBe(false);
  });

  it('returns false (fail-closed) when Redis throws', async () => {
    mockCacheGet.mockRejectedValue(new Error('timeout'));
    expect(await isKimiUserWithinDailyLimit('u1')).toBe(false);
  });

  it('logs a warn with code budget_check_unavailable when Redis throws', async () => {
    resetBudgetWarnThrottle();
    const warnSpy = vi.mocked(logger.warn);
    warnSpy.mockClear();
    mockCacheGet.mockRejectedValue(new Error('Redis down'));
    await isKimiUserWithinDailyLimit('u2');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'budget_check_unavailable', context: 'kimi_user_daily' }),
      expect.any(String),
    );
  });
});

// ── isTogetherWithinDailyBudget ─────────────────────────────

describe('isTogetherWithinDailyBudget', () => {
  beforeEach(() => {
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
  });

  it('returns true when no spend recorded', async () => {
    mockCacheGet.mockResolvedValue(null);
    expect(await isTogetherWithinDailyBudget()).toBe(true);
  });

  it('returns true when spend is below the daily budget', async () => {
    mockCacheGet.mockResolvedValue('50'); // under 100 cents
    expect(await isTogetherWithinDailyBudget()).toBe(true);
  });

  it('returns false when daily budget is reached', async () => {
    mockCacheGet.mockResolvedValue('100'); // at limit
    expect(await isTogetherWithinDailyBudget()).toBe(false);
  });

  it('returns false (fail-closed) when Redis throws', async () => {
    mockCacheGet.mockRejectedValue(new Error('ECONNRESET'));
    expect(await isTogetherWithinDailyBudget()).toBe(false);
  });

  it('logs a warn with code budget_check_unavailable when Redis throws', async () => {
    resetBudgetWarnThrottle();
    const warnSpy = vi.mocked(logger.warn);
    warnSpy.mockClear();
    mockCacheGet.mockRejectedValue(new Error('Redis down'));
    await isTogetherWithinDailyBudget();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'budget_check_unavailable', context: 'together_daily' }),
      expect.any(String),
    );
  });
});

// ── Router fallback when Redis is unavailable ───────────────

describe('routeChat — Redis-down budget guard falls back to Groq', () => {
  beforeEach(() => {
    clearOllamaCache();
    clearLLMCache();
    clearRoutingTraces();
    mockCacheGet.mockReset();
    mockCacheSet.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to Groq when Redis throws during Kimi budget check', async () => {
    // Redis is broken for all reads
    mockCacheGet.mockRejectedValue(new Error('Redis ECONNREFUSED'));

    const fetchStub = vi.fn(async (url: string | URL | Request) => {
      const u = String(url instanceof URL ? url.href : url);
      if (u.includes(GROQ_URL)) {
        return jsonResponse(providerBody('groq-fallback-reply'));
      }
      return jsonResponse({}, 503);
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchStub);

    const res = await routeChat(MESSAGES, { userId: 'u1', userPlan: 'free' });

    // Kimi and Together were skipped (budget gates returned false); Groq handled it
    expect(res.provider).toBe('groq');
    expect(res.reply).toBe('groq-fallback-reply');
  });

  it('never returns a 500 to the client when Redis is unavailable', async () => {
    mockCacheGet.mockRejectedValue(new Error('Redis down'));

    const fetchStub = vi.fn(async (url: string | URL | Request) => {
      const u = String(url instanceof URL ? url.href : url);
      if (u.includes(GROQ_URL)) return jsonResponse(providerBody('ok'));
      return jsonResponse({}, 503);
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchStub);

    // Should resolve (not throw) even with Redis fully broken
    await expect(routeChat(MESSAGES, { userId: 'u1' })).resolves.toBeDefined();
  });
});
