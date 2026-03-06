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
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '../../..');

describe('Phase 104 — ReAct Tool Loop', () => {
  describe('104.1 Tool schemas', () => {
    it('TOOL_SCHEMAS includes web_search', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain("web_search:");
    });

    it('TOOL_SCHEMAS includes telegram_notify', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain("telegram_notify:");
    });

    it('web_search schema requires query string', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain('webSearchSchema');
      expect(content).toContain("query: z.string()");
    });

    it('telegram_notify schema requires message string', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain('telegramNotifySchema');
      expect(content).toContain("message: z.string()");
    });
  });

  describe('104.2 Executors', () => {
    it('action-executor.ts handles web_search', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/action-executor.ts'), 'utf-8');
      expect(content).toContain("case 'web_search':");
      expect(content).toContain('tavilySearch');
    });

    it('action-executor.ts handles telegram_notify', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/action-executor.ts'), 'utf-8');
      expect(content).toContain("case 'telegram_notify':");
      expect(content).toContain('sendTelegramMessage');
    });
  });

  describe('104.3 ReAct loop service', () => {
    it('react-loop.ts file exists', () => {
      expect(existsSync(path.resolve(SERVER_ROOT, 'src/services/react-loop.ts'))).toBe(true);
    });

    it('exports runReActLoop function', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('export async function runReActLoop');
    });

    it('defines MAX_REACT_ITERATIONS = 5', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('MAX_REACT_ITERATIONS = 5');
    });

    it('injects observations back into messages', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('[OBSERVATION');
    });

    it('returns accumulated observations on max iterations', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('MAX_REACT_ITERATIONS');
      expect(content).toContain('observations');
    });

    it('calls onStatus for each tool execution', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('onStatus');
    });
  });

  describe('104.4 System prompt documents tools', () => {
    it('agent.ts buildSystemPrompt mentions web_search tool', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/routes/agent.ts'), 'utf-8');
      expect(content).toContain('web_search');
    });

    it('agent.ts buildSystemPrompt mentions <<<ACTION>>> format', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/routes/agent.ts'), 'utf-8');
      expect(content).toContain('<<<ACTION');
    });

    it('message-router.ts buildChannelSystemPrompt mentions web_search tool', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/message-router.ts'), 'utf-8');
      expect(content).toContain('web_search');
    });
  });

  describe('104.5 message-router wired to ReAct loop', () => {
    it('message-router.ts imports runReActLoop', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/message-router.ts'), 'utf-8');
      expect(content).toContain('runReActLoop');
    });

    it('message-router.ts has onStatus callback calling sendChannelResponse', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/message-router.ts'), 'utf-8');
      expect(content).toContain('onStatus');
      expect(content).toContain('sendChannelResponse');
    });
  });

  // Remaining describe blocks will be added in later tasks
});
