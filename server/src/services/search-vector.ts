// ============================================================
// Qdrant + Embedding Integration — Semantic memory search
// Uses Ollama nomic-embed-text for 768-dim embeddings
// ============================================================

import { config } from '../config.js';
import pino from 'pino';

const log = pino({ name: 'search-vector' });

const QDRANT_URL = config.qdrantUrl;
const OLLAMA_URL = config.ollamaBaseUrl;
const EMBED_MODEL = config.embeddingModel;
const COLLECTION = 'user_memories';
const VECTOR_DIM = 768; // nomic-embed-text dimension

// ── Types ────────────────────────────────────────────────────

interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

interface SemanticResult {
  id: string;
  score: number;
  key: string;
  value: string;
  source: string;
  userId: string;
}

// ── Qdrant HTTP helper ───────────────────────────────────────

async function qdrant(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qdrant ${method} ${path}: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

// ── Embedding via Ollama ─────────────────────────────────────

async function embed(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, input: text }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { embeddings?: number[][] };
    return data.embeddings?.[0] || null;
  } catch (e) {
    log.debug({ err: e }, 'Embedding failed');
    return null;
  }
}

// ── Collection Setup ─────────────────────────────────────────

let collectionReady = false;

export async function initQdrant(): Promise<void> {
  if (collectionReady) return;
  try {
    // Check if collection exists
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      collectionReady = true;
      log.info('Qdrant collection exists: ' + COLLECTION);
      return;
    }
  } catch { /* collection doesn't exist */ }

  try {
    await qdrant('PUT', `/collections/${COLLECTION}`, {
      vectors: { size: VECTOR_DIM, distance: 'Cosine' },
    });
    // Create user_id payload index for filtering
    await qdrant('PUT', `/collections/${COLLECTION}/index`, {
      field_name: 'user_id',
      field_schema: 'keyword',
    });
    collectionReady = true;
    log.info('Created Qdrant collection: ' + COLLECTION);
  } catch (e) {
    log.warn({ err: e }, 'Qdrant collection creation');
  }
}

// ── Upsert Memory Vector ────────────────────────────────────

export async function upsertMemoryVector(
  userId: string,
  key: string,
  value: string,
  source: string = 'manual'
): Promise<void> {
  try {
    await initQdrant();
    const textToEmbed = `${key}: ${value}`;
    const vector = await embed(textToEmbed);
    if (!vector || vector.length !== VECTOR_DIM) {
      log.debug({ key }, 'Skipping vector upsert — no embedding');
      return;
    }

    // Use deterministic ID from userId + key
    const pointId = stringToUUID(userId + ':' + key);

    await qdrant('PUT', `/collections/${COLLECTION}/points`, {
      points: [{
        id: pointId,
        vector,
        payload: {
          user_id: userId,
          key,
          value,
          source,
          indexed_at: Date.now(),
        },
      }],
    });
    log.debug({ userId: userId.slice(0, 8), key }, 'Upserted memory vector');
  } catch (e) {
    log.warn({ err: e, key }, 'Failed to upsert memory vector');
  }
}

// ── Semantic Search ──────────────────────────────────────────

export async function semanticSearch(
  userId: string,
  query: string,
  limit: number = 5
): Promise<SemanticResult[]> {
  try {
    await initQdrant();
    const vector = await embed(query);
    if (!vector || vector.length !== VECTOR_DIM) {
      return [];
    }

    const result = await qdrant('POST', `/collections/${COLLECTION}/points/search`, {
      vector,
      filter: {
        must: [{ key: 'user_id', match: { value: userId } }],
      },
      limit,
      with_payload: true,
    }) as { result: Array<{ id: string; score: number; payload: Record<string, unknown> }> };

    return (result.result || [])
      .filter(r => r.score > 0.3) // minimum similarity threshold
      .map(r => ({
        id: String(r.id),
        score: r.score,
        key: String(r.payload.key || ''),
        value: String(r.payload.value || ''),
        source: String(r.payload.source || ''),
        userId: String(r.payload.user_id || ''),
      }));
  } catch (e) {
    log.warn({ err: e, query }, 'Semantic search failed');
    return [];
  }
}

// ── Delete Memory Vector ─────────────────────────────────────

export async function deleteMemoryVector(userId: string, key: string): Promise<void> {
  try {
    const pointId = stringToUUID(userId + ':' + key);
    await qdrant('POST', `/collections/${COLLECTION}/points/delete`, {
      points: [pointId],
    });
  } catch (e) {
    log.debug({ err: e, key }, 'Delete vector failed');
  }
}

// ── Bulk Embed + Upsert ──────────────────────────────────────

export async function bulkUpsertMemories(
  memories: Array<{ userId: string; key: string; value: string; source?: string }>
): Promise<number> {
  await initQdrant();
  let count = 0;
  // Process in batches to avoid overwhelming Ollama
  const batchSize = 10;
  for (let i = 0; i < memories.length; i += batchSize) {
    const batch = memories.slice(i, i + batchSize);
    const points: VectorPoint[] = [];

    for (const m of batch) {
      const vector = await embed(`${m.key}: ${m.value}`);
      if (vector && vector.length === VECTOR_DIM) {
        points.push({
          id: stringToUUID(m.userId + ':' + m.key),
          vector,
          payload: {
            user_id: m.userId,
            key: m.key,
            value: m.value,
            source: m.source || 'bulk',
            indexed_at: Date.now(),
          },
        });
      }
    }

    if (points.length > 0) {
      try {
        await qdrant('PUT', `/collections/${COLLECTION}/points`, { points });
        count += points.length;
      } catch (e) {
        log.warn({ err: e, batch: i }, 'Bulk upsert batch failed');
      }
    }
  }
  log.info({ count, total: memories.length }, 'Bulk upserted memory vectors');
  return count;
}

// ── Health ────────────────────────────────────────────────────

export async function isQdrantHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${QDRANT_URL}/healthz`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function isEmbeddingAvailable(): Promise<boolean> {
  const vector = await embed('test');
  return vector !== null && vector.length === VECTOR_DIM;
}

// ── Utility ──────────────────────────────────────────────────

function stringToUUID(str: string): string {
  // Deterministic UUID v5-like from string (simple hash-based)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  // Create a valid UUID format
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`;
}
