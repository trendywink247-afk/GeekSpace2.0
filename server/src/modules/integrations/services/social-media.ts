// ============================================================
// Social Media Handler — Connect accounts, generate content
// plans, and auto-post on schedule.
//
// Tables: social_accounts, content_plans, content_plan_items
// Supports webhook and direct API posting methods.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { encrypt, decrypt } from '../../../utils/encryption.js';
import { edithChat } from '../../../services/edith.js';
import { computeCreditCost, deductSubscriptionCredits } from '../../../services/llm.js';

// ---- Types ----

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: 'instagram' | 'facebook';
  account_name: string;
  posting_method: 'webhook' | 'api';
  webhook_url: string;
  page_id: string;
  access_token_encrypted: string;
  status: 'active' | 'paused';
  posts_count: number;
  last_post_at: string | null;
  created_at: string;
}

export interface ContentPlan {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  niche: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  social_account_id: string | null;
  start_date: string | null;
  created_at: string;
  items?: ContentPlanItem[];
}

export interface ContentPlanItem {
  id: string;
  plan_id: string;
  day_number: number;
  slot: number;
  caption: string;
  media_id: string;
  media_type: string;
  media_url: string;
  scheduled_at: string | null;
  status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed';
  enabled: number;
  posted_at: string | null;
  error_message: string;
  created_at: string;
}

// ---- Schema Init ----

export function initSocialMediaTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL CHECK(platform IN ('instagram', 'facebook')),
      account_name TEXT NOT NULL DEFAULT '',
      posting_method TEXT NOT NULL CHECK(posting_method IN ('webhook', 'api')),
      webhook_url TEXT DEFAULT '',
      page_id TEXT DEFAULT '',
      access_token_encrypted TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      posts_count INTEGER DEFAULT 0,
      last_post_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);

    CREATE TABLE IF NOT EXISTS content_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT '',
      niche TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      social_account_id TEXT,
      start_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_content_plans_user ON content_plans(user_id);

    CREATE TABLE IF NOT EXISTS content_plan_items (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      slot INTEGER NOT NULL CHECK(slot >= 1 AND slot <= 2),
      caption TEXT NOT NULL DEFAULT '',
      media_id TEXT DEFAULT '',
      media_type TEXT DEFAULT '',
      media_url TEXT DEFAULT '',
      scheduled_at TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      enabled INTEGER DEFAULT 1,
      posted_at TEXT,
      error_message TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(plan_id, day_number, slot)
    );
    CREATE INDEX IF NOT EXISTS idx_content_plan_items_plan ON content_plan_items(plan_id);
    CREATE INDEX IF NOT EXISTS idx_content_plan_items_scheduled ON content_plan_items(scheduled_at);
  `);

  logger.info('Social Media tables initialized');
}

// ---- Account CRUD ----

export function getUserSocialAccounts(userId: string): SocialAccount[] {
  return db.prepare('SELECT * FROM social_accounts WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as SocialAccount[];
}

export function createSocialAccount(userId: string, data: {
  platform: string;
  account_name: string;
  posting_method: string;
  webhook_url?: string;
  page_id?: string;
  access_token?: string;
}): SocialAccount {
  const id = uuid();
  const tokenEncrypted = data.access_token ? encrypt(data.access_token) : '';

  db.prepare(`INSERT INTO social_accounts (id, user_id, platform, account_name, posting_method, webhook_url, page_id, access_token_encrypted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, userId, data.platform, data.account_name, data.posting_method,
      data.webhook_url || '', data.page_id || '', tokenEncrypted);

  return db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(id) as SocialAccount;
}

export function updateSocialAccount(accountId: string, userId: string, updates: {
  account_name?: string;
  posting_method?: string;
  webhook_url?: string;
  page_id?: string;
  access_token?: string;
  status?: string;
}): SocialAccount {
  const account = db.prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?')
    .get(accountId, userId) as SocialAccount | undefined;
  if (!account) throw new Error('Account not found');

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.account_name !== undefined) { fields.push('account_name = ?'); values.push(updates.account_name); }
  if (updates.posting_method !== undefined) { fields.push('posting_method = ?'); values.push(updates.posting_method); }
  if (updates.webhook_url !== undefined) { fields.push('webhook_url = ?'); values.push(updates.webhook_url); }
  if (updates.page_id !== undefined) { fields.push('page_id = ?'); values.push(updates.page_id); }
  if (updates.access_token !== undefined) { fields.push('access_token_encrypted = ?'); values.push(encrypt(updates.access_token)); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

  if (fields.length) {
    values.push(accountId);
    db.prepare(`UPDATE social_accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  return db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(accountId) as SocialAccount;
}

export function deleteSocialAccount(accountId: string, userId: string): void {
  const account = db.prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?')
    .get(accountId, userId) as SocialAccount | undefined;
  if (!account) throw new Error('Account not found');
  db.prepare('DELETE FROM social_accounts WHERE id = ?').run(accountId);
}

export async function testSocialAccount(accountId: string, userId: string): Promise<{ success: boolean; message: string }> {
  const account = db.prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?')
    .get(accountId, userId) as SocialAccount | undefined;
  if (!account) throw new Error('Account not found');

  if (account.posting_method === 'webhook') {
    if (!account.webhook_url) return { success: false, message: 'No webhook URL configured' };
    try {
      const res = await fetch(account.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, platform: account.platform, timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000),
      });
      return { success: res.ok, message: res.ok ? `Webhook responded ${res.status}` : `Webhook returned ${res.status}` };
    } catch (err) {
      return { success: false, message: `Webhook unreachable: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // API mode — test by validating credentials format
  if (!account.page_id) return { success: false, message: 'No page ID configured' };
  if (!account.access_token_encrypted) return { success: false, message: 'No access token configured' };
  return { success: true, message: 'API credentials configured (live validation on first post)' };
}

// ---- Plan CRUD ----

export function getUserContentPlans(userId: string): ContentPlan[] {
  return db.prepare('SELECT * FROM content_plans WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as ContentPlan[];
}

export function getContentPlan(planId: string, userId: string): ContentPlan | null {
  const plan = db.prepare('SELECT * FROM content_plans WHERE id = ? AND user_id = ?')
    .get(planId, userId) as ContentPlan | undefined;
  if (!plan) return null;

  plan.items = db.prepare('SELECT * FROM content_plan_items WHERE plan_id = ? ORDER BY day_number ASC, slot ASC')
    .all(planId) as ContentPlanItem[];

  return plan;
}

export function deleteContentPlan(planId: string, userId: string): void {
  const plan = db.prepare('SELECT * FROM content_plans WHERE id = ? AND user_id = ?')
    .get(planId, userId) as ContentPlan | undefined;
  if (!plan) throw new Error('Plan not found');
  db.prepare('DELETE FROM content_plans WHERE id = ?').run(planId);
}

// ---- AI Content Generation ----

const CONTENT_STRATEGIST_PROMPT = `You are a social media content strategist for the "Agentin" AI platform.
Generate a 10-day content plan based on the user's topic and niche.

Rules:
- Each day has 1-2 post slots (alternate between 1 and 2 posts per day)
- Each caption should be engaging, relevant to the topic/niche, and 100-300 characters
- Include relevant hashtags (3-5 per post)
- Every caption MUST end with a newline then "Powered by Agentin"
- Vary content types: tips, questions, behind-the-scenes, quotes, tutorials, engagement posts
- Be creative and platform-appropriate

Respond with ONLY a JSON array, no markdown fences:
[{"day":1,"slots":[{"slot":1,"caption":"Your caption here\\n\\nPowered by Agentin"},{"slot":2,"caption":"Second post\\n\\nPowered by Agentin"}]},{"day":2,"slots":[{"slot":1,"caption":"..."}]}]

Exactly 10 days. Each day 1-2 slots. No extra text.`;

export async function generateContentPlan(userId: string, topic: string, niche: string): Promise<ContentPlan> {
  const userMessage = `Topic: ${topic}\nNiche: ${niche}\n\nGenerate a 10-day content plan.`;

  const result = await edithChat(userMessage, CONTENT_STRATEGIST_PROMPT);

  // Deduct credits
  const creditCost = computeCreditCost('edith', result.tokensIn, result.tokensOut);
  deductSubscriptionCredits(userId, creditCost);

  // Log usage
  db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
    VALUES (?, ?, 'edith', 'kimi-k2-thinking', ?, ?, ?, 'social-media', 'content.plan')`)
    .run(uuid(), userId, result.tokensIn, result.tokensOut, creditCost);

  // Parse response
  let days: Array<{ day: number; slots: Array<{ slot: number; caption: string }> }>;
  try {
    let text = result.text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    days = JSON.parse(text);
    if (!Array.isArray(days)) throw new Error('Not an array');
  } catch {
    logger.warn({ raw: result.text.slice(0, 300) }, 'Content plan AI returned non-JSON');
    throw new Error('Failed to generate content plan — AI returned invalid format');
  }

  // Create plan
  const planId = uuid();
  const title = `${topic} — ${niche}`;
  db.prepare(`INSERT INTO content_plans (id, user_id, title, topic, niche, status)
    VALUES (?, ?, ?, ?, ?, 'draft')`)
    .run(planId, userId, title, topic, niche);

  // Create items
  const insertItem = db.prepare(`INSERT INTO content_plan_items (id, plan_id, day_number, slot, caption)
    VALUES (?, ?, ?, ?, ?)`);

  for (const day of days.slice(0, 10)) {
    const dayNum = typeof day.day === 'number' ? day.day : days.indexOf(day) + 1;
    const slots = Array.isArray(day.slots) ? day.slots.slice(0, 2) : [];

    for (const s of slots) {
      const slotNum = typeof s.slot === 'number' ? Math.min(2, Math.max(1, s.slot)) : slots.indexOf(s) + 1;
      let caption = String(s.caption || '');
      // Enforce branding
      if (!caption.includes('Powered by Agentin')) {
        caption += '\n\nPowered by Agentin';
      }
      insertItem.run(uuid(), planId, dayNum, slotNum, caption);
    }
  }

  return getContentPlan(planId, userId)!;
}

// ---- Plan Item Update ----

export function updateContentPlanItem(itemId: string, userId: string, updates: {
  caption?: string;
  media_id?: string;
  enabled?: boolean;
}): ContentPlanItem {
  const item = db.prepare(`
    SELECT i.* FROM content_plan_items i
    JOIN content_plans p ON p.id = i.plan_id
    WHERE i.id = ? AND p.user_id = ?
  `).get(itemId, userId) as ContentPlanItem | undefined;
  if (!item) throw new Error('Item not found');

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.caption !== undefined) {
    let caption = updates.caption;
    if (!caption.includes('Powered by Agentin')) {
      caption += '\n\nPowered by Agentin';
    }
    fields.push('caption = ?');
    values.push(caption);
  }

  if (updates.media_id !== undefined) {
    fields.push('media_id = ?');
    values.push(updates.media_id);

    // Resolve media info
    if (updates.media_id) {
      const resolved = resolveMediaUrl(userId, updates.media_id);
      if (resolved) {
        fields.push('media_type = ?', 'media_url = ?');
        values.push(resolved.type, resolved.url);
      }
    } else {
      fields.push('media_type = ?', 'media_url = ?');
      values.push('', '');
    }
  }

  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }

  if (fields.length) {
    values.push(itemId);
    db.prepare(`UPDATE content_plan_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  return db.prepare('SELECT * FROM content_plan_items WHERE id = ?').get(itemId) as ContentPlanItem;
}

// ---- Media Resolution ----

export function resolveMediaUrl(userId: string, mediaId: string): { type: string; url: string } | null {
  if (mediaId.startsWith('img-')) {
    const realId = mediaId.slice(4);
    const img = db.prepare(
      "SELECT image_url FROM user_images WHERE id = ? AND user_id = ? AND expires_at > datetime('now')"
    ).get(realId, userId) as { image_url: string } | undefined;
    if (img) return { type: 'image', url: img.image_url };
  }

  if (mediaId.startsWith('vid-')) {
    const realId = mediaId.slice(4);
    const vid = db.prepare(
      "SELECT video_url FROM user_videos WHERE id = ? AND user_id = ? AND expires_at > datetime('now') AND status = 'ready'"
    ).get(realId, userId) as { video_url: string } | undefined;
    if (vid) return { type: 'video', url: vid.video_url };
  }

  return null;
}

// ---- Plan Activation ----

export function activateContentPlan(planId: string, userId: string, startDate: string, socialAccountId: string, postingTimes?: string[]): ContentPlan {
  const plan = db.prepare('SELECT * FROM content_plans WHERE id = ? AND user_id = ?')
    .get(planId, userId) as ContentPlan | undefined;
  if (!plan) throw new Error('Plan not found');
  if (plan.status === 'active') throw new Error('Plan is already active');

  // Verify account exists
  const account = db.prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?')
    .get(socialAccountId, userId) as SocialAccount | undefined;
  if (!account) throw new Error('Social account not found');

  const times = postingTimes?.length ? postingTimes : ['10:00', '18:00'];

  // Get items
  const items = db.prepare('SELECT * FROM content_plan_items WHERE plan_id = ? AND enabled = 1 ORDER BY day_number, slot')
    .all(planId) as ContentPlanItem[];

  const start = new Date(startDate);
  const updateItem = db.prepare("UPDATE content_plan_items SET scheduled_at = ?, status = 'scheduled' WHERE id = ?");

  for (const item of items) {
    const dayOffset = item.day_number - 1;
    const timeStr = times[Math.min(item.slot - 1, times.length - 1)] || '10:00';
    const [hours, minutes] = timeStr.split(':').map(Number);

    const scheduledDate = new Date(start);
    scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
    scheduledDate.setHours(hours, minutes, 0, 0);

    const scheduledAt = scheduledDate.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    updateItem.run(scheduledAt, item.id);
  }

  // Update plan
  db.prepare("UPDATE content_plans SET status = 'active', social_account_id = ?, start_date = ? WHERE id = ?")
    .run(socialAccountId, startDate, planId);

  return getContentPlan(planId, userId)!;
}

// ---- Post Execution ----

export async function executeAutoPost(item: ContentPlanItem, account: SocialAccount): Promise<string> {
  let caption = item.caption;
  if (!caption.includes('Powered by Agentin')) {
    caption += '\n\nPowered by Agentin';
  }

  if (account.posting_method === 'webhook') {
    if (!account.webhook_url) throw new Error('No webhook URL configured');

    const payload = {
      media_url: item.media_url || null,
      caption,
      platform: account.platform,
      media_type: item.media_type || 'text',
      scheduled_at: item.scheduled_at,
    };

    const res = await fetch(account.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Webhook returned ${res.status}: ${body.slice(0, 200)}`);
    }

    return `Posted via webhook (${res.status})`;
  }

  // API mode
  const accessToken = account.access_token_encrypted ? decrypt(account.access_token_encrypted) : '';
  if (!accessToken) throw new Error('No access token configured');

  if (account.platform === 'instagram') {
    return await postToInstagram(account.page_id, accessToken, caption, item.media_url, item.media_type);
  } else {
    return await postToFacebook(account.page_id, accessToken, caption, item.media_url, item.media_type);
  }
}

async function postToInstagram(pageId: string, accessToken: string, caption: string, mediaUrl: string, mediaType: string): Promise<string> {
  const baseUrl = 'https://graph.facebook.com/v19.0';

  // Step 1: Create media container
  const containerParams: Record<string, string> = {
    caption,
    access_token: accessToken,
  };

  if (mediaUrl && mediaType === 'image') {
    containerParams.image_url = mediaUrl;
  } else if (mediaUrl && mediaType === 'video') {
    containerParams.media_type = 'VIDEO';
    containerParams.video_url = mediaUrl;
  } else {
    throw new Error('Instagram requires media (image or video)');
  }

  const createRes = await fetch(`${baseUrl}/${pageId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerParams),
    signal: AbortSignal.timeout(30000),
  });

  if (!createRes.ok) {
    const err = await createRes.text().catch(() => '');
    throw new Error(`Instagram container creation failed: ${err.slice(0, 200)}`);
  }

  const { id: containerId } = await createRes.json() as { id: string };

  // Step 2: Publish
  const publishRes = await fetch(`${baseUrl}/${pageId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    signal: AbortSignal.timeout(30000),
  });

  if (!publishRes.ok) {
    const err = await publishRes.text().catch(() => '');
    throw new Error(`Instagram publish failed: ${err.slice(0, 200)}`);
  }

  const { id: mediaId } = await publishRes.json() as { id: string };
  return `Posted to Instagram (media_id: ${mediaId})`;
}

async function postToFacebook(pageId: string, accessToken: string, caption: string, mediaUrl: string, mediaType: string): Promise<string> {
  const baseUrl = 'https://graph.facebook.com/v19.0';

  if (mediaUrl && mediaType === 'image') {
    const res = await fetch(`${baseUrl}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mediaUrl, caption, access_token: accessToken }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Facebook photo post failed: ${res.status}`);
    const { id } = await res.json() as { id: string };
    return `Posted photo to Facebook (id: ${id})`;
  }

  if (mediaUrl && mediaType === 'video') {
    const res = await fetch(`${baseUrl}/${pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_url: mediaUrl, description: caption, access_token: accessToken }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`Facebook video post failed: ${res.status}`);
    const { id } = await res.json() as { id: string };
    return `Posted video to Facebook (id: ${id})`;
  }

  // Text-only post
  const res = await fetch(`${baseUrl}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: caption, access_token: accessToken }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Facebook post failed: ${res.status}`);
  const { id } = await res.json() as { id: string };
  return `Posted to Facebook (id: ${id})`;
}

// ---- Scheduled Post Checker (called from pico-fleet tick) ----

export async function checkDueSocialPosts(): Promise<void> {
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

  const dueItems = db.prepare(`
    SELECT i.*, p.user_id, p.social_account_id
    FROM content_plan_items i
    JOIN content_plans p ON p.id = i.plan_id
    WHERE i.status = 'scheduled'
      AND i.enabled = 1
      AND i.scheduled_at <= ?
      AND p.status = 'active'
    ORDER BY i.scheduled_at ASC
    LIMIT 10
  `).all(now) as (ContentPlanItem & { user_id: string; social_account_id: string })[];

  for (const item of dueItems) {
    try {
      // Enforce max 2 posts per day per user
      const today = now.slice(0, 10);
      const todayCount = db.prepare(`
        SELECT COUNT(*) as c FROM content_plan_items i
        JOIN content_plans p ON p.id = i.plan_id
        WHERE p.user_id = ? AND i.status = 'posted'
          AND i.posted_at LIKE ?
      `).get(item.user_id, `${today}%`) as { c: number };

      if (todayCount.c >= 2) {
        logger.info({ userId: item.user_id, itemId: item.id }, 'Max 2 posts/day reached — skipping');
        continue;
      }

      // Validate media if assigned
      if (item.media_id) {
        const resolved = resolveMediaUrl(item.user_id, item.media_id);
        if (!resolved) {
          db.prepare("UPDATE content_plan_items SET status = 'failed', error_message = 'Media expired or not found' WHERE id = ?")
            .run(item.id);
          continue;
        }
        // Update URL in case it changed
        db.prepare('UPDATE content_plan_items SET media_url = ?, media_type = ? WHERE id = ?')
          .run(resolved.url, resolved.type, item.id);
        item.media_url = resolved.url;
        item.media_type = resolved.type;
      }

      // Get account
      const account = db.prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ? AND status = ?')
        .get(item.social_account_id, item.user_id, 'active') as SocialAccount | undefined;
      if (!account) {
        db.prepare("UPDATE content_plan_items SET status = 'failed', error_message = 'Account not found or paused' WHERE id = ?")
          .run(item.id);
        continue;
      }

      // Mark as posting
      db.prepare("UPDATE content_plan_items SET status = 'posting' WHERE id = ?").run(item.id);

      // Execute post
      const result = await executeAutoPost(item, account);

      // Success
      const postedAt = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
      db.prepare("UPDATE content_plan_items SET status = 'posted', posted_at = ? WHERE id = ?")
        .run(postedAt, item.id);
      db.prepare('UPDATE social_accounts SET posts_count = posts_count + 1, last_post_at = ? WHERE id = ?')
        .run(postedAt, account.id);

      logger.info({ itemId: item.id, result }, 'Social media post published');

      // Check if all items are done
      const remaining = db.prepare(
        "SELECT COUNT(*) as c FROM content_plan_items WHERE plan_id = ? AND status IN ('draft', 'scheduled', 'posting') AND enabled = 1"
      ).get(item.plan_id) as { c: number };
      if (remaining.c === 0) {
        db.prepare("UPDATE content_plans SET status = 'completed' WHERE id = ?").run(item.plan_id);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      db.prepare("UPDATE content_plan_items SET status = 'failed', error_message = ? WHERE id = ?")
        .run(errorMsg.slice(0, 500), item.id);
      logger.error({ itemId: item.id, error: errorMsg }, 'Social media post failed');
    }
  }
}

// ---- Manual Post Trigger ----

export async function manualPostItem(itemId: string, userId: string): Promise<string> {
  const item = db.prepare(`
    SELECT i.*, p.user_id, p.social_account_id
    FROM content_plan_items i
    JOIN content_plans p ON p.id = i.plan_id
    WHERE i.id = ? AND p.user_id = ?
  `).get(itemId, userId) as (ContentPlanItem & { user_id: string; social_account_id: string }) | undefined;
  if (!item) throw new Error('Item not found');
  if (!item.social_account_id) throw new Error('No social account linked to this plan');

  const account = db.prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?')
    .get(item.social_account_id, userId) as SocialAccount | undefined;
  if (!account) throw new Error('Social account not found');

  // Resolve media
  if (item.media_id) {
    const resolved = resolveMediaUrl(userId, item.media_id);
    if (resolved) {
      item.media_url = resolved.url;
      item.media_type = resolved.type;
    }
  }

  db.prepare("UPDATE content_plan_items SET status = 'posting' WHERE id = ?").run(itemId);

  try {
    const result = await executeAutoPost(item, account);
    const postedAt = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    db.prepare("UPDATE content_plan_items SET status = 'posted', posted_at = ? WHERE id = ?")
      .run(postedAt, itemId);
    db.prepare('UPDATE social_accounts SET posts_count = posts_count + 1, last_post_at = ? WHERE id = ?')
      .run(postedAt, account.id);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    db.prepare("UPDATE content_plan_items SET status = 'failed', error_message = ? WHERE id = ?")
      .run(errorMsg.slice(0, 500), itemId);
    throw err;
  }
}

// ---- Pico Fleet Bridge ----

export async function executeSocialMediaPostTask(userId: string, taskConfig: Record<string, unknown>): Promise<string> {
  const planId = String(taskConfig.plan_id || '');
  const itemId = String(taskConfig.item_id || '');

  if (itemId) {
    return await manualPostItem(itemId, userId);
  }

  if (planId) {
    // Trigger check for due posts in this plan
    await checkDueSocialPosts();
    return 'Checked and posted due social media items';
  }

  await checkDueSocialPosts();
  return 'Social media post check completed';
}
