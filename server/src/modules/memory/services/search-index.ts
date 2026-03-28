// ============================================================
// Meilisearch Integration — Typo-tolerant instant search
// Indexes: notes, memories, reminders, habits
// ============================================================

import { config } from '../../../config.js';
import { db } from '../../../db/index.js';
import pino from 'pino';

const log = pino({ name: 'search-index' });

const MEILI_URL = config.meilisearchUrl;
const MEILI_KEY = config.meilisearchApiKey;

// ── Types ────────────────────────────────────────────────────

interface MeiliDocument {
  id: string;
  user_id: string;
  type: 'note' | 'memory' | 'reminder' | 'habit' | 'conversation';
  title: string;
  content: string;
  created_at: number;
  updated_at?: number;
}

interface MeiliSearchResult {
  hits: MeiliDocument[];
  estimatedTotalHits: number;
  processingTimeMs: number;
}

// ── HTTP helper ──────────────────────────────────────────────

async function meili(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${MEILI_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MEILI_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meilisearch ${method} ${path}: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Index Setup ──────────────────────────────────────────────

let initialized = false;

export async function initMeilisearch(): Promise<void> {
  if (initialized) return;
  try {
    // Create the unified index
    await meili('POST', '/indexes', { uid: 'content', primaryKey: 'id' });
    log.info('Created Meilisearch index: content');
  } catch (e: unknown) {
    // index_already_exists is fine
    if (!(e instanceof Error) || !e.message.includes('already_exists')) {
      log.warn({ err: e }, 'Meilisearch index creation');
    }
  }

  try {
    // Configure filterable + searchable attributes
    await meili('PATCH', '/indexes/content/settings', {
      filterableAttributes: ['user_id', 'type', 'created_at'],
      searchableAttributes: ['title', 'content'],
      sortableAttributes: ['created_at'],
      typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 } },
    });
    initialized = true;
    log.info('Meilisearch initialized');
  } catch (e) {
    log.warn({ err: e }, 'Meilisearch settings update');
  }
}

// ── Index Documents ──────────────────────────────────────────

export async function indexDocument(doc: MeiliDocument): Promise<void> {
  try {
    await initMeilisearch();
    await meili('POST', '/indexes/content/documents', [doc]);
  } catch (e) {
    log.warn({ err: e, docId: doc.id }, 'Failed to index document');
  }
}

export async function indexNote(userId: string, noteId: string, title: string, content: string, createdAt?: number): Promise<void> {
  await indexDocument({
    id: `note-${noteId}`,
    user_id: userId,
    type: 'note',
    title: title || '',
    content: content || '',
    created_at: createdAt || Date.now(),
  });
}

export async function indexMemory(userId: string, key: string, value: string, _memId?: number): Promise<void> {
  await indexDocument({
    id: `mem-${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    user_id: userId,
    type: 'memory',
    title: key,
    content: value,
    created_at: Date.now(),
  });
}

export async function indexReminder(userId: string, reminderId: string, text: string, createdAt?: number): Promise<void> {
  await indexDocument({
    id: `rem-${reminderId}`,
    user_id: userId,
    type: 'reminder',
    title: text,
    content: text,
    created_at: createdAt || Date.now(),
  });
}

export async function indexHabit(userId: string, habitId: string, name: string, description?: string): Promise<void> {
  await indexDocument({
    id: `habit-${habitId}`,
    user_id: userId,
    type: 'habit',
    title: name,
    content: description || name,
    created_at: Date.now(),
  });
}

// ── Remove Document ──────────────────────────────────────────

export async function removeDocument(docId: string): Promise<void> {
  try {
    await meili('DELETE', `/indexes/content/documents/${encodeURIComponent(docId)}`);
  } catch (e) {
    log.warn({ err: e, docId }, 'Failed to remove document from index');
  }
}

// ── Search ───────────────────────────────────────────────────

export async function searchContent(
  userId: string,
  query: string,
  options?: { type?: string; limit?: number }
): Promise<MeiliSearchResult> {
  const limit = options?.limit || 10;
  const filter = options?.type
    ? `user_id = "${userId}" AND type = "${options.type}"`
    : `user_id = "${userId}"`;

  try {
    await initMeilisearch();
    const result = await meili('POST', '/indexes/content/search', {
      q: query,
      filter,
      limit,
      attributesToHighlight: ['title', 'content'],
      highlightPreTag: '**',
      highlightPostTag: '**',
    }) as MeiliSearchResult;
    return result;
  } catch (e) {
    log.warn({ err: e, query }, 'Meilisearch search failed');
    return { hits: [], estimatedTotalHits: 0, processingTimeMs: 0 };
  }
}

// ── Bulk Index (for initial population) ──────────────────────

export async function bulkIndex(docs: MeiliDocument[]): Promise<void> {
  if (docs.length === 0) return;
  try {
    await initMeilisearch();
    // Meilisearch handles batches up to 100MB
    const batchSize = 500;
    for (let i = 0; i < docs.length; i += batchSize) {
      await meili('POST', '/indexes/content/documents', docs.slice(i, i + batchSize));
    }
    log.info({ count: docs.length }, 'Bulk indexed documents');
  } catch (e) {
    log.warn({ err: e }, 'Bulk index failed');
  }
}

// ── Bulk Index Existing Data (startup population) ────────────

export async function bulkIndexExistingData(): Promise<void> {
  try {
    await initMeilisearch();

    // Check if index already has data — skip if so
    const stats = await meili('GET', '/indexes/content/stats') as { numberOfDocuments: number };
    if (stats.numberOfDocuments > 0) {
      log.info({ docs: stats.numberOfDocuments }, 'Meilisearch already indexed, skipping bulk');
      return;
    }

    const docs: MeiliDocument[] = [];

    // Index reminders
    const reminders = db.prepare('SELECT id, user_id, text, category FROM reminders LIMIT 10000').all() as Array<{ id: string; user_id: string; text: string; category: string }>;
    for (const r of reminders) {
      docs.push({
        id: `rem-${r.id}`,
        user_id: r.user_id,
        type: 'reminder',
        title: r.text,
        content: r.text,
        created_at: Date.now(),
      });
    }

    // Index notes
    const notes = db.prepare('SELECT id, user_id, title, content FROM notes LIMIT 10000').all() as Array<{ id: number; user_id: string; title: string; content: string }>;
    for (const n of notes) {
      docs.push({
        id: `note-${n.id}`,
        user_id: n.user_id,
        type: 'note',
        title: n.title || '',
        content: n.content || '',
        created_at: Date.now(),
      });
    }

    // Index memories
    const memories = db.prepare('SELECT id, user_id, key, value FROM user_memories LIMIT 10000').all() as Array<{ id: number; user_id: string; key: string; value: string }>;
    for (const m of memories) {
      docs.push({
        id: `mem-${m.user_id.replace(/[^a-zA-Z0-9_-]/g, '_')}-${m.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        user_id: m.user_id,
        type: 'memory',
        title: m.key,
        content: m.value,
        created_at: Date.now(),
      });
    }

    if (docs.length > 0) {
      await bulkIndex(docs);
    }

    log.info({ reminders: reminders.length, notes: notes.length, memories: memories.length }, 'Meilisearch bulk index complete');
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'Meilisearch bulk index failed (non-fatal)');
  }
}

// ── Health Check ─────────────────────────────────────────────

export async function isMeilisearchHealthy(): Promise<boolean> {
  try {
    await meili('GET', '/health');
    return true;
  } catch {
    return false;
  }
}
