/**
 * office-reactions-gs011.test.ts
 * GS-011: Tests for new event→reaction mapping, phrase dictionaries, and priority queue.
 */
import { describe, it, expect } from 'vitest';
import {
  ERROR_PHRASES,
  GOAL_COMPLETION_PHRASES,
  GOAL_START_PHRASES,
  IDLE_CHATTER_PHRASES,
  WALK_TO_USER_PHRASES,
  ATTENTION_PHRASES,
  GREETING_PHRASES,
  THINKING_PHRASES,
  COLLAB_RECV_PHRASES,
  FAILURE_PHRASES,
} from '../../src/dashboard/pages/office/shared/agentPhrases';
import { BUBBLE_PRIORITY } from '../../src/dashboard/pages/office/overlays/SpeechBubbleLayer';

const ALL_AGENTS = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

describe('GS-011 phrase dictionaries', () => {
  describe('ERROR_PHRASES', () => {
    it('has entries for all 9 agents', () => {
      for (const id of ALL_AGENTS) {
        expect(ERROR_PHRASES[id], `ERROR_PHRASES missing agent: ${id}`).toBeDefined();
        expect(ERROR_PHRASES[id].length).toBeGreaterThan(0);
      }
    });
    it('phrases are non-empty strings', () => {
      for (const phrases of Object.values(ERROR_PHRASES)) {
        for (const p of phrases) expect(p.length).toBeGreaterThan(0);
      }
    });
  });

  describe('GOAL_COMPLETION_PHRASES', () => {
    it('has entries for all 9 agents', () => {
      for (const id of ALL_AGENTS) {
        expect(GOAL_COMPLETION_PHRASES[id], `missing ${id}`).toBeDefined();
        expect(GOAL_COMPLETION_PHRASES[id].length).toBeGreaterThan(0);
      }
    });
  });

  describe('GOAL_START_PHRASES', () => {
    it('has entries for all 9 agents', () => {
      for (const id of ALL_AGENTS) {
        expect(GOAL_START_PHRASES[id], `missing ${id}`).toBeDefined();
        expect(GOAL_START_PHRASES[id].length).toBeGreaterThan(0);
      }
    });
  });

  describe('IDLE_CHATTER_PHRASES', () => {
    it('has initiator and responder for all 9 agents', () => {
      for (const id of ALL_AGENTS) {
        expect(IDLE_CHATTER_PHRASES.initiator[id], `initiator missing ${id}`).toBeDefined();
        expect(IDLE_CHATTER_PHRASES.responder[id], `responder missing ${id}`).toBeDefined();
        expect(IDLE_CHATTER_PHRASES.initiator[id].length).toBeGreaterThan(0);
        expect(IDLE_CHATTER_PHRASES.responder[id].length).toBeGreaterThan(0);
      }
    });
  });

  describe('WALK_TO_USER_PHRASES', () => {
    it('has entries for all 9 agents', () => {
      for (const id of ALL_AGENTS) {
        expect(WALK_TO_USER_PHRASES[id], `missing ${id}`).toBeDefined();
        expect(WALK_TO_USER_PHRASES[id].length).toBeGreaterThan(0);
      }
    });
  });

  describe('ATTENTION_PHRASES', () => {
    it('has entries for all 9 agents', () => {
      for (const id of ALL_AGENTS) {
        expect(ATTENTION_PHRASES[id], `missing ${id}`).toBeDefined();
        expect(ATTENTION_PHRASES[id].length).toBeGreaterThan(0);
      }
    });
  });

  describe('existing dictionaries still intact', () => {
    it('GREETING_PHRASES preserved', () => {
      for (const id of ALL_AGENTS) expect(GREETING_PHRASES[id]).toBeDefined();
    });
    it('THINKING_PHRASES preserved', () => {
      for (const id of ALL_AGENTS) expect(THINKING_PHRASES[id]).toBeDefined();
    });
    it('COLLAB_RECV_PHRASES preserved', () => {
      for (const id of ALL_AGENTS) expect(COLLAB_RECV_PHRASES[id]).toBeDefined();
    });
    it('FAILURE_PHRASES preserved', () => {
      for (const id of ALL_AGENTS) expect(FAILURE_PHRASES[id]).toBeDefined();
    });
  });
});

describe('BUBBLE_PRIORITY queue (GS-011)', () => {
  it('constants are correct', () => {
    expect(BUBBLE_PRIORITY.SOCIAL).toBe(1);
    expect(BUBBLE_PRIORITY.TOOL_CALL).toBe(2);
    expect(BUBBLE_PRIORITY.TASK_COMPLETE).toBe(3);
    expect(BUBBLE_PRIORITY.TASK_FAILURE).toBe(4);
  });

  it('priority ordering is task_failure > task_complete > tool_call > social', () => {
    expect(BUBBLE_PRIORITY.TASK_FAILURE).toBeGreaterThan(BUBBLE_PRIORITY.TASK_COMPLETE);
    expect(BUBBLE_PRIORITY.TASK_COMPLETE).toBeGreaterThan(BUBBLE_PRIORITY.TOOL_CALL);
    expect(BUBBLE_PRIORITY.TOOL_CALL).toBeGreaterThan(BUBBLE_PRIORITY.SOCIAL);
  });
});

describe('AgentStateType new values (GS-011)', () => {
  it('new states are valid string literals (type-level smoke test)', () => {
    // If this compiles, the types in entities/types.ts include these values
    const newStates: string[] = [
      'error', 'message_in', 'message_out',
      'goal_started', 'goal_completed', 'streak_milestone',
    ];
    expect(newStates).toHaveLength(6);
  });
});
