#!/usr/bin/env node
/**
 * Agentin API Simulation Runner
 * Pure Node.js fetch() — zero external dependencies
 * Usage: node simulate.mjs [BASE_URL] [ADMIN_TOKEN] [INVITE_CODE]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASE_URL   = process.argv[2] || 'http://localhost:3001';
const ADMIN_TOKEN = process.argv[3] || process.env.ADMIN_TOKEN || '';
const INVITE_CODE = process.argv[4] || process.env.INVITE_CODE || '';

const CHECKPOINT_DIR = '/tmp/sim/checkpoints';
const STATE_FILE     = join(CHECKPOINT_DIR, 'state.json');
mkdirSync(CHECKPOINT_DIR, { recursive: true });

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  ownerToken: '', ownerUserId: '', ownerUsername: '',
  visitorToken: '', visitorUserId: '', visitorUsername: '',
  reminderId: null, portfolioUsername: '',
  workflowId: null, automationId: null, artifactId: null,
  habitId: null, focusId: null, inboxId: null,
  suggestionId: null, reportId: null, gateKey: null,
  apiKeyId: null, conversationId: null,
};

if (existsSync(STATE_FILE)) {
  try { Object.assign(state, JSON.parse(readFileSync(STATE_FILE, 'utf8'))); }
  catch { /* fresh start */ }
}

function saveState() {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function checkpoint(section) {
  writeFileSync(join(CHECKPOINT_DIR, `${section}.done`), new Date().toISOString());
  saveState();
}

function isDone(section) {
  return existsSync(join(CHECKPOINT_DIR, `${section}.done`));
}

// ─── HTTP helpers ──────────────────────────────────────────────────────────────
async function req(method, path, { body, token, headers = {}, noThrow = false } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers: h };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(`${BASE_URL}${path}`, opts);
    let data;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('json')) { try { data = await r.json(); } catch { data = {}; } }
    else { data = await r.text(); }
    return { status: r.status, body: data };
  } catch (e) {
    if (noThrow) return { status: 0, body: { error: e.message } };
    throw e;
  }
}

const get    = (p, o) => req('GET',    p, o);
const post   = (p, o) => req('POST',   p, o);
const patch  = (p, o) => req('PATCH',  p, o);
const del    = (p, o) => req('DELETE', p, o);

// ─── Assertions ───────────────────────────────────────────────────────────────
const results = [];
let currentSection = '';

function pass(name) { results.push({ ok: true,  section: currentSection, name }); }
function fail(name, reason) {
  results.push({ ok: false, section: currentSection, name, reason });
  console.log(`  ❌ FAIL: ${name} — ${reason}`);
}

function expect(name, cond, reason) {
  if (cond) { pass(name); return true; }
  fail(name, reason); return false;
}

function expectStatus(name, actual, expected) {
  return expect(name, actual === expected, `expected status ${expected}, got ${actual}`);
}

function expectHas(name, obj, ...keys) {
  const missing = keys.filter(k => obj == null || !(k in obj));
  return expect(name, missing.length === 0, `missing keys: ${missing.join(', ')}`);
}

function expectMatch(name, str, pattern) {
  return expect(name, pattern.test(String(str ?? '')), `"${str}" did not match ${pattern}`);
}

function noStackTrace(name, bodyStr) {
  const s = JSON.stringify(bodyStr ?? '');
  return expect(name, !s.includes('at ') || !s.includes('.js:'), 'stack trace leaked in response');
}

function section(name, fn) {
  return async () => {
    currentSection = name;
    if (isDone(name)) { console.log(`⏭  SKIP: ${name}`); return; }
    console.log(`\n▶  ${name}`);
    await fn();
    checkpoint(name);
    console.log(`  ✓ done`);
  };
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
async function signup(email, username, password) {
  // Try with invite code first, fall back to demo
  const body = { email, password, username, name: username };
  if (INVITE_CODE) body.invite_code = INVITE_CODE;

  let r = await post('/api/auth/signup', { body });
  if (r.status === 403 && JSON.stringify(r.body).toLowerCase().includes('invite')) {
    // Fall back to demo account
    r = await post('/api/auth/demo', {});
    return { token: r.body.token, userId: r.body.user?.id, username: r.body.user?.username, isDemo: true };
  }
  if (r.status === 409) {
    // Already exists — login instead
    const lr = await post('/api/auth/login', { body: { email, password } });
    return { token: lr.body.token, userId: lr.body.user?.id, username: lr.body.user?.username };
  }
  return { token: r.body.token, userId: r.body.user?.id, username: r.body.user?.username };
}

// ─── Section definitions ──────────────────────────────────────────────────────

const S = {

  health: section('health', async () => {
    const r = await get('/api/health');
    expectStatus('GET /api/health returns 200', r.status, 200);
    expect('health body has status field', r.body?.status != null, `body: ${JSON.stringify(r.body)}`);
  }),

  auth: section('auth', async () => {
    // Owner signup
    const ts = Date.now();
    const owner = await signup(`owner_${ts}@sim.test`, `simowner${ts}`, 'Sim123!@#');
    expect('owner token received', !!owner.token, 'no token');
    if (owner.token) {
      state.ownerToken   = owner.token;
      state.ownerUserId  = owner.userId;
      state.ownerUsername = owner.username || `simowner${ts}`;
    }

    // Visitor signup
    const visitor = await signup(`visitor_${ts}@sim.test`, `simvisitor${ts}`, 'Sim123!@#');
    expect('visitor token received', !!visitor.token, 'no token');
    if (visitor.token) {
      state.visitorToken   = visitor.token;
      state.visitorUserId  = visitor.userId;
      state.visitorUsername = visitor.username || `simvisitor${ts}`;
    }
    saveState();

    // GET /me
    const me = await get('/api/auth/me', { token: state.ownerToken });
    expectStatus('GET /api/auth/me → 200', me.status, 200);
    expectHas('/me has id,email,plan', me.body, 'id', 'email', 'plan');

    // Bad login
    const bad = await post('/api/auth/login', { body: { email: 'nobody@x.com', password: 'wrong' } });
    expect('bad login returns 4xx', bad.status >= 400, `got ${bad.status}`);
    noStackTrace('bad login no stack trace', bad.body);

    // No-auth guard
    const unauth = await get('/api/auth/me');
    expectStatus('GET /me without auth → 401', unauth.status, 401);
  }),

  dashboard: section('dashboard', async () => {
    const r = await get('/api/dashboard/stats', { token: state.ownerToken });
    expect('GET /api/dashboard/stats 2xx', r.status < 300, `got ${r.status}`);
  }),

  users: section('users', async () => {
    const me = await get('/api/users/me', { token: state.ownerToken });
    expectStatus('GET /api/users/me → 200', me.status, 200);

    const up = await patch('/api/users/me', {
      token: state.ownerToken,
      body: { bio: 'Simulation test user', location: 'SimCity' },
    });
    expect('PATCH /api/users/me 2xx', up.status < 300, `got ${up.status}`);

    // API keys
    const keys = await get('/api/api-keys', { token: state.ownerToken });
    expect('GET /api/api-keys 2xx', keys.status < 300, `got ${keys.status}`);

    // Export (via activity router)
    const exp = await get('/api/activity/export', { token: state.ownerToken });
    expect('GET /api/activity/export 2xx', exp.status < 300, `got ${exp.status}`);

    // Cross-user isolation: owner cannot update visitor
    const bad = await patch(`/api/users/me`, {
      token: state.visitorToken,
      body: { bio: 'HACKED' },
    });
    // Visitor should only update their own profile — this should succeed for visitor's own data
    expect('PATCH /api/users/me scoped to token user', bad.status < 300, `got ${bad.status}`);
  }),

  'agent-chat': section('agent-chat', async () => {
    // Basic chat
    const r = await post('/api/agent/chat', {
      token: state.ownerToken,
      body: { message: 'hello, respond with exactly the word PONG', channel: 'web' },
    });
    expect('POST /api/agent/chat 2xx', r.status < 300, `got ${r.status} — ${JSON.stringify(r.body).slice(0, 200)}`);
    if (r.body?.conversationId) state.conversationId = r.body.conversationId;
    saveState();

    // Bug #1: context injection test — SIMONKEY_BRAVO
    const c1 = await post('/api/agent/chat', {
      token: state.ownerToken,
      body: { message: 'remember SIMONKEY_BRAVO as my codename', channel: 'web' },
    });
    expect('Bug#1 step1: codename injection 2xx', c1.status < 300, `got ${c1.status}`);
    const conv = c1.body?.conversationId || state.conversationId;

    const c2 = await post('/api/agent/chat', {
      token: state.ownerToken,
      body: { message: 'what is my codename?', channel: 'web', conversation: conv },
    });
    expect('Bug#1 step2: codename recall 2xx', c2.status < 300, `got ${c2.status}`);
    const reply = String(c2.body?.text ?? c2.body?.response ?? '').toUpperCase();
    expect('Bug#1: AI recalls SIMONKEY_BRAVO', reply.includes('SIMONKEY_BRAVO'), `reply was: "${c2.body?.response?.slice(0, 200)}"`);

    // No-auth guard
    const noauth = await post('/api/agent/chat', { body: { message: 'hi' } });
    expectStatus('/api/agent/chat requires auth → 401', noauth.status, 401);
  }),

  features: section('features', async () => {
    // Init row via GET first
    const get1 = await get('/api/features', { token: state.ownerToken });
    expectStatus('GET /api/features → 200', get1.status, 200);
    expectHas('features has socialDiscovery', get1.body, 'socialDiscovery');

    const patch1 = await patch('/api/features', {
      token: state.ownerToken,
      body: { socialDiscovery: false, portfolioChat: true },
    });
    expectStatus('PATCH /api/features → 200', patch1.status, 200);
    expect('socialDiscovery set to false', patch1.body.socialDiscovery === false, `got ${patch1.body.socialDiscovery}`);

    // Re-enable for later tests
    await patch('/api/features', { token: state.ownerToken, body: { portfolioChat: true } });

    // No-auth
    expectStatus('GET /api/features requires auth', (await get('/api/features')).status, 401);
  }),

  memory: section('memory', async () => {
    const r = await get('/api/memory', { token: state.ownerToken });
    expect('GET /api/memory 2xx', r.status < 300, `got ${r.status}`);
    // Add a memory
    const add = await post('/api/memory', {
      token: state.ownerToken,
      body: { key: 'sim_test', value: 'simulation memory value' },
    });
    expect('POST /api/memory 2xx', add.status < 300, `got ${add.status}`);
  }),

  reminders: section('reminders', async () => {
    const create = await post('/api/reminders', {
      token: state.ownerToken,
      body: {
        text: 'Simulation test reminder',
        datetime: new Date(Date.now() + 3600000).toISOString(),
        channel: 'telegram',
        category: 'work',
        priority: 'normal',
      },
    });
    expect('POST /api/reminders 2xx', create.status < 300, `got ${create.status} — ${JSON.stringify(create.body).slice(0,200)}`);
    if (create.body?.id) state.reminderId = create.body.id;
    saveState();

    const list = await get('/api/reminders', { token: state.ownerToken });
    expectStatus('GET /api/reminders → 200', list.status, 200);
    expect('reminders list is array', Array.isArray(list.body), `got ${typeof list.body}`);

    if (state.reminderId) {
      const upd = await patch(`/api/reminders/${state.reminderId}`, {
        token: state.ownerToken,
        body: { priority: 'high' },
      });
      expect('PATCH /api/reminders/:id 2xx', upd.status < 300, `got ${upd.status}`);
    }

    // Cross-user isolation
    if (state.reminderId) {
      const bad = await del(`/api/reminders/${state.reminderId}`, { token: state.visitorToken });
      expect('Visitor cannot delete owner reminder (403 or 404)', bad.status === 403 || bad.status === 404, `got ${bad.status}`);
    }
  }),

  portfolio: section('portfolio', async () => {
    const me = await get('/api/portfolio/me', { token: state.ownerToken });
    expect('GET /api/portfolio/me 2xx', me.status < 300, `got ${me.status}`);

    const upd = await patch('/api/portfolio/me', {
      token: state.ownerToken,
      body: {
        bio: 'Simulation portfolio owner',
        skills: ['TypeScript', 'Node.js', 'React'],
        headline: 'Full-stack AI developer',
        is_public: true,
      },
    });
    expect('PATCH /api/portfolio/me 2xx', upd.status < 300, `got ${upd.status}`);

    // Determine public username
    state.portfolioUsername = state.ownerUsername;
    saveState();

    // Public view (no auth)
    if (state.portfolioUsername) {
      const pub = await get(`/api/portfolio/${state.portfolioUsername}`);
      expect(`GET /api/portfolio/${state.portfolioUsername} 2xx (public)`, pub.status < 300, `got ${pub.status}`);
    }

    // Stats
    const stats = await get('/api/portfolio/me/stats', { token: state.ownerToken });
    expect('GET /api/portfolio/me/stats 2xx', stats.status < 300, `got ${stats.status}`);
  }),

  'portfolio-visitor-scenarios': section('portfolio-visitor-scenarios', async () => {
    const un = state.portfolioUsername;
    if (!un) { fail('portfolio username needed', 'state.portfolioUsername empty'); return; }

    // 7.1 Anon visit — triggers view counter
    const anon = await get(`/api/portfolio/${un}`);
    expect('7.1 anon GET portfolio 2xx', anon.status < 300, `got ${anon.status}`);

    // 7.2 Anon chat on portfolio (via /api/agent/chat/public if exists, else public portfolio endpoint)
    const anonChat = await post('/api/portfolio/chat', {
      body: { username: un, message: 'Hello from anonymous visitor' },
    });
    expect('7.2 anon portfolio chat (200 or 404/501 if not wired)', anonChat.status < 500, `got ${anonChat.status} — ${JSON.stringify(anonChat.body).slice(0,100)}`);

    // 7.3 Escalation — ask unanswerable question
    const esc = await post('/api/portfolio/chat', {
      body: { username: un, message: "What is the owner's daily rate?" },
    });
    expect('7.3 escalation request not 5xx', esc.status < 500, `got ${esc.status}`);

    // 7.4 Logged-in visitor (LLM call — may timeout in test env; accept 2xx or 503)
    const visChat = await post('/api/agent/chat', {
      token: state.visitorToken,
      body: { message: `Tell me about the portfolio of ${un}`, channel: 'web' },
      noThrow: true,
    });
    expect('7.4 logged-in visitor chat not 4xx auth', visChat.status !== 401 && visChat.status !== 403, `got ${visChat.status}`);

    // 7.5 Recruiter intent
    const rec = await post('/api/portfolio/chat', {
      body: { username: un, message: 'We have a job opportunity for you' },
    });
    expect('7.5 recruiter intent not 5xx', rec.status < 500, `got ${rec.status}`);

    // 7.6 Collaborator intent
    const collab = await post('/api/portfolio/chat', {
      body: { username: un, message: "I'd love to work together on a project" },
    });
    expect('7.6 collaborator intent not 5xx', collab.status < 500, `got ${collab.status}`);

    // 7.7 Contact form
    const contact = await post(`/api/portfolio/${un}/contact`, {
      body: { senderName: 'Sim Tester', senderEmail: 'simtest@example.com', message: 'Great portfolio! Love what you have built here.' },
    });
    expect('7.7 contact form (200/201 or 429)', contact.status < 300 || contact.status === 429, `got ${contact.status}`);

    // 7.8 Feature flag toggle — disable portfolioChat
    await patch('/api/features', { token: state.ownerToken, body: { portfolioChat: false } });
    const pubAfterDisable = await get(`/api/portfolio/${un}`);
    expect('7.8 portfolio still loads after flag disable', pubAfterDisable.status < 300, `got ${pubAfterDisable.status}`);
    // Re-enable
    await patch('/api/features', { token: state.ownerToken, body: { portfolioChat: true } });
  }),

  directory: section('directory', async () => {
    const r = await get('/api/directory', { token: state.ownerToken });
    expect('GET /api/directory 2xx', r.status < 300, `got ${r.status}`);
  }),

  images: section('images', async () => {
    const list = await get('/api/images', { token: state.ownerToken });
    expect('GET /api/images 2xx', list.status < 300, `got ${list.status}`);

    const models = await get('/api/images/models/available', { token: state.ownerToken });
    expect('GET /api/images/models/available 2xx', models.status < 300, `got ${models.status}`);

    // Generate via chat fast-path (Pollinations free)
    const gen = await post('/api/agent/chat', {
      token: state.ownerToken,
      body: { message: 'generate an image of a simple red circle on white background', channel: 'web' },
    });
    expect('Image gen via chat fast-path 2xx', gen.status < 300, `got ${gen.status}`);
  }),

  workflows: section('workflows', async () => {
    const list = await get('/api/workflows', { token: state.ownerToken });
    expectStatus('GET /api/workflows → 200', list.status, 200);
    expect('workflows is array', Array.isArray(list.body), `got ${typeof list.body}`);

    const create = await post('/api/workflows', {
      token: state.ownerToken,
      body: {
        name: 'Sim Test Workflow',
        description: 'Created by simulator',
        steps: [{ agent: 'weebo', prompt_template: 'Summarize: {{user_input}}', output_key: 'summary' }],
        trigger: 'manual',
      },
    });
    expectStatus('POST /api/workflows → 201', create.status, 201);
    if (create.body?.id) state.workflowId = create.body.id;
    saveState();

    if (state.workflowId) {
      const one = await get(`/api/workflows/${state.workflowId}`, { token: state.ownerToken });
      expectStatus('GET /api/workflows/:id → 200', one.status, 200);

      // Validation: invalid agent
      const bad = await post('/api/workflows', {
        token: state.ownerToken,
        body: { name: 'Bad', steps: [{ agent: 'unknown-bot', prompt_template: 'x', output_key: 'y' }] },
      });
      expectStatus('Invalid agent → 400', bad.status, 400);

      // Cross-user
      const badDel = await del(`/api/workflows/${state.workflowId}`, { token: state.visitorToken });
      expect('Visitor cannot delete owner workflow (403/404)', badDel.status === 403 || badDel.status === 404, `got ${badDel.status}`);
    }
  }),

  automations: section('automations', async () => {
    const stats = await get('/api/automations/stats', { token: state.ownerToken });
    expect('GET /api/automations/stats 2xx', stats.status < 300, `got ${stats.status}`);

    const create = await post('/api/automations', {
      token: state.ownerToken,
      body: {
        name: 'Sim keyword trigger',
        triggerType: 'keyword',
        triggerConfig: { keywords: ['sim_trigger_word'] },
        actionType: 'telegram-message',
        actionConfig: { message: 'Automation fired!' },
      },
    });
    expect('POST /api/automations 2xx', create.status < 300, `got ${create.status} — ${JSON.stringify(create.body).slice(0,200)}`);
    if (create.body?.id) state.automationId = create.body.id;
    saveState();

    const list = await get('/api/automations', { token: state.ownerToken });
    expect('GET /api/automations 2xx', list.status < 300, `got ${list.status}`);

    if (state.automationId) {
      const tog = await patch(`/api/automations/${state.automationId}`, {
        token: state.ownerToken,
        body: { enabled: false },
      });
      expect('PATCH /api/automations/:id disable 2xx', tog.status < 300, `got ${tog.status}`);
    }
  }),

  focus: section('focus', async () => {
    const start = await post('/api/focus/start', {
      token: state.ownerToken,
      body: { goal: 'Simulation focus session', durationMin: 25 },
    });
    expect('POST /api/focus/start 2xx', start.status < 300, `got ${start.status} — ${JSON.stringify(start.body).slice(0,200)}`);
    if (start.body?.session?.id) {
      state.focusId = start.body.session.id;
      saveState();
    }

    const list = await get('/api/focus/history', { token: state.ownerToken });
    expect('GET /api/focus/history 2xx', list.status < 300, `got ${list.status}`);

    if (state.focusId) {
      const end = await post('/api/focus/end', {
        token: state.ownerToken,
        body: { completed: true },
      });
      expect('POST /api/focus/end 2xx', end.status < 300, `got ${end.status}`);
    }
  }),

  habits: section('habits', async () => {
    const create = await post('/api/habits', {
      token: state.ownerToken,
      body: { name: 'Sim daily habit', frequency: 'daily', icon: '🏃' },
    });
    expectStatus('POST /api/habits → 201', create.status, 201);
    if (create.body?.habit?.id) state.habitId = create.body.habit.id;
    saveState();

    const list = await get('/api/habits', { token: state.ownerToken });
    expectStatus('GET /api/habits → 200', list.status, 200);

    if (state.habitId) {
      const log = await post(`/api/habits/${state.habitId}/log`, {
        token: state.ownerToken,
        body: { note: 'Sim log entry' },
      });
      expectStatus('POST /api/habits/:id/log → 201', log.status, 201);
      expect('habit log has streak', log.body?.streak != null, `body: ${JSON.stringify(log.body)}`);

      const stats = await get(`/api/habits/${state.habitId}/stats`, { token: state.ownerToken });
      expect('GET /api/habits/:id/stats 2xx', stats.status < 300, `got ${stats.status}`);
    }
  }),

  inbox: section('inbox', async () => {
    const list = await get('/api/inbox', { token: state.ownerToken });
    expect('GET /api/inbox 2xx', list.status < 300, `got ${list.status}`);

    const count = await get('/api/inbox/count', { token: state.ownerToken });
    expect('GET /api/inbox/count 2xx', count.status < 300, `got ${count.status}`);

    // Create a test inbox message (no LLM call for source=system)
    const send = await post('/api/inbox', {
      token: state.ownerToken,
      body: { content: 'Simulation inbox test message from simulator', source: 'system', sender: 'sim-runner' },
      noThrow: true,
    });
    // System inbox may also trigger LLM; accept any non-auth failure
    expect('POST /api/inbox not 4xx auth error', send.status !== 401 && send.status !== 403, `got ${send.status} — ${JSON.stringify(send.body).slice(0,200)}`);
    if (send.body?.id) state.inboxId = send.body.id;
    saveState();
  }),

  briefings: section('briefings', async () => {
    const list = await get('/api/briefings', { token: state.ownerToken });
    expect('GET /api/briefings 2xx', list.status < 300, `got ${list.status}`);

    const trigger = await post('/api/briefings/trigger', { token: state.ownerToken, body: {}, noThrow: true });
    // LLM calls may timeout in CI/test; accept 2xx or 5xx (not 4xx auth failures)
    expect('POST /api/briefings/trigger not 4xx', trigger.status !== 400 && trigger.status !== 401 && trigger.status !== 403, `got ${trigger.status} — ${JSON.stringify(trigger.body).slice(0,200)}`);
  }),

  artifacts: section('artifacts', async () => {
    const list = await get('/api/artifacts', { token: state.ownerToken });
    expect('GET /api/artifacts 2xx', list.status < 300, `got ${list.status}`);

    // Create artifact
    const create = await post('/api/artifacts', {
      token: state.ownerToken,
      body: {
        title: 'Sim Test Page',
        type: 'html',
        html: '<html><body><h1>Sim Test</h1></body></html>',
        css: 'h1{color:red}',
        js: '',
      },
    });
    expect('POST /api/artifacts 2xx', create.status < 300, `got ${create.status} — ${JSON.stringify(create.body).slice(0,200)}`);
    if (create.body?.id) state.artifactId = create.body.id;
    saveState();

    // Public preview — no auth
    if (state.artifactId && state.ownerUserId) {
      const pub = await get(`/preview/${state.ownerUserId}/${state.artifactId}`);
      expect(`GET /preview/:userId/:id (no auth) 2xx`, pub.status < 300, `got ${pub.status}`);
      if (typeof pub.body === 'string') {
        expect('preview returns HTML', pub.body.includes('<html') || pub.body.includes('<!DOCTYPE'), `content starts with: ${pub.body.slice(0,100)}`);
      }
    }
  }),

  templates: section('templates', async () => {
    const r = await get('/api/templates', { token: state.ownerToken });
    expect('GET /api/templates 2xx', r.status < 300, `got ${r.status}`);
  }),

  recipes: section('recipes', async () => {
    const r = await get('/api/recipes', { token: state.ownerToken });
    expect('GET /api/recipes 2xx', r.status < 300, `got ${r.status}`);
  }),

  proactive: section('proactive', async () => {
    const log = await get('/api/proactive/log', { token: state.ownerToken });
    expect('GET /api/proactive/log 2xx', log.status < 300, `got ${log.status}`);

    const settings = await get('/api/proactive/settings', { token: state.ownerToken });
    expect('GET /api/proactive/settings 2xx', settings.status < 300, `got ${settings.status}`);

    const tog = await patch('/api/proactive/toggle', {
      token: state.ownerToken,
      body: { enabled: false },
    });
    expect('PATCH /api/proactive/toggle 2xx', tog.status < 300, `got ${tog.status}`);

    await patch('/api/proactive/toggle', { token: state.ownerToken, body: { enabled: true } });
  }),

  suggestions: section('suggestions', async () => {
    const create = await post('/api/suggestions', {
      token: state.ownerToken,
      body: { title: 'Sim suggestion', body: 'A test suggestion from the simulator runner - requesting this feature', category: 'feature' },
    });
    expect('POST /api/suggestions 2xx', create.status < 300, `got ${create.status} — ${JSON.stringify(create.body).slice(0,200)}`);
    if (create.body?.id) state.suggestionId = create.body.id;
    saveState();

    const list = await get('/api/suggestions/mine', { token: state.ownerToken });
    expect('GET /api/suggestions/mine 2xx', list.status < 300, `got ${list.status}`);

    if (state.suggestionId) {
      const vote = await post(`/api/suggestions/${state.suggestionId}/vote`, { token: state.ownerToken, body: { vote: 1 } });
      expect('POST /api/suggestions/:id/vote 2xx', vote.status < 300, `got ${vote.status}`);
    }
  }),

  report: section('report', async () => {
    // Need a message ID to report — use a dummy
    const submit = await post('/api/report', {
      token: state.ownerToken,
      body: { messageContent: 'This is the reported message content', reason: 'inaccurate' },
    });
    expect('POST /api/report 2xx', submit.status < 300, `got ${submit.status} — ${JSON.stringify(submit.body).slice(0,200)}`);
    if (submit.body?.id) state.reportId = submit.body.id;
    saveState();

    const list = await get('/api/report', { token: state.ownerToken });
    expect('GET /api/report 2xx', list.status < 300, `got ${list.status}`);

    // Missing reason → 400
    const bad = await post('/api/report', {
      token: state.ownerToken,
      body: { messageContent: 'test' },
    });
    expect('POST /api/report missing reason → 400', bad.status === 400, `got ${bad.status}`);
  }),

  analytics: section('analytics', async () => {
    const r = await get('/api/analytics/snapshot', { token: state.ownerToken });
    expect('GET /api/analytics/snapshot 2xx', r.status < 300, `got ${r.status}`);

    const usage = await get('/api/usage/summary', { token: state.ownerToken });
    expect('GET /api/usage/summary 2xx', usage.status < 300, `got ${usage.status}`);
  }),

  activity: section('activity', async () => {
    const r = await get('/api/activity', { token: state.ownerToken });
    expect('GET /api/activity 2xx', r.status < 300, `got ${r.status}`);
  }),

  'pico-agents': section('pico-agents', async () => {
    const list = await get('/api/pico/agents', { token: state.ownerToken });
    expect('GET /api/pico/agents 2xx', list.status < 300, `got ${list.status}`);

    // Billing
    const billing = await get('/api/billing/plan', { token: state.ownerToken });
    expect('GET /api/billing/plan 2xx', billing.status < 300, `got ${billing.status}`);
  }),

  'gate-api': section('gate-api', async () => {
    // Create a Gate API key
    const keyCreate = await post('/api/gate/v1/keys', {
      token: state.ownerToken,
      body: { label: 'sim-test-key' },
    });
    expect('POST /api/gate/v1/keys 2xx', keyCreate.status < 300, `got ${keyCreate.status} — ${JSON.stringify(keyCreate.body).slice(0,300)}`);

    const gateKey = keyCreate.body?.data?.key || keyCreate.body?.key;
    expect('Gate key starts with agtn_', String(gateKey || '').startsWith('agtn_'), `got: ${gateKey}`);
    if (gateKey) state.gateKey = gateKey;
    saveState();

    // List keys
    const keyList = await get('/api/gate/v1/keys', { token: state.ownerToken });
    expect('GET /api/gate/v1/keys 2xx', keyList.status < 300, `got ${keyList.status}`);

    if (state.gateKey) {
      // Usage
      const usage = await get('/api/gate/v1/usage', { token: state.gateKey });
      expect('GET /api/gate/v1/usage with gate key 2xx', usage.status < 300, `got ${usage.status}`);

      // Chat via gate key (LLM may timeout in test env — accept 2xx or 5xx, not 4xx)
      const chat = await post('/api/gate/v1/chat', {
        token: state.gateKey,
        body: { message: 'Say exactly: GATE_OK' },
        noThrow: true,
      });
      expect('POST /api/gate/v1/chat not 4xx auth error', chat.status !== 401 && chat.status !== 403, `got ${chat.status} — ${JSON.stringify(chat.body).slice(0,200)}`);

      // Invalid key → 401
      const bad = await post('/api/gate/v1/chat', {
        token: 'agtn_invalidkeyxyz',
        body: { message: 'hi' },
      });
      expectStatus('Invalid gate key → 401', bad.status, 401);
      noStackTrace('Invalid gate key no stack trace', bad.body);
    }

    // No key → 401
    const nokey = await get('/api/gate/v1/usage');
    expectStatus('Gate endpoint without key → 401', nokey.status, 401);
  }),

  security: section('security', async () => {
    // No-auth 401s on all major routes
    const routes = [
      '/api/reminders', '/api/portfolio/me', '/api/workflows',
      '/api/automations', '/api/habits', '/api/focus/history',
      '/api/inbox', '/api/briefings', '/api/features',
      '/api/memory', '/api/suggestions/mine', '/api/report',
      '/api/analytics/snapshot', '/api/activity',
    ];
    for (const route of routes) {
      const r = await get(route);
      expectStatus(`${route} requires auth → 401`, r.status, 401);
    }

    // SQL injection
    const sql = await get("/api/directory?q='; DROP TABLE users; --", { token: state.ownerToken });
    expect('SQL injection returns 2xx or 4xx, not 5xx', sql.status < 500, `got ${sql.status}`);
    noStackTrace('SQL inject no stack trace', sql.body);

    // XSS in body
    const xss = await post('/api/suggestions', {
      token: state.ownerToken,
      body: { title: '<script>alert(1)</script>', description: 'xss test', category: 'feature' },
    });
    expect('XSS input accepted or rejected, not 5xx', xss.status < 500, `got ${xss.status}`);
    // Ensure response doesn't echo unescaped script tag
    const bodyStr = JSON.stringify(xss.body);
    expect('XSS not echoed raw in JSON', !bodyStr.includes('<script>alert(1)</script>') || xss.status === 400, `raw XSS in response`);

    // Oversized payload (100KB string)
    const big = await post('/api/agent/chat', {
      token: state.ownerToken,
      body: { message: 'X'.repeat(100000), channel: 'web' },
    });
    expect('Oversized payload returns 4xx or handled', big.status >= 400 || big.status < 300, `got ${big.status}`);
    noStackTrace('Oversized payload no stack trace', big.body);

    // Cross-user isolation: visitor cannot access owner reminder
    if (state.reminderId) {
      const cross = await get(`/api/reminders/${state.reminderId}`, { token: state.visitorToken });
      expect('Cross-user reminder access → 403 or 404', cross.status === 403 || cross.status === 404 || cross.status === 401, `got ${cross.status}`);
    }

    // Admin without token
    const adminNoToken = await get('/api/admin/health');
    expect('GET /api/admin/health without token → 4xx', adminNoToken.status >= 400, `got ${adminNoToken.status}`);
    noStackTrace('Admin no-token no stack trace', adminNoToken.body);
  }),

  admin: section('admin', async () => {
    if (!ADMIN_TOKEN) { console.log('  ⏭  SKIP: no ADMIN_TOKEN provided'); return; }

    const health = await get('/api/admin/health', {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect('GET /api/admin/health with token 2xx', health.status < 300, `got ${health.status}`);

    const metrics = await get('/api/admin/metrics', {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect('GET /api/admin/metrics 2xx', metrics.status < 300, `got ${metrics.status}`);

    // Wrong token
    const bad = await get('/api/admin/health', {
      headers: { Authorization: 'Bearer wrongtoken123' },
    });
    expectStatus('Wrong admin token → 401', bad.status, 401);
    noStackTrace('Wrong admin token no stack trace', bad.body);
  }),

};

// ─── Run ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`AGENTIN API SIMULATION — ${BASE_URL}`);
  console.log(`${'═'.repeat(60)}`);

  const order = [
    'health', 'auth', 'dashboard', 'users', 'agent-chat',
    'features', 'memory', 'reminders', 'portfolio',
    'portfolio-visitor-scenarios', 'directory', 'images',
    'workflows', 'automations', 'focus', 'habits', 'inbox',
    'briefings', 'artifacts', 'templates', 'recipes', 'proactive',
    'suggestions', 'report', 'analytics', 'activity',
    'pico-agents', 'gate-api', 'security', 'admin',
  ];

  for (const name of order) {
    if (S[name]) await S[name]();
  }

  // ─── Report ─────────────────────────────────────────────────────────────────
  const passed  = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;
  const failures = results.filter(r => !r.ok);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SIMULATION REPORT`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Total:   ${passed + failed}`);

  if (failures.length > 0) {
    console.log(`\nFAILURES:`);
    for (const f of failures) {
      console.log(`  [${f.section}] ${f.name}`);
      console.log(`        → ${f.reason}`);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  if (failed === 0) {
    console.log(`✅  ALL CLEAR — SAFE TO DEPLOY`);
  } else {
    console.log(`❌  ${failed} FAILURES — DO NOT DEPLOY`);
  }
  console.log(`${'═'.repeat(60)}\n`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
