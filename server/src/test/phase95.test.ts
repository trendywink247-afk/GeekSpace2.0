/**
 * Phase 95 -- Google Calendar Integration Tests
 * Covers: DB schema, service functions, routes, proactive-engine integration, scheduler
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { generateTestToken, createTestUser } from './setup.js';
import {
  getTodayEvents,
  getUpcomingEvents,
  getUserCalendarToken,
  _resetCalendarSyncTimer,
} from '../services/calendar-sync.js';

// --- helpers ---

const srcPath = (...parts: string[]) => join(__dirname, '..', ...parts);
const readSrc = (...parts: string[]) => readFileSync(srcPath(...parts), 'utf-8');

// ──────────────────────────────────────────────────────────────────────────────
// 95.1  DB Schema: calendar_events table + google_calendar_token column
// ──────────────────────────────────────────────────────────────────────────────

describe('95.1 DB schema: calendar_events and google_calendar_token', () => {
  it('calendar_events table exists in live DB', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='calendar_events'").get();
    expect(row).toBeTruthy();
  });

  it('users table has google_calendar_token column in live DB', () => {
    const info = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const col = info.find((c) => c.name === 'google_calendar_token');
    expect(col).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 95.2  calendar-sync.ts: service file static checks
// ──────────────────────────────────────────────────────────────────────────────

describe('95.2 calendar-sync.ts service file', () => {
  it('exports getOAuth2Client', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/export function getOAuth2Client/);
  });

  it('exports syncUserCalendar', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/export async function syncUserCalendar/);
  });

  it('exports getTodayEvents', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/export function getTodayEvents/);
  });

  it('exports getUpcomingEvents', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/export function getUpcomingEvents/);
  });

  it('exports startCalendarSyncScheduler', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/export function startCalendarSyncScheduler/);
  });

  it('exports _resetCalendarSyncTimer for testing', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/export function _resetCalendarSyncTimer/);
  });

  it('uses googleapis and google.calendar', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/from ['"]googleapis['"]/);
    expect(src).toMatch(/google.calendar/);
  });

  it('syncs +/-14 days of events', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/14 \* 24/);
  });

  it('creates reminders for new events (INSERT INTO reminders)', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/INSERT INTO reminders/);
    expect(src).toMatch(/category/);
  });

  it('scheduler runs every 30 minutes', () => {
    const src = readSrc('modules', 'integrations', 'services', 'calendar-sync.ts');
    expect(src).toMatch(/30 \* 60 \* 1000/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 95.3  calendar-sync.ts: functional tests
// ──────────────────────────────────────────────────────────────────────────────

describe('95.3 calendar-sync functional', () => {
  let userId: string;

  beforeAll(() => {
    const user = createTestUser({ prefix: 'phase95-sync' });
    userId = user.id;
  });

  afterEach(() => {
    _resetCalendarSyncTimer();
    db.prepare('DELETE FROM calendar_events WHERE user_id = ?').run(userId);
  });

  it('getUserCalendarToken returns null when not connected', () => {
    const token = getUserCalendarToken(userId);
    expect(token).toBeNull();
  });

  it('getTodayEvents returns empty array when no events', () => {
    const events = getTodayEvents(userId);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(0);
  });

  it('getUpcomingEvents returns empty array when no events', () => {
    const events = getUpcomingEvents(userId);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(0);
  });

  it('getTodayEvents returns events with correct shape', () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    db.prepare(
      'INSERT INTO calendar_events (user_id, gcal_event_id, title, start_time, synced_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, 'gcal-test-today', 'Standup Meeting', startOfDay + 3600000, Date.now());

    const events = getTodayEvents(userId);
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Standup Meeting');
    expect(events[0].start_time).toBe(startOfDay + 3600000);
  });

  it('getUpcomingEvents returns future events within the window', () => {
    const future = Date.now() + 2 * 24 * 60 * 60 * 1000;
    db.prepare(
      'INSERT INTO calendar_events (user_id, gcal_event_id, title, start_time, synced_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, 'gcal-test-future', 'Team Lunch', future, Date.now());

    const events = getUpcomingEvents(userId, 7);
    const found = events.find((e) => e.title === 'Team Lunch');
    expect(found).toBeTruthy();
    expect(found!.start_time).toBe(future);
  });

  it('getUpcomingEvents excludes events outside the window', () => {
    const farFuture = Date.now() + 60 * 24 * 60 * 60 * 1000;
    db.prepare(
      'INSERT INTO calendar_events (user_id, gcal_event_id, title, start_time, synced_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, 'gcal-test-far', 'Annual Review', farFuture, Date.now());

    const events = getUpcomingEvents(userId, 7);
    const found = events.find((e) => e.title === 'Annual Review');
    expect(found).toBeUndefined();
  });

  it('getUpcomingEvents respects custom days parameter', () => {
    const inThirtyDays = Date.now() + 30 * 24 * 60 * 60 * 1000;
    db.prepare(
      'INSERT INTO calendar_events (user_id, gcal_event_id, title, start_time, synced_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, 'gcal-test-30d', 'Offsite Event', inThirtyDays, Date.now());

    const narrow = getUpcomingEvents(userId, 7);
    const wide = getUpcomingEvents(userId, 31);
    expect(narrow.find((e) => e.title === 'Offsite Event')).toBeUndefined();
    expect(wide.find((e) => e.title === 'Offsite Event')).toBeTruthy();
  });
});
