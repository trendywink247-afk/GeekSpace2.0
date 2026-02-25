import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';
import { routeChat, type ChatMessage } from './llm.js';
import { sendBriefingEmail } from './email.js';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

interface BriefingData {
  pendingReminders: number;
  dueToday: number;
  completedYesterday: number;
  recentMessages: number;
  streak: number;
  overdueCount: number;
}

function gatherBriefingData(userId: string): BriefingData {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

  // Fix: use completed = 0 (correct schema) instead of status = 'pending'
  const pendingReminders = (db.prepare(
    "SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0"
  ).get(userId) as { c: number })?.c || 0;

  const dueToday = (db.prepare(
    "SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0 AND datetime LIKE ? || '%'"
  ).get(userId, todayStr) as { c: number })?.c || 0;

  const overdueCount = (db.prepare(
    "SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0 AND datetime < ?"
  ).get(userId, now.toISOString()) as { c: number })?.c || 0;

  // Reminders completed yesterday (using completed_at timestamp)
  const completedYesterday = (db.prepare(
    "SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 1 AND date(completed_at / 1000, 'unixepoch') = ?"
  ).get(userId, yesterdayStr) as { c: number })?.c || 0;

  // Recent messages sent in last 24 hours (from activity_log)
  const recentMessages = (db.prepare(
    "SELECT COUNT(*) as c FROM activity_log WHERE user_id = ? AND action LIKE '%message%' AND created_at >= ?"
  ).get(userId, now.getTime() - 86400000) as { c: number })?.c || 0;

  // Current completion streak
  const streakRows = (db.prepare(
    "SELECT DISTINCT date(completed_at / 1000, 'unixepoch') AS day FROM reminders WHERE user_id = ? AND completed = 1 AND completed_at IS NOT NULL ORDER BY day DESC LIMIT 30"
  ).all(userId) as Array<{ day: string }>);
  let streak = 0;
  const todayDate = todayStr;
  const yesterdayDate = yesterdayStr;
  const startDay = streakRows[0]?.day === todayDate ? todayDate : (streakRows[0]?.day === yesterdayDate ? yesterdayDate : null);
  if (startDay) {
    let expected = startDay;
    for (const row of streakRows) {
      if (row.day === expected) {
        streak++;
        const d = new Date(expected + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() - 1);
        expected = d.toISOString().slice(0, 10);
      } else break;
    }
  }

  return { pendingReminders, dueToday, completedYesterday, recentMessages, streak, overdueCount };
}

async function generateBriefing(userId: string): Promise<string> {
  const data = gatherBriefingData(userId);

  const streakNote = data.streak > 0 ? `${data.streak}-day completion streak` : 'no active streak';
  const overdueNote = data.overdueCount > 0 ? ` (${data.overdueCount} overdue)` : '';
  const prompt = `Generate a concise daily briefing (3-5 sentences) based on this data:
- ${data.pendingReminders} pending reminders${overdueNote}, ${data.dueToday} due today
- ${data.completedYesterday} reminders completed yesterday
- ${data.recentMessages} AI messages sent in the last 24h
- Completion streak: ${streakNote}
Be conversational and upbeat. Mention the streak if > 1. If there are overdue items, gently remind. Keep it short and actionable.`;

  const picoAvailable = await isPicoClawAvailable();

  if (picoAvailable) {
    const result = await queryPicoClaw(prompt, 'You are a helpful assistant providing a daily briefing. Be concise.');
    return result.text;
  }

  // Fallback to Ollama
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  const result = await routeChat(messages, {
    systemPrompt: 'You are a helpful assistant providing a daily briefing. Be concise.',
    forceProvider: 'ollama' as const,
    userCredits: 1000,
  });
  return result.reply;
}

export async function createBriefing(userId: string): Promise<string> {
  const content = await generateBriefing(userId);
  const id = uuid();

  db.prepare(
    "INSERT INTO briefings (id, user_id, type, content, channels_sent) VALUES (?, ?, 'daily', ?, '[]')"
  ).run(id, userId, content);

  logger.info({ userId, briefingId: id }, 'Daily briefing created');

  // Send via email if the user has email notifications enabled
  const user = db.prepare('SELECT notification_email FROM users WHERE id = ?').get(userId) as { notification_email: number } | undefined;
  if (user?.notification_email) {
    sendBriefingEmail(userId, content).then((sent) => {
      if (sent) {
        db.prepare("UPDATE briefings SET channels_sent = json_insert(channels_sent, '$[#]', 'email') WHERE id = ?").run(id);
      }
    }).catch((err: Error) => {
      logger.warn({ userId, briefingId: id, error: err.message }, 'Briefing email failed');
    });
  }

  return content;
}

export function getRecentBriefings(userId: string, limit = 10): unknown[] {
  try {
    return db.prepare(
      'SELECT * FROM briefings WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(userId, limit);
  } catch {
    return [];
  }
}

function checkAndSendBriefings(): void {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayStr = now.toISOString().slice(0, 10);

  try {
    const users = db.prepare(`
      SELECT ac.user_id, ac.briefing_time FROM agent_configs ac
      WHERE ac.briefing_time = ?
      AND NOT EXISTS (
        SELECT 1 FROM briefings b
        WHERE b.user_id = ac.user_id AND b.created_at >= ? || 'T00:00:00'
      )
    `).all(currentTime, todayStr) as Array<{ user_id: string; briefing_time: string }>;

    for (const user of users) {
      createBriefing(user.user_id).catch(err => {
        logger.warn({ userId: user.user_id, error: (err as Error).message }, 'Failed to create daily briefing');
      });
    }
  } catch (err) {
    // briefing_time column or briefings table might not exist yet
    logger.debug({ error: (err as Error).message }, 'Briefing scheduler check skipped');
  }
}

export function startBriefingScheduler(): void {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(checkAndSendBriefings, 60_000);
  logger.info('Daily briefing scheduler started (60s interval)');
}

export function stopBriefingScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
