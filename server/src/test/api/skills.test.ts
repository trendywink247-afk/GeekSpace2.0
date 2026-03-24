/**
 * Skill Engine Tests -- Round 1 (Server Foundation)
 *
 * Tests the skill registry (pure functions), injector (DB queries),
 * and API routes (supertest). Registry tests need no DB; injector
 * and route tests use the real test database via setup.ts helpers.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';

// -- Registry imports -------------------------------------------------
import {
  SKILL_CATALOG,
  getSkillById,
  getSkillsByCategory,
  getSkillsForAgent,
  seedSkillsToDb,
} from '../../skills/registry.js';

// -- Type imports -----------------------------------------------------
import type {
  SkillType,
  SkillTier,
  SkillCategory,
  AgentId,
} from '../../skills/types.js';

// -- Injector import --------------------------------------------------
import { getSkillPromptForAgent } from '../../skills/injector.js';

const app = createApp();

// -- DB setup: create skill tables + seed catalog ---------------------
// The skill tables may not be in the main schema yet (coder adds them
// to db/index.ts separately), so we create them here defensively.
beforeAll(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('knowledge', 'tool', 'hybrid')),
      tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'teams')),
      category TEXT NOT NULL,
      compatible_agents TEXT NOT NULL DEFAULT '[]',
      icon TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      skill_content TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_skills (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      enabled INTEGER DEFAULT 1,
      agent_overrides TEXT NOT NULL DEFAULT '{}',
      config TEXT NOT NULL DEFAULT '{}',
      installed_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT,
      PRIMARY KEY (user_id, skill_id)
    );
    CREATE TABLE IF NOT EXISTS skill_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      success INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed the catalog into the skills table
  seedSkillsToDb();
});


// =====================================================================
// 1. REGISTRY -- Pure function tests (no DB)
// =====================================================================

describe('Skill Registry', () => {
  describe('SKILL_CATALOG', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(SKILL_CATALOG)).toBe(true);
      expect(SKILL_CATALOG.length).toBeGreaterThan(0);
    });

    it('every skill has all required fields', () => {
      for (const s of SKILL_CATALOG) {
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('name');
        expect(s).toHaveProperty('description');
        expect(s).toHaveProperty('type');
        expect(s).toHaveProperty('tier');
        expect(s).toHaveProperty('category');
        expect(s).toHaveProperty('compatibleAgents');
        expect(s).toHaveProperty('icon');
        expect(s).toHaveProperty('tags');
        expect(s).toHaveProperty('skillContent');
      }
    });

    it('all skills have non-empty skillContent', () => {
      for (const s of SKILL_CATALOG) {
        expect(s.skillContent.length).toBeGreaterThan(0);
      }
    });

    it('all skills have valid type values', () => {
      const validTypes: SkillType[] = ['knowledge', 'tool', 'hybrid'];
      for (const s of SKILL_CATALOG) {
        expect(validTypes).toContain(s.type);
      }
    });

    it('all skills have valid tier values', () => {
      const validTiers: SkillTier[] = ['free', 'pro', 'teams'];
      for (const s of SKILL_CATALOG) {
        expect(validTiers).toContain(s.tier);
      }
    });

    it('all skills have valid category values', () => {
      const validCategories: SkillCategory[] = [
        'india-business', 'productivity', 'communication', 'development',
        'data-analysis', 'research', 'finance', 'security', 'automation', 'creative',
      ];
      for (const s of SKILL_CATALOG) {
        expect(validCategories).toContain(s.category);
      }
    });

    it('all skills have at least one compatible agent', () => {
      for (const s of SKILL_CATALOG) {
        expect(s.compatibleAgents.length).toBeGreaterThan(0);
      }
    });

    it('all skill IDs are unique', () => {
      const ids = SKILL_CATALOG.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getSkillById', () => {
    it('returns correct skill for gst-compliance', () => {
      const skill = getSkillById('gst-compliance');
      expect(skill).toBeDefined();
      expect(skill!.id).toBe('gst-compliance');
      expect(skill!.name).toBeTruthy();
      expect(skill!.category).toBe('india-business');
    });

    it('returns correct skill for hindi-business-writing', () => {
      const skill = getSkillById('hindi-business-writing');
      expect(skill).toBeDefined();
      expect(skill!.type).toBe('knowledge');
      expect(skill!.category).toBe('communication');
    });

    it('returns undefined for nonexistent skill', () => {
      const skill = getSkillById('nonexistent-skill-abc');
      expect(skill).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      const skill = getSkillById('');
      expect(skill).toBeUndefined();
    });
  });

  describe('getSkillsByCategory', () => {
    it('returns india-business skills', () => {
      const skills = getSkillsByCategory('india-business');
      expect(skills.length).toBeGreaterThanOrEqual(2);
      for (const s of skills) {
        expect(s.category).toBe('india-business');
      }
    });

    it('returns communication skills including Hindi writing', () => {
      const skills = getSkillsByCategory('communication');
      const ids = skills.map((s) => s.id);
      expect(ids).toContain('hindi-business-writing');
    });

    it('returns empty array for unknown category', () => {
      const skills = getSkillsByCategory('nonexistent-category' as SkillCategory);
      expect(skills).toEqual([]);
    });

    it('each returned skill belongs to the requested category', () => {
      const categories: SkillCategory[] = ['india-business', 'communication', 'finance'];
      for (const cat of categories) {
        const skills = getSkillsByCategory(cat);
        for (const s of skills) {
          expect(s.category).toBe(cat);
        }
      }
    });
  });

  describe('getSkillsForAgent', () => {
    it('echo agent gets GST, UPI reconciliation, Hindi writing, and Labor compliance', () => {
      const skills = getSkillsForAgent('echo');
      const ids = skills.map((s) => s.id);
      expect(ids).toContain('gst-compliance');
      expect(ids).toContain('upi-reconciliation');
      expect(ids).toContain('hindi-business-writing');
      expect(ids).toContain('indian-labor-compliance');
    });

    it('forge agent gets Tally but NOT Hindi writing', () => {
      const skills = getSkillsForAgent('forge');
      const ids = skills.map((s) => s.id);
      expect(ids).toContain('tally-integration');
      expect(ids).not.toContain('hindi-business-writing');
    });

    it('each returned skill lists the queried agent in compatibleAgents', () => {
      const agents: AgentId[] = ['echo', 'forge', 'aria', 'pulse', 'jarvis'];
      for (const agent of agents) {
        const skills = getSkillsForAgent(agent);
        for (const s of skills) {
          expect(s.compatibleAgents).toContain(agent);
        }
      }
    });

    it('returns empty array for invalid agent', () => {
      const skills = getSkillsForAgent('nonexistent-agent' as AgentId);
      expect(skills).toEqual([]);
    });
  });
});


// =====================================================================
// 2. INJECTOR -- Requires test database with skills seeded
// =====================================================================

describe('Skill Injector', () => {
  let userId: string;

  beforeEach(() => {
    resetDatabase();
    const user = createTestUser();
    userId = user.id;
    // Re-seed skills after DB reset (resetDatabase clears user rows but
    // skills table is not in the cleanup list, so seed defensively)
    seedSkillsToDb();
  });

  it('returns empty string when user has no skills installed', () => {
    const prompt = getSkillPromptForAgent(userId, 'echo', 'yearly');
    expect(prompt).toBe('');
  });

  it('returns skill content when user has a knowledge skill enabled', () => {
    // gst-compliance is hybrid, compatible with echo
    installSkillForUser(userId, 'gst-compliance');

    const prompt = getSkillPromptForAgent(userId, 'echo', 'yearly');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt.toLowerCase()).toMatch(/gst/);
  });

  it('does not inject tool-only skills into prompt', () => {
    // upi-reconciliation is type=tool, tally-integration is type=tool
    const toolSkill = SKILL_CATALOG.find((s) => s.type === 'tool');
    if (!toolSkill) return;

    installSkillForUser(userId, toolSkill.id);

    const prompt = getSkillPromptForAgent(userId, toolSkill.compatibleAgents[0], 'yearly');
    expect(prompt).toBe('');
  });

  it('injects hybrid skills into prompt', () => {
    const hybridSkill = SKILL_CATALOG.find((s) => s.type === 'hybrid');
    if (!hybridSkill) return;

    installSkillForUser(userId, hybridSkill.id);

    const prompt = getSkillPromptForAgent(userId, hybridSkill.compatibleAgents[0], 'yearly');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('injects knowledge skills into prompt', () => {
    // hindi-business-writing is type=knowledge
    installSkillForUser(userId, 'hindi-business-writing');

    const prompt = getSkillPromptForAgent(userId, 'echo', 'yearly');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt.toLowerCase()).toMatch(/hindi/);
  });

  it('respects agent_overrides -- skill disabled for specific agent', () => {
    installSkillForUser(userId, 'gst-compliance', {
      agentOverrides: { echo: false },
    });

    const echoPrompt = getSkillPromptForAgent(userId, 'echo', 'yearly');
    expect(echoPrompt).toBe('');
  });

  it('agent_overrides only affects the specified agent', () => {
    // Disable for echo but not for cal (gst-compliance is compatible with both)
    installSkillForUser(userId, 'gst-compliance', {
      agentOverrides: { echo: false },
    });

    const calPrompt = getSkillPromptForAgent(userId, 'cal', 'yearly');
    expect(calPrompt.length).toBeGreaterThan(0);
    expect(calPrompt.toLowerCase()).toMatch(/gst/);
  });

  it('respects enabled flag -- disabled skill is not injected', () => {
    installSkillForUser(userId, 'gst-compliance', { enabled: false });

    const prompt = getSkillPromptForAgent(userId, 'echo', 'premium');
    expect(prompt).toBe('');
  });

  it('respects tier gating -- free user does not get pro skills', () => {
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('free', userId);

    const proSkill = SKILL_CATALOG.find((s) => s.tier === 'pro');
    if (!proSkill) return;

    installSkillForUser(userId, proSkill.id);

    const prompt = getSkillPromptForAgent(userId, proSkill.compatibleAgents[0], 'free');
    expect(prompt).toBe('');
  });

  it('paid user (yearly plan) DOES get pro skills', () => {
    // NOTE: 'premium' is NOT in injector's PRO_PLANS set.
    // Valid paid plans: pro, monthly, halfyear, yearly, team, teams.
    // The createTestUser helper uses plan='premium' which would fail
    // tier gating. This test uses 'yearly' explicitly to verify the
    // happy path. See BUG below for the 'premium' omission.
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('yearly', userId);

    const proSkill = SKILL_CATALOG.find(
      (s) => s.tier === 'pro' && (s.type === 'knowledge' || s.type === 'hybrid'),
    );
    if (!proSkill) return;

    installSkillForUser(userId, proSkill.id);

    const prompt = getSkillPromptForAgent(userId, proSkill.compatibleAgents[0], 'yearly');
    expect(prompt.length).toBeGreaterThan(0);
  });

  // BUG: 'premium' plan is not recognized by injector's PRO_PLANS set.
  // createTestUser assigns plan='premium' but PRO_PLANS only has:
  // ['pro', 'monthly', 'halfyear', 'yearly', 'team', 'teams']
  // This means users on the 'premium' plan cannot access pro-tier skills.
  it('BUG: premium plan is not in PRO_PLANS (should be fixed in injector)', () => {
    const proSkill = SKILL_CATALOG.find(
      (s) => s.tier === 'pro' && (s.type === 'knowledge' || s.type === 'hybrid'),
    );
    if (!proSkill) return;

    installSkillForUser(userId, proSkill.id);

    // This SHOULD return content but currently returns '' because 'premium' is not in PRO_PLANS
    const prompt = getSkillPromptForAgent(userId, proSkill.compatibleAgents[0], 'premium');
    // When the bug is fixed, change this to: expect(prompt.length).toBeGreaterThan(0)
    expect(prompt).toBe('');
  });

  it('multiple skills are concatenated with separator', () => {
    // Install two knowledge/hybrid skills compatible with echo
    const echoSkills = SKILL_CATALOG
      .filter((s) => s.type !== 'tool' && s.compatibleAgents.includes('echo'))
      .slice(0, 2);

    if (echoSkills.length < 2) return;

    for (const skill of echoSkills) {
      installSkillForUser(userId, skill.id);
    }

    const prompt = getSkillPromptForAgent(userId, 'echo', 'yearly');
    // The separator is '\n\n---\n\n'
    expect(prompt).toContain('---');
    // Prompt should be longer than either individual skill's content
    for (const skill of echoSkills) {
      expect(prompt.length).toBeGreaterThan(skill.skillContent.length);
    }
  });

  it('returns empty string when agent is not compatible with installed skill', () => {
    // tally-integration is compatible with jarvis, pulse, forge -- NOT echo
    installSkillForUser(userId, 'tally-integration');

    const prompt = getSkillPromptForAgent(userId, 'echo', 'yearly');
    expect(prompt).toBe('');
  });

  it('gracefully returns empty string on error (does not throw)', () => {
    // Pass a non-existent user ID -- should not throw
    const prompt = getSkillPromptForAgent('nonexistent-user-id', 'echo', 'free');
    expect(prompt).toBe('');
  });
});


// =====================================================================
// 3. API ROUTES -- Supertest against real app
// =====================================================================

describe('Skills API Routes', () => {
  let authHeader: string;
  let userId: string;

  beforeEach(() => {
    resetDatabase();
    const user = createTestUser();
    userId = user.id;
    authHeader = makeAuthHeader(user.id);
    // Re-seed skills catalog
    seedSkillsToDb();
  });

  // -- Auth guards ----------------------------------------------------

  describe('Auth guards', () => {
    it('GET /api/skills/catalog requires auth', async () => {
      const res = await request(app).get('/api/skills/catalog');
      expect(res.status).toBe(401);
    });

    it('POST /api/skills/install requires auth', async () => {
      const res = await request(app)
        .post('/api/skills/install')
        .send({ skillId: 'gst-compliance' });
      expect(res.status).toBe(401);
    });

    it('PATCH /api/skills/:id/toggle requires auth', async () => {
      const res = await request(app)
        .patch('/api/skills/gst-compliance/toggle')
        .send({ enabled: true });
      expect(res.status).toBe(401);
    });

    it('GET /api/skills/user requires auth', async () => {
      const res = await request(app).get('/api/skills/user');
      expect(res.status).toBe(401);
    });

    it('POST /api/skills/uninstall requires auth', async () => {
      const res = await request(app)
        .post('/api/skills/uninstall')
        .send({ skillId: 'gst-compliance' });
      expect(res.status).toBe(401);
    });

    it('GET /api/skills/stats requires auth', async () => {
      const res = await request(app).get('/api/skills/stats');
      expect(res.status).toBe(401);
    });
  });

  // -- GET /api/skills/catalog ----------------------------------------

  describe('GET /api/skills/catalog', () => {
    it('returns array of skills', async () => {
      const res = await request(app)
        .get('/api/skills/catalog')
        .set('Authorization', authHeader)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('each catalog skill has public-facing fields', async () => {
      const res = await request(app)
        .get('/api/skills/catalog')
        .set('Authorization', authHeader)
        .expect(200);

      for (const skill of res.body) {
        expect(skill).toHaveProperty('id');
        expect(skill).toHaveProperty('name');
        expect(skill).toHaveProperty('description');
        expect(skill).toHaveProperty('type');
        expect(skill).toHaveProperty('tier');
        expect(skill).toHaveProperty('category');
        expect(skill).toHaveProperty('icon');
        expect(skill).toHaveProperty('compatibleAgents');
        expect(skill).toHaveProperty('tags');
      }
    });

    it('does NOT expose raw skillContent in catalog', async () => {
      const res = await request(app)
        .get('/api/skills/catalog')
        .set('Authorization', authHeader)
        .expect(200);

      for (const skill of res.body) {
        expect(skill).not.toHaveProperty('skillContent');
        expect(skill).not.toHaveProperty('skill_content');
      }
    });
  });

  // -- POST /api/skills/install ---------------------------------------

  describe('POST /api/skills/install', () => {
    it('installs a valid free skill', async () => {
      const res = await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('skillId', 'gst-compliance');
    });

    it('returns 404 for nonexistent skillId', async () => {
      const res = await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'nonexistent-skill-xyz' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when skillId is missing', async () => {
      const res = await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when skillId is not a string', async () => {
      const res = await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 12345 });

      expect(res.status).toBe(400);
    });

    it('returns 409 when installing same skill twice (not idempotent)', async () => {
      await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' })
        .expect(200);

      const res = await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 403 when free user tries to install pro skill', async () => {
      // Downgrade user to free plan
      db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('free', userId);

      const proSkill = SKILL_CATALOG.find((s) => s.tier === 'pro');
      if (!proSkill) return;

      const res = await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: proSkill.id });

      expect(res.status).toBe(403);
    });
  });

  // -- PATCH /api/skills/:skillId/toggle ------------------------------

  describe('PATCH /api/skills/:skillId/toggle', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' });
    });

    it('toggles skill to disabled', async () => {
      const res = await request(app)
        .patch('/api/skills/gst-compliance/toggle')
        .set('Authorization', authHeader)
        .send({ enabled: false })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.enabled).toBe(false);
    });

    it('toggles skill back to enabled', async () => {
      await request(app)
        .patch('/api/skills/gst-compliance/toggle')
        .set('Authorization', authHeader)
        .send({ enabled: false });

      const res = await request(app)
        .patch('/api/skills/gst-compliance/toggle')
        .set('Authorization', authHeader)
        .send({ enabled: true })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.enabled).toBe(true);
    });

    it('returns 404 for skill not installed by user', async () => {
      const res = await request(app)
        .patch('/api/skills/upi-reconciliation/toggle')
        .set('Authorization', authHeader)
        .send({ enabled: false });

      expect(res.status).toBe(404);
    });

    it('returns 400 when enabled field is missing', async () => {
      const res = await request(app)
        .patch('/api/skills/gst-compliance/toggle')
        .set('Authorization', authHeader)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // -- GET /api/skills/user -------------------------------------------

  describe('GET /api/skills/user', () => {
    it('returns empty array when no skills installed', async () => {
      const res = await request(app)
        .get('/api/skills/user')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('returns installed skills after installation', async () => {
      await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' });

      const res = await request(app)
        .get('/api/skills/user')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].skillId).toBe('gst-compliance');
      expect(res.body[0]).toHaveProperty('enabled', true);
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('tier');
    });

    it('installed skills are isolated per user', async () => {
      await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' });

      const user2 = createTestUser();
      const auth2 = makeAuthHeader(user2.id);

      const res = await request(app)
        .get('/api/skills/user')
        .set('Authorization', auth2)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('reflects toggle state in user skills list', async () => {
      await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' });

      await request(app)
        .patch('/api/skills/gst-compliance/toggle')
        .set('Authorization', authHeader)
        .send({ enabled: false });

      const res = await request(app)
        .get('/api/skills/user')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body[0].enabled).toBe(false);
    });
  });

  // -- POST /api/skills/uninstall -------------------------------------

  describe('POST /api/skills/uninstall', () => {
    it('uninstalls a previously installed skill', async () => {
      await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' });

      const res = await request(app)
        .post('/api/skills/uninstall')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);

      // Verify it is gone
      const installed = await request(app)
        .get('/api/skills/user')
        .set('Authorization', authHeader)
        .expect(200);

      expect(installed.body).toHaveLength(0);
    });

    it('returns 404 when trying to uninstall a skill not installed', async () => {
      const res = await request(app)
        .post('/api/skills/uninstall')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' });

      expect(res.status).toBe(404);
    });

    it('returns 400 when skillId is missing', async () => {
      const res = await request(app)
        .post('/api/skills/uninstall')
        .set('Authorization', authHeader)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // -- PATCH /api/skills/:skillId/agents ------------------------------

  describe('PATCH /api/skills/:skillId/agents', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/skills/install')
        .set('Authorization', authHeader)
        .send({ skillId: 'gst-compliance' });
    });

    it('updates agent overrides', async () => {
      const res = await request(app)
        .patch('/api/skills/gst-compliance/agents')
        .set('Authorization', authHeader)
        .send({ agentOverrides: { echo: false, cal: true } })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.agentOverrides).toEqual({ echo: false, cal: true });
    });

    it('returns 404 for skill not installed', async () => {
      const res = await request(app)
        .patch('/api/skills/upi-reconciliation/agents')
        .set('Authorization', authHeader)
        .send({ agentOverrides: { echo: false } });

      expect(res.status).toBe(404);
    });

    it('returns 400 when agentOverrides is missing', async () => {
      const res = await request(app)
        .patch('/api/skills/gst-compliance/agents')
        .set('Authorization', authHeader)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // -- GET /api/skills/stats ------------------------------------------

  describe('GET /api/skills/stats', () => {
    it('returns empty array when no usage recorded', async () => {
      const res = await request(app)
        .get('/api/skills/stats')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });
  });
});


// =====================================================================
// Test helpers
// =====================================================================

/**
 * Directly inserts a user_skill row into the DB for testing the injector
 * without going through the API.
 */
function installSkillForUser(
  userId: string,
  skillId: string,
  opts?: {
    enabled?: boolean;
    agentOverrides?: Record<string, boolean>;
  },
): void {
  const enabled = opts?.enabled !== undefined ? (opts.enabled ? 1 : 0) : 1;
  const overrides = opts?.agentOverrides
    ? JSON.stringify(opts.agentOverrides)
    : '{}';

  db.prepare(
    `INSERT OR REPLACE INTO user_skills (user_id, skill_id, enabled, agent_overrides, config, installed_at)
     VALUES (?, ?, ?, ?, '{}', datetime('now'))`,
  ).run(userId, skillId, enabled, overrides);
}
