/**
 * Conversation Threads — Session management for chat conversations
 * 
 * Each conversation is a thread of messages with a unique ID.
 * Threads auto-close after 30min idle and trigger session summary.
 */

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';

// ── Types ────────────────────────────────────────────────────

export interface ConversationThread {
  id: string;
  user_id: string;
  title: string;
  last_message_preview: string;
  message_count: number;
  channel: string;
  agent_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  agent_id: string | null;
  provider: string;
  created_at: string;
}

// ── CRUD ─────────────────────────────────────────────────────

export function createConversation(userId: string, title?: string, channel = 'web'): string {
  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO conversations (id, user_id, title, channel, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, title || 'New conversation', channel, now, now);
  logger.debug({ userId, conversationId: id }, 'conversation:created');
  return id;
}

export function getOrCreateConversation(userId: string, conversationId?: string, channel = 'web'): string {
  // If a specific conversation ID is provided and exists, use it
  if (conversationId) {
    const existing = db.prepare(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?'
    ).get(conversationId, userId) as { id: string } | undefined;
    if (existing) {
      return existing.id;
    }
  }
  
  // Find the most recent active conversation (within 30 min)
  const recent = db.prepare(`
    SELECT id, updated_at FROM conversations
    WHERE user_id = ? AND is_active = 1 AND channel = ?
    ORDER BY updated_at DESC LIMIT 1
  `).get(userId, channel) as { id: string; updated_at: string } | undefined;
  
  if (recent) {
    const lastUpdate = new Date(recent.updated_at).getTime();
    const now = Date.now();
    const thirtyMin = 30 * 60 * 1000;
    if (now - lastUpdate < thirtyMin) {
      return recent.id;
    }
    // Close the stale conversation
    closeConversation(recent.id);
  }
  
  // Create a new conversation
  return createConversation(userId, undefined, channel);
}

export function listConversations(userId: string, limit = 30): ConversationThread[] {
  return db.prepare(`
    SELECT * FROM conversations
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(userId, Math.min(limit, 100)) as ConversationThread[];
}

export function getConversationMessages(userId: string, conversationId: string, limit = 50): ConversationMessage[] {
  return db.prepare(`
    SELECT id, role, content, agent_id, provider, created_at
    FROM conversation_log
    WHERE user_id = ? AND conversation_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(userId, conversationId, Math.min(limit, 200)) as ConversationMessage[];
}

export function updateConversationTitle(userId: string, conversationId: string, title: string): void {
  db.prepare(
    'UPDATE conversations SET title = ?, updated_at = datetime("now") WHERE id = ? AND user_id = ?'
  ).run(title.slice(0, 200), conversationId, userId);
}

export function updateConversationMeta(conversationId: string, lastMessage: string, agentId?: string): void {
  db.prepare(`
    UPDATE conversations SET
      last_message_preview = ?,
      message_count = message_count + 1,
      agent_id = COALESCE(?, agent_id),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(lastMessage.slice(0, 200), agentId || null, conversationId);
}

export function closeConversation(conversationId: string): void {
  db.prepare(
    'UPDATE conversations SET is_active = 0, updated_at = datetime("now") WHERE id = ?'
  ).run(conversationId);
}

export function autoTitleConversation(conversationId: string, firstMessage: string): void {
  // Generate title from first user message (first 60 chars, clean up)
  let title = firstMessage
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  if (firstMessage.length > 60) title += '...';
  if (title) {
    db.prepare(
      'UPDATE conversations SET title = ? WHERE id = ? AND title = ?'
    ).run(title, conversationId, 'New conversation');
  }
}
