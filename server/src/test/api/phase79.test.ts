// ============================================================
// Phase 79 Tests — Structured Memory Pipeline + Reminder Consistency
// ============================================================

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../..');

function readFile(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('Phase 79 — Structured Memory Pipeline + Reminder Consistency', () => {

  // ── 79.2: Ollama memory extraction ──────────────────────────────
  describe('79.2: Ollama-powered memory extraction', () => {
    it('extractMemoriesWithOllama is exported from memory.ts', () => {
      const src = readFile('server/src/services/memory.ts');
      expect(src).toContain('export async function extractMemoriesWithOllama');
    });

    it('uses config.ollamaBaseUrl for Ollama endpoint', () => {
      const src = readFile('server/src/services/memory.ts');
      expect(src).toContain('config.ollamaBaseUrl');
    });

    it('uses config.ollamaModel for Ollama model', () => {
      const src = readFile('server/src/services/memory.ts');
      expect(src).toContain('config.ollamaModel');
    });

    it('falls back to regex extractMemories when Ollama fails', () => {
      const src = readFile('server/src/services/memory.ts');
      // Must call extractMemories as fallback on error
      const fnBody = src.slice(src.indexOf('export async function extractMemoriesWithOllama'));
      expect(fnBody).toContain('extractMemories(userId');
    });

    it('stores extracted facts with ollama-extract source', () => {
      const src = readFile('server/src/services/memory.ts');
      expect(src).toContain("'ollama-extract'");
    });

    it('limits extracted facts to 5 per call', () => {
      const src = readFile('server/src/services/memory.ts');
      const fnBody = src.slice(src.indexOf('export async function extractMemoriesWithOllama'));
      expect(fnBody).toContain('.slice(0, 5)');
    });

    it('is imported and called in message-router.ts after AI reply', () => {
      const src = readFile('server/src/services/message-router.ts');
      expect(src).toContain('extractMemoriesWithOllama');
      // Must be fire-and-forget (non-blocking)
      expect(src).toContain('extractMemoriesWithOllama(userId, msg.text, finalReply).catch');
    });

    it('config is imported in memory.ts', () => {
      const src = readFile('server/src/services/memory.ts');
      expect(src).toContain("from '../config.js'");
    });
  });

  // ── 79.3: Memory context injected into system prompt ────────────
  describe('79.3: Memory read — inject into system prompt', () => {
    it('buildMemoryContext is called in message-router.ts with user message', () => {
      const src = readFile('server/src/services/message-router.ts');
      expect(src).toContain('buildMemoryContext(userId, userMessage)');
    });

    it('memory block is included in channel system prompt', () => {
      const src = readFile('server/src/services/message-router.ts');
      expect(src).toContain('memoryBlock');
    });

    it('buildMemoryContext is called in agent.ts for web chat', () => {
      const src = readFile('server/src/modules/agent/routes/chat.ts');
      expect(src).toContain('buildMemoryContext(userId, userMessage)');
    });
  });

  // ── 79.4/79.5/79.6: Memory manager UI + API endpoints ───────────
  // MemoryManagerPage was merged into MemoryHubPage
  describe('79.4: Memory manager UI page exists', () => {
    it('MemoryHubPage.tsx exists (successor to MemoryManagerPage)', () => {
      const src = readFile('src/dashboard/pages/MemoryHubPage.tsx');
      expect(src).toContain('MemoryHubPage');
    });

    it('uses memoryService from api.ts', () => {
      const src = readFile('src/dashboard/pages/MemoryHubPage.tsx');
      expect(src).toContain('memoryService');
    });
  });

  describe('79.5: GET /api/agent/memory endpoint', () => {
    it('GET /memory endpoint exists in agent router', () => {
      const src = readFile('server/src/modules/agent/routes/chat.ts');
      expect(src).toContain("agentRouter.get('/memory'");
    });

    it('supports category filter', () => {
      const src = readFile('server/src/modules/agent/routes/chat.ts');
      const memSection = src.slice(src.indexOf("agentRouter.get('/memory'"));
      expect(memSection).toContain('category');
    });

    it('supports search filter via getRelevantMemories', () => {
      const src = readFile('server/src/modules/agent/routes/chat.ts');
      const memSection = src.slice(src.indexOf("agentRouter.get('/memory'"));
      expect(memSection).toContain('getRelevantMemories');
    });
  });

  describe('79.6: DELETE /api/agent/memory/:id endpoint', () => {
    it('DELETE /memory/:id endpoint exists in agent router', () => {
      const src = readFile('server/src/modules/agent/routes/chat.ts');
      expect(src).toContain("agentRouter.delete('/memory/:id'");
    });

    it('returns 404 for missing memory', () => {
      const src = readFile('server/src/modules/agent/routes/chat.ts');
      const deleteSection = src.slice(src.indexOf("agentRouter.delete('/memory/:id'"));
      expect(deleteSection).toContain('404');
    });

    it('bulk clear endpoint exists', () => {
      const src = readFile('server/src/modules/agent/routes/chat.ts');
      expect(src).toContain("agentRouter.delete('/memory/bulk'");
    });
  });

  // ── 79.7: Reminder delivery must NOT leak memory data (phase110 privacy fix) ──
  describe('79.7: Reminder delivery must not leak memory context into notifications', () => {
    it('reminder-scheduler does NOT import getRelevantMemories (privacy fix)', () => {
      const src = readFile('server/src/services/reminder-scheduler.ts');
      expect(src).not.toContain('getRelevantMemories');
    });

    it('deliverReminder does NOT call getRelevantMemories (privacy fix)', () => {
      const src = readFile('server/src/services/reminder-scheduler.ts');
      expect(src).not.toContain('getRelevantMemories(reminder.user_id');
    });

    it('notification message does NOT append memory context (privacy fix)', () => {
      const src = readFile('server/src/services/reminder-scheduler.ts');
      expect(src).not.toContain('💡 Context');
    });

    it('deliverReminder notification includes reminder text (no memory context)', () => {
      const src = readFile('server/src/services/reminder-scheduler.ts');
      // Phase 110: message now includes optional local time display but still contains reminder.text
      expect(src).toContain('${reminder.text}');
      expect(src).not.toContain('getRelevantMemories');
    });
  });

  // ── 79.8: Weekly memory summary cron ────────────────────────────
  describe('79.8: Weekly memory summary scheduler', () => {
    it('startWeeklySummaryScheduler is exported from memory.ts', () => {
      const src = readFile('server/src/services/memory.ts');
      expect(src).toContain('export function startWeeklySummaryScheduler');
    });

    it('weekly summary uses Ollama (not PicoClaw)', () => {
      const src = readFile('server/src/services/memory.ts');
      const fnBody = src.slice(src.indexOf('async function runWeeklyMemorySummary'));
      expect(fnBody).toContain('config.ollamaBaseUrl');
      // Must NOT use queryPicoClaw in the weekly summary function
      expect(fnBody).not.toContain('queryPicoClaw');
    });

    it('weekly summary stores result in agent_memory with category summary', () => {
      const src = readFile('server/src/services/memory.ts');
      const fnBody = src.slice(src.indexOf('async function runWeeklyMemorySummary'));
      expect(fnBody).toContain("'summary'");
    });

    it('weekly summary scheduler checks day-of-week (Sunday)', () => {
      const src = readFile('server/src/services/memory.ts');
      const fnBody = src.slice(src.indexOf('async function runWeeklyMemorySummary'));
      expect(fnBody).toContain('getUTCDay() !== 0');
    });

    it('startWeeklySummaryScheduler is started in index.ts', () => {
      const src = readFile('server/src/index.ts');
      expect(src).toContain('startWeeklySummaryScheduler');
    });
  });

});
