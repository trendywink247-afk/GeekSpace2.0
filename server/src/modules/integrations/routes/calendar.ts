// ============================================================
// Google Calendar Routes -- Phase 95
// OAuth flow + sync management for Google Calendar integration
// ============================================================

import { Router } from "express";
import { db } from "../../../db/index.js";
import { config } from "../../../config.js";
import { logger } from "../../../logger.js";
import { requireAuth, type AuthRequest } from "../../../middleware/auth.js";
import { getOAuth2Client, syncUserCalendar, getUpcomingEvents } from "../services/calendar-sync.js";

const router = Router();

const CALENDAR_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

// GET /api/calendar/status -- check connection status
router.get("/status", requireAuth, (req, res) => {
  const userId = (req as AuthRequest).userId!;

  if (!config.googleClientId || !config.googleClientSecret) {
    return res.json({ available: false, connected: false, message: "Google Calendar not configured" });
  }

  const row = db.prepare("SELECT google_calendar_token FROM users WHERE id = ?").get(userId) as
    | { google_calendar_token: string | null }
    | undefined;

  logger.info({ userId, hasRow: !!row, hasToken: !!row?.google_calendar_token, tokenLen: row?.google_calendar_token?.length ?? 0 }, "Calendar status check");

  if (!row?.google_calendar_token) {
    return res.json({ available: true, connected: false, email: null, lastSync: null });
  }

  try {
    const token = JSON.parse(row.google_calendar_token) as { email?: string };
    let lastSync: number | null = null;
    try {
      const lastSyncRow = db.prepare("SELECT value FROM user_settings WHERE user_id = ? AND key = 'calendar_last_sync'").get(userId) as { value: string } | undefined;
      lastSync = lastSyncRow ? parseInt(lastSyncRow.value, 10) : null;
    } catch { /* user_settings table may not exist yet — non-fatal */ }
    return res.json({ available: true, connected: true, email: token.email ?? null, lastSync });
  } catch (err) {
    logger.error({ userId, err: (err as Error).message }, "Calendar status: token parse failed");
    return res.json({ available: true, connected: false, email: null, lastSync: null });
  }
});

// GET /api/calendar/auth -- redirect to Google OAuth consent
router.get("/auth", requireAuth, (req, res) => {
  const userId = (req as AuthRequest).userId!;

  if (!config.googleClientId || !config.googleClientSecret) {
    return res.status(503).json({ error: "Google Calendar not configured" });
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.status(503).json({ error: "OAuth client unavailable" });
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: CALENDAR_SCOPES,
    state: userId,
    prompt: "consent",
  });

  logger.info({ userId }, "Calendar OAuth redirect initiated");
  if (req.headers.accept?.includes('application/json')) {
    res.json({ url: authUrl });
  } else {
    res.redirect(authUrl);
  }
});

// GET /api/calendar/callback -- handle OAuth callback
router.get("/callback", async (req, res) => {
  const { code, state: userId, error } = req.query as { code?: string; state?: string; error?: string };

  if (error || !code || !userId) {
    logger.warn({ error, userId }, "Calendar OAuth callback error");
    return res.redirect(config.publicUrl + "/dashboard/calendar?error=" + encodeURIComponent(error ?? "OAuth cancelled"));
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.redirect(config.publicUrl + "/dashboard/calendar?error=" + encodeURIComponent("OAuth client unavailable"));
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get email from existing user record (no need to call userinfo API)
    const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string } | undefined;

    const tokenData = {
      access_token: tokens.access_token ?? "",
      refresh_token: tokens.refresh_token ?? "",
      expiry_date: tokens.expiry_date ?? 0,
      email: user?.email ?? "",
    };

    db.prepare("UPDATE users SET google_calendar_token = ? WHERE id = ?").run(
      JSON.stringify(tokenData),
      userId
    );

    logger.info({ userId, email: tokenData.email }, "Calendar OAuth token stored");

    // Trigger initial sync in background
    syncUserCalendar(userId).catch((err) => logger.warn({ err, userId }, "Initial calendar sync failed"));

    return res.redirect(config.publicUrl + "/dashboard/calendar?connected=1");
  } catch (err) {
    logger.error({ err, userId }, "Calendar OAuth token exchange failed");
    return res.redirect(config.publicUrl + "/dashboard/calendar?error=" + encodeURIComponent("Token exchange failed"));
  }
});

// POST /api/calendar/sync -- trigger manual sync
router.post("/sync", requireAuth, async (req, res) => {
  const userId = (req as AuthRequest).userId!;

  const row = db.prepare("SELECT google_calendar_token FROM users WHERE id = ?").get(userId) as
    | { google_calendar_token: string | null }
    | undefined;

  if (!row?.google_calendar_token) {
    return res.status(400).json({ error: "Calendar not connected" });
  }

  try {
    const result = await syncUserCalendar(userId);
    return res.json({ ok: true, synced: result.synced, errors: result.errors });
  } catch (err) {
    logger.error({ err, userId }, "Manual calendar sync failed");
    return res.status(500).json({ error: "Sync failed" });
  }
});

// POST /api/calendar/disconnect -- revoke token + delete events
router.post("/disconnect", requireAuth, (req, res) => {
  const userId = (req as AuthRequest).userId!;

  db.prepare("UPDATE users SET google_calendar_token = NULL WHERE id = ?").run(userId);
  db.prepare("DELETE FROM calendar_events WHERE user_id = ?").run(userId);

  // Clean up last_sync setting
  try {
    db.prepare("DELETE FROM user_settings WHERE user_id = ? AND key = 'calendar_last_sync'").run(userId);
  } catch { /* user_settings might not exist */ }

  logger.info({ userId }, "Calendar disconnected");
  return res.json({ ok: true });
});

// GET /api/calendar/events -- list imported events
router.get("/events", requireAuth, (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const days = Math.min(parseInt(String(req.query.days ?? "7"), 10) || 7, 30);

  const events = getUpcomingEvents(userId, days);
  return res.json({ events });
});

export { router as calendarRouter };
