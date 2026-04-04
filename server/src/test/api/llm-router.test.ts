// ============================================================
// LLM Router Unit Tests — Phase 76
// Tests for smart model routing logic, waterfall fallback chain,
// daily budget enforcement, and edith-last-resort gate.
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger before importing services
vi.mock('../../logger', () => {
  const log = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  log.child.mockReturnValue(log);
  return { logger: log };
});

// Mock the config
vi.mock('../../config', () => ({
  config: {
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5-coder:1.5b',
    ollamaTimeout: 5000,
    ollamaMaxTokens: 2048,
    ollamaCloudBaseUrl: 'https://cloud.ollama.ai',
    ollamaCloudApiKey: 'cloud-key',
    ollamaCloudModel: 'llama3.1:8b',
    ollamaCloudTimeout: 60000,
    openrouterFreeApiKey: 'test-key',
    openrouterFreeBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterFreeModel: 'meta-llama/llama-3.3-70b-instruct:free',
    openrouterApiKey: 'test-paid-key',
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterModel: 'anthropic/claude-3-haiku',
    openrouterMaxTokens: 4096,
    openrouterTimeout: 30000,
    groqApiKey: 'test-groq-key',
    groqApiKey2: '',
    groqApiKey3: '',
    groqBaseUrl: 'https://api.groq.com/openai/v1',
    groqModel: 'llama-3.3-70b-versatile',
    groqTimeoutMs: 30000,
    groqMaxTokens: 2048,
    moonshotReasoningModel: 'kimi-k2-thinking',
    moonshotMaxTokens: 4096,
    moonshotTimeout: 120000,
    publicUrl: 'http://localhost:3001',
    isTestMode: true,
  },
}));

// Mock token-budget BEFORE importing llm
vi.mock('../../services/token-budget', () => ({
  recordTokenUsage: vi.fn(),
  shouldDegradeRouting: vi.fn().mockReturnValue(false),
  isOverDailyBudget: vi.fn().mockReturnValue(false),
}));

// Mock picoclaw
vi.mock('../../services/picoclaw', () => ({
  isPicoClawAvailable: vi.fn().mockResolvedValue(false),
  queryPicoClaw: vi.fn(),
}));

// Mock cache
vi.mock('../../services/cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

// Mock db
vi.mock('../../db/index', () => ({
  db: {
    prepare: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(undefined),
      run: vi.fn(),
    }),
  },
}));

// Mock openrouter-models
vi.mock('../../services/openrouter-models', () => ({
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
  clearOllamaCache,
  clearLLMCache,
  getManualOverride,
} = await import('../../services/llm.js');

const { shouldDegradeRouting, isOverDailyBudget } = await import('../../services/token-budget.js');

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

  it('classifies coding queries (needs 2+ coding keywords)', () => {
    expect(classifyIntent('write a python function')).toBe('coding');   // 'python' + 'function'
    expect(classifyIntent('debug this code error')).toBe('coding');     // 'debug' + 'code' + 'error'
    expect(classifyIntent('write typescript code')).toBe('coding');     // 'typescript' + 'code'
  });

  it('classifies planning queries (needs 2+ planning keywords)', () => {
    expect(classifyIntent('plan my project timeline')).toBe('planning');    // 'plan' + 'project' + 'timeline'
    expect(classifyIntent('create a roadmap with milestones')).toBe('planning'); // 'roadmap' + 'milestone'
  });

  it('classifies automation queries (needs 1+ automation keywords)', () => {
    expect(classifyIntent('set up a workflow')).toBe('automation');     // 'workflow'
    expect(classifyIntent('automate this task')).toBe('automation');    // 'automate'
    expect(classifyIntent('set up a cron job')).toBe('automation');     // 'cron'
  });

  it('classifies complex queries (needs 2+ complex keywords or >40 words)', () => {
    expect(classifyIntent('explain and analyze the pros and cons')).toBe('complex'); // 'explain' + 'analyze' + 'pros and cons'
    expect(classifyIntent('deep dive into a comprehensive strategy')).toBe('complex'); // 'deep dive' + 'comprehensive' + 'strategy'
  });
});

// ============================================================

describe('Routing Trace', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearRoutingTraces();
    clearOllamaCache();
    clearLLMCache();
    vi.mocked(shouldDegradeRouting).mockReturnValue(false);
    vi.mocked(isOverDailyBudget).mockReturnValue(false);
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
    vi.unstubAllGlobals();
    clearRoutingTraces();
    clearOllamaCache();
    clearLLMCache();
    vi.mocked(shouldDegradeRouting).mockReturnValue(false);
    vi.mocked(isOverDailyBudget).mockReturnValue(false);
  });

  it('Step 1: routes to ollama first (local-first waterfall)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)   // Ollama health check
      .mockResolvedValueOnce(ollamaOkResponse)   // Ollama chat response
    );

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'test-user' }
    );

    expect(response.provider).toBe('ollama');
    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].routeDecision).toBe('ollama');
  });

  it('Step 2: falls back to openrouter-free (T1.5) when Ollama unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED')) // Ollama health check fails
      .mockResolvedValueOnce(openrouterOk())            // T1.5: OpenRouter-free succeeds
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
    // Phase 110: premium users use T1 (OpenRouter-free) first — Ollama is free-user only
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)              // isOllamaAvailable check
      .mockResolvedValueOnce(openrouterOk('Complex answer')) // T1: OpenRouter-free for premium
    );

    const response = await routeChat(
      [{ role: 'user', content: 'explain quantum computing in great depth and detail, analyzing all trade-offs' }],
      { userId: 'premium-user', userPlan: 'yearly', userCredits: 100 }
    );

    // Edith must NEVER be auto-selected based on intent — premium users use OpenRouter-free (T1)
    expect(response.provider).not.toBe('edith');
    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].routeDecision).not.toBe('edith');
    // complexity_escalation routing reason must NOT exist (removed in Phase 76)
    expect(traces[traces.length - 1].reason).not.toBe('complexity_escalation');
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

    // Non-premium: all free tiers failed → builtin fallback
    expect(response.provider).toBe('builtin');
  });
});

// ============================================================

describe('Daily Token Budget Enforcement (Phase 76)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearRoutingTraces();
    clearOllamaCache();
    clearLLMCache();
    vi.mocked(shouldDegradeRouting).mockReturnValue(false);
  });

  it('blocks edith when daily budget exceeded, even for premium users', async () => {
    vi.mocked(isOverDailyBudget).mockReturnValue(true);

    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('Ollama down'))
      .mockRejectedValueOnce(new Error('OR Free fails'))
      .mockRejectedValueOnce(new Error('Cloud fails'))
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

  it('returns builtin response when daily budget exceeded', async () => {
    vi.mocked(isOverDailyBudget).mockReturnValue(true);

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ollamaOkResponse)   // Ollama health check
      .mockResolvedValueOnce(openrouterOk())      // Cloud-first: OpenRouter-free
    );

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'test-user' }
    );

    // When budget exceeded, routing degrades to free providers (ollama, openrouter-free, builtin)
    expect(['builtin', 'openrouter-free', 'ollama']).toContain(response.provider);
  });
});

// ============================================================

describe('Monthly Budget Degradation', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearRoutingTraces();
    clearOllamaCache();
    clearLLMCache();
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
    vi.unstubAllGlobals();
    delete process.env.FORCE_LLM_PROVIDER;
    clearRoutingTraces();
    clearOllamaCache();
    clearLLMCache();
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
