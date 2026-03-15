// ============================================================
// Gmail Sync Service -- Phase 100
// Fetches unread Gmail messages, triages them into AI Inbox.
// ============================================================

import { google } from 'googleapis';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { addInboxMessage } from './inbox.js';

export interface GmailTokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  email: string;
}

export interface GmailMessageRow {
  id: number;
  user_id: string;
  gmail_message_id: string;
  thread_id: string;
  subject: string;
  sender: string;
  snippet: string | null;
  inbox_id: number | null;
  synced_at: number;
}

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    `${config.apiUrl}/api/gmail/callback`,
  );
}

export interface GmailToken {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  email?: string;
}

export function saveGmailToken(userId: string, token: GmailToken): void {
  db.prepare('UPDATE users SET google_gmail_token = ? WHERE id = ?')
    .run(JSON.stringify(token), userId);
}

export function loadGmailToken(userId: string): GmailToken | null {
  const row = db.prepare('SELECT google_gmail_token FROM users WHERE id = ?')
    .get(userId) as { google_gmail_token: string | null } | undefined;
  if (!row?.google_gmail_token) return null;
  try {
    return JSON.parse(row.google_gmail_token) as GmailToken;
  } catch {
    return null;
  }
}

export function clearGmailToken(userId: string): void {
  db.prepare('UPDATE users SET google_gmail_token = NULL WHERE id = ?').run(userId);
}

export function getGmailStatus(userId: string): {
  connected: boolean;
  email: string | null;
  lastSync: string | null;
  unreadCount: number;
} {
  const token = loadGmailToken(userId);
  if (!token) {
    return { connected: false, email: null, lastSync: null, unreadCount: 0 };
  }
  const lastMsg = db.prepare(
    'SELECT synced_at FROM gmail_messages WHERE user_id = ? ORDER BY synced_at DESC LIMIT 1'
  ).get(userId) as { synced_at: number } | undefined;
  const unreadRow = db.prepare(
    "SELECT COUNT(*) as cnt FROM inbox_messages WHERE user_id = ? AND source = 'gmail' AND read = 0 AND archived = 0"
  ).get(userId) as { cnt: number };
  return {
    connected: true,
    email: token.email ?? null,
    lastSync: lastMsg ? new Date(lastMsg.synced_at).toISOString() : null,
    unreadCount: unreadRow.cnt,
  };
}

export function getGmailMessages(userId: string, limit = 50): GmailMessageRow[] {
  return db.prepare(
    'SELECT * FROM gmail_messages WHERE user_id = ? ORDER BY synced_at DESC LIMIT ?'
  ).all(userId, limit) as GmailMessageRow[];
}

export async function syncUserGmail(userId: string): Promise<number> {
  if (config.isTestMode) {
    return _testSyncUserGmail(userId);
  }

  if (!config.googleClientId || !config.googleClientSecret) {
    logger.warn({ userId }, 'Gmail sync skipped: credentials not configured');
    return 0;
  }

  const userRow = db.prepare('SELECT google_gmail_token FROM users WHERE id = ?')
    .get(userId) as { google_gmail_token: string | null } | undefined;

  if (!userRow?.google_gmail_token) return 0;

  let tokenData: GmailTokenData;
  try {
    tokenData = JSON.parse(userRow.google_gmail_token);
  } catch {
    logger.warn({ userId }, 'Gmail sync: invalid token JSON');
    return 0;
  }

  try {
    const auth = getOAuth2Client();
    auth.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: tokenData.expiry_date,
    });

    // Persist refreshed tokens automatically
    auth.on('tokens', (tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }) => {
      const updated = {
        ...tokenData,
        ...(tokens.access_token != null ? { access_token: tokens.access_token } : {}),
        ...(tokens.refresh_token != null ? { refresh_token: tokens.refresh_token } : {}),
        ...(tokens.expiry_date != null ? { expiry_date: tokens.expiry_date } : {}),
      };
      db.prepare('UPDATE users SET google_gmail_token = ? WHERE id = ?')
        .run(JSON.stringify(updated), userId);
    });

    const gmail = google.gmail({ version: 'v1', auth });

    // Fetch recent inbox messages (last 7 days)
    const cutoff = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: `in:inbox after:${cutoff}`,
      maxResults: 50,
    });

    const messages: Array<{ id?: string | null }> = listRes.data.messages ?? [];
    let imported = 0;

    for (const msg of messages) {
      if (!msg.id) continue;

      // Skip already-imported messages
      const existing = db.prepare(
        'SELECT id FROM gmail_messages WHERE user_id = ? AND gmail_message_id = ?'
      ).get(userId, msg.id);
      if (existing) continue;

      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From'],
        });

        type Header = { name?: string | null; value?: string | null };
        const headers: Header[] = detail.data.payload?.headers ?? [];
        const getHeader = (name: string) =>
          headers.find((h) => (h.name ?? '').toLowerCase() === name.toLowerCase())?.value ?? '';

        const subject = getHeader('Subject') || '(no subject)';
        const sender = getHeader('From') || 'unknown';
        const snippet = ((detail.data.snippet ?? '') as string).slice(0, 200);
        const threadId: string = detail.data.threadId ?? msg.id;

        // Triage into AI Inbox
        const inboxId = addInboxMessage(
          userId,
          'gmail',
          sender,
          subject + (snippet ? ` \u2014 ${snippet}` : ''),
        );

        db.prepare(`
          INSERT OR IGNORE INTO gmail_messages
            (user_id, gmail_message_id, thread_id, subject, sender, snippet, inbox_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, msg.id, threadId, subject, sender, snippet, inboxId);

        imported++;
      } catch (err) {
        logger.warn({ err, userId, msgId: msg.id }, 'Gmail: failed to fetch message detail');
      }
    }

    logger.info({ userId, imported }, 'Gmail sync complete');
    return imported;
  } catch (err) {
    logger.error({ err, userId }, 'Gmail sync failed');
    return 0;
  }
}

function _testSyncUserGmail(userId: string): number {
  const userRow = db.prepare('SELECT google_gmail_token FROM users WHERE id = ?')
    .get(userId) as { google_gmail_token: string | null } | undefined;

  if (!userRow?.google_gmail_token) return 0;

  const existing = db.prepare(
    "SELECT id FROM gmail_messages WHERE user_id = ? AND gmail_message_id = 'test-msg-001'"
  ).get(userId);
  if (existing) return 0;

  const inboxId = addInboxMessage(userId, 'gmail', 'sender@example.com', 'Test subject \u2014 test snippet');
  db.prepare(`
    INSERT OR IGNORE INTO gmail_messages
      (user_id, gmail_message_id, thread_id, subject, sender, snippet, inbox_id)
    VALUES (?, 'test-msg-001', 'test-thread-001', 'Test subject', 'sender@example.com', 'test snippet', ?)
  `).run(userId, inboxId);

  return 1;
}

export async function sendGmailReply(
  userId: string,
  gmailMessageId: string,
  threadId: string,
  replyBody: string,
): Promise<boolean> {
  if (config.isTestMode) {
    return true;
  }

  if (!config.googleClientId || !config.googleClientSecret) return false;

  const userRow = db.prepare('SELECT google_gmail_token, email FROM users WHERE id = ?')
    .get(userId) as { google_gmail_token: string | null; email: string } | undefined;

  if (!userRow?.google_gmail_token) return false;

  let tokenData: GmailTokenData;
  try {
    tokenData = JSON.parse(userRow.google_gmail_token);
  } catch { return false; }

  try {
    const auth = getOAuth2Client();
    auth.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: tokenData.expiry_date,
    });

    const gmail = google.gmail({ version: 'v1', auth });

    type Header = { name?: string | null; value?: string | null };
    const original = await gmail.users.messages.get({
      userId: 'me',
      id: gmailMessageId,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Message-ID'],
    });

    const headers: Header[] = original.data.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => (h.name ?? '').toLowerCase() === name.toLowerCase())?.value ?? '';

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const msgId = getHeader('Message-ID');

    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    const rawEmail = [
      `To: ${from}`,
      `Subject: ${replySubject}`,
      `In-Reply-To: ${msgId}`,
      `References: ${msgId}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      replyBody,
    ].join('\r\n');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: Buffer.from(rawEmail).toString('base64url'), threadId },
    });

    return true;
  } catch (err) {
    logger.error({ err, userId, gmailMessageId }, 'Gmail send reply failed');
    return false;
  }
}

export async function sendGmailCompose(
  userId: string,
  to: string,
  subject: string,
  body: string,
): Promise<boolean> {
  if (config.isTestMode) return true;
  if (!config.googleClientId || !config.googleClientSecret) return false;

  const userRow = db.prepare('SELECT google_gmail_token, email FROM users WHERE id = ?')
    .get(userId) as { google_gmail_token: string | null; email: string } | undefined;
  if (!userRow?.google_gmail_token) return false;

  let tokenData: GmailTokenData;
  try { tokenData = JSON.parse(userRow.google_gmail_token); } catch { return false; }

  try {
    const auth = getOAuth2Client();
    auth.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: tokenData.expiry_date,
    });

    const gmail = google.gmail({ version: 'v1', auth });

    const rawEmail = [
      `From: ${userRow.email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: Buffer.from(rawEmail).toString('base64url') },
    });

    logger.info({ userId, to, subject }, 'Gmail compose sent');
    return true;
  } catch (err) {
    logger.error({ err, userId, to }, 'Gmail compose send failed');
    return false;
  }
}

let _syncTimer: ReturnType<typeof setInterval> | null = null;

export function startGmailSyncScheduler(): void {
  if (_syncTimer) return;

  const INTERVAL_MS = 15 * 60 * 1000;

  _syncTimer = setInterval(() => {
    if (config.isTestMode) return;
    try {
      const users = db.prepare(
        'SELECT id FROM users WHERE google_gmail_token IS NOT NULL'
      ).all() as Array<{ id: string }>;

      for (const user of users) {
        syncUserGmail(user.id).catch((err: unknown) => {
          logger.warn({ err, userId: user.id }, 'Gmail background sync failed');
        });
      }
    } catch (err) {
      logger.warn({ err }, 'Gmail scheduler failed');
    }
  }, INTERVAL_MS);

  if (_syncTimer.unref) _syncTimer.unref();
  logger.info({ intervalMs: INTERVAL_MS }, 'Gmail sync scheduler started');
}

export function _resetGmailSyncTimer(): void {
  if (_syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
  }
}
