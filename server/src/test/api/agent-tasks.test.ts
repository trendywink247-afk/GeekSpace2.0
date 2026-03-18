// ============================================================
// Agent Task Queue Tests
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

let token: string;
const agent = request(app);

beforeAll(async () => {
  const res = await agent.post('/api/auth/demo');
  token = res.body.token;
});

describe('Agent Tasks API', () => {
  let taskId: string;

  it('GET /api/agent-tasks returns empty list initially', async () => {
    const res = await agent
      .get('/api/agent-tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/agent-tasks creates a task', async () => {
    const res = await agent
      .post('/api/agent-tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ agent_id: 'weebo', title: 'Test task', description: 'Do something', priority: 7 });
    expect(res.status).toBe(201);
    expect(res.body.agent_id).toBe('weebo');
    expect(res.body.title).toBe('Test task');
    expect(res.body.status).toBe('pending');
    expect(res.body.priority).toBe(7);
    taskId = res.body.id;
  });

  it('POST /api/agent-tasks validates agent_id', async () => {
    const res = await agent
      .post('/api/agent-tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ agent_id: 'invalid', title: 'Bad task' });
    expect(res.status).toBe(400);
  });

  it('POST /api/agent-tasks requires title', async () => {
    const res = await agent
      .post('/api/agent-tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ agent_id: 'weebo' });
    expect(res.status).toBe(400);
  });

  it('GET /api/agent-tasks returns the created task', async () => {
    const res = await agent
      .get('/api/agent-tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const task = res.body.find((t: { id: string }) => t.id === taskId);
    expect(task).toBeDefined();
  });

  it('GET /api/agent-tasks?agent_id=weebo filters by agent', async () => {
    const res = await agent
      .get('/api/agent-tasks?agent_id=weebo')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    for (const t of res.body) {
      expect(t.agent_id).toBe('weebo');
    }
  });

  it('PATCH /api/agent-tasks/:id starts a task', async () => {
    const res = await agent
      .patch(`/api/agent-tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'start' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PATCH /api/agent-tasks/:id completes a task', async () => {
    const res = await agent
      .patch(`/api/agent-tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'complete', result: 'Task done!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/agent-tasks/board returns kanban board', async () => {
    const res = await agent
      .get('/api/agent-tasks/board')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pending');
    expect(res.body).toHaveProperty('completed');
  });

  it('GET /api/agent-tasks/stats returns statistics', async () => {
    const res = await agent
      .get('/api/agent-tasks/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('completed');
    expect(res.body.completed).toBeGreaterThanOrEqual(1);
  });

  it('requires auth', async () => {
    const res = await agent.get('/api/agent-tasks');
    expect(res.status).toBe(401);
  });
});

describe('Agent Comms API', () => {
  it('GET /api/agent-comms returns empty list initially', async () => {
    const res = await agent
      .get('/api/agent-comms')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/agent-comms sends a message', async () => {
    const res = await agent
      .post('/api/agent-comms')
      .set('Authorization', `Bearer ${token}`)
      .send({ from_agent: 'weebo', to_agent: 'jarvis', message: 'Hey Jarvis, help me out!' });
    expect(res.status).toBe(201);
    expect(res.body.from_agent).toBe('weebo');
    expect(res.body.to_agent).toBe('jarvis');
    expect(res.body.message_type).toBe('info');
  });

  it('POST /api/agent-comms/delegate creates a delegation', async () => {
    const res = await agent
      .post('/api/agent-comms/delegate')
      .set('Authorization', `Bearer ${token}`)
      .send({ from_agent: 'edith', to_agent: 'weebo', task_description: 'Create a social media post' });
    expect(res.status).toBe(200);
    expect(res.body.message_type).toBe('delegation');
  });

  it('GET /api/agent-comms/recent returns recent messages', async () => {
    const res = await agent
      .get('/api/agent-comms/recent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/agent-comms/stats returns statistics', async () => {
    const res = await agent
      .get('/api/agent-comms/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(res.body.byType).toHaveProperty('info');
  });

  it('validates agent IDs', async () => {
    const res = await agent
      .post('/api/agent-comms')
      .set('Authorization', `Bearer ${token}`)
      .send({ from_agent: 'invalid', to_agent: 'jarvis', message: 'test' });
    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const res = await agent.get('/api/agent-comms');
    expect(res.status).toBe(401);
  });
});

describe('Recommendations API', () => {
  it('GET /api/recommendations returns recommendations', async () => {
    const res = await agent
      .get('/api/recommendations')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should have some recommendations since demo user hasn't used most features
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('feature');
      expect(res.body[0]).toHaveProperty('reason');
      expect(res.body[0]).toHaveProperty('cta');
      expect(res.body[0]).toHaveProperty('score');
    }
  });

  it('POST /api/recommendations/dismiss dismisses a feature', async () => {
    const res = await agent
      .post('/api/recommendations/dismiss')
      .set('Authorization', `Bearer ${token}`)
      .send({ feature: 'voice-chat' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('requires auth', async () => {
    const res = await agent.get('/api/recommendations');
    expect(res.status).toBe(401);
  });
});

describe('Agent State API', () => {
  it('GET /api/agent-state/agents returns autocomplete list', async () => {
    const res = await agent
      .get('/api/agent-state/agents')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.agents).toBeDefined();
    expect(res.body.agents.length).toBe(9);
    expect(res.body.defaultAgent).toBeDefined();
    // Core agents should be listed
    const names = res.body.agents.map((a: { name: string }) => a.name);
    expect(names).toContain('Weebo');
    expect(names).toContain('Edith');
    expect(names).toContain('Jarvis');
  });

  it('GET /api/agent-state/states returns agent states', async () => {
    const res = await agent
      .get('/api/agent-state/states')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
    for (const state of res.body) {
      expect(state).toHaveProperty('agentId');
      expect(state).toHaveProperty('agentName');
      expect(state).toHaveProperty('state');
    }
  });

  it('POST /api/agent-state/parse-mentions parses @mentions', async () => {
    const res = await agent
      .post('/api/agent-state/parse-mentions')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '@weebo help me with something' });
    expect(res.status).toBe(200);
    expect(res.body.mentionedAgents).toContain('weebo');
    expect(res.body.cleanMessage).toBe('help me with something');
  });

  it('POST /api/agent-state/parse-mentions handles no mentions', async () => {
    const res = await agent
      .post('/api/agent-state/parse-mentions')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'just a normal message' });
    expect(res.status).toBe(200);
    expect(res.body.mentionedAgents).toHaveLength(0);
  });

  it('POST /api/agent-state/parse-mentions handles multiple mentions', async () => {
    const res = await agent
      .post('/api/agent-state/parse-mentions')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '@weebo @edith what do you think?' });
    expect(res.status).toBe(200);
    expect(res.body.mentionedAgents).toContain('weebo');
    expect(res.body.mentionedAgents).toContain('edith');
  });

  it('GET /api/agent-state/info returns bus health', async () => {
    const res = await agent
      .get('/api/agent-state/info')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('connectedClients');
    expect(res.body).toHaveProperty('redisPubSub');
  });
});
