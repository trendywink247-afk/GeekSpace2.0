// ============================================================
// LLM Router Unit Tests
// Tests for smart model routing logic
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
    openrouterFreeApiKey: 'test-key',
    openrouterFreeBaseUrl: 'https://openrouter.ai/api/v1',
    openrouterApiKey: 'test-paid-key',
    openrouterBaseUrl: 'https://openrouter.ai/api/v1',
    moonshotReasoningModel: 'kimi-k2-thinking',
    isTestMode: true,
  },
}));

// Now import after mocks are set up
const {
  classifyIntent,
  routeChat,
  getRoutingTraces,
  clearRoutingTraces,
  getManualOverride,
} = await import('../../src/services/llm');

// Mock fetch for provider availability checks
vi.mock('../../src/services/openrouter-models', () => ({
  getFreeModelList: vi.fn().mockResolvedValue([
    { id: 'meta-llama/llama-3.3-70b-instruct:free', context_length: 128000 },
  ]),
  getCurrentFreeModel: vi.fn().mockResolvedValue('meta-llama/llama-3.3-70b-instruct:free'),
}));

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

describe('Routing Trace', () => {
  beforeEach(() => {
    clearRoutingTraces();
  });

  it('records routing traces', async () => {
    // Mock Ollama as available
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [{ name: 'test' }] }),
    }));

    await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'test-user' }
    );

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

describe('Smart Routing Logic', () => {
  beforeEach(() => {
    clearRoutingTraces();
    vi.unstubAllGlobals();
  });

  it('routes simple queries to Ollama when available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [{ name: 'qwen2.5-coder:1.5b' }] }),
    }));

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'test-user' }
    );

    expect(response.intent).toBe('simple');
    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].routeDecision).toBe('ollama');
  });

  it('routes complex queries with escalation to Edith', async () => {
    vi.stubGlobal('fetch', vi.fn()
      // Ollama available
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [{ name: 'qwen2.5-coder:1.5b' }] }),
      })
      // Edith call succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Complex answer' } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
      })
    );

    const response = await routeChat(
      [{ role: 'user', content: 'explain quantum computing in detail' }],
      { userId: 'test-user', userCredits: 10 }
    );

    expect(response.intent).toBe('complex');
    const traces = getRoutingTraces();
    // Should escalate to Edith for complex tasks
    expect(traces[traces.length - 1].reason).toBe('complexity_escalation');
  });

  it('falls back to OpenRouter Free when Ollama is down', async () => {
    vi.stubGlobal('fetch', vi.fn()
      // Ollama fails
      .mockRejectedValueOnce(new Error('Connection refused'))
      // OpenRouter Free succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Fallback answer' } }],
          usage: { prompt_tokens: 50, completion_tokens: 25 },
        }),
      })
    );

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'test-user' }
    );

    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].ollamaAvailable).toBe(false);
  });

  it('degrades to cheaper provider when over budget', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [{ name: 'test' }] }),
    }));

    // Mock shouldDegradeRouting to return true
    vi.doMock('../../src/services/llm', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        shouldDegradeRouting: () => true,
      };
    });

    const response = await routeChat(
      [{ role: 'user', content: 'hello' }],
      { userId: 'over-budget-user', userCredits: 100 }
    );

    const traces = getRoutingTraces();
    expect(traces[traces.length - 1].reason).toBe('budget_degradation');
  });
});

describe('Manual Override (TEST_MODE only)', () => {
  beforeEach(() => {
    delete process.env.FORCE_LLM_PROVIDER;
    clearRoutingTraces();
  });

  it('respects env var override in TEST_MODE', () => {
    process.env.FORCE_LLM_PROVIDER = 'openrouter-free';
    const override = getManualOverride();
    expect(override).toBe('openrouter-free');
  });

  it('respects header override in TEST_MODE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [{ name: 'test' }] }),
    }));

    const response = await routeChat(
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

  it('ignores override when not in TEST_MODE', () => {
    // Would need to mock config.isTestMode = false
    // Override should return null
  });
});

describe('Fallback Chain', () => {
  beforeEach(() => {
    clearRoutingTraces();
  });

  it('falls back from cloud to Ollama on failure', async () => {
    vi.stubGlobal('fetch', vi.fn()
      // Edith fails
      .mockRejectedValueOnce(new Error('Edith timeout'))
      // Ollama check succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [{ name: 'ollama-model' }] }),
      })
      // Ollama call succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          message: { content: 'Fallback from Ollama' },
          prompt_eval_count: 100,
          eval_count: 50,
        }),
      })
    );

    const response = await routeChat(
      [{ role: 'user', content: 'complex task' }],
      { userId: 'test-user', userCredits: 10 }
    );

    expect(response.provider).toBe('ollama');
  });
});
