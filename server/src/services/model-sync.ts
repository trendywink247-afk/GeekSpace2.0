// ============================================================
// Model Sync Service
//
// Maintains a curated allowlist of free OpenRouter models and
// syncs daily against the live API. New models are discovered,
// removed ones flagged, and changes pushed via Telegram.
// ============================================================

import { db } from '../db/index.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { sendTelegramMessage } from './telegram.js';

// ---- Types ----

interface CuratedModel {
  displayName: string;
  summary: string;
  parameters?: string;
}

interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

interface FreeModelRow {
  id: string;
  display_name: string;
  provider: string;
  summary: string;
  context_length: number;
  parameters: string | null;
  status: string;
  curated: number;
  first_seen: string;
  last_seen: string;
  last_checked: string;
}

interface ChangelogEntry {
  model_id: string;
  event: string;
  display_name?: string;
}

// ---- Curated Models ----

export const CURATED_MODELS: Record<string, CuratedModel> = {
  'deepseek/deepseek-r1-0528:free': {
    displayName: 'DeepSeek R1 0528',
    summary: 'Open-source 671B MoE reasoning model, performance on par with o1',
    parameters: '671B (37B active)',
  },
  'meta-llama/llama-3.3-70b-instruct:free': {
    displayName: 'Llama 3.3 70B',
    summary: 'Multilingual instruction model supporting 8 languages',
    parameters: '70B',
  },
  'qwen/qwen3-235b-a22b-thinking:free': {
    displayName: 'Qwen3 235B Thinking',
    summary: 'MoE reasoning model excelling at math, science and code',
    parameters: '235B (22B active)',
  },
  'qwen/qwen3-235b-a22b-thinking-2507:free': {
    displayName: 'Qwen3 235B Thinking 2507',
    summary: 'Latest Qwen3 MoE optimized for structured reasoning tasks',
    parameters: '235B (22B active)',
  },
  'openai/gpt-oss-120b:free': {
    displayName: 'GPT-OSS 120B',
    summary: 'Open-weight 117B MoE from OpenAI, runs on single H100',
    parameters: '117B (5.1B active)',
  },
  'openai/gpt-oss-20b:free': {
    displayName: 'GPT-OSS 20B',
    summary: 'Compact open-weight MoE from OpenAI for fast inference',
    parameters: '21B (3.6B active)',
  },
  'stepfun/step-3.5-flash:free': {
    displayName: 'Step 3.5 Flash',
    summary: 'Fast reasoning MoE model, speed-efficient at long contexts',
    parameters: '196B (11B active)',
  },
  'nvidia/nemotron-3-nano-30b-a3b:free': {
    displayName: 'Nemotron 3 Nano 30B',
    summary: 'NVIDIA MoE for efficient agentic AI systems',
    parameters: '30B (3B active)',
  },
  'arcee-ai/trinity-large-preview:free': {
    displayName: 'Arcee Trinity Large',
    summary: 'Frontier 400B MoE excelling at creative writing and agentic tasks',
    parameters: '400B (13B active)',
  },
  'arcee-ai/trinity-mini:free': {
    displayName: 'Arcee Trinity Mini',
    summary: 'Compact 26B MoE with robust function calling and agent workflows',
    parameters: '26B (3B active)',
  },
};

// ---- Helper Functions ----

/** Turn 'provider/model-name:free' into 'Model Name' */
export function deriveDisplayName(modelId: string): string {
  // Strip ':free' suffix and provider prefix
  const withoutSuffix = modelId.replace(/:free$/, '');
  const name = withoutSuffix.includes('/') ? withoutSuffix.split('/').pop()! : withoutSuffix;

  // Convert kebab-case to Title Case, strip version suffixes like -v1.0
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Extract provider from model ID (e.g. 'meta-llama' from 'meta-llama/llama-3.3-70b-instruct:free') */
export function deriveProvider(modelId: string): string {
  const slashIdx = modelId.indexOf('/');
  return slashIdx > 0 ? modelId.slice(0, slashIdx) : 'unknown';
}

// ---- Core Sync Logic ----

export async function syncFreeModels(): Promise<void> {
  const apiKey = config.openrouterFreeApiKey || config.openrouterApiKey;
  if (!apiKey) {
    logger.warn('No OpenRouter API key configured, skipping model sync');
    return;
  }

  logger.info('Starting free model sync...');
  const now = new Date().toISOString();

  // Fetch live models from OpenRouter
  let liveModels: OpenRouterModel[];
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'Agentin',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      logger.error({ status: res.status }, 'OpenRouter models API returned non-OK status');
      return;
    }

    const data = (await res.json()) as { data?: OpenRouterModel[] };
    liveModels = data.data || [];
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Failed to fetch models from OpenRouter');
    return;
  }

  // Filter to :free models only
  const freeModels = liveModels.filter((m) => m.id.endsWith(':free'));
  logger.info({ total: liveModels.length, free: freeModels.length }, 'Fetched OpenRouter models');

  if (freeModels.length === 0) {
    logger.warn('No free models returned from OpenRouter — skipping sync to avoid false removals');
    return;
  }

  // Build a set of live model IDs for quick lookup
  const liveModelIds = new Set(freeModels.map((m) => m.id));

  // Get all existing models from DB
  const existingRows = db.prepare('SELECT * FROM free_models').all() as FreeModelRow[];
  const existingMap = new Map(existingRows.map((r) => [r.id, r]));

  const changes: ChangelogEntry[] = [];

  // Prepared statements
  const insertModel = db.prepare(`
    INSERT INTO free_models (id, display_name, provider, summary, context_length, parameters, status, curated, first_seen, last_seen, last_checked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateSeen = db.prepare(`
    UPDATE free_models SET last_seen = ?, last_checked = ? WHERE id = ?
  `);
  const updateStatus = db.prepare(`
    UPDATE free_models SET status = ?, last_checked = ? WHERE id = ?
  `);
  const updateReturned = db.prepare(`
    UPDATE free_models SET status = 'active', last_seen = ?, last_checked = ? WHERE id = ?
  `);
  const insertChangelog = db.prepare(`
    INSERT INTO model_changelog (model_id, event, timestamp) VALUES (?, ?, ?)
  `);

  // Process in a transaction for consistency
  const syncTransaction = db.transaction(() => {
    // 1. Process each live free model
    for (const model of freeModels) {
      const existing = existingMap.get(model.id);
      const curated = CURATED_MODELS[model.id];

      if (!existing) {
        // New model — never seen before
        const isCurated = !!curated;
        const displayName = curated?.displayName || deriveDisplayName(model.id);
        const summary = curated?.summary || model.description || '';
        const provider = deriveProvider(model.id);
        const parameters = curated?.parameters || null;
        const status = isCurated ? 'active' : 'new';

        insertModel.run(
          model.id, displayName, provider, summary,
          model.context_length || 0, parameters,
          status, isCurated ? 1 : 0,
          now, now, now,
        );

        const event = isCurated ? 'added' : 'discovered';
        insertChangelog.run(model.id, event, now);
        changes.push({ model_id: model.id, event, display_name: displayName });
        logger.info({ modelId: model.id, event, curated: isCurated }, `Model ${event}`);
      } else if (existing.status === 'unavailable') {
        // Previously unavailable, now returned
        updateReturned.run(now, now, model.id);
        insertChangelog.run(model.id, 'returned', now);
        changes.push({ model_id: model.id, event: 'returned', display_name: existing.display_name });
        logger.info({ modelId: model.id }, 'Model returned');
      } else {
        // Known + still present — update timestamps
        updateSeen.run(now, now, model.id);
      }
    }

    // 2. Check for models that disappeared
    for (const existing of existingRows) {
      if (!liveModelIds.has(existing.id) && existing.status !== 'unavailable') {
        updateStatus.run('unavailable', now, existing.id);
        insertChangelog.run(existing.id, 'removed', now);
        changes.push({ model_id: existing.id, event: 'removed', display_name: existing.display_name });
        logger.info({ modelId: existing.id }, 'Model removed');
      }
    }
  });

  syncTransaction();

  logger.info({ changes: changes.length }, 'Model sync completed');

  // Notify if there were changes
  if (changes.length > 0) {
    await notifyModelChanges(changes);
  }
}

// ---- Telegram Notifications ----

async function notifyModelChanges(changes: ChangelogEntry[]): Promise<void> {
  if (changes.length === 0) return;

  // Build formatted message
  const lines: string[] = ['\u{1F4E2} Model Update:'];

  const added = changes.filter((c) => c.event === 'added');
  const returned = changes.filter((c) => c.event === 'returned');
  const discovered = changes.filter((c) => c.event === 'discovered');
  const removed = changes.filter((c) => c.event === 'removed');

  for (const c of added) lines.push(`+ New: ${c.display_name || c.model_id}`);
  for (const c of returned) lines.push(`\u21A9 Returned: ${c.display_name || c.model_id}`);
  for (const c of discovered) lines.push(`\u{1F50D} Discovered: ${c.display_name || c.model_id}`);
  for (const c of removed) lines.push(`- Removed: ${c.display_name || c.model_id}`);

  lines.push('');
  lines.push('Use /model to see all available models.');

  const message = lines.join('\n');

  // Send to all users with connected Telegram
  try {
    const telegramUsers = db.prepare(
      "SELECT external_id FROM channel_links WHERE channel = 'telegram' AND is_verified = 1"
    ).all() as Array<{ external_id: string }>;

    for (const user of telegramUsers) {
      try {
        await sendTelegramMessage(user.external_id, message);
      } catch (err) {
        logger.warn({ externalId: user.external_id, err: (err as Error).message }, 'Failed to send model update to Telegram user');
      }
    }

    logger.info({ recipients: telegramUsers.length, changes: changes.length }, 'Model change notifications sent');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Failed to query Telegram users for model notifications');
  }

  // Mark changelog entries as notified
  try {
    db.prepare(
      "UPDATE model_changelog SET notified = 1 WHERE notified = 0"
    ).run();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Failed to mark changelog entries as notified');
  }
}

// ---- Scheduler ----

let syncInterval: ReturnType<typeof setInterval> | null = null;
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function startModelSyncScheduler(): void {
  if (syncInterval) return;

  // Run once at startup (delayed 10s to let other subsystems init)
  setTimeout(() => {
    syncFreeModels().catch((err) => {
      logger.error({ err: (err as Error).message }, 'Initial model sync failed');
    });
  }, 10_000);

  // Then every 24 hours
  syncInterval = setInterval(() => {
    syncFreeModels().catch((err) => {
      logger.error({ err: (err as Error).message }, 'Scheduled model sync failed');
    });
  }, SYNC_INTERVAL_MS);

  logger.info('Model sync scheduler started (24h interval)');
}

export function stopModelSyncScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
