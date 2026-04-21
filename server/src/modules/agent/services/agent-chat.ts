import { db } from '../../../db/index.js';
import { v4 as uuid } from 'uuid';
import { sendTelegramNotification, escapeTelegramHtml } from '../../../services/telegram.js';
import { logger } from '../../../logger.js';


export async function sendAgentMessage(fromUserId: string, toUsername: string, content: string): Promise<boolean> {
  const recipient = db.prepare('SELECT id, agent_chat_enabled FROM users WHERE username = ?').get(toUsername) as {
    id: string;
    agent_chat_enabled: number;
  } | undefined;

  if (!recipient || !recipient.agent_chat_enabled) {
    return false;
  }

  db.prepare(`
    INSERT INTO agent_messages (id, from_user_id, to_user_id, content)
    VALUES (?, ?, ?, ?)
  `).run(uuid(), fromUserId, recipient.id, content);

  // Update connection counter
  db.prepare(`
    INSERT INTO user_connections (user_id, connected_user_id, last_interaction)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id, connected_user_id) DO UPDATE SET
      last_interaction = datetime('now')
  `).run(recipient.id, fromUserId);

  // Notify recipient via Telegram (non-blocking)
  try {
    const sender = db.prepare('SELECT name, username FROM users WHERE id = ?')
      .get(fromUserId) as { name: string; username: string } | undefined;
    const senderName = sender?.name || sender?.username || 'Someone';
    const telegramLink = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' ORDER BY linked_at DESC LIMIT 1"
    ).get(recipient.id) as { external_id: string } | undefined;

    if (telegramLink) {
      const snippet = content.slice(0, 120);
      void sendTelegramNotification(telegramLink.external_id,
        `<b>${escapeTelegramHtml(senderName)}</b> sent you a message:\n<i>"${escapeTelegramHtml(snippet)}"</i>\n\nCheck your dashboard to reply.`
      ).catch(() => {});
    }
  } catch (err) {
    logger.debug({ err }, 'Non-fatal: failed to send agent message notification');
  }

  return true;
}

export function getAgentMessages(userId: string, limit = 50) {
  return db.prepare(`
    SELECT m.*, u.username as from_username
    FROM agent_messages m
    JOIN users u ON u.id = m.from_user_id
    WHERE m.to_user_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(userId, limit);
}

export function canChatWithAgent(viewerUserId: string, targetUsername: string): boolean {
  const target = db.prepare('SELECT id, agent_chat_enabled FROM users WHERE username = ?').get(targetUsername) as {
    id: string;
    agent_chat_enabled: number;
  } | undefined;

  if (!target) return false;
  if (target.id === viewerUserId) return true;
  return !!target.agent_chat_enabled;
}
