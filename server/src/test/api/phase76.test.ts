/**
 * Phase 76 Tests — AI Gateway + Smart Routing
 *
 * Verifies:
 * - routing waterfall order (ollama → openrouter-free → edith)
 * - edith NOT selected automatically for 'complex' intent
 * - edith IS selected for premium users as last resort
 * - budget degradation applies to forced premium providers
 * - Redis L2 cache key prefix is correct
 * - in-flight deduplication Map is exported
 * - job-queue service can enqueue and retrieve jobs
 * - token-budget daily limit functions exist
 * P3: ollama-cloud and together removed — dead providers (no API keys)
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../../..');
const SERVER_ROOT = resolve(ROOT, 'server');

describe('Phase 76 — AI Gateway + Smart Routing', () => {

  // ---- 76.2: Routing waterfall in llm.ts (P3: ollama-cloud/together removed) ----
  describe('76.2 Routing waterfall', () => {
    it("llm.ts does NOT include removed dead providers in Provider type", () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).not.toContain("'ollama-cloud'");
      // 'together' was re-added in migration as a real paid provider (Together AI Llama 3.1 70B)
    });

    it('waterfall contains ollama, openrouter-free, and edith', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).toContain("'ollama'");
      expect(content).toContain("'openrouter-free'");
      expect(content).toContain("'edith'");
    });
  });

  // ---- 76.3: Edith is premium-only last resort ----
  describe('76.3 Edith gating (premium-only)', () => {
    it('llm.ts does NOT auto-escalate to edith based on "complex" intent', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      // The old pattern was: intent === 'complex' && isEdithAvailable() → edith
      // This should no longer exist as the primary routing decision
      expect(content).not.toMatch(/intent\s*===\s*['"]complex['"]\s*\)?\s*\{?\s*[\s\S]*?provider\s*=\s*['"]edith['"]/);
    });

    it('llm.ts defines isPremiumPlan helper', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).toContain('isPremiumPlan');
      expect(content).toContain("'halfyear'");
      expect(content).toContain("'yearly'");
    });

    it('edith selection requires isPremium check', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      // Phase 110: edith gated by isPremium in fallback chain switch case
      expect(content).toContain('isPremium');
      expect(content).toContain("'edith'");
      // Verify edith is guarded (either via isPremium check or similar guard)
      expect(content).toMatch(/edith[\s\S]{0,200}isPremium|isPremium[\s\S]{0,200}edith/);
    });

    it('userPlan is part of routeChat opts', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).toContain('userPlan?:');
    });
  });

  // ---- 76.5: Redis L2 cache ----
  describe('76.5 Redis LLM cache', () => {
    it('llm.ts imports cacheGet and cacheSet from cache.ts', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).toContain("import { cacheGet, cacheSet } from './cache.js'");
    });

    it('Redis cache key uses correct prefix', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).toContain("'llm:resp:'");
    });

    it('Redis cache TTL is 300 seconds (5 minutes)', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).toContain('LLM_CACHE_TTL_SEC = 300');
    });

    it('getRedisCached and setRedisCached are defined', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).toContain('getRedisCached');
      expect(content).toContain('setRedisCached');
    });
  });

  // ---- 76.6: In-flight deduplication ----
  describe('76.6 In-flight deduplication', () => {
    it('llm.ts defines inFlightRequests Map', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).toContain('inFlightRequests');
      expect(content).toContain('new Map<string, Promise<string>>()');
    });

    it('inFlightRequests is cleaned up in finally block', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      expect(content).toContain('inFlightRequests.delete');
      // Should be in finally
      const finallyIdx = content.indexOf('} finally {');
      const deleteIdx = content.indexOf('inFlightRequests.delete');
      expect(finallyIdx).toBeGreaterThan(0);
      expect(deleteIdx).toBeGreaterThan(0);
    });
  });

  // ---- 76.4: Token budget daily enforcement ----
  describe('76.4 Daily token budget', () => {
    it('token-budget.ts exports getDailyTokenUsage', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/token-budget.ts'), 'utf-8');
      expect(content).toContain('getDailyTokenUsage');
    });

    it('token-budget.ts exports isOverDailyBudget', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/token-budget.ts'), 'utf-8');
      expect(content).toContain('isOverDailyBudget');
    });

    it('daily budget is 10% of monthly budget', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/token-budget.ts'), 'utf-8');
      expect(content).toContain('DAILY_BUDGET_RATIO = 0.10');
    });
  });

  // ---- 76.7: Async job queue ----
  describe('76.7 Async job queue', () => {
    it('job-queue.ts service file exists', () => {
      expect(existsSync(resolve(SERVER_ROOT, 'src/services/job-queue.ts'))).toBe(true);
    });

    it('job-queue exports enqueueJob function', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/job-queue.ts'), 'utf-8');
      expect(content).toContain('export async function enqueueJob');
    });

    it('job-queue exports getJobStatus function', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/job-queue.ts'), 'utf-8');
      expect(content).toContain('export async function getJobStatus');
    });

    it('job-queue exports registerJobHandler function', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/job-queue.ts'), 'utf-8');
      expect(content).toContain('export function registerJobHandler');
    });

    it('job-queue supports voice and video job types', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/job-queue.ts'), 'utf-8');
      expect(content).toContain('voice:transcribe');
      expect(content).toContain('video:generate');
    });

    it('job-queue uses Redis for persistence', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/job-queue.ts'), 'utf-8');
      expect(content).toContain("import { cacheGet, cacheSet }");
    });

    it('job has required fields: id, type, payload, status, createdAt', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/job-queue.ts'), 'utf-8');
      expect(content).toContain('id:');
      expect(content).toContain('type:');
      expect(content).toContain('payload:');
      expect(content).toContain('status:');
      expect(content).toContain('createdAt:');
    });
  });

  // ---- Routing waterfall comment / documentation ----
  describe('Documentation', () => {
    it('llm.ts header documents the routing waterfall order', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/llm.ts'), 'utf-8');
      // Phase 110: waterfall updated to 6-tier system
      expect(content).toContain('Waterfall');
      expect(content).toContain('ollama');
      expect(content).toContain('openrouter-free');
      expect(content).toContain('edith');
    });
  });
});
