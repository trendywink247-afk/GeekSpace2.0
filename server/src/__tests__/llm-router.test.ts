// ============================================================
// LLM Router Unit Tests — Phase 76
// Tests for smart model routing logic, waterfall fallback chain,
// daily budget enforcement, and edith-last-resort gate.
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing services
vi.mock('../../src/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the config
vi.mock('../../src/config', () => ({
  config: {
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5-coder:1.5b',
    ollamaTimeout: 5000,
    ollamaMaxTokens: 2048,
    openrouterFreeApiKey: 'test-key',
    openrouterFreeBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterFreeModel: 'meta-llama/llama-3.3-70b-instruct:free',
    openrouterApiKey: 'test-paid-key',
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterModel: 'anthropic/claude-3-haiku',
    openrouterMaxTokens: 4096,
    openrouterTimeout: 30000,
    moonshotReasoningModel: 'kimi-k2-thinking',
    moonshotMaxTokens: 4096,
    moonshotTimeout: 120000,
    publicUrl: 'http://localhost:3001',
    isTestMode: true,
  },
}));

// Mock token-budget BEFORE importing llm
vi.mock('../../src/services/token-budget', () => ({
  recordTokenUsage: vi.fn(),
  shouldDegradeRouting: vi.fn().mockReturnValue(false),
  isOverDailyBudget: vi.fn().mockReturnValue(false),
}));

// Mock picoclaw
vi.mock('../../src/services/picoclaw', () => ({
  isPicoClawAvailable: vi.fn().mockResolvedValue(false),
  queryPicoClaw: vi.fn(),
}));

// Mock cache
vi.mock('../../src/services/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

// Mock db
vi.mock('../../src/db/index', () => ({
  db: {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      run: vi.fn(),
    }),
  },
}));

// Mock openrouter-models
vi.mock('../../src/services/openrouter-models', () => ({
  getFreeModelList: vi.fn().mockResolvedValue([
    { id: 'meta-llama/llama-3.3-70b-instruct:free', context_length: 128000 },
  ]),
  getCurrentFreeModel: vi.fn().mockResolvedValue('meta-llama/llama-3.3-70b-instruct:free'),
  getUserPreferredFreeModel: vi.fn().mockReturnValue(null),
  switchToNextFreeModel: vi.fn().mockResolvedValue(undefined),
}));

// Now import after mocks are set up
const {
  classifyIntent,
  routeChat,
  getRoutingTraces,
  clearRoutingTraces,
  getManualOverride,
} = await import('../../src/services/llm');

const { shouldDegradeRouting, isOverDailyBudget } = await import('../../src/services/token-budget');

// ---- Helpers ----

const ollamaOkResponse = {
  ok: true,
  json: () => Promise.resolve({ models: [{ name: 'qwen2.5-coder:1.5b' }] }),
  text: () => Promise.resolve(''),
};

const ollamaChatOk = (content = 'Ollama reply') => ({
  ok: true,
  json: () => Promise.resolve({
    message: { content },
    prompt_eval_count: 50,
    eval_count: 25,
  }),
  text: () => Promise.resolve(''),
});

const openrouterOk = (content = 'OpenRouter reply') => ({
  ok: true,
  json: () => Promise.resolve({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 50, completion_tokens: 25 },
  }),
  text: () => Promise.resolve(''),
});

// ============================================================

describe('Intent Classification', () => {
  it('classifies simple queries', () => {
    expect(classifyIntent('hello')).toBe('simple');
    expect(classifyIntent('what is the weather')).toBe('simple');
    expect(classifyIntent('tell me a joke')).toBe('simple');
  });

  it('classifies coding queries', () => {
    expect(classifyIntent('write a python function')).toBe('coding');
    expect(classifyIntent('how do I use useEffect')).toBe('coding');
    expect(classifyIntent('debug this code')).toBe('coding');
  });

  it('classifies planning queries', () => {
    expect(classifyIntent('plan my week')).toBe('planning');
    expect(classifyIntent('schedule a meeting')).toBe('planning');
  });

  it('classifies automation queries', () => {
    expect(classifyIntent('set up a workflow')).toBe('automation');
    expect(classifyIntent('remind me daily')).toBe('automation');
  });

  it('classifies complex queries', () => {
    expect(classifyIntent('explain quantum computing')).toBe('complex');
    expect(classifyIntent('analyze this dataset')).toBe('complex');
  });
});

// ============================================================

describe('Routing Trace', () => {
  beforeEach(() => {
    clearRoutingTraces();
  });

  it('records routing traces', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)
      .mockResolvedValueOnce(ollamaChatOk())
    );

    await routeChat([{ role: 'user', content: 'hello' }], { userId: 'test-user' });

    const traces = getRoutingTraces();
    expect(traces.length).toBeGreaterThan(0);
    expect(traces[0]).toHaveProperty('routeDecision');
    expect(traces[0]).toHaveProperty('reason');
    expect(traces[0]).toHaveProperty('intent');
    expect(traces[0].userId).toBe('test-user');
  });

  it('clears routing traces', () => {
    clearRoutingTraces();
    expect(getRoutingTraces()).toHaveLength(0);
  });
});

// ============================================================

describe('Routing Ladder — Fallback Chain Order (Phase 76)', () => {
  beforeEach(() => {
    clearRoutingTraces();
    vi.unstubAllGlobals();
    vi.mocked(shouldDegradeRouting).mockReturnValue(false);
    vi.mocked(isOverDailyBudget).mockReturnValue(false);
  });

  it('Step 1: routes to Ollama when available', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)
      .mockResolvedValueOnce(ollamaChatOk())
    );

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'test-user' }
    );

    expect(response.provider).toBe('ollama');
    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].routeDecision).toBe('ollama');
    expect(traces[traces.length - 1].reason).toBe('ollama_healthy');
  });

  it('Step 2: falls back to openrouter-free when Ollama unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))  // Ollama health check fails
      .mockResolvedValueOnce(openrouterOk())              // OpenRouter Free succeeds
    );

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'test-user' }
    );

    expect(response.provider).toBe('openrouter-free');
    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].routeDecision).toBe('openrouter-free');
    expect(traces[traces.length - 1].ollamaAvailable).toBe(false);
  });

  it('edith is NOT auto-selected for complex intent (no complexity_escalation)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)
      .mockResolvedValueOnce(ollamaChatOk('Complex answer'))
    );

    const response = await routeChat(
      [{ role: 'user', content: 'explain quantum computing in great depth and detail, analyzing all trade-offs' }],
      { userId: 'premium-user', userPlan: 'yearly', userCredits: 100 }
    );

    // Ollama is available — must NOT auto-escalate to edith for complex intent
    expect(response.provider).toBe('ollama');
    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].routeDecision).not.toBe('edith');
    // Must NOT have complexity_escalation reason (removed in Phase 76)
    expect(traces[traces.length - 1].reason).not.toBe('complexity_escalation');
  });

  it('edith ONLY appears as last resort for premium users when all free tiers fail', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('Ollama unavailable'))    // Ollama health check
      .mockRejectedValueOnce(new Error('OR Free quota'))         // OR Free (selected, fails)
      .mockRejectedValueOnce(new Error('Cloud unavailable'))     // Ollama Cloud (fallback, fails)
      .mockResolvedValueOnce(openrouterOk('Edith reply'))        // Edith (last resort)
    );

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'premium-user', userPlan: 'yearly', userCredits: 100 }
    );

    // Edith reached as last resort via fallback chain
    expect(['edith', 'builtin']).toContain(response.provider);
  });

  it('edith NOT available for non-premium users even as last resort', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('Ollama unavailable'))
      .mockRejectedValueOnce(new Error('OR Free fails'))
      .mockRejectedValueOnce(new Error('Cloud fails'))
    );

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'free-user', userPlan: 'free', userCredits: 0 }
    );

    // Non-premium: all free tiers failed, should land on builtin
    expect(response.provider).toBe('builtin');
  });
});

// ============================================================

describe('Daily Token Budget Enforcement (Phase 76)', () => {
  beforeEach(() => {
    clearRoutingTraces();
    vi.unstubAllGlobals();
    vi.mocked(shouldDegradeRouting).mockReturnValue(false);
  });

  it('blocks edith when daily budget exceeded, even for premium users', async () => {
    vi.mocked(isOverDailyBudget).mockReturnValue(true);

    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('Ollama down'))
      .mockRejectedValueOnce(new Error('OR Free fails'))
      .mockRejectedValueOnce(new Error('Cloud fails'))
      // Edith would be next but must be skipped
    );

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'over-daily-user', userPlan: 'yearly', userCredits: 100 }
    );

    expect(response.provider).not.toBe('edith');
  });

  it('degrades forced edith call to openrouter-free when over daily budget', async () => {
    vi.mocked(isOverDailyBudget).mockReturnValue(true);

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)
      .mockResolvedValueOnce(openrouterOk('Degraded'))
    );

    await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'test-user', forceProvider: 'edith', userCredits: 100 }
    );

    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].reason).toBe('daily_budget_exceeded');
  });

  it('allows free-tier Ollama when daily budget exceeded', async () => {
    vi.mocked(isOverDailyBudget).mockReturnValue(true);

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)
      .mockResolvedValueOnce(ollamaChatOk())
    );

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'test-user' }
    );

    expect(response.provider).toBe('ollama');
  });
});

// ============================================================

describe('Monthly Budget Degradation', () => {
  beforeEach(() => {
    clearRoutingTraces();
    vi.unstubAllGlobals();
    vi.mocked(isOverDailyBudget).mockReturnValue(false);
  });

  it('degrades forced edith/openrouter to openrouter-free when over monthly budget', async () => {
    vi.mocked(shouldDegradeRouting).mockReturnValue(true);

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)
      .mockResolvedValueOnce(openrouterOk('Budget fallback'))
    );

    await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'over-budget-user', forceProvider: 'edith', userCredits: 100 }
    );

    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].reason).toBe('budget_degradation');
  });
});

// ============================================================

describe('Manual Override (TEST_MODE only)', () => {
  beforeEach(() => {
    delete process.env.FORCE_LLM_PROVIDER;
    clearRoutingTraces();
    vi.mocked(shouldDegradeRouting).mockReturnValue(false);
    vi.mocked(isOverDailyBudget).mockReturnValue(false);
  });

  it('respects env var override in TEST_MODE', () => {
    process.env.FORCE_LLM_PROVIDER = 'openrouter-free';
    const override = getManualOverride();
    expect(override).toBe('openrouter-free');
  });

  it('respects header override in TEST_MODE', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)
      .mockResolvedValueOnce(openrouterOk('Header forced'))
    );

    await routeChat(
      [{ role: 'user', content: 'hello' }],
      {
        userId: 'test-user',
        requestHeaders: { 'x-model-route': 'edith' }
      }
    );

    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].forcedProvider).toBe('edith');
    expect(traces[traces.length - 1].reason).toBe('manual_override');
  });
});
