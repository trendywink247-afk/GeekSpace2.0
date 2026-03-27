import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { resetDatabase, createTestUser, makeAuthHeader } from '../../../test/setup.js';

const app = createApp();

describe('Reminders Module', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  it('GET /api/reminders — returns 200 with array when authenticated', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/reminders')
      .set('Authorization', makeAuthHeader(user.id));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/reminders — creates a reminder and returns 201', async () => {
    const user = createTestUser();
    const dueDate = new Date(Date.now() + 86400000).toISOString();

    const res = await request(app)
      .post('/api/reminders')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ text: 'Buy groceries', datetime: dueDate });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.text).toBe('Buy groceries');
  });

  it('GET /api/reminders — includes newly created reminder', async () => {
    const user = createTestUser();
    const dueDate = new Date(Date.now() + 86400000).toISOString();

    await request(app)
      .post('/api/reminders')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ text: 'Read a book', datetime: dueDate });

    const res = await request(app)
      .get('/api/reminders')
      .set('Authorization', makeAuthHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].text).toBe('Read a book');
  });

  it('DELETE /api/reminders/:id — deletes a reminder and returns 200', async () => {
    const user = createTestUser();
    const dueDate = new Date(Date.now() + 86400000).toISOString();

    const createRes = await request(app)
      .post('/api/reminders')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ text: 'Temporary reminder', datetime: dueDate });

    const reminderId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/reminders/${reminderId}`)
      .set('Authorization', makeAuthHeader(user.id));

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({ success: true });

    // Verify it's gone
    const listRes = await request(app)
      .get('/api/reminders')
      .set('Authorization', makeAuthHeader(user.id));

    expect(listRes.body.length).toBe(0);
  });

  it('GET /api/reminders — returns 401 without auth', async () => {
    const res = await request(app).get('/api/reminders');

    expect(res.status).toBe(401);
  });
});
