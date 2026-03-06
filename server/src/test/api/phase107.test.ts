/**
 * Phase 107 Tests — web_search + send_telegram tools + ReAct loop
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { resetDatabase } from '../setup.js';
import { parseActions } from '../../services/action-parser.js';

const app = createApp();

async function getDemoToken(): Promise<string> {
  const res = await request(app).post('/api/auth/demo').expect(200);
  return res.body.token as string;
}

// ── action-parser schema tests ──────────────────────────────

describe('Phase 107 — action-parser: web_search schema', () => {
  it('accepts valid web_search action block', () => {
    const input = `Let me search for that.\n<<<ACTION\n{"tool":"web_search","params":{"query":"latest AI news","max_results":3}}\nACTION>>>`;
    const { actions } = parseActions(input);
    expect(actions).toHaveLength(1);
    expect(actions[0].tool).toBe('web_search');
    expect(actions[0].params.query).toBe('latest AI news');
    expect(actions[0].params.max_results).toBe(3);
  });

  it('defaults max_results to 3 when omitted', () => {
    const input = `<<<ACTION\n{"tool":"web_search","params":{"query":"test"}}\nACTION>>>`;
    const { actions } = parseActions(input);
    expect(actions[0].params.max_results).toBe(3);
  });

  it('rejects web_search with empty query', () => {
    const input = `<<<ACTION\n{"tool":"web_search","params":{"query":""}}\nACTION>>>`;
    const { actions } = parseActions(input);
    expect(actions).toHaveLength(0);
  });

  it('rejects web_search with max_results > 10', () => {
    const input = `<<<ACTION\n{"tool":"web_search","params":{"query":"test","max_results":99}}\nACTION>>>`;
    const { actions } = parseActions(input);
    expect(actions).toHaveLength(0);
  });
});

describe('Phase 107 — action-parser: send_telegram schema', () => {
  it('accepts valid send_telegram action block', () => {
    const input = `<<<ACTION\n{"tool":"send_telegram","params":{"message":"Hello! Here is your summary."}}\nACTION>>>`;
    const { actions } = parseActions(input);
    expect(actions).toHaveLength(1);
    expect(actions[0].tool).toBe('send_telegram');
    expect(actions[0].params.message).toBe('Hello! Here is your summary.');
  });

  it('rejects send_telegram with empty message', () => {
    const input = `<<<ACTION\n{"tool":"send_telegram","params":{"message":""}}\nACTION>>>`;
    const { actions } = parseActions(input);
    expect(actions).toHaveLength(0);
  });

  it('strips action block text from response text', () => {
    const input = `Sending you a message now.\n<<<ACTION\n{"tool":"send_telegram","params":{"message":"hi"}}\nACTION>>>\nDone!`;
    const { text } = parseActions(input);
    expect(text).not.toContain('<<<ACTION');
    expect(text).toContain('Sending you a message now.');
  });
});
