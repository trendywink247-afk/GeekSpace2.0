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
  failedYesterday: number;
  activeAgents: number;
}

function gatherBriefingData(userId: string): BriefingData {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

  const pendingReminders = (db.prepare(
    "SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND status = 'pending'"
  ).get(userId) as { c: number })?.c || 0;

  const dueToday = (db.prepare(
    "SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND status = 'pending' AND due_at <= ? || 'T23:59:59'"
  ).get(userId, todayStr) as { c: number })?.c || 0;

  let completedYesterday = 0;
  let failedYesterday = 0;
  try {
    completedYesterday = (db.prepare(
      "SELECT COUNT(*) as c FROM pico_tasks WHERE user_id = ? AND status = 'completed' AND completed_at >= ? || 'T00:00:00'"
    ).get(userId, yesterdayStr) as { c: number })?.c || 0;
    failedYesterday = (db.prepare(
      "SELECT COUNT(*) as c FROM pico_tasks WHERE user_id = ? AND status = 'failed' AND completed_at >= ? || 'T00:00:00'"
    ).get(userId, yesterdayStr) as { c: number })?.c || 0;
  } catch {
    // pico_tasks table might not exist yet
  }

  let activeAgents = 0;
  try {
    activeAgents = (db.prepare(
      "SELECT COUNT(*) as c FROM pico_agents WHERE user_id = ? AND status = 'active'"
    ).get(userId) as { c: number })?.c || 0;
  } catch {
    // pico_agents table might not exist yet
  }

  return { pendingReminders, dueToday, completedYesterday, failedYesterday, activeAgents };
}

async function generateBriefing(userId: string): Promise<string> {
  const data = gatherBriefingData(userId);

  const prompt = `Generate a concise daily briefing (3-5 sentences) based on this data:
- ${data.pendingReminders} pending reminders (${data.dueToday} due today)
- ${data.completedYesterday} tasks completed yesterday, ${data.failedYesterday} failed
- ${data.activeAgents} active Weebo agents
Be conversational and helpful. If there are failed tasks, mention them. If nothing notable, keep it short and encouraging.`;

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
