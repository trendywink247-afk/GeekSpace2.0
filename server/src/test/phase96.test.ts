/**
 * Phase 96 -- Multi-Agent Workflows Tests
 * Covers: DB schema, workflow CRUD, run execution, template substitution,
 *         seeded templates, route coverage, auth protection
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { generateTestToken, createTestUser } from './setup.js';
import {
  substituteTemplate,
  seedWorkflowTemplates,
  getUserWorkflowList,
} from '../services/workflow-runner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

function readSrc(...parts: string[]): string {
  return readFileSync(path.join(ROOT, 'server/src', ...parts), 'utf-8');
}
function fileExists(rel: string): boolean {
  return existsSync(path.join(ROOT, rel));
}

// ──────────────────────────────────────────────────────────────────────────────
// 96.1  DB Schema: user_workflows and user_workflow_runs tables
// ──────────────────────────────────────────────────────────────────────────────

describe('96.1 DB schema: user_workflows and user_workflow_runs', () => {
  it('db/index.ts creates user_workflows table', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('CREATE TABLE IF NOT EXISTS user_workflows');
  });

  it('db/index.ts creates user_workflow_runs table', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('CREATE TABLE IF NOT EXISTS user_workflow_runs');
  });

  it('user_workflows table has steps column', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('steps TEXT');
  });

  it('user_workflows table has trigger column', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('trigger TEXT');
  });

  it('user_workflows table has enabled column', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('enabled INTEGER');
  });

  it('user_workflows table has last_run column', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('last_run INTEGER');
  });

  it('user_workflow_runs table has context column', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('context TEXT');
  });

  it('user_workflow_runs table has status column', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('status TEXT');
  });

  it('user_workflows table exists in live DB', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_workflows'").get();
    expect(row).toBeTruthy();
  });

  it('user_workflow_runs table exists in live DB', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_workflow_runs'").get();
    expect(row).toBeTruthy();
  });

  it('user_workflow_runs has FK reference to user_workflows', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('REFERENCES user_workflows');
  });

  it('user_workflows has index on user_id', () => {
    const src = readSrc('db', 'index.ts');
    expect(src).toContain('idx_user_workflows_user');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 96.2  workflow-runner.ts: service file checks + unit tests
// ──────────────────────────────────────────────────────────────────────────────

describe('96.2 workflow-runner.ts service', () => {
  it('workflow-runner.ts exists', () => {
    expect(fileExists('server/src/services/workflow-runner.ts')).toBe(true);
  });

  it('exports substituteTemplate', () => {
    const src = readSrc('services', 'workflow-runner.ts');
    expect(src).toContain('export function substituteTemplate');
  });

  it('exports runUserWorkflow', () => {
    const src = readSrc('services', 'workflow-runner.ts');
    expect(src).toContain('export async function runUserWorkflow');
  });

  it('exports seedWorkflowTemplates', () => {
    const src = readSrc('services', 'workflow-runner.ts');
    expect(src).toContain('export function seedWorkflowTemplates');
  });

  it('exports getUserWorkflowList', () => {
    const src = readSrc('services', 'workflow-runner.ts');
    expect(src).toContain('export function getUserWorkflowList');
  });

  it('exports getUserWorkflowById', () => {
    const src = readSrc('services', 'workflow-runner.ts');
    expect(src).toContain('export function getUserWorkflowById');
  });

  it('exports getWorkflowRuns', () => {
    const src = readSrc('services', 'workflow-runner.ts');
    expect(src).toContain('export function getWorkflowRuns');
  });

  it('exports getWorkflowRun', () => {
    const src = readSrc('services', 'workflow-runner.ts');
    expect(src).toContain('export function getWorkflowRun');
  });

  it('returns TEST_MODE stub in callAgent', () => {
    const src = readSrc('services', 'workflow-runner.ts');
    expect(src).toContain('isTestMode');
    expect(src).toContain('TEST RESPONSE');
  });

  it('substituteTemplate replaces user_input', () => {
    const result = substituteTemplate('Hello {{user_input}}!', {}, 'World');
    expect(result).toBe('Hello World!');
  });

  it('substituteTemplate replaces previous_output with last context value', () => {
    const ctx = { step1: 'first output' };
    const result = substituteTemplate('Based on: {{previous_output}}', ctx, '');
    expect(result).toBe('Based on: first output');
  });

  it('substituteTemplate replaces named context keys', () => {
    const ctx = { summary: 'my summary' };
    const result = substituteTemplate('Here is: {{summary}}', ctx, '');
    expect(result).toBe('Here is: my summary');
  });

  it('substituteTemplate returns unchanged string when no vars', () => {
    const result = substituteTemplate('No variables here', {}, 'input');
    expect(result).toBe('No variables here');
  });

  it('substituteTemplate handles both user_input and named key in same template', () => {
    const ctx = { summary: 'the summary' };
    const result = substituteTemplate('Input: {{user_input}}, Summary: {{summary}}', ctx, 'raw');
    expect(result).toBe('Input: raw, Summary: the summary');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 96.3  routes/workflows.ts: route file checks
// ──────────────────────────────────────────────────────────────────────────────

describe('96.3 routes/workflows.ts', () => {
  it('workflows.ts exists', () => {
    expect(fileExists('server/src/routes/workflows.ts')).toBe(true);
  });

  it('exports workflowsRouter', () => {
    const src = readSrc('routes', 'workflows.ts');
    expect(src).toContain('export const workflowsRouter');
  });

  it('defines GET / route', () => {
    const src = readSrc('routes', 'workflows.ts');
    expect(src).toContain("workflowsRouter.get('/',");
  });

  it('defines POST / route', () => {
    const src = readSrc('routes', 'workflows.ts');
    expect(src).toContain("workflowsRouter.post('/',");
  });

  it('defines GET /:id route', () => {
    const src = readSrc('routes', 'workflows.ts');
    expect(src).toContain("workflowsRouter.get('/:id'");
  });

  it('defines PATCH /:id route', () => {
    const src = readSrc('routes', 'workflows.ts');
    expect(src).toContain("workflowsRouter.patch('/:id'");
  });

  it('defines DELETE /:id route', () => {
    const src = readSrc('routes', 'workflows.ts');
    expect(src).toContain("workflowsRouter.delete('/:id'");
  });

  it('defines POST /:id/run route', () => {
    const src = readSrc('routes', 'workflows.ts');
    expect(src).toContain("workflowsRouter.post('/:id/run'");
  });

  it('defines GET /:id/runs route', () => {
    const src = readSrc('routes', 'workflows.ts');
    expect(src).toContain("workflowsRouter.get('/:id/runs'");
  });

  it('defines GET /runs/:runId route', () => {
    const src = readSrc('routes', 'workflows.ts');
    expect(src).toContain("workflowsRouter.get('/runs/:runId'");
  });

  it('automationModule is registered in app.ts (which registers workflow routes)', () => {
    const src = readSrc('app.ts');
    expect(src).toContain('automationModule');
  });

  it('automationModule is imported in app.ts', () => {
    const src = readSrc('app.ts');
    expect(src).toContain('automationModule');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 96.4  API: workflow CRUD (functional)
// ──────────────────────────────────────────────────────────────────────────────

let app: ReturnType<typeof createApp>;
let userId: string;
let token: string;

describe('96.4 API: workflow CRUD', () => {
  beforeAll(() => {
    app = createApp();
    const user = createTestUser('phase96-' + Date.now() + '@example.com');
    userId = user.id;
    token = generateTestToken(userId);
  });

  afterAll(() => {
    db.prepare('DELETE FROM user_workflows WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  });

  it('GET /api/workflows returns 401 without auth', async () => {
    const res = await request(app).get('/api/workflows');
    expect(res.status).toBe(401);
  });

  it('GET /api/workflows returns workflows array for authed user', async () => {
    const res = await request(app)
      .get('/api/workflows')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/workflows seeds pre-built templates on first access', async () => {
    const res = await request(app)
      .get('/api/workflows')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it('POST /api/workflows returns 401 without auth', async () => {
    const res = await request(app).post('/api/workflows').send({ name: 'Test', steps: [] });
    expect(res.status).toBe(401);
  });

  it('POST /api/workflows returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', 'Bearer ' + token)
      .send({ steps: [{ agent: 'weebo', prompt_template: 'hi', output_key: 'out' }] });
    expect(res.status).toBe(400);
  });

  it('POST /api/workflows returns 400 when steps is empty', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', 'Bearer ' + token)
      .send({ name: 'Test', steps: [] });
    expect(res.status).toBe(400);
  });

  it('POST /api/workflows creates workflow and returns 201', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name: 'My Test Workflow',
        description: 'Phase 96 test',
        steps: [
          { agent: 'weebo', prompt_template: 'Say hello to {{user_input}}', output_key: 'greeting' },
          { agent: 'jarvis', prompt_template: 'Expand on: {{greeting}}', output_key: 'expanded' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Test Workflow');
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.enabled).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it('GET /api/workflows/:id returns 404 for non-existent workflow', async () => {
    const res = await request(app)
      .get('/api/workflows/999999')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(404);
  });

  it('GET /api/workflows/:id returns the workflow', async () => {
    const created = await request(app)
      .post('/api/workflows')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name: 'Get Test',
        steps: [{ agent: 'weebo', prompt_template: 'test', output_key: 'out' }],
      });
    const wfId = created.body.id;
    const res = await request(app)
      .get('/api/workflows/' + wfId)
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(wfId);
    expect(res.body.name).toBe('Get Test');
  });

  it('PATCH /api/workflows/:id updates workflow fields', async () => {
    const created = await request(app)
      .post('/api/workflows')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name: 'Patch Test',
        steps: [{ agent: 'weebo', prompt_template: 'hello', output_key: 'out' }],
      });
    const wfId = created.body.id;
    const res = await request(app)
      .patch('/api/workflows/' + wfId)
      .set('Authorization', 'Bearer ' + token)
      .send({ name: 'Updated Name', enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
    expect(res.body.enabled).toBe(false);
  });

  it('PATCH /api/workflows/:id returns 404 for non-existent workflow', async () => {
    const res = await request(app)
      .patch('/api/workflows/999999')
      .set('Authorization', 'Bearer ' + token)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/workflows/:id deletes the workflow', async () => {
    const created = await request(app)
      .post('/api/workflows')
      .set('Authorization', 'Bearer ' + token)
      .send({
        name: 'Delete Test',
        steps: [{ agent: 'weebo', prompt_template: 'hello', output_key: 'out' }],
      });
    const wfId = created.body.id;
    const del = await request(app)
      .delete('/api/workflows/' + wfId)
      .set('Authorization', 'Bearer ' + token);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const get = await request(app)
      .get('/api/workflows/' + wfId)
      .set('Authorization', 'Bearer ' + token);
    expect(get.status).toBe(404);
  });

  it('DELETE /api/workflows/:id returns 404 for non-existent workflow', async () => {
    const res = await request(app)
      .delete('/api/workflows/999999')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(404);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 96.5  API: run a workflow
// ──────────────────────────────────────────────────────────────────────────────

describe('96.5 API: workflow run', () => {
  let app2: ReturnType<typeof createApp>;
  let userId2: string;
  let token2: string;
  let workflowId: number;

  beforeAll(async () => {
    app2 = createApp();
    const user = createTestUser('phase96-run-' + Date.now() + '@example.com');
    userId2 = user.id;
    token2 = generateTestToken(userId2);
    const res = await request(app2)
      .post('/api/workflows')
      .set('Authorization', 'Bearer ' + token2)
      .send({
        name: 'Run Test Workflow',
        steps: [
          { agent: 'weebo', prompt_template: 'Summarize: {{user_input}}', output_key: 'summary' },
          { agent: 'jarvis', prompt_template: 'Expand: {{summary}}', output_key: 'detail' },
        ],
      });
    workflowId = res.body.id;
  });

  afterAll(() => {
    db.prepare('DELETE FROM user_workflows WHERE user_id = ?').run(userId2);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId2);
  });

  it('POST /api/workflows/:id/run returns 401 without auth', async () => {
    const res = await request(app2).post('/api/workflows/' + workflowId + '/run');
    expect(res.status).toBe(401);
  });

  it('POST /api/workflows/:id/run returns 400 for non-existent workflow', async () => {
    const res = await request(app2)
      .post('/api/workflows/999999/run')
      .set('Authorization', 'Bearer ' + token2)
      .send({ input: 'test' });
    expect(res.status).toBe(400);
  });

  it('POST /api/workflows/:id/run returns runId and running status', async () => {
    const res = await request(app2)
      .post('/api/workflows/' + workflowId + '/run')
      .set('Authorization', 'Bearer ' + token2)
      .send({ input: 'phase 96 test input' });
    expect(res.status).toBe(200);
    expect(res.body.runId).toBeTypeOf('number');
    expect(res.body.status).toBe('running');
  });

  it('async run completes in TEST_MODE and has context with both steps', async () => {
    const triggerRes = await request(app2)
      .post('/api/workflows/' + workflowId + '/run')
      .set('Authorization', 'Bearer ' + token2)
      .send({ input: 'phase 96 test input' });
    const runId = triggerRes.body.runId;

    // In TEST_MODE stubs are synchronous, so give the event loop a tick to finish
    await new Promise(r => setTimeout(r, 100));

    const res = await request(app2)
      .get('/api/workflows/runs/' + runId)
      .set('Authorization', 'Bearer ' + token2);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.context).toBeDefined();
    expect(Object.keys(res.body.context)).toContain('summary');
    expect(Object.keys(res.body.context)).toContain('detail');
  });

  it('completed run has per-step output in steps array', async () => {
    const triggerRes = await request(app2)
      .post('/api/workflows/' + workflowId + '/run')
      .set('Authorization', 'Bearer ' + token2)
      .send({ input: 'step tracking test' });
    const runId = triggerRes.body.runId;
    await new Promise(r => setTimeout(r, 100));

    const res = await request(app2)
      .get('/api/workflows/runs/' + runId)
      .set('Authorization', 'Bearer ' + token2);
    expect(res.body.steps).toBeDefined();
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[0].status).toBe('done');
    expect(res.body.steps[0].agent).toBe('weebo');
    expect(res.body.steps[1].status).toBe('done');
    expect(res.body.steps[1].agent).toBe('jarvis');
  });

  it('run context contains stub output for weebo step', async () => {
    const triggerRes = await request(app2)
      .post('/api/workflows/' + workflowId + '/run')
      .set('Authorization', 'Bearer ' + token2)
      .send({ input: 'my test topic' });
    const runId = triggerRes.body.runId;
    await new Promise(r => setTimeout(r, 100));

    const res = await request(app2)
      .get('/api/workflows/runs/' + runId)
      .set('Authorization', 'Bearer ' + token2);
    expect(res.body.context.summary).toContain('WEEBO TEST RESPONSE');
  });

  it('run context contains stub output for jarvis step', async () => {
    const triggerRes = await request(app2)
      .post('/api/workflows/' + workflowId + '/run')
      .set('Authorization', 'Bearer ' + token2)
      .send({ input: 'my test topic' });
    const runId = triggerRes.body.runId;
    await new Promise(r => setTimeout(r, 100));

    const res = await request(app2)
      .get('/api/workflows/runs/' + runId)
      .set('Authorization', 'Bearer ' + token2);
    expect(res.body.context.detail).toContain('JARVIS TEST RESPONSE');
  });

  it('GET /api/workflows/:id/runs returns run history', async () => {
    // Give any in-flight runs a tick to finish
    await new Promise(r => setTimeout(r, 100));
    const res = await request(app2)
      .get('/api/workflows/' + workflowId + '/runs')
      .set('Authorization', 'Bearer ' + token2);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].status).toBe('completed');
  });

  it('GET /api/workflows/runs/:runId returns single run', async () => {
    const runRes = await request(app2)
      .post('/api/workflows/' + workflowId + '/run')
      .set('Authorization', 'Bearer ' + token2)
      .send({ input: 'single run test' });
    const runId = runRes.body.runId;
    await new Promise(r => setTimeout(r, 100));

    const res = await request(app2)
      .get('/api/workflows/runs/' + runId)
      .set('Authorization', 'Bearer ' + token2);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(runId);
  });

  it('GET /api/workflows/runs/:runId returns 404 for non-existent run', async () => {
    const res = await request(app2)
      .get('/api/workflows/runs/999999')
      .set('Authorization', 'Bearer ' + token2);
    expect(res.status).toBe(404);
  });

  it('disabled workflow returns 400 when run attempted', async () => {
    await request(app2)
      .patch('/api/workflows/' + workflowId)
      .set('Authorization', 'Bearer ' + token2)
      .send({ enabled: false });
    const res = await request(app2)
      .post('/api/workflows/' + workflowId + '/run')
      .set('Authorization', 'Bearer ' + token2)
      .send({ input: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/disabled/i);
    await request(app2)
      .patch('/api/workflows/' + workflowId)
      .set('Authorization', 'Bearer ' + token2)
      .send({ enabled: true });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 96.6  seedWorkflowTemplates: functional tests
// ──────────────────────────────────────────────────────────────────────────────

describe('96.6 seedWorkflowTemplates', () => {
  let seedUserId: string;

  beforeAll(() => {
    const user = createTestUser('phase96-seed-' + Date.now() + '@example.com');
    seedUserId = user.id;
  });

  afterAll(() => {
    db.prepare('DELETE FROM user_workflows WHERE user_id = ?').run(seedUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(seedUserId);
  });

  it('seeds 3 template workflows for a new user', () => {
    seedWorkflowTemplates(seedUserId);
    const workflows = getUserWorkflowList(seedUserId);
    expect(workflows.length).toBe(3);
  });

  it('seeded templates include Daily Briefing', () => {
    const workflows = getUserWorkflowList(seedUserId);
    const names = workflows.map(w => w.name);
    expect(names).toContain('Daily Briefing');
  });

  it('seeded templates include Task Decomposer', () => {
    const workflows = getUserWorkflowList(seedUserId);
    const names = workflows.map(w => w.name);
    expect(names).toContain('Task Decomposer');
  });

  it('seeded templates include Research & Summarize', () => {
    const workflows = getUserWorkflowList(seedUserId);
    const names = workflows.map(w => w.name);
    expect(names).toContain('Research & Summarize');
  });

  it('does not seed again if workflows already exist', () => {
    seedWorkflowTemplates(seedUserId);
    const workflows = getUserWorkflowList(seedUserId);
    expect(workflows.length).toBe(3);
  });

  it('each seeded template has at least 2 steps', () => {
    const workflows = getUserWorkflowList(seedUserId);
    for (const wf of workflows) {
      expect(wf.steps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('seeded templates are enabled by default', () => {
    const workflows = getUserWorkflowList(seedUserId);
    for (const wf of workflows) {
      expect(wf.enabled).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 96.7  Frontend: WorkflowsPage + DashboardApp integration
// ──────────────────────────────────────────────────────────────────────────────

describe('96.7 WorkflowsPage frontend integration', () => {
  it('WorkflowsPage.tsx exists', () => {
    expect(fileExists('src/dashboard/pages/WorkflowsPage.tsx')).toBe(true);
  });

  it('WorkflowsPage exports WorkflowsPage component', () => {
    const src = readFileSync(path.join(ROOT, 'src/dashboard/pages/WorkflowsPage.tsx'), 'utf-8');
    expect(src).toContain('export function WorkflowsPage');
  });

  it('WorkflowsPage uses /workflows endpoint', () => {
    const src = readFileSync(path.join(ROOT, 'src/dashboard/pages/WorkflowsPage.tsx'), 'utf-8');
    expect(src).toContain('/workflows');
  });

  it('WorkflowsPage supports running a workflow', () => {
    const src = readFileSync(path.join(ROOT, 'src/dashboard/pages/WorkflowsPage.tsx'), 'utf-8');
    expect(src).toContain('/run');
  });

  it('DashboardApp has WorkflowsPage lazy import', () => {
    const src = readFileSync(path.join(ROOT, 'src/dashboard/DashboardApp.tsx'), 'utf-8');
    expect(src).toContain('WorkflowsPage');
  });

  it('DashboardApp PageType includes workflows', () => {
    const src = readFileSync(path.join(ROOT, 'src/dashboard/DashboardApp.tsx'), 'utf-8');
    expect(src).toContain("'workflows'");
  });

  it('DashboardApp has Workflows menu item', () => {
    const src = readFileSync(path.join(ROOT, 'src/dashboard/DashboardApp.tsx'), 'utf-8');
    expect(src).toContain('Workflows');
  });

  it('DashboardApp renders WorkflowsPage for workflows case', () => {
    const src = readFileSync(path.join(ROOT, 'src/dashboard/DashboardApp.tsx'), 'utf-8');
    expect(src).toContain("case 'workflows'");
    expect(src).toContain('<WorkflowsPage />');
  });

  it('DashboardApp imports Sparkles from lucide-react', () => {
    const src = readFileSync(path.join(ROOT, 'src/dashboard/DashboardApp.tsx'), 'utf-8');
    expect(src).toContain('Sparkles');
  });
});
