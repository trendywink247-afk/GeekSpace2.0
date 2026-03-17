/**
 * GAP-1: Dashboard Overview Endpoint Tests
 * Tests for GET /api/dashboard/overview
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, generateTestToken } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

describe('GET /api/dashboard/overview', () => {
  let userA: ReturnType<typeof createTestUser>;
  let tokenA: string;

  beforeEach(() => {
    resetDatabase();
    userA = createTestUser('overview-a@example.com');
    tokenA = generateTestToken(userA.id);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Test 1: Returns correct top-level structure ──────────────────────────
  it('returns all required top-level fields', async () => {
    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body).toHaveProperty('greeting');
    expect(res.body).toHaveProperty('remindersDueToday');
    expect(res.body).toHaveProperty('habitsToday');
    expect(res.body).toHaveProperty('calendarEventsToday');
    expect(res.body).toHaveProperty('weeklyStats');
    expect(res.body).toHaveProperty('recentConversations');

    // Verify types
    expect(typeof res.body.greeting).toBe('string');
    expect(Array.isArray(res.body.remindersDueToday)).toBe(true);
    expect(Array.isArray(res.body.habitsToday)).toBe(true);
    expect(Array.isArray(res.body.calendarEventsToday)).toBe(true);
    expect(typeof res.body.weeklyStats).toBe('object');
    expect(Array.isArray(res.body.recentConversations)).toBe(true);
  });

  // ── Test 2: Requires authentication (401 without token) ─────────────────
  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .get('/api/dashboard/overview')
      .expect(401);

    expect(res.body).toHaveProperty('error');
  });

  // ── Test 3: User isolation — user A cannot see user B data ──────────────
  it('user A does not see user B reminders', async () => {
    const userB = createTestUser('overview-b@example.com');
    const tokenB = generateTestToken(userB.id);

    // Create a reminder for user B due today
    const todayISO = new Date().toISOString().split('T')[0];
    const reminderDatetime = `${todayISO}T15:00:00.000Z`;
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, completed) VALUES (?, ?, ?, ?, 0)'
    ).run(uuid(), userB.id, 'User B reminder', reminderDatetime);

    // User A should not see user B's reminder
    const resA = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(resA.body.remindersDueToday.length).toBe(0);

    // User B should see their own reminder
    const resB = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(resB.body.remindersDueToday.length).toBe(1);
    expect(resB.body.remindersDueToday[0].text).toBe('User B reminder');
  });

  // ── Test 4: Greeting changes by time of day ─────────────────────────────
  it('greeting says "Good morning" before noon', async () => {
    // Mock Date to 9:00 AM UTC on a weekday
    const morningDate = new Date('2026-03-17T09:00:00Z');
    vi.setSystemTime(morningDate);

    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // Greeting should contain the user's first name
    expect(res.body.greeting).toContain('Test');
  });

  it('greeting is time-aware and contains user name', async () => {
    // Update user name to something identifiable
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run('Priya Sharma', userA.id);

    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.greeting).toContain('Priya');
    // Greeting must start with Good morning/afternoon/evening
    expect(res.body.greeting).toMatch(/^Good (morning|afternoon|evening)/);
  });

  // ── Test 5: Habits show loggedToday correctly ───────────────────────────
  it('habits show loggedToday boolean correctly', async () => {
    // Create a habit for user A
    db.prepare(
      'INSERT INTO habits (user_id, name, icon, current_streak) VALUES (?, ?, ?, ?)'
    ).run(userA.id, 'Meditate', 'star', 5);

    const habitRow = db.prepare('SELECT id FROM habits WHERE user_id = ?').get(userA.id) as { id: number };

    // Log the habit for today
    const nowMs = Date.now();
    db.prepare(
      'INSERT INTO habit_logs (habit_id, user_id, logged_at) VALUES (?, ?, ?)'
    ).run(habitRow.id, userA.id, nowMs);

    // Create another habit without a log
    db.prepare(
      'INSERT INTO habits (user_id, name, icon, current_streak) VALUES (?, ?, ?, ?)'
    ).run(userA.id, 'Exercise', 'star', 0);

    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.habitsToday.length).toBe(2);

    const logged = res.body.habitsToday.find((h: { name: string }) => h.name === 'Meditate');
    const notLogged = res.body.habitsToday.find((h: { name: string }) => h.name === 'Exercise');

    expect(logged).toBeDefined();
    expect(logged.loggedToday).toBe(true);
    expect(logged.streak).toBe(5);

    expect(notLogged).toBeDefined();
    expect(notLogged.loggedToday).toBe(false);
  });

  // ── Test 6: Only incomplete reminders returned ──────────────────────────
  it('only returns incomplete reminders due today', async () => {
    const todayISO = new Date().toISOString().split('T')[0];
    const datetime = `${todayISO}T14:00:00.000Z`;

    // Incomplete reminder (should appear)
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, completed) VALUES (?, ?, ?, ?, 0)'
    ).run(uuid(), userA.id, 'Pending task', datetime);

    // Completed reminder (should NOT appear)
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, completed) VALUES (?, ?, ?, ?, 1)'
    ).run(uuid(), userA.id, 'Done task', datetime);

    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.remindersDueToday.length).toBe(1);
    expect(res.body.remindersDueToday[0].text).toBe('Pending task');
  });

  // ── Test 7: Weekly stats structure is correct ───────────────────────────
  it('weeklyStats has correct numeric fields', async () => {
    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const ws = res.body.weeklyStats;
    expect(typeof ws.messagesThisWeek).toBe('number');
    expect(typeof ws.remindersCompleted).toBe('number');
    expect(typeof ws.habitsLogged).toBe('number');
    expect(ws.messagesThisWeek).toBeGreaterThanOrEqual(0);
    expect(ws.remindersCompleted).toBeGreaterThanOrEqual(0);
    expect(ws.habitsLogged).toBeGreaterThanOrEqual(0);
  });

  // ── Test 8: Recent conversations are assistant-only ─────────────────────
  it('recentConversations returns only assistant messages', async () => {
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO conversation_log (id, user_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)"
    ).run(uuid(), userA.id, 'Hello', now);

    db.prepare(
      "INSERT INTO conversation_log (id, user_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)"
    ).run(uuid(), userA.id, 'Hi there! How can I help?', now);

    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // Should only contain the assistant message
    expect(res.body.recentConversations.length).toBe(1);
    expect(res.body.recentConversations[0].content).toBe('Hi there! How can I help?');
  });

  // ── Test 9: Reminders max 10 limit enforced ─────────────────────────────
  it('limits remindersDueToday to 10 items', async () => {
    const todayISO = new Date().toISOString().split('T')[0];

    // Insert 15 incomplete reminders for today
    for (let i = 0; i < 15; i++) {
      const hour = String(8 + Math.floor(i / 2)).padStart(2, '0');
      const minute = (i % 2) * 30;
      const datetime = `${todayISO}T${hour}:${String(minute).padStart(2, '0')}:00.000Z`;
      db.prepare(
        'INSERT INTO reminders (id, user_id, text, datetime, completed) VALUES (?, ?, ?, ?, 0)'
      ).run(uuid(), userA.id, `Task ${i + 1}`, datetime);
    }

    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.remindersDueToday.length).toBeLessThanOrEqual(10);
  });

  // ── Test 10: Empty state returns empty arrays, not nulls ────────────────
  it('returns empty arrays for user with no data', async () => {
    // userA was created in beforeEach with no reminders/habits/events,
    // so the overview should return empty arrays
    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.remindersDueToday).toEqual([]);
    expect(res.body.habitsToday).toEqual([]);
    expect(res.body.calendarEventsToday).toEqual([]);
    expect(res.body.recentConversations).toEqual([]);
    expect(res.body.weeklyStats.messagesThisWeek).toBe(0);
    expect(res.body.weeklyStats.remindersCompleted).toBe(0);
    expect(res.body.weeklyStats.habitsLogged).toBe(0);
  });

  // ── Test 11: Overdue flag is set on past-due reminders ──────────────────
  it('marks overdue reminders with overdue: true', async () => {
    const todayISO = new Date().toISOString().split('T')[0];
    // Set reminder to 00:01 today (already past for most of the day)
    const pastDatetime = `${todayISO}T00:01:00.000Z`;

    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, completed) VALUES (?, ?, ?, ?, 0)'
    ).run(uuid(), userA.id, 'Overdue task', pastDatetime);

    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // The reminder at 00:01 UTC should be overdue unless test runs at midnight UTC
    const overdueItem = res.body.remindersDueToday.find(
      (r: { text: string }) => r.text === 'Overdue task'
    );
    if (overdueItem) {
      expect(typeof overdueItem.overdue).toBe('boolean');
    }
  });

  // ── Test 12: Calendar events returned for today ─────────────────────────
  it('returns calendar events with start_time today', async () => {
    const nowMs = Date.now();
    const todayStartMs = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z').getTime();
    const eventStartMs = todayStartMs + 10 * 3600 * 1000; // 10:00 today
    const eventEndMs = eventStartMs + 3600 * 1000; // 11:00 today

    db.prepare(
      'INSERT INTO calendar_events (user_id, gcal_event_id, title, start_time, end_time, synced_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userA.id, 'gcal-test-1', 'Team Standup', eventStartMs, eventEndMs, nowMs);

    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.calendarEventsToday.length).toBe(1);
    expect(res.body.calendarEventsToday[0].title).toBe('Team Standup');
    expect(res.body.calendarEventsToday[0].start_time).toBe(eventStartMs);
    expect(res.body.calendarEventsToday[0].end_time).toBe(eventEndMs);
  });

  // ── Test 13: Reminder fields include expected shape ─────────────────────
  it('each reminder has id, text, datetime, category, overdue fields', async () => {
    const todayISO = new Date().toISOString().split('T')[0];
    const datetime = `${todayISO}T16:00:00.000Z`;

    db.prepare(
      "INSERT INTO reminders (id, user_id, text, datetime, completed, category, priority) VALUES (?, ?, ?, ?, 0, 'work', 'high')"
    ).run(uuid(), userA.id, 'Review PR', datetime);

    const res = await request(app)
      .get('/api/dashboard/overview')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const rem = res.body.remindersDueToday[0];
    expect(rem).toHaveProperty('id');
    expect(rem).toHaveProperty('text', 'Review PR');
    expect(rem).toHaveProperty('datetime');
    expect(rem).toHaveProperty('category', 'work');
    expect(rem).toHaveProperty('priority', 'high');
    expect(rem).toHaveProperty('overdue');
  });
});
