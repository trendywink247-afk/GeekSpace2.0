import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';

export function initAgentChatTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON agent_messages(from_user_id, to_user_id);
  `);
}

export function sendAgentMessage(fromUserId: string, toUsername: string, content: string): boolean {
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
