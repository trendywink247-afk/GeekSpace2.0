// ============================================================
// Memory Summarizer — Daily and Per-Session summarization
//
// Uses the local Ollama model to summarize user activity and
// store concise summaries in agent_memory for future context.
// ============================================================

import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { routeChat } from '../../../services/llm.js';
import { upsertMemory } from './memory.js';

export async function summarizeUserDay(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Use conversation_log (actual table — no agent_conversations table exists)
  const conversations = db.prepare(`
    SELECT role, content FROM conversation_log
    WHERE user_id = ? AND date(created_at) = ?
    ORDER BY created_at ASC LIMIT 30
  `).all(userId, today) as { role: string; content: string }[];

  const completedTasks = db.prepare(`
    SELECT description FROM pico_tasks
    WHERE user_id = ? AND status = 'completed' AND date(completed_at) = ?
  `).all(userId, today) as { description: string }[];

  const completedReminders = db.prepare(`
    SELECT text FROM reminders
    WHERE user_id = ? AND completed = 1 AND date(created_at) = ?
  `).all(userId, today) as { text: string }[];

  if (!conversations.length && !completedTasks.length && !completedReminders.length) return;

  const input = [
    conversations.length > 0
      ? `Conversations: ${conversations.map(c => `${c.role}: ${c.content.slice(0, 100)}`).join(' | ')}`
      : '',
    completedTasks.length > 0
      ? `Completed tasks: ${completedTasks.map(t => t.description).join(', ')}`
      : '',
    completedReminders.length > 0
      ? `Completed reminders: ${completedReminders.map(r => r.text).join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  try {
    const result = await routeChat([
      { role: 'user', content: `Summarize this user's day in 3 bullet points (very concise, max 150 words):\n${input}` },
    ], { forceProvider: 'ollama' });

    upsertMemory(userId, 'auto_summary', today, result.reply, 1.0, 'daily-summarizer');
    logger.info({ userId, date: today }, 'Daily summary saved to memory');
  } catch (err) {
    logger.error({ err, userId }, 'Failed to summarize user day');
  }
}

export async function summarizeConversationSession(
  userId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  if (messages.length < 3) return; // too short to summarize

  const formatted = messages.map(m => `${m.role}: ${m.content.slice(0, 150)}`).join('\n');
  try {
    const result = await routeChat([
      { role: 'user', content: `Summarize this conversation in 1 sentence for future context:\n${formatted}` },
    ], { forceProvider: 'ollama' });

    const sessionKey = `session_${Date.now()}`;
    upsertMemory(userId, 'conversation_summary', sessionKey, `Conversation: ${result.reply}`, 0.8, 'session-summarizer');
  } catch {
    // Non-fatal
  }
}
