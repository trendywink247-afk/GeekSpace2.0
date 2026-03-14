#!/usr/bin/env node
// ops/bulk-index.mjs — Bulk index existing data into Meilisearch + Qdrant
// Runs on HOST. Uses sqlite3 CLI for DB, docker exec for Meilisearch/Qdrant,
// and Ollama host port for embeddings.

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const DB_PATH = '/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db';
const MEILI_KEY = 'agentin-meili-2026';
const MEILI_INDEX = 'content';
const QDRANT_COLLECTION = 'user_memories';
const OLLAMA_PORT = 32779; // host-mapped port for Ollama
const EMBED_MODEL = 'nomic-embed-text';
const MEILI_BATCH_SIZE = 100;
const QDRANT_BATCH_SIZE = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Query SQLite and return parsed JSON array (empty array if no rows). */
function dbQuery(sql) {
  try {
    const raw = execSync(
      `sqlite3 -json "${DB_PATH}" "${sql}"`,
      { encoding: 'utf8', timeout: 30_000, maxBuffer: 50 * 1024 * 1024 }
    ).trim();
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    // sqlite3 -json returns empty string on 0 rows (exit 0),
    // but may exit non-zero on real errors
    if (err.stdout !== undefined && err.stdout.trim() === '') return [];
    throw err;
  }
}

/**
 * POST to Meilisearch via docker exec.
 * Writes JSON to a host temp file, docker-cp's it into geekspace-app,
 * then curl from inside the container (has network access to meilisearch).
 */
function meiliPost(path, body) {
  const tmpHost = `/tmp/_meili_${Date.now()}_${Math.random().toString(36).slice(2)}.json`;
  const tmpContainer = tmpHost;
  writeFileSync(tmpHost, JSON.stringify(body));
  execSync(`docker cp ${tmpHost} geekspace-app:${tmpContainer}`, { timeout: 10_000 });
  try {
    const result = execSync(
      `docker exec geekspace-app curl -sf -X POST ` +
      `-H 'Authorization: Bearer ${MEILI_KEY}' ` +
      `-H 'Content-Type: application/json' ` +
      `'http://geekspace-meilisearch:7700${path}' ` +
      `-d @${tmpContainer}`,
      { encoding: 'utf8', timeout: 60_000 }
    );
    return result ? JSON.parse(result) : {};
  } finally {
    try { unlinkSync(tmpHost); } catch {}
    try { execSync(`docker exec geekspace-app rm -f ${tmpContainer}`, { timeout: 5_000, stdio: 'ignore' }); } catch {}
  }
}

/** PUT/POST to Qdrant via docker exec. Same tmp-file pattern. */
function qdrantReq(method, path, body) {
  const tmpHost = `/tmp/_qdrant_${Date.now()}_${Math.random().toString(36).slice(2)}.json`;
  const tmpContainer = tmpHost;
  writeFileSync(tmpHost, JSON.stringify(body));
  execSync(`docker cp ${tmpHost} geekspace-app:${tmpContainer}`, { timeout: 10_000 });
  try {
    const result = execSync(
      `docker exec geekspace-app curl -sf -X ${method} ` +
      `-H 'Content-Type: application/json' ` +
      `'http://geekspace-qdrant:6333${path}' ` +
      `-d @${tmpContainer}`,
      { encoding: 'utf8', timeout: 60_000 }
    );
    return result ? JSON.parse(result) : {};
  } finally {
    try { unlinkSync(tmpHost); } catch {}
    try { execSync(`docker exec geekspace-app rm -f ${tmpContainer}`, { timeout: 5_000, stdio: 'ignore' }); } catch {}
  }
}

/** Get 768-dim embedding from Ollama via host port. */
async function embed(text) {
  const res = await fetch(`http://localhost:${OLLAMA_PORT}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
  const data = await res.json();
  return data.embeddings?.[0] || null;
}

/** Deterministic positive integer hash for Qdrant point IDs. */
function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

/** Sanitize for Meilisearch document ID (alphanumeric, dash, underscore only). */
function sanitizeId(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Sleep helper. */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Bulk Index: Meilisearch + Qdrant ===\n');

  let totalMeili = 0;
  let totalQdrant = 0;

  // ── 1. Notes ───────────────────────────────────────────────────────────────
  const notes = dbQuery(
    "SELECT id, user_id, title, content, created_at FROM notes WHERE archived = 0"
  );
  if (notes.length > 0) {
    process.stdout.write(`Meilisearch: Indexing ${notes.length} notes... `);
    const noteDocs = notes.map(n => ({
      id: `note-${n.id}`,
      user_id: n.user_id,
      type: 'note',
      title: n.title || '',
      content: n.content || '',
      created_at: n.created_at || 0,
    }));
    for (let i = 0; i < noteDocs.length; i += MEILI_BATCH_SIZE) {
      meiliPost(`/indexes/${MEILI_INDEX}/documents`, noteDocs.slice(i, i + MEILI_BATCH_SIZE));
    }
    totalMeili += noteDocs.length;
    console.log(`done (${noteDocs.length} docs)`);
  } else {
    console.log('Meilisearch: No notes to index (0 rows)');
  }

  // ── 2. Reminders ──────────────────────────────────────────────────────────
  const reminders = dbQuery(
    "SELECT id, user_id, text, datetime, created_at FROM reminders WHERE completed = 0"
  );
  if (reminders.length > 0) {
    process.stdout.write(`Meilisearch: Indexing ${reminders.length} reminders... `);
    const remDocs = reminders.map(r => ({
      id: `rem-${sanitizeId(r.id)}`,
      user_id: r.user_id,
      type: 'reminder',
      title: r.text || '',
      content: r.text || '',
      created_at: r.created_at || '',
    }));
    for (let i = 0; i < remDocs.length; i += MEILI_BATCH_SIZE) {
      meiliPost(`/indexes/${MEILI_INDEX}/documents`, remDocs.slice(i, i + MEILI_BATCH_SIZE));
    }
    totalMeili += remDocs.length;
    console.log(`done (${remDocs.length} docs)`);
  } else {
    console.log('Meilisearch: No reminders to index (0 rows)');
  }

  // ── 3. Habits ─────────────────────────────────────────────────────────────
  const habits = dbQuery(
    "SELECT id, user_id, name, description, created_at FROM habits"
  );
  if (habits.length > 0) {
    process.stdout.write(`Meilisearch: Indexing ${habits.length} habits... `);
    const habitDocs = habits.map(h => ({
      id: `habit-${h.id}`,
      user_id: h.user_id,
      type: 'habit',
      title: h.name || '',
      content: h.description || h.name || '',
      created_at: h.created_at || 0,
    }));
    for (let i = 0; i < habitDocs.length; i += MEILI_BATCH_SIZE) {
      meiliPost(`/indexes/${MEILI_INDEX}/documents`, habitDocs.slice(i, i + MEILI_BATCH_SIZE));
    }
    totalMeili += habitDocs.length;
    console.log(`done (${habitDocs.length} docs)`);
  } else {
    console.log('Meilisearch: No habits to index (0 rows)');
  }

  // ── 4. Memories -> Meilisearch ────────────────────────────────────────────
  const memories = dbQuery(
    "SELECT id, user_id, key, value, created_at FROM user_memories"
  );
  if (memories.length > 0) {
    process.stdout.write(`Meilisearch: Indexing ${memories.length} memories... `);
    const memDocs = memories.map(m => ({
      id: `mem-${sanitizeId(m.user_id)}-${sanitizeId(m.key)}`,
      user_id: m.user_id,
      type: 'memory',
      title: m.key || '',
      content: m.value || '',
      created_at: m.created_at || 0,
    }));
    for (let i = 0; i < memDocs.length; i += MEILI_BATCH_SIZE) {
      meiliPost(`/indexes/${MEILI_INDEX}/documents`, memDocs.slice(i, i + MEILI_BATCH_SIZE));
    }
    totalMeili += memDocs.length;
    console.log(`done (${memDocs.length} docs)`);
  } else {
    console.log('Meilisearch: No memories to index (0 rows)');
  }

  // ── 5. Memories -> Qdrant (vector embeddings) ────────────────────────────
  if (memories.length > 0) {
    const totalBatches = Math.ceil(memories.length / QDRANT_BATCH_SIZE);
    console.log(`\nQdrant: Embedding ${memories.length} memories (${QDRANT_BATCH_SIZE} per batch)...`);

    for (let i = 0; i < memories.length; i += QDRANT_BATCH_SIZE) {
      const batch = memories.slice(i, i + QDRANT_BATCH_SIZE);
      const batchNum = Math.floor(i / QDRANT_BATCH_SIZE) + 1;

      const points = [];
      for (const m of batch) {
        const text = `${m.key}: ${m.value}`;
        try {
          const vector = await embed(text);
          if (!vector || vector.length !== 768) {
            console.warn(`  WARN: skipping memory id=${m.id} -- bad embedding (${vector?.length || 0} dims)`);
            continue;
          }
          points.push({
            id: hashId(`${m.user_id}:${m.key}`),
            vector,
            payload: {
              user_id: m.user_id,
              key: m.key,
              value: m.value,
              source: 'bulk-index',
              created_at: m.created_at || 0,
            },
          });
        } catch (err) {
          console.warn(`  WARN: embed failed for memory id=${m.id}: ${err.message}`);
        }
      }

      if (points.length > 0) {
        qdrantReq('PUT', `/collections/${QDRANT_COLLECTION}/points`, { points });
      }
      totalQdrant += points.length;
      console.log(`  Batch ${batchNum}/${totalBatches}: embedded ${points.length} memories`);

      // Small delay between batches to avoid overwhelming Ollama
      if (i + QDRANT_BATCH_SIZE < memories.length) {
        await sleep(500);
      }
    }
  } else {
    console.log('\nQdrant: No memories to embed (0 rows)');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\nDone! Meilisearch: ${totalMeili} docs. Qdrant: ${totalQdrant} vectors.`);
}

main().catch(err => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
