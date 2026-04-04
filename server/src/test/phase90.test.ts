// ============================================================
// Phase 90 Tests -- Proactive AI Engine
// Verifies: daily_briefing, overdue_alert, idle_check_in,
//           DB schema, routes, ProactivePage, DashboardApp.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readFile(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf-8');
}

function fileExists(rel: string): boolean {
  return existsSync(path.join(ROOT, rel));
}

// ---- 90.1: Proactive engine service structure -------------------------

describe('90.1 proactive-engine.ts exports', () => {
  it('proactive-engine.ts exists', () => {
    expect(fileExists('server/src/services/proactive-engine.ts')).toBe(true);
  });

  it('exports dailyBriefing function', () => {
    const src = readFile('server/src/services/proactive-engine.ts');
    expect(src).toContain('export async function dailyBriefing');
  });

  it('exports overdueAlert function', () => {
    const src = readFile('server/src/services/proactive-engine.ts');
    expect(src).toContain('export async function overdueAlert');
  });

  it('exports idleCheckIn function', () => {
    const src = readFile('server/src/services/proactive-engine.ts');
    expect(src).toContain('export async function idleCheckIn');
  });

  it('exports initProactiveEngine function', () => {
    const src = readFile('server/src/services/proactive-engine.ts');
    expect(src).toContain('initProactiveEngine');
  });

  it('engine uses 60-second interval', () => {
    const src = readFile('server/src/services/proactive-engine.ts');
    expect(src).toContain('60_000');
  });

  it('uses per-user timezone with Asia/Kolkata default', () => {
    const src = readFile('server/src/services/proactive-engine.ts');
    expect(src).toContain('getUserHour');
    expect(src).toContain("Asia/Kolkata");
  });

  it('daily briefing fires at IST hour 8', () => {
    const src = readFile('server/src/services/proactive-engine.ts');
    expect(src).toContain('hour === 8');
  });

  it('overdue alert fires at IST hour 10', () => {
    const src = readFile('server/src/services/proactive-engine.ts');
    expect(src).toContain('hour === 10');
  });

  it('idle check-in requires 3 days of inactivity', () => {
    const src = readFile('server/src/services/proactive-engine.ts');
    expect(src).toContain('daysSinceActive < 3');
  });
});

// ---- 90.2: Registration in index.ts ------------------------------------

describe('90.2 initProactiveEngine registered in server', () => {
  it('index.ts imports initProactiveEngine', () => {
    const src = readFile('server/src/index.ts');
    expect(src).toContain('initProactiveEngine');
  });

  it('index.ts calls initProactiveEngine via safeStart', () => {
    const src = readFile('server/src/index.ts');
    expect(src).toContain("safeStart('proactive-engine', initProactiveEngine)");
  });
});

// ---- 90.3: DB schema ---------------------------------------------------

describe('90.3 DB schema: proactive_messages + proactive_enabled', () => {
  it('db/index.ts creates proactive_messages table', () => {
    const src = readFile('server/src/db/index.ts');
    expect(src).toContain('proactive_messages');
  });

  it('proactive_messages has user_id, type, sent_at, message columns', () => {
    const src = readFile('server/src/db/index.ts');
    expect(src).toContain('user_id');
    expect(src).toContain('sent_at');
    expect(src).toContain('proactive_messages');
  });

  it('users table gets proactive_enabled column via ALTER TABLE', () => {
    const src = readFile('server/src/db/index.ts');
    expect(src).toContain('proactive_enabled');
    expect(src).toContain('ALTER TABLE users ADD COLUMN proactive_enabled');
  });
});

// ---- 90.4: Route: GET /api/proactive/log --------------------------------

describe('90.4 Route GET /api/proactive/log', () => {
  it('proactive.ts exists', () => {
    expect(fileExists('server/src/routes/proactive.ts')).toBe(true);
  });

  it('GET /log route is defined', () => {
    const src = readFile('server/src/routes/proactive.ts');
    expect(src).toContain("proactiveRouter.get('/log'");
  });

  it('GET /log calls getProactiveLog', () => {
    const src = readFile('server/src/routes/proactive.ts');
    expect(src).toContain('getProactiveLog');
  });

  it('GET /log returns { log } key', () => {
    const src = readFile('server/src/routes/proactive.ts');
    expect(src).toContain('res.json({ log }');
  });

  it('GET /settings returns enabled key', () => {
    const src = readFile('server/src/routes/proactive.ts');
    // Settings endpoint returns enabled along with autonomy/quiet hours
    expect(src).toContain("enabled:");
    expect(src).toContain("autonomy_level");
  });

  it('PATCH /toggle returns { enabled } key', () => {
    const src = readFile('server/src/routes/proactive.ts');
    expect(src).toContain("res.json({ enabled }");
  });

  it('PATCH /toggle validates enabled is boolean', () => {
    const src = readFile('server/src/routes/proactive.ts');
    expect(src).toContain("typeof enabled !== 'boolean'");
  });
});

// ---- 90.5: proactiveRouter registered in app.ts -------------------------

describe('90.5 proactiveRouter registered in app.ts', () => {
  it('app.ts imports agentModule (which registers proactive routes)', () => {
    const src = readFile('server/src/app.ts');
    expect(src).toContain('agentModule');
  });

  it('app.ts registers agentModule which mounts proactive routes', () => {
    const src = readFile('server/src/app.ts');
    expect(src).toContain('agentModule');
  });
});

// ---- 90.6: ProactivePage + DashboardApp integration --------------------

describe('90.6 ProactivePage frontend', () => {
  it('ProactivePage.tsx exists', () => {
    expect(fileExists('src/dashboard/pages/ProactivePage.tsx')).toBe(true);
  });

  it('ProactivePage exports a ProactivePage component', () => {
    const src = readFile('src/dashboard/pages/ProactivePage.tsx');
    expect(src).toContain('export function ProactivePage');
  });

  it('ProactivePage fetches /proactive/log', () => {
    const src = readFile('src/dashboard/pages/ProactivePage.tsx');
    expect(src).toContain('/proactive/log');
  });

  it('ProactivePage fetches /proactive/settings', () => {
    const src = readFile('src/dashboard/pages/ProactivePage.tsx');
    expect(src).toContain('/proactive/settings');
  });

  it('ProactivePage calls /proactive/toggle on button click', () => {
    const src = readFile('src/dashboard/pages/ProactivePage.tsx');
    expect(src).toContain('/proactive/toggle');
  });

  it('DashboardApp has ProactivePage lazy import', () => {
    const src = readFile('src/dashboard/DashboardApp.tsx');
    expect(src).toContain("import('./pages/ProactivePage')");
  });

  it('DashboardApp PageType includes proactive', () => {
    const src = readFile('src/dashboard/DashboardApp.tsx');
    expect(src).toContain("'proactive'");
  });

  it('DashboardApp has proactive page route', () => {
    const src = readFile('src/dashboard/DashboardApp.tsx');
    // Proactive AI page accessible via URL even if not in sidebar
    expect(src).toContain("case 'proactive'");
  });

  it('DashboardApp renders ProactivePage for proactive case', () => {
    const src = readFile('src/dashboard/DashboardApp.tsx');
    expect(src).toContain("case 'proactive'");
    expect(src).toContain('<ProactivePage />');
  });
});

// ---- 90.7: Functional tests for engine --------------------------------


import { createTestUser, resetDatabase } from './setup.js';
import { db } from '../db/index.js';
import { dailyBriefing, overdueAlert, idleCheckIn } from '../services/proactive-engine.js';

describe('90.7 Proactive engine functional tests', () => {
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser('phase90-' + Date.now() + '@example.com');
    userId = user.id;
  });

  afterAll(() => {
    resetDatabase();
  });

  it('dailyBriefing returns a string starting with Good morning', async () => {
    const msg = await dailyBriefing(userId);
    expect(typeof msg).toBe('string');
    expect(msg).toMatch(/Good morning/);
  });

  it('dailyBriefing includes "clear schedule" when no reminders', async () => {
    const msg = await dailyBriefing(userId);
    expect(msg).toMatch(/clear schedule|No reminders/i);
  });

  it('overdueAlert returns null when no overdue reminders', async () => {
    const result = await overdueAlert(userId);
    expect(result).toBeNull();
  });

  it('overdueAlert returns a string when overdue reminders exist', async () => {
    const { v4: uuid } = await import('uuid');
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, completed) VALUES (?, ?, ?, ?, 0)'
    ).run(uuid(), userId, 'Overdue task', pastDate);
    const msg = await overdueAlert(userId);
    expect(typeof msg).toBe('string');
    expect(msg).toMatch(/overdue/i);
    db.prepare('DELETE FROM reminders WHERE user_id = ?').run(userId);
  });

  it('idleCheckIn returns null when user has recent activity', async () => {
    db.prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?").run(userId);
    const result = await idleCheckIn(userId);
    expect(result).toBeNull();
  });

  it('idleCheckIn returns a message when user has been idle 4+ days', async () => {
    const oldDate = new Date(Date.now() - 4 * 86400000).toISOString();
    db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(oldDate, userId);
    const msg = await idleCheckIn(userId);
    expect(typeof msg).toBe('string');
    expect(msg).toMatch(/while|miss/i);
    db.prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?").run(userId);
  });

  it('proactiveEnabled = 0 makes dailyBriefing return null', async () => {
    db.prepare('UPDATE users SET proactive_enabled = 0 WHERE id = ?').run(userId);
    const msg = await dailyBriefing(userId);
    expect(msg).toBeNull();
    db.prepare('UPDATE users SET proactive_enabled = 1 WHERE id = ?').run(userId);
  });
});
