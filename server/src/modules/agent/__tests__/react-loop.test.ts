import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ─────────────────────────────────────────────

vi.mock('../services/llm.js', () => ({
  routeChat: vi.fn(),
}));

vi.mock('../services/action-executor.js', () => ({
  executeActionWithRecovery: vi.fn(),
  needsConfirmation: vi.fn(() => false),
  CONFIRM_REQUIRED: new Set<string>(),
}));

vi.mock('../../../services/action-parser.js', () => ({
  parseActions: vi.fn(),
}));

vi.mock('../services/agent-state-bus.js', () => ({
  emitThinking: vi.fn(),
  emitToolCall: vi.fn(),
  emitToolResult: vi.fn(),
  emitResponding: vi.fn(),
  emitDone: vi.fn(),
}));

vi.mock('../services/confirm-action.js', () => ({
  needsConfirmationForUser: vi.fn(() => false),
}));

vi.mock('../services/tool-chain-service.js', () => ({
  recordToolChain: vi.fn(),
}));

vi.mock('../../../logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────

import { runReactLoop, type ReactLoopOptions } from '../services/react-loop.js';
import { routeChat } from '../services/llm.js';
import { executeActionWithRecovery } from '../services/action-executor.js';
import { parseActions } from '../../../services/action-parser.js';
import { needsConfirmationForUser } from '../services/confirm-action.js';

// ── Typed mocks ──────────────────────────────────────────────

const mockRouteChat = vi.mocked(routeChat);
const mockExecuteAction = vi.mocked(executeActionWithRecovery);
const mockParseActions = vi.mocked(parseActions);
const mockNeedsConfirmation = vi.mocked(needsConfirmationForUser);

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
    intent: 'simple' as const,
  };
}

function successAction(tool: string, message = 'ok') {
  return { tool, success: true, message, data: { summary: message } };
}

function failAction(tool: string, message = 'error') {
  return { tool, success: false, message };
}

const DEFAULT_OPTS: ReactLoopOptions = {
  systemPrompt: 'You are a helpful assistant.',
  userId: 'test-user',
};

const USER_MSG = [{ role: 'user' as const, content: 'What is 2+2?' }];

// ── Tests ────────────────────────────────────────────────────

describe('runReactLoop — happy path, no tool use', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns final text when LLM produces no action blocks', async () => {
    mockRouteChat.mockResolvedValue(llmReply('The answer is 4.'));
    mockParseActions.mockReturnValue({ text: 'The answer is 4.', actions: [] });

    const result = await runReactLoop(USER_MSG, DEFAULT_OPTS);

    expect(result.text).toBe('The answer is 4.');
    expect(result.actions).toHaveLength(0);
    expect(mockRouteChat).toHaveBeenCalledTimes(1);
  });

  it('accumulates token counts from the LLM response', async () => {
    mockRouteChat.mockResolvedValue({ ...llmReply('hello'), tokensIn: 15, tokensOut: 25 });
    mockParseActions.mockReturnValue({ text: 'hello', actions: [] });

    const result = await runReactLoop(USER_MSG, DEFAULT_OPTS);

    expect(result.tokensIn).toBe(15);
    expect(result.tokensOut).toBe(25);
    expect(result.creditCost).toBe(2);
  });
});

describe('runReactLoop — two-iteration loop with one tool call', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('executes a tool, feeds observation back, and returns the final answer', async () => {
    // Iteration 0: LLM wants to call web_search
    mockRouteChat
      .mockResolvedValueOnce(llmReply('<<<ACTION web_search {"query":"2+2"} ACTION>>>'))
      .mockResolvedValueOnce(llmReply('The answer is 4.'));

    mockParseActions
      .mockReturnValueOnce({
        text: '',
        actions: [{ tool: 'web_search', params: { query: '2+2' } }],
      })
      .mockReturnValueOnce({ text: 'The answer is 4.', actions: [] });

    mockExecuteAction.mockResolvedValue(successAction('web_search', 'Result: 4'));

    const onStep = vi.fn();
    const result = await runReactLoop(USER_MSG, { ...DEFAULT_OPTS, onStep });

    expect(result.text).toBe('The answer is 4.');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].tool).toBe('web_search');
    expect(result.actions[0].success).toBe(true);
    expect(mockRouteChat).toHaveBeenCalledTimes(2);

    // onStep should have emitted thinking + tool_call + tool_result + drafting
    const types = onStep.mock.calls.map(([s]) => s.type);
    expect(types).toContain('tool_call');
    expect(types).toContain('tool_result');
    expect(types).toContain('drafting');
  });
});

describe('runReactLoop — tool failure becomes observation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('records tool error as TOOL ERROR observation and continues the loop', async () => {
    mockRouteChat
      .mockResolvedValueOnce(llmReply('<<<ACTION web_search {"query":"broken"} ACTION>>>'))
      .mockResolvedValueOnce(llmReply('I could not find the information.'));

    mockParseActions
      .mockReturnValueOnce({
        text: '',
        actions: [{ tool: 'web_search', params: { query: 'broken' } }],
      })
      .mockReturnValueOnce({ text: 'I could not find the information.', actions: [] });

    mockExecuteAction.mockResolvedValue(failAction('web_search', 'Network timeout'));

    const result = await runReactLoop(USER_MSG, DEFAULT_OPTS);

    expect(result.text).toBe('I could not find the information.');
    expect(result.actions[0].success).toBe(false);

    // The second LLM call receives a message containing [TOOL ERROR:]
    const secondCallMessages = mockRouteChat.mock.calls[1][0];
    const observationMsg = secondCallMessages.find(
      (m) => m.role === 'user' && m.content.includes('[TOOL ERROR:'),
    );
    expect(observationMsg).toBeDefined();
  });
});

describe('runReactLoop — malformed tool JSON does not crash', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('handles parse errors from action-parser gracefully', async () => {
    // parseActions returns an empty actions list on parse failure (error handled inside parser)
    mockRouteChat.mockResolvedValue(llmReply('some text with <<<ACTION bad json ACTION>>>'));
    mockParseActions.mockReturnValue({
      text: 'some text with',
      actions: [],
    });

    const result = await runReactLoop(USER_MSG, DEFAULT_OPTS);

    expect(result.text).toBeTruthy();
    // Should not throw; loop terminates cleanly with no actions
    expect(result.actions).toHaveLength(0);
  });
});

describe('runReactLoop — iteration cap (5)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('bails out after 5 iterations when tool calls never stop', async () => {
    // Every LLM call returns an action — forcing the loop to hit its cap
    mockRouteChat.mockResolvedValue(llmReply('<<<ACTION web_search {"query":"loop"} ACTION>>>'));
    mockParseActions.mockReturnValue({
      text: 'thinking...',
      actions: [{ tool: 'web_search', params: { query: 'loop' } }],
    });
    mockExecuteAction.mockResolvedValue(successAction('web_search', 'found something'));

    const result = await runReactLoop(USER_MSG, DEFAULT_OPTS);

    // The loop runs at most MAX_REACT_ITERATIONS (5) times
    expect(mockRouteChat).toHaveBeenCalledTimes(5);
    // Returns whatever text is available on the last iteration
    expect(typeof result.text).toBe('string');
  });
});

describe('runReactLoop — HITL confirmation gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects a tool and injects rejection observation when user declines', async () => {
    mockRouteChat
      .mockResolvedValueOnce(llmReply('<<<ACTION send_email {"to":"x@y.com"} ACTION>>>'))
      .mockResolvedValueOnce(llmReply('I will not send the email.'));

    mockParseActions
      .mockReturnValueOnce({
        text: '',
        actions: [{ tool: 'send_email', params: { to: 'x@y.com' } }],
      })
      .mockReturnValueOnce({ text: 'I will not send the email.', actions: [] });

    // This tool needs confirmation
    mockNeedsConfirmation.mockReturnValue(true);

    const onConfirmNeeded = vi.fn().mockResolvedValue({ approved: false, rejectReason: 'User declined' });

    const result = await runReactLoop(USER_MSG, {
      ...DEFAULT_OPTS,
      onConfirmNeeded,
    });

    expect(onConfirmNeeded).toHaveBeenCalledWith('send_email', { to: 'x@y.com' });
    // No action should have executed
    expect(mockExecuteAction).not.toHaveBeenCalled();

    // The second LLM call should see a REJECTED observation
    const secondCallMessages = mockRouteChat.mock.calls[1][0];
    const rejectionMsg = secondCallMessages.find(
      (m) => m.role === 'user' && m.content.includes('REJECTED'),
    );
    expect(rejectionMsg).toBeDefined();
    expect(result.text).toBe('I will not send the email.');
  });

  it('approves a tool and executes it when user confirms', async () => {
    mockRouteChat
      .mockResolvedValueOnce(llmReply('<<<ACTION send_email {"to":"ok@y.com"} ACTION>>>'))
      .mockResolvedValueOnce(llmReply('Email sent!'));

    mockParseActions
      .mockReturnValueOnce({
        text: '',
        actions: [{ tool: 'send_email', params: { to: 'ok@y.com' } }],
      })
      .mockReturnValueOnce({ text: 'Email sent!', actions: [] });

    mockNeedsConfirmation.mockReturnValue(true);
    mockExecuteAction.mockResolvedValue(successAction('send_email', 'delivered'));

    const onConfirmNeeded = vi.fn().mockResolvedValue({ approved: true });
    const result = await runReactLoop(USER_MSG, { ...DEFAULT_OPTS, onConfirmNeeded });

    expect(mockExecuteAction).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('Email sent!');
  });
});

describe('runReactLoop — deferred actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('defers generate_code actions without executing them', async () => {
    mockRouteChat.mockResolvedValue(llmReply('<<<ACTION generate_code {"html":"<h1>hi</h1>"} ACTION>>>'));
    mockParseActions.mockReturnValue({
      text: 'here is your page',
      actions: [{ tool: 'generate_code', params: { html: '<h1>hi</h1>' } }],
    });

    const result = await runReactLoop(USER_MSG, DEFAULT_OPTS);

    expect(result.deferredActions).toHaveLength(1);
    expect(result.deferredActions[0].tool).toBe('generate_code');
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });
});
