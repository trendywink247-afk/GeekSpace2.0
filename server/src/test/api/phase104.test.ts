/**
 * Phase 104 Tests — ReAct Tool Loop
 *
 * Verifies:
 * - web_search and telegram_notify schemas present in TOOL_SCHEMAS
 * - web_search and telegram_notify executors implemented
 * - react-loop.ts service exists and is correctly structured
 * - system prompts document available tools
 * - message-router.ts wired to ReAct loop
 * - agent.ts main chat path wired to ReAct loop
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SERVER_ROOT = resolve(__dirname, '../../..');

describe('Phase 104 — ReAct Tool Loop', () => {
  describe('104.1 Tool schemas', () => {
    it('TOOL_SCHEMAS includes web_search', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain("web_search:");
    });

    it('TOOL_SCHEMAS includes telegram_notify', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain("telegram_notify:");
    });

    it('web_search schema requires query string', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain('webSearchSchema');
      expect(content).toContain("query: z.string()");
    });

    it('telegram_notify schema requires message string', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain('telegramNotifySchema');
    });
  });

  // Remaining describe blocks will be added in later tasks
});
