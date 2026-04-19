import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ─────────────────────────────────────────────

vi.mock('../services/llm.js', () => ({
  routeChat: vi.fn(),
}));

vi.mock('../services/action-executor.js', () => ({
  executeAction: vi.fn(),
}));

vi.mock('../../../services/action-parser.js', () => ({
  parseActions: vi.fn(),
}));

vi.mock('../services/delegation-pipeline.js', () => ({
  detectDelegationNeed: vi.fn(() => null),
  executeDelegation: vi.fn(),
}));

vi.mock('../services/agent-state-bus.js', () => ({
  emitThinking: vi.fn(),
  emitToolCall: vi.fn(),
  emitToolResult: vi.fn(),
  emitResponding: vi.fn(),
  emitDone: vi.fn(),
}));

vi.mock('../services/agentflo-bridge.js', () => ({
  isAgentFloAvailable: vi.fn(() => false),
  storePattern: vi.fn(async () => {}),
  retrievePatterns: vi.fn(async () => ({ bestMatch: null })),
}));

vi.mock('../../../logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────

import { runDeepReasoning, type DeepReasoningOptions } from '../services/deep-reasoning.js';
import { routeChat } from '../services/llm.js';
import { executeAction } from '../services/action-executor.js';
import { parseActions } from '../../../services/action-parser.js';
import { detectDelegationNeed, executeDelegation } from '../services/delegation-pipeline.js';

// ── Typed mocks ──────────────────────────────────────────────

const mockRouteChat = vi.mocked(routeChat);
const mockExecuteAction = vi.mocked(executeAction);
const mockParseActions = vi.mocked(parseActions);
const mockDetectDelegation = vi.mocked(detectDelegationNeed);
const mockExecuteDelegation = vi.mocked(executeDelegation);

// ── Fixtures ─────────────────────────────────────────────────

function llmReply(text: string) {
  return {
    reply: text,
    provider: 'groq' as const,
    model: 'llama-3.3-70b',
    tokensIn: 10,
    tokensOut: 20,
    latencyMs: 50,
    costEstimate: 0,
    creditCost: 2,
    intent: 'complex' as const,
  };
}

function successAction(tool: string, message = 'ok') {
  return { tool, success: true, message };
}

const BASE_OPTS: DeepReasoningOptions = {
  systemPrompt: 'You are a deep reasoning agent.',
  userId: 'test-user',
  enableDelegation: false,
  enableReflection: false,
};

const SHORT_MSG = [{ role: 'user' as const, content: 'What is 2+2?' }];

// A message long enough to trigger the planning phase (>100 chars)
const LONG_MSG = [
  {
    role: 'user' as const,
    content:
      'Please help me build a comprehensive data pipeline that reads from multiple sources, ' +
      'transforms the data, and loads it into a data warehouse with proper error handling and monitoring.',
  },
];

// ── Tests ────────────────────────────────────────────────────

describe('runDeepReasoning — simple happy path (no planning)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns immediately when LLM produces no action blocks', async () => {
    mockRouteChat.mockResolvedValue(llmReply('The answer is 4.'));
    mockParseActions.mockReturnValue({ text: 'The answer is 4.', actions: [] });

    const result = await runDeepReasoning(SHORT_MSG, BASE_OPTS);

    expect(result.text).toBe('The answer is 4.');
    expect(result.iterations).toBe(1);
    expect(result.delegationResults).toHaveLength(0);
  });

  it('returns structured result with token counts', async () => {
    mockRouteChat.mockResolvedValue({ ...llmReply('done'), tokensIn: 15, tokensOut: 30 });
    mockParseActions.mockReturnValue({ text: 'done', actions: [] });

    const result = await runDeepReasoning(SHORT_MSG, BASE_OPTS);

    expect(result.tokensIn).toBe(15);
    expect(result.tokensOut).toBe(30);
    expect(result.reflections).toHaveLength(0);
  });
});

describe('runDeepReasoning — plan-then-execute happy path (≥3 steps)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('triggers planning phase for long messages and executes a 3-step plan', async () => {
    // Planning call: returns a pure plan (no actions)
    mockRouteChat
      .mockResolvedValueOnce(llmReply('PLAN:\n1. Read sources\n2. Transform\n3. Load'))  // planning
      .mockResolvedValueOnce(llmReply('<<<ACTION read_data {"source":"db"} ACTION>>>'))  // step 1
      .mockResolvedValueOnce(llmReply('<<<ACTION transform {"format":"json"} ACTION>>>'))// step 2
      .mockResolvedValueOnce(llmReply('<<<ACTION load_data {"dest":"warehouse"} ACTION>>>')) // step 3
      .mockResolvedValueOnce(llmReply('Pipeline complete.'));                             // final

    mockParseActions
      .mockReturnValueOnce({ text: 'PLAN:\n1. Read sources\n2. Transform\n3. Load', actions: [] })
      .mockReturnValueOnce({ text: '', actions: [{ tool: 'read_data', params: { source: 'db' } }] })
      .mockReturnValueOnce({ text: '', actions: [{ tool: 'transform', params: { format: 'json' } }] })
      .mockReturnValueOnce({ text: '', actions: [{ tool: 'load_data', params: { dest: 'warehouse' } }] })
      .mockReturnValueOnce({ text: 'Pipeline complete.', actions: [] });

    mockExecuteAction.mockResolvedValue(successAction('any', 'step done'));

    const result = await runDeepReasoning(LONG_MSG, BASE_OPTS);

    expect(result.text).toBe('Pipeline complete.');
    expect(result.actions.length).toBeGreaterThanOrEqual(3);
    // Planning call + execution calls
    expect(mockRouteChat.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('emits planning step callback when planning phase fires', async () => {
    mockRouteChat
      .mockResolvedValueOnce(llmReply('PLAN:\n1. Step one'))
      .mockResolvedValueOnce(llmReply('Done.'));
    mockParseActions
      .mockReturnValueOnce({ text: 'PLAN:\n1. Step one', actions: [] })
      .mockReturnValueOnce({ text: 'Done.', actions: [] });

    const onStep = vi.fn();
    await runDeepReasoning(LONG_MSG, { ...BASE_OPTS, onStep });

    const stepTypes = onStep.mock.calls.map(([s]) => s.type);
    expect(stepTypes).toContain('planning');
  });
});

describe('runDeepReasoning — HITL confirmation gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('executes a tool inline (deep-reasoning has no HITL pause — that lives in react-loop)', async () => {
    // Deep-reasoning uses executeAction directly (no confirmation gate at this layer).
    // Verify the tool is called without a confirmation step.
    mockRouteChat
      .mockResolvedValueOnce(llmReply('<<<ACTION send_email {"to":"a@b.com"} ACTION>>>'))
      .mockResolvedValueOnce(llmReply('Email sent.'));
    mockParseActions
      .mockReturnValueOnce({ text: '', actions: [{ tool: 'send_email', params: { to: 'a@b.com' } }] })
      .mockReturnValueOnce({ text: 'Email sent.', actions: [] });
    mockExecuteAction.mockResolvedValue(successAction('send_email', 'delivered'));

    const result = await runDeepReasoning(SHORT_MSG, BASE_OPTS);

    expect(mockExecuteAction).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('Email sent.');
  });
});

describe('runDeepReasoning — mid-loop delegation detection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('hands off to a specialist agent when delegation is detected at iteration 1', async () => {
    // i=0: tool call → observation injected → loop continues
    // i=1: delegation detection fires (i===1), then tool call keeps loop alive
    // i=2: no actions → final answer
    mockRouteChat
      .mockResolvedValueOnce(llmReply('<<<ACTION web_search {"query":"x"} ACTION>>>'))  // i=0
      .mockResolvedValueOnce(llmReply('<<<ACTION web_search {"query":"y"} ACTION>>>'))  // i=1
      .mockResolvedValueOnce(llmReply('Final answer after delegation.'));                // i=2

    mockParseActions
      .mockReturnValueOnce({ text: '', actions: [{ tool: 'web_search', params: { query: 'x' } }] })
      .mockReturnValueOnce({ text: '', actions: [{ tool: 'web_search', params: { query: 'y' } }] })
      .mockReturnValueOnce({ text: 'Final answer after delegation.', actions: [] });

    mockExecuteAction.mockResolvedValue(successAction('web_search', 'result'));

    mockDetectDelegation.mockReturnValue({
      targetAgent: 'research' as never,
      reason: 'Needs specialist research agent',
    });

    mockExecuteDelegation.mockResolvedValue({
      id: 'delg-1',
      fromAgent: 'main' as never,
      toAgent: 'research' as never,
      task: 'research task',
      result: 'Research result from specialist',
      success: true,
    });

    const onStep = vi.fn();
    const result = await runDeepReasoning(SHORT_MSG, {
      ...BASE_OPTS,
      agentId: 'main' as never,
      enableDelegation: true,
      onStep,
    });

    expect(mockExecuteDelegation).toHaveBeenCalledTimes(1);
    expect(result.delegationResults).toHaveLength(1);
    expect(result.delegationResults[0].agent).toBe('research');

    const stepTypes = onStep.mock.calls.map(([s]) => s.type);
    expect(stepTypes).toContain('delegating');
  });

  it('continues normally when delegation pipeline returns null (no need to delegate)', async () => {
    mockRouteChat
      .mockResolvedValueOnce(llmReply('<<<ACTION web_search {"query":"y"} ACTION>>>'))
      .mockResolvedValueOnce(llmReply('Done without delegation.'));

    mockParseActions
      .mockReturnValueOnce({ text: '', actions: [{ tool: 'web_search', params: { query: 'y' } }] })
      .mockReturnValueOnce({ text: 'Done without delegation.', actions: [] });

    mockExecuteAction.mockResolvedValue(successAction('web_search', 'found'));
    mockDetectDelegation.mockReturnValue(null);

    const result = await runDeepReasoning(SHORT_MSG, {
      ...BASE_OPTS,
      agentId: 'main' as never,
      enableDelegation: true,
    });

    expect(mockExecuteDelegation).not.toHaveBeenCalled();
    expect(result.delegationResults).toHaveLength(0);
    expect(result.text).toBe('Done without delegation.');
  });
});

describe('runDeepReasoning — iteration cap (10)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('bails out after maxIterations when tool calls never terminate', async () => {
    // Always returns an action — forces the cap
    mockRouteChat.mockResolvedValue(llmReply('<<<ACTION web_search {"query":"loop"} ACTION>>>'));
    mockParseActions.mockReturnValue({
      text: 'still looping',
      actions: [{ tool: 'web_search', params: { query: 'loop' } }],
    });
    mockExecuteAction.mockResolvedValue(successAction('web_search', 'result'));

    const result = await runDeepReasoning(SHORT_MSG, { ...BASE_OPTS, maxIterations: 10 });

    // Must not exceed 10 iterations
    expect(result.iterations).toBeLessThanOrEqual(10);
    expect(typeof result.text).toBe('string');
  });

  it('respects a custom maxIterations override', async () => {
    mockRouteChat.mockResolvedValue(llmReply('<<<ACTION web_search {"query":"x"} ACTION>>>'));
    mockParseActions.mockReturnValue({
      text: 'still going',
      actions: [{ tool: 'web_search', params: { query: 'x' } }],
    });
    mockExecuteAction.mockResolvedValue(successAction('web_search', 'r'));

    const result = await runDeepReasoning(SHORT_MSG, { ...BASE_OPTS, maxIterations: 3 });

    expect(result.iterations).toBeLessThanOrEqual(3);
  });
});

describe('runDeepReasoning — self-reflection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('stores reflections when reflection fires at the threshold iteration', async () => {
    // SELF_REFLECTION_THRESHOLD = 3; fires when i > 0 && i % 3 === 0 && i < maxIter - 1
    // With maxIterations=5: fires at i=3 (3 > 0, 3%3=0, 3 < 4).
    // Provide tool-call responses for i=0..3, reflection call, then final no-action.
    const toolReply = '<<<ACTION web_search {"q":"x"} ACTION>>>';
    const toolAction = { text: '', actions: [{ tool: 'web_search', params: { q: 'x' } }] };

    // i=0,1,2,3 → tool calls
    for (let i = 0; i < 4; i++) {
      mockRouteChat.mockResolvedValueOnce(llmReply(toolReply));
      mockParseActions.mockReturnValueOnce(toolAction);
    }
    // Reflection LLM call (triggered after i=3 observations are injected)
    mockRouteChat.mockResolvedValueOnce(llmReply('REFLECTION: On track.\nNEXT_ACTION: finalize'));
    // i=4 → final answer (loop hits maxIter-1 but we also get a no-action)
    mockRouteChat.mockResolvedValueOnce(llmReply('Final.'));
    mockParseActions.mockReturnValueOnce({ text: 'Final.', actions: [] });

    mockExecuteAction.mockResolvedValue(successAction('web_search', 'r'));

    const result = await runDeepReasoning(SHORT_MSG, {
      ...BASE_OPTS,
      enableReflection: true,
      maxIterations: 5,
    });

    expect(result.reflections.length).toBeGreaterThan(0);
    expect(result.reflections[0]).toContain('REFLECTION');
  });
});
