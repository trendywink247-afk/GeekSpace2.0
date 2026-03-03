// ============================================================
// Google Calendar Sync Service -- Phase 95
// ============================================================

import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { v4 as uuid } from "uuid";
import { db } from "../db/index.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

interface CalendarToken {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email: string;
}

interface CalendarEventRow {
  id: number;
  user_id: string;
  gcal_event_id: string;
  title: string;
  start_time: number;
  end_time: number | null;
  reminder_id: string | null;
  synced_at: number;
}

export function getOAuth2Client(tokenJson?: string | null) {
  if (!config.googleClientId || !config.googleClientSecret) return null;
  const oauth2Client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.apiUrl + "/calendar/callback"
  );
  if (tokenJson) {
    try {
      const token = JSON.parse(tokenJson) as CalendarToken;
      oauth2Client.setCredentials({
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expiry_date: token.expiry_date,
      });
    } catch { return null; }
  }
  return oauth2Client;
}

export function getUserCalendarToken(userId: string): CalendarToken | null {
  const row = db.prepare("SELECT google_calendar_token FROM users WHERE id = ?").get(userId) as
    | { google_calendar_token: string | null }
    | undefined;
  if (!row?.google_calendar_token) return null;
  try { return JSON.parse(row.google_calendar_token) as CalendarToken; }
  catch { return null; }
}

function upsertEventReminder(
  userId: string,
  title: string,
  startTimeMs: number,
  description: string | null | undefined
): string {
  const reminderId = uuid();
  const datetime = new Date(startTimeMs).toISOString();
  const text = description ? title + "\n" + description : title;
  db.prepare(
    "INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by) VALUES (?, ?, ?, ?, 'push', 'event', 'calendar')"
  ).run(reminderId, userId, text, datetime);
  return reminderId;
}

export async function syncUserCalendar(userId: string): Promise<{ synced: number; errors: string[] }> {
  const tokenRow = db.prepare("SELECT google_calendar_token FROM users WHERE id = ?").get(userId) as
    | { google_calendar_token: string | null }
    | undefined;
  if (!tokenRow?.google_calendar_token) return { synced: 0, errors: ["user not connected"] };

  const oauth2Client = getOAuth2Client(tokenRow.google_calendar_token);
  if (!oauth2Client) return { synced: 0, errors: ["OAuth client unavailable"] };

  try {
    const tokenInfo = await oauth2Client.getAccessToken();
    if (tokenInfo.token) {
      const creds = oauth2Client.credentials;
      const tokenObj = JSON.parse(tokenRow.google_calendar_token) as CalendarToken;
      const updated: CalendarToken = { ...tokenObj, access_token: tokenInfo.token, expiry_date: creds.expiry_date ?? tokenObj.expiry_date };
      db.prepare("UPDATE users SET google_calendar_token = ? WHERE id = ?").run(JSON.stringify(updated), userId);
    }
  } catch { /* non-fatal */ }

  const calendarApi = google.calendar({ version: "v3", auth: oauth2Client });
  const now = new Date();
  const minTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const maxTime = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  let events: calendar_v3.Schema$Event[] = [];
  const errors: string[] = [];

  try {
    const res = await calendarApi.events.list({
      calendarId: "primary",
      timeMin: minTime,
      timeMax: maxTime,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });
    events = res.data.items ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    logger.warn({ err, userId }, "Failed to fetch Google Calendar events");
    return { synced: 0, errors: [msg] };
  }

  let synced = 0;
  for (const event of events) {
    if (!event.id || !event.summary) continue;
    const startStr = event.start?.dateTime ?? event.start?.date;
    if (!startStr) continue;
    const startTimeMs = new Date(startStr).getTime();
    const endStr = event.end?.dateTime ?? event.end?.date;
    const endTimeMs = endStr ? new Date(endStr).getTime() : null;

    try {
      const existing = db.prepare("SELECT id, reminder_id FROM calendar_events WHERE user_id = ? AND gcal_event_id = ?").get(userId, event.id) as CalendarEventRow | undefined;
      if (existing) {
        db.prepare("UPDATE calendar_events SET title = ?, start_time = ?, end_time = ?, synced_at = ? WHERE user_id = ? AND gcal_event_id = ?").run(event.summary, startTimeMs, endTimeMs, Date.now(), userId, event.id);
      } else {
        let reminderId: string | null = null;
        if (startTimeMs > now.getTime() - 60 * 60 * 1000) {
          try { reminderId = upsertEventReminder(userId, event.summary, startTimeMs, event.description); }
          catch (reminderErr) { logger.warn({ reminderErr, userId }, "Failed to create reminder"); }
        }
        db.prepare("INSERT INTO calendar_events (user_id, gcal_event_id, title, start_time, end_time, reminder_id, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(userId, event.id, event.summary, startTimeMs, endTimeMs, reminderId, Date.now());
        synced++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push("event " + event.id + ": " + msg);
      logger.warn({ err, userId }, "Failed to upsert calendar event");
    }
  }

  logger.info({ userId, synced, errors: errors.length }, "Calendar sync complete");
  return { synced, errors };
}

export function getTodayEvents(userId: string): Array<{ title: string; start_time: number }> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
  try {
    return db.prepare("SELECT title, start_time FROM calendar_events WHERE user_id = ? AND start_time BETWEEN ? AND ? ORDER BY start_time ASC").all(userId, startOfDay, endOfDay) as Array<{ title: string; start_time: number }>;
  } catch { return []; }
}

export function getUpcomingEvents(userId: string, days = 7): Array<{ id: number; title: string; start_time: number; end_time: number | null }> {
  const now = Date.now();
  const maxTime = now + days * 24 * 60 * 60 * 1000;
  try {
    return db.prepare("SELECT id, title, start_time, end_time FROM calendar_events WHERE user_id = ? AND start_time BETWEEN ? AND ? ORDER BY start_time ASC").all(userId, now, maxTime) as Array<{ id: number; title: string; start_time: number; end_time: number | null }>;
  } catch { return []; }
}

let calendarSyncTimer: ReturnType<typeof setInterval> | null = null;

export function startCalendarSyncScheduler(): void {
  if (calendarSyncTimer) return;
  const syncAll = async () => {
    let users: Array<{ id: string }> = [];
    try { users = db.prepare("SELECT id FROM users WHERE google_calendar_token IS NOT NULL AND google_calendar_token != ''").all() as Array<{ id: string }>; }
    catch { return; }
    for (const user of users) {
      try { await syncUserCalendar(user.id); }
      catch (err) { logger.warn({ err, userId: user.id }, "Calendar sync failed for user"); }
    }
  };
  void syncAll();
  calendarSyncTimer = setInterval(() => void syncAll(), 30 * 60 * 1000);
  logger.info("Calendar sync scheduler started (every 30 minutes)");
}

export function _resetCalendarSyncTimer(): void {
  if (calendarSyncTimer) { clearInterval(calendarSyncTimer); calendarSyncTimer = null; }
}
