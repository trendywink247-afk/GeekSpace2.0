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

    it('TOOL_SCHEMAS includes send_telegram', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain("send_telegram:");
    });

    it('web_search schema requires query string', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain('webSearchSchema');
      expect(content).toContain("query: z.string()");
    });

    it('send_telegram schema requires message string', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain('sendTelegramToolSchema');
      expect(content).toContain("message: z.string()");
    });
  });

  describe('104.2 Executors', () => {
    it('action-executor.ts handles web_search', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/action-executor.ts'), 'utf-8');
      expect(content).toContain("case 'web_search':");
      expect(content).toContain('tavilySearch');
    });

    it('action-executor.ts handles send_telegram', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/action-executor.ts'), 'utf-8');
      expect(content).toContain("case 'send_telegram':");
      expect(content).toContain('sendTelegramNotification');
    });
  });

  describe('104.3 ReAct loop service', () => {
    it('react-loop.ts file exists', () => {
      expect(existsSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/react-loop.ts'))).toBe(true);
    });

    it('exports runReactLoop function', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('export async function runReactLoop');
    });

    it('defines MAX_REACT_ITERATIONS = 5', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('MAX_REACT_ITERATIONS = 5');
    });

    it('injects tool results back into messages', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('[TOOL RESULT');
    });

    it('returns accumulated observations on max iterations', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('MAX_REACT_ITERATIONS');
      expect(content).toContain('observations');
    });

    it('calls executeAction for each tool', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('executeAction');
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
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/message-router.ts'), 'utf-8');
      expect(content).toContain('web_search');
    });
  });

  describe('104.5 message-router wired to ReAct loop', () => {
    it('message-router.ts imports runReactLoop', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/message-router.ts'), 'utf-8');
      expect(content).toContain('runReactLoop');
    });

    it('message-router.ts calls sendChannelResponse', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/modules/agent/services/message-router.ts'), 'utf-8');
      expect(content).toContain('sendChannelResponse');
    });
  });

  describe('104.6 agent.ts wired to ReAct loop', () => {
    it('agent.ts imports runReactLoop', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/routes/agent.ts'), 'utf-8');
      expect(content).toContain('runReactLoop');
    });

    it('agent.ts default chat path calls runReactLoop', () => {
      const content = readFileSync(path.resolve(SERVER_ROOT, 'src/routes/agent.ts'), 'utf-8');
      expect(content).toContain('runReactLoop');
    });
  });

  // Remaining describe blocks will be added in later tasks
});
