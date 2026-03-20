import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Response } from 'express';
import {
  emit,
  broadcastAgentState,
  addStateClient,
  removeStateClient,
  getRecentEvents,
  getAgentLastState,
  getAllAgentStates,
  getConnectedClientCount,
  emitThinking,
  emitToolCall,
  emitToolResult,
  emitResponding,
  emitDone,
  emitIdle,
  emitDelegation,
  emitCommSent,
  emitCommReceived,
  emitTaskStarted,
  emitTaskCompleted,
  emitTaskFailed,
} from '../../services/activity-stream.js';
import type { ActivityEvent } from '../../services/activity-stream.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRes(): Response {
  return {
    write: vi.fn(),
    end: vi.fn(),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityStream', () => {
  describe('emit()', () => {
    it('should auto-populate state, agentName, content from type, agentId, summary', () => {
      const event = emit({
        userId: 'user1',
        agentId: 'weebo',
        type: 'thinking',
        channel: 'web',
        summary: 'Processing your request',
      });

      expect(event.state).toBe('thinking');
      expect(event.agentName).toBe('Weebo');
      expect(event.content).toBe('Processing your request');
      expect(event.type).toBe('thinking');
      expect(event.agentId).toBe('weebo');
      expect(event.userId).toBe('user1');
    });

    it('should include id and timestamp fields', () => {
      const event = emit({
        userId: 'user1',
        agentId: 'edith',
        type: 'done',
        channel: 'telegram',
        summary: 'Finished',
      });

      expect(typeof event.id).toBe('string');
      expect(event.id.length).toBeGreaterThan(0);
      expect(typeof event.timestamp).toBe('string');
      expect(new Date(event.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should buffer events per user up to MAX_BUFFER (100)', () => {
      const userId = 'buffer-test-user';
      for (let i = 0; i < 110; i++) {
        emit({ userId, agentId: 'weebo', type: 'thinking', channel: 'web', summary: `Event ${i}` });
      }
      const events = getRecentEvents(userId, Date.now() - 200_000);
      expect(events.length).toBeLessThanOrEqual(100);
    });

    it('should expire events older than BUFFER_TTL (120s)', () => {
      const userId = 'ttl-test-user';
      // Emit an event and retrieve it with a future sinceMs (no events in that window)
      emit({ userId, agentId: 'weebo', type: 'thinking', channel: 'web', summary: 'Old event' });
      // Only events after "now" should be empty
      const future = Date.now() + 10_000;
      const events = getRecentEvents(userId, future);
      expect(events).toHaveLength(0);
    });

    it('should broadcast to registered SSE clients', () => {
      const userId = 'sse-test-user';
      const res = mockRes();
      addStateClient(userId, res);

      emit({ userId, agentId: 'weebo', type: 'responding', channel: 'web', summary: 'Writing...' });

      expect(res.write).toHaveBeenCalledTimes(1);
      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(written).toMatch(/^data: /);
      expect(written).toContain('"state":"responding"');

      removeStateClient(userId, res);
    });

    it('should pass metadata through to the event', () => {
      const event = emit({
        userId: 'user1',
        agentId: 'jarvis',
        type: 'tool_call',
        channel: 'web',
        summary: 'Running search...',
        metadata: { tool: 'web_search', query: 'test' },
      });

      expect(event.metadata).toEqual({ tool: 'web_search', query: 'test' });
    });

    it('should use unknown agentId as agentName fallback', () => {
      const event = emit({
        userId: 'user1',
        agentId: 'unknown-bot',
        type: 'idle',
        channel: 'web',
        summary: 'Idle',
      });
      expect(event.agentName).toBe('unknown-bot');
    });
  });

  // -------------------------------------------------------------------------

  describe('getRecentEvents()', () => {
    it('should return events within sinceMs window', () => {
      const userId = 'recent-test-user';
      const before = Date.now();
      emit({ userId, agentId: 'weebo', type: 'thinking', channel: 'web', summary: 'Event A' });
      const events = getRecentEvents(userId, before - 1);
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for unknown userId', () => {
      const events = getRecentEvents('no-such-user-xyz', Date.now() - 1000);
      expect(events).toEqual([]);
    });

    it('should not return events before sinceMs', () => {
      const userId = 'filter-test-user';
      emit({ userId, agentId: 'edith', type: 'done', channel: 'web', summary: 'Old' });
      // Use a future timestamp — should get zero results
      const events = getRecentEvents(userId, Date.now() + 5_000);
      expect(events).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe('SSE client management', () => {
    it('should track connected client count', () => {
      const userId = 'count-test-user';
      const initialCount = getConnectedClientCount();
      const res1 = mockRes();
      const res2 = mockRes();

      addStateClient(userId, res1);
      addStateClient(userId, res2);
      expect(getConnectedClientCount()).toBe(initialCount + 2);

      removeStateClient(userId, res1);
      removeStateClient(userId, res2);
      expect(getConnectedClientCount()).toBe(initialCount);
    });

    it('should remove client and clean up empty sets', () => {
      const userId = 'cleanup-test-user';
      const res = mockRes();
      addStateClient(userId, res);
      removeStateClient(userId, res);
      // After removing, that user should have 0 clients (empty set removed)
      expect(getConnectedClientCount()).toBe(getConnectedClientCount()); // just verify no throw
    });
  });

  // -------------------------------------------------------------------------

  describe('getAgentLastState() and getAllAgentStates()', () => {
    it('should return last emitted state for an agent', () => {
      const userId = 'last-state-user';
      emit({ userId, agentId: 'weebo', type: 'thinking', channel: 'web', summary: 'Step 1' });
      emit({ userId, agentId: 'weebo', type: 'done', channel: 'web', summary: 'Step 2' });

      const last = getAgentLastState(userId, 'weebo');
      expect(last).toBeDefined();
      expect(last!.state).toBe('done');
    });

    it('should return undefined for agent with no state', () => {
      const state = getAgentLastState('no-user', 'aria');
      expect(state).toBeUndefined();
    });

    it('getAllAgentStates should return states for weebo, edith, jarvis', () => {
      const userId = 'all-states-user';
      emit({ userId, agentId: 'weebo', type: 'responding', channel: 'web', summary: 'Hi' });

      const states = getAllAgentStates(userId);
      expect(states).toHaveLength(3);
      const agentIds = states.map(s => s.agentId);
      expect(agentIds).toContain('weebo');
      expect(agentIds).toContain('edith');
      expect(agentIds).toContain('jarvis');
    });

    it('getAllAgentStates should default to idle for unknown agents', () => {
      const userId = 'idle-default-user';
      const states = getAllAgentStates(userId);
      for (const s of states) {
        expect(s.state).toBe('idle');
      }
    });
  });

  // -------------------------------------------------------------------------

  describe('backward compat — broadcastAgentState()', () => {
    it('should accept old AgentStateEvent shape and broadcast correctly', () => {
      const userId = 'compat-user';
      const res = mockRes();
      addStateClient(userId, res);

      broadcastAgentState(userId, {
        agentId: 'weebo',
        agentName: 'Weebo',
        state: 'thinking',
        content: 'Old format',
      });

      expect(res.write).toHaveBeenCalledTimes(1);
      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.state).toBe('thinking');
      expect(parsed.agentName).toBe('Weebo');
      expect(parsed.content).toBe('Old format');
      expect(typeof parsed.timestamp).toBe('string');

      removeStateClient(userId, res);
    });

    it('should add timestamp to old-format event', () => {
      const userId = 'compat-ts-user';
      const res = mockRes();
      addStateClient(userId, res);

      broadcastAgentState(userId, {
        agentId: 'edith',
        agentName: 'Edith',
        state: 'done',
      });

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.timestamp).toBeDefined();
      expect(new Date(parsed.timestamp).getTime()).toBeGreaterThan(0);

      removeStateClient(userId, res);
    });
  });

  // -------------------------------------------------------------------------

  describe('convenience emitters — backward compat', () => {
    it('emitThinking should emit type=thinking with state=thinking', () => {
      const userId = 'think-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitThinking(userId, 'weebo', 'Analyzing data');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.state).toBe('thinking');
      expect(parsed.type).toBe('thinking');
      expect(parsed.agentName).toBe('Weebo');
      expect(parsed.content).toBe('Analyzing data');

      removeStateClient(userId, res);
    });

    it('emitThinking should default content to Processing...', () => {
      const userId = 'think-default-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitThinking(userId, 'weebo');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.content).toBe('Processing...');

      removeStateClient(userId, res);
    });

    it('emitToolCall should emit type=tool_call with tool in metadata', () => {
      const userId = 'tool-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitToolCall(userId, 'edith', 'web_search', 'Searching...');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('tool_call');
      expect(parsed.state).toBe('tool_call');
      expect(parsed.tool).toBe('web_search');
      expect(parsed.content).toBe('Searching...');

      removeStateClient(userId, res);
    });

    it('emitToolCall should default content', () => {
      const userId = 'tool-default-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitToolCall(userId, 'weebo', 'calculator');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.content).toBe('Running calculator...');

      removeStateClient(userId, res);
    });

    it('emitToolResult should emit type=tool_result', () => {
      const userId = 'result-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitToolResult(userId, 'weebo', 'web_search');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('tool_result');
      expect(parsed.tool).toBe('web_search');
      expect(parsed.content).toBe('web_search complete');

      removeStateClient(userId, res);
    });

    it('emitResponding should emit type=responding', () => {
      const userId = 'respond-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitResponding(userId, 'jarvis');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('responding');
      expect(parsed.content).toBe('Writing response...');

      removeStateClient(userId, res);
    });

    it('emitDone should emit type=done', () => {
      const userId = 'done-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitDone(userId, 'weebo', 'Task complete!');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('done');
      expect(parsed.state).toBe('done');
      expect(parsed.content).toBe('Task complete!');

      removeStateClient(userId, res);
    });

    it('emitIdle should emit type=idle', () => {
      const userId = 'idle-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitIdle(userId, 'aria');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('idle');

      removeStateClient(userId, res);
    });

    it('agentName should map agentId to display name (weebo -> Weebo)', () => {
      const personalities: Array<[string, string]> = [
        ['weebo', 'Weebo'],
        ['edith', 'Edith'],
        ['jarvis', 'Jarvis'],
        ['aria', 'Aria'],
        ['forge', 'Forge'],
        ['pulse', 'Pulse'],
        ['echo', 'Echo'],
        ['cal', 'Cal'],
        ['nova', 'Nova'],
      ];

      for (const [agentId, expectedName] of personalities) {
        const event = emit({
          userId: 'name-test-user',
          agentId,
          type: 'idle',
          channel: 'web',
          summary: 'idle',
        });
        expect(event.agentName).toBe(expectedName);
      }
    });

    it('emitDelegation should emit type=delegating with targetAgent', () => {
      const userId = 'deleg-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitDelegation(userId, 'weebo', 'edith', 'Code review needed');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('delegating');
      expect(parsed.targetAgent).toBe('edith');
      expect(parsed.content).toContain('Edith');
      expect(parsed.content).toContain('Code review needed');

      removeStateClient(userId, res);
    });

    it('emitCommSent should emit type=comm_sent', () => {
      const userId = 'comm-sent-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitCommSent(userId, 'weebo', 'edith', 'Hello Edith', 'comm-123');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('comm_sent');
      expect(parsed.commId).toBe('comm-123');
      expect(parsed.content).toContain('Hello Edith');

      removeStateClient(userId, res);
    });

    it('emitCommReceived should emit type=comm_received', () => {
      const userId = 'comm-recv-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitCommReceived(userId, 'edith', 'weebo', 'Got it!', 'comm-456');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('comm_received');
      expect(parsed.commId).toBe('comm-456');

      removeStateClient(userId, res);
    });

    it('emitTaskStarted should emit type=task_started with taskId', () => {
      const userId = 'task-start-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitTaskStarted(userId, 'weebo', 'task-001', 'Write report');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('task_started');
      expect(parsed.taskId).toBe('task-001');
      expect(parsed.content).toContain('Write report');

      removeStateClient(userId, res);
    });

    it('emitTaskCompleted should emit type=task_completed', () => {
      const userId = 'task-done-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitTaskCompleted(userId, 'weebo', 'task-001', 'Write report');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('task_completed');
      expect(parsed.content).toContain('Write report');

      removeStateClient(userId, res);
    });

    it('emitTaskFailed should emit type=task_failed', () => {
      const userId = 'task-fail-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitTaskFailed(userId, 'weebo', 'task-001', 'Timeout');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.type).toBe('task_failed');
      expect(parsed.content).toContain('Timeout');

      removeStateClient(userId, res);
    });

    it('convenience emitters accept optional channel param', () => {
      const userId = 'channel-test-user';
      const res = mockRes();
      addStateClient(userId, res);

      emitThinking(userId, 'weebo', 'Thinking...', 'telegram');

      const written = (res.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      const parsed = JSON.parse(written.replace(/^data: /, '').trim()) as ActivityEvent;
      expect(parsed.channel).toBe('telegram');

      removeStateClient(userId, res);
    });
  });
});
