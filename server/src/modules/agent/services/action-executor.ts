/**
 * Action Executor -- Runs Validated Tool Actions Against the DB
 *
 * Bridges the gap between LLM-emitted tool calls (parsed by
 * `action-parser.ts`) and actual side effects: database writes,
 * media generation, web searches, email sending, etc.
 *
 * Each tool name maps to a branch in the internal `runAction` switch
 * that performs the operation and returns an {@link ActionResult} with
 * success/failure status, a human-readable message, optional artifact
 * IDs, and optional receipt data for visual confirmation cards.
 *
 * The public entry point is {@link executeAction}, which wraps
 * `runAction` with timing, logging, and error handling so callers
 * (primarily the ReAct loop) never receive an unhandled throw.
 *
 * **Security note:** All DB operations are scoped to the authenticated
 * `userId` passed by the caller. The executor trusts action params
 * as-is since they originate from the LLM's tool-call output and the
 * user's own conversation context.
 *
 * @module services/action-executor
 */

import { v4 as uuid } from 'uuid';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { sendAgentEmail, resolveEmailAddress } from '../../../services/email.js';
import { parseReminderTime } from './pico-fleet.js';
import { DateTime } from 'luxon';
import type { ParsedAction } from '../../../services/action-parser.js';
import { config } from '../../../config.js';
import { RECEIPT_TEMPLATES, type ReceiptItem } from '../../../services/receipts.js';
import { generateImage, generateVideo, generateAvatar } from '../../../services/media-generation.js';
import { cacheSet, cacheGet, cacheDel } from '../../../services/cache.js';
import { sendTelegramNotification, escapeTelegramHtml, sendTelegramButtons } from '../../../services/telegram.js';
import { tavilySearch } from '../../../services/tavily.js';
import { searxngSearch } from '../../../services/searxng.js';
import { fetchAndExtract, fetchScreenshot, extractLinks, smartSearch } from '../../../services/web-research.js';
import { indexNote, indexReminder, indexHabit, indexMemory } from '../../../services/search-index.js';
import { semanticSearch, upsertMemoryVector } from '../../../services/search-vector.js';
import { eventBus } from '../../../services/event-bus.js';

// ── Hinglish Preprocessor ────────────────────────────────────

// Pre-process Hinglish time expressions into English before LLM datetime parsing
export function hinglishToEnglish(text: string): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const todayDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return text
    .replace(/\bkal\b/gi, `tomorrow (${tomorrowDate})`)
    .replace(/\baaj\b/gi, `today (${todayDate})`)
    .replace(/\bsubah\b/gi, 'morning')
    .replace(/\bshaam\b/gi, 'evening 6pm')
    .replace(/\braat\b/gi, 'night 10pm')
    .replace(/\bduphar\b/gi, 'afternoon 2pm')
    .replace(/(\d+)\s*baj[ae]?/gi, "$1 o'clock")
    .replace(/\bdo ghante\b/gi, '2 hours')
    .replace(/\bek ghante?\b/gi, '1 hour')
    .replace(/\bteen ghante?\b/gi, '3 hours')
    .replace(/\bbaad mein\b/gi, 'later');
}

// Indian merchant → category mapping
const INDIAN_MERCHANT_CATS: Record<string, string> = {
  swiggy: 'food', zomato: 'food', dunzo: 'food', blinkit: 'food', zepto: 'food',
  'big basket': 'food', bigbasket: 'food', instamart: 'food',
  ola: 'transport', uber: 'transport', rapido: 'transport', metro: 'transport',
  amazon: 'shopping', flipkart: 'shopping', meesho: 'shopping', myntra: 'shopping',
  ajio: 'shopping', nykaa: 'shopping', dmart: 'shopping',
  netflix: 'entertainment', prime: 'entertainment', hotstar: 'entertainment',
  jiocinema: 'entertainment', spotify: 'entertainment', gaana: 'entertainment',
  pharmeasy: 'health', netmeds: 'health', 'apollo pharmacy': 'health',
  aws: 'tech', digitalocean: 'tech', hostinger: 'tech',
  jio: 'utilities', airtel: 'utilities', electricity: 'utilities', bsnl: 'utilities',
};

// ── Types ───────────────────────────────────────────────────

export interface ActionResult {
  tool: string;
  success: boolean;
  message: string;
  artifactId?: string;
  previewUrl?: string;
  imageUrl?: string;  // Set by generate_image / generate_avatar actions
  imageId?: string;   // DB id of saved image in user_images table
  videoUrl?: string;  // Set by generate_video action
  data?: Record<string, unknown>;
  receipt?: ReceiptItem; // Visual confirmation of action taken
  cardSent?: boolean;    // True when a Telegram inline card was sent — caller should skip duplicate text
}

// ── Portfolio cache helper ───────────────────────────────────
// 48.2: Invalidate public portfolio cache after AI-driven portfolio writes
async function invalidatePortfolioCache(userId: string): Promise<void> {
  try {
    const row = db.prepare('SELECT username FROM portfolios WHERE user_id = ?').get(userId) as { username: string } | undefined;
    if (row?.username) await cacheDel(`portfolio:${row.username}`);
    // Also invalidate by users.username in case portfolios.username differs
    const userRow = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined;
    if (userRow?.username && userRow.username !== row?.username) await cacheDel(`portfolio:${userRow.username}`);
  } catch { /* non-fatal */ }
}

// ── Executor ────────────────────────────────────────────────

async function runAction(userId: string, tool: string, params: ParsedAction['params']): Promise<ActionResult> {
  switch (tool) {
      // ── generate_code ───────────────────────────────────
      case 'generate_code': {
        let html = (params.html as string) || '';
        let css = (params.css as string) || '';
        let js = (params.js as string) || '';
        let title = params.title as string;

        const existingArtifactId = params.existingArtifactId as string | undefined;
        const baseUrl = params.baseUrl as string | undefined;

        // For edits: load stored template params and merge with LLM overrides
        // so e.g. "change theme to blue" doesn't lose name/profession/etc.
        let storedTemplateParams: Record<string, unknown> = {};
        let existingHtml: string | undefined;
        if (existingArtifactId && !html) {
          const existingArtifact = db.prepare(
            'SELECT html, metadata FROM generated_artifacts WHERE id = ? AND user_id = ?'
          ).get(existingArtifactId, userId) as { html: string; metadata: string } | undefined;
          if (existingArtifact) {
            existingHtml = existingArtifact.html || undefined;
            if (existingArtifact.metadata) {
              try { storedTemplateParams = JSON.parse(existingArtifact.metadata); } catch { /* ignore */ }
            }
          }
        }

        if (!html) {
          const userPrompt = params.prompt as string | undefined;

          if (userPrompt) {
            // ── Prompt-based path: LLM generates custom HTML from the user's actual request ──
            // Used for freeform requests like "hello world futuristic", "calculator app", "snake game".
            const { routeChat } = await import('./llm.js');
            const sysPrompt = [
              'You are an expert web developer. Generate a complete, self-contained HTML page.',
              'Rules:',
              '- Output ONLY valid HTML starting with <!DOCTYPE html> and ending with </html>.',
              '- Embed ALL CSS inside a <style> tag in <head>.',
              '- Embed ALL JavaScript inside a <script> tag before </body>.',
              '- Make it visually impressive and match the user\'s description exactly.',
              '- Do NOT output markdown, code fences, or any explanation — raw HTML only.',
            ].join('\n');
            try {
              // When editing an existing custom artifact, pass the existing HTML so the
              // LLM can modify it rather than generate a new page from scratch.
              const userContent = existingHtml
                ? `Here is the existing webpage code:\n\`\`\`html\n${existingHtml.slice(0, 8000)}\n\`\`\`\n\nThe user wants to change: ${userPrompt}\n\nReturn the complete updated HTML with the requested changes applied. Keep all existing functionality intact.`
                : `Build this website: ${userPrompt}`;
              const llmResult = await routeChat(
                [{ role: 'user', content: userContent }],
                { systemPrompt: sysPrompt, userCredits: 200 },
              );
              // Strip markdown code fences if the model wrapped the output
              const raw = llmResult.reply.trim()
                .replace(/^```(?:html)?\r?\n?/i, '')
                .replace(/\r?\n?```$/i, '');
              html = (raw.startsWith('<!') || raw.toLowerCase().startsWith('<html'))
                ? raw
                : `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${userPrompt.slice(0, 60)}</title><style>body{margin:0;font-family:sans-serif}</style></head><body>${raw}</body></html>`;
              title = title || userPrompt.slice(0, 60);
              css = '';
              js = '';
            } catch (err) {
              logger.warn({ err }, 'generate_code LLM generation failed, falling back to template');
              // Fall through to template render below
            }
          }

          // ── Template-based path: structured params → pre-built site template ──
          // Used when LLM provides structured params (name/theme/template) for personal pages.
          if (!html) {
            const merged = { ...storedTemplateParams, ...params };
            const { renderWebsiteTemplate } = await import('../../../services/website-templates.js');
            const rendered = renderWebsiteTemplate({
              template: (merged.template as 'portfolio' | 'landing' | 'blog' | 'business') || 'portfolio',
              title: merged.title as string | undefined,
              name: merged.name as string | undefined,
              theme: merged.theme as 'dark' | 'light' | 'purple' | 'blue' | 'gradient' | undefined,
              profession: merged.profession as string | undefined,
              location: merged.location as string | undefined,
              bio: merged.bio as string | undefined,
              skills: merged.skills as string[] | undefined,
              email: merged.email as string | undefined,
              tagline: merged.tagline as string | undefined,
              productName: merged.productName as string | undefined,
              description: merged.description as string | undefined,
              features: merged.features as string[] | undefined,
              cta: merged.cta as string | undefined,
            });
            html = rendered.html;
            css = rendered.css;
            js = rendered.js;
            title = title || rendered.title;
            storedTemplateParams = merged;
          }
        }

        const selfDestruct = params.selfDestruct as boolean | undefined;
        const templateMetadata = JSON.stringify(storedTemplateParams);

        // Check if we should update an existing artifact (builder "edit" flow)
        if (existingArtifactId) {
          const existing = db.prepare(
            'SELECT id FROM generated_artifacts WHERE id = ? AND user_id = ?'
          ).get(existingArtifactId, userId) as { id: string } | undefined;

          if (existing) {
            db.prepare(
              `UPDATE generated_artifacts SET title = ?, html = ?, css = ?, js = ?, metadata = ? WHERE id = ? AND user_id = ?`
            ).run(title, html, css, js, templateMetadata, existingArtifactId, userId);

            const previewUrl = baseUrl ? `${baseUrl}/preview/${userId}/${existingArtifactId}` : undefined;
            return {
              tool,
              success: true,
              message: `Updated project "${title}"${previewUrl ? `. Live preview: ${previewUrl}` : ''}`,
              artifactId: existingArtifactId,
              previewUrl,
              data: { title, html, css, js, previewUrl, updated: true },
              receipt: previewUrl
                ? RECEIPT_TEMPLATES.website(title, previewUrl)
                : RECEIPT_TEMPLATES.project(title),
            };
          }
          // Fall through to create new if existing artifact not found
        }

        const id = uuid();

        // Calculate expiration (48 hours only if explicitly self-destruct, otherwise permanent)
        const expiresAt = selfDestruct === true
          ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          : null;

        db.prepare(
          `INSERT INTO generated_artifacts (id, user_id, type, title, html, css, js, metadata, expires_at)
           VALUES (?, ?, 'code', ?, ?, ?, ?, ?, ?)`,
        ).run(id, userId, title, html, css, js, templateMetadata, expiresAt);

        // Build preview URL if baseUrl provided
        const previewUrl = baseUrl ? `${baseUrl}/preview/${userId}/${id}` : undefined;

        // Auto-add to portfolio projects so user sees it in their dashboard
        try {
          const portfolio = db.prepare('SELECT projects FROM portfolios WHERE user_id = ?').get(userId) as { projects: string } | undefined;
          if (portfolio) {
            const projects = JSON.parse(portfolio.projects || '[]') as unknown[];
            projects.push({
              id: uuid(),
              name: title,
              description: 'Generated by AI assistant',
              tags: ['generated', 'ai'],
              liveUrl: previewUrl || '',
              repoUrl: '',
            });
            db.prepare('UPDATE portfolios SET projects = ? WHERE user_id = ?')
              .run(JSON.stringify(projects), userId);
            await invalidatePortfolioCache(userId); // 48.2
          }
        } catch { /* non-fatal */ }

        const result: ActionResult = {
          tool,
          success: true,
          message: `Created project "${title}"${previewUrl ? `. Live preview: ${previewUrl}` : ''}`,
          artifactId: id,
          previewUrl,
          data: { title, html, css, js, previewUrl },
          receipt: previewUrl
            ? RECEIPT_TEMPLATES.website(title, previewUrl)
            : RECEIPT_TEMPLATES.project(title),
        };
        return result;
      }

      // ── portfolio_add_project ───────────────────────────
      case 'portfolio_add_project': {
        const row = db.prepare(
          `SELECT projects FROM portfolios WHERE user_id = ?`,
        ).get(userId) as { projects: string } | undefined;

        let projects: unknown[] = [];
        try { projects = row ? JSON.parse(row.projects) : []; } catch { projects = []; }

        projects.push({
          id: uuid(),
          name: params.title as string,
          description: (params.description as string) || '',
          tags: (params.tags as string[]) || [],
          liveUrl: (params.liveUrl as string) || '',
          repoUrl: (params.repoUrl as string) || '',
        });

        db.prepare(
          `UPDATE portfolios SET projects = ? WHERE user_id = ?`,
        ).run(JSON.stringify(projects), userId);
        await invalidatePortfolioCache(userId); // 48.2

        return {
          tool,
          success: true,
          message: `Added project "${params.title}" to portfolio`,
          receipt: RECEIPT_TEMPLATES.project(params.title as string),
        };
      }

      // ── portfolio_update_bio ────────────────────────────
      case 'portfolio_update_bio': {
        db.prepare(
          `UPDATE portfolios SET about = ? WHERE user_id = ?`,
        ).run(params.bio as string, userId);
        await invalidatePortfolioCache(userId); // 48.2

        return {
          tool,
          success: true,
          message: 'Portfolio bio updated',
          receipt: RECEIPT_TEMPLATES.memory('Portfolio bio'),
        };
      }

      // ── portfolio_update_skills ─────────────────────────
      case 'portfolio_update_skills': {
        db.prepare(
          `UPDATE portfolios SET skills = ? WHERE user_id = ?`,
        ).run(JSON.stringify(params.skills as string[]), userId);
        await invalidatePortfolioCache(userId); // 48.2

        return {
          tool,
          success: true,
          message: 'Portfolio skills updated',
          receipt: RECEIPT_TEMPLATES.memory('Portfolio skills'),
        };
      }

      // ── portfolio_remove_project ────────────────────────
      case 'portfolio_remove_project': {
        const row = db.prepare(
          `SELECT projects FROM portfolios WHERE user_id = ?`,
        ).get(userId) as { projects: string } | undefined;

        let projects: { name: string; [key: string]: unknown }[] = [];
        try { projects = row ? JSON.parse(row.projects) : []; } catch { projects = []; }

        const targetTitle = (params.projectTitle as string).toLowerCase();
        const filtered = projects.filter(
          (p) => p.name.toLowerCase() !== targetTitle,
        );

        if (filtered.length === projects.length) {
          return {
            tool,
            success: false,
            message: `Project "${params.projectTitle}" not found in portfolio`,
          };
        }

        db.prepare(
          `UPDATE portfolios SET projects = ? WHERE user_id = ?`,
        ).run(JSON.stringify(filtered), userId);
        await invalidatePortfolioCache(userId); // 48.2

        return {
          tool,
          success: true,
          message: `Removed project "${params.projectTitle}" from portfolio`,
        };
      }

      // ── portfolio_update_theme ──────────────────────────
      case 'portfolio_update_theme': {
        const accentColor = params.accentColor as string | undefined;
        const mode = (params.mode as string | undefined) || 'dark';
        db.prepare(`UPDATE users SET theme_mode = ?, theme_accent = ? WHERE id = ?`)
          .run(mode, accentColor || '#7B61FF', userId);
        return {
          tool,
          success: true,
          message: `App theme updated${accentColor ? ` (accent: ${accentColor})` : ''}`,
        };
      }

      // ── send_email ──────────────────────────────────────
      case 'send_email': {
        const emailTo = (params.to as string)?.trim() || resolveEmailAddress(userId);
        const emailSubject = (params.subject as string)?.trim();
        const emailBody = (params.body as string)?.trim();

        if (!emailTo) {
          return { tool, success: false, message: 'No recipient email address. Specify who to send to.' };
        }
        if (!emailSubject || !emailBody) {
          return { tool, success: false, message: 'Subject and body are required.' };
        }

        // Try Gmail first (user's own account), fall back to Resend
        let sent = false;
        const gmailToken = db.prepare('SELECT google_gmail_token FROM users WHERE id = ?').get(userId) as { google_gmail_token: string | null } | undefined;
        if (gmailToken?.google_gmail_token) {
          try {
            const { sendGmailCompose } = await import('../../../services/gmail-sync.js');
            sent = await sendGmailCompose(userId, emailTo, emailSubject, emailBody);
          } catch { /* fall through to Resend */ }
        }

        if (!sent) {
          sent = await sendAgentEmail(userId, emailSubject, emailBody);
        }

        if (!sent) {
          return { tool, success: false, message: 'Email could not be sent. Connect Gmail in Settings for better delivery.' };
        }

        return {
          tool,
          success: true,
          message: `Email sent to ${emailTo}`,
          data: { to: emailTo, subject: emailSubject },
          receipt: RECEIPT_TEMPLATES.email(emailTo),
        };
      }

      // ── set_reminder ────────────────────────────────────────
      case 'set_reminder': {
        const text = hinglishToEnglish(params.text as string);
        const reminderId = uuid();
        const userRow = db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as { timezone?: string } | undefined;
        const userTimezone = userRow?.timezone || 'Asia/Kolkata';
        // LLMs are unreliable at timezone math — never trust a computed UTC datetime from an LLM.
        // Strategy:
        //   1. LLM passes explicit UTC offset (Z / +HH:MM) → trust it, convert to UTC
        //   2. LLM passes ISO without timezone ("2026-03-08 10:00:00") → treat as user's LOCAL time, convert
        //   3. LLM passes bare expression ("3:30am", "tomorrow at 9") → parseReminderTime (server handles tz)
        //   4. Nothing → parseReminderTime from reminder text
        const rawDatetime = params.datetime as string | undefined;
        let dueAt: string | null;
        const toUtcSqlite = (dt: DateTime) => dt.toUTC().toISO()!.replace('T', ' ').replace(/\.\d{3}Z$/, '');
        if (!rawDatetime) {
          // No datetime from LLM — extract from the reminder text
          dueAt = parseReminderTime(text, userTimezone);
        } else if (/[Zz]$|[+-]\d{2}:\d{2}$/.test(rawDatetime)) {
          // Has explicit UTC offset → trust it
          const dt = DateTime.fromISO(rawDatetime);
          dueAt = dt.isValid ? toUtcSqlite(dt) : parseReminderTime(text, userTimezone);
        } else if (rawDatetime.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(rawDatetime)) {
          // ISO without timezone (LLM computed) → interpret as user's local time
          const dt = DateTime.fromISO(rawDatetime.replace(' ', 'T'), { zone: userTimezone });
          dueAt = dt.isValid ? toUtcSqlite(dt) : parseReminderTime(text, userTimezone);
        } else {
          // Bare time expression ("3:30am", "tomorrow", "in 2 hours") → server parses with user tz
          dueAt = parseReminderTime(rawDatetime, userTimezone);
        }
        // Calculate epoch ms for drift tracking
        const scheduledFor = dueAt ? new Date(dueAt).getTime() : Date.now();

        // Use user-specified channel, or auto-detect from linked accounts
        let channel = (params.channel as string) || 'push';
        if (!params.channel) {
          const hasChannel = db.prepare(
            "SELECT 1 FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
          ).get(userId);
          if (hasChannel) channel = 'telegram';
        }
        const category = (params.category as string) || 'general';

        // ── Smart Reminders V2: detect recurrence patterns ─────────────────
        // Detect "every day", "everyday", "daily", "each day", "weekly", "every Monday", "every week"
        let recurrence: string | null = null;
        const lowerText = text.toLowerCase();
        if (/\b(every\s+day|everyday|daily|each\s+day|cada\s+dia|roz|har\s+roz)\b/i.test(lowerText)) {
          recurrence = 'daily';
        } else if (/\bevery\s+(morning|evening|night|noon)\b/i.test(lowerText)) {
          recurrence = 'daily';
        } else if (/\b(every\s+week|weekly|once\s+a\s+week)\b/i.test(lowerText) ||
                   /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lowerText)) {
          recurrence = 'weekly';
        } else if (/\b(every\s+month|monthly|once\s+a\s+month)\b/i.test(lowerText)) {
          recurrence = 'monthly';
        } else if (/\b(every\s+year|yearly|annually|once\s+a\s+year)\b/i.test(lowerText)) {
          recurrence = 'yearly';
        }

        db.prepare(
          'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurrence, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(reminderId, userId, text, dueAt, channel, category, recurrence, 'agent', scheduledFor);

        db.prepare(
          `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created reminder', ?, 'bell')`
        ).run(uuid(), userId, text);
        // Index in Meilisearch (async)
        indexReminder(userId, reminderId, text).catch(() => {});

        eventBus.emit('reminder.created', { userId, reminderId, text });

        const recurMsg = recurrence ? ` (repeats ${recurrence})` : '';

        // Send inline keyboard confirmation via Telegram (non-blocking)
        const tgLink = db.prepare(
          "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 ORDER BY linked_at DESC LIMIT 1"
        ).get(userId) as { external_id: string } | undefined;
        if (tgLink) {
          const timeLabel = dueAt
            ? new Date(dueAt).toLocaleString('en-IN', { timeZone: userTimezone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'soon';
          void sendTelegramButtons(
            tgLink.external_id,
            `🔔 Reminder set: "${text}"\n⏰ ${timeLabel}${recurMsg}`,
            [[
              { text: '✅ Done', callback_data: `reminder:done:${reminderId}` },
              { text: '💤 Snooze 1h', callback_data: `reminder:snooze:${reminderId}` },
              { text: '🗑️ Delete', callback_data: `reminder:delete:${reminderId}` },
            ]],
          );
        }

        return {
          tool,
          success: true,
          message: `Reminder set: "${text}"${dueAt ? ` at ${dueAt}` : ''}${recurMsg}`,
          data: { reminderId, text, datetime: dueAt, channel, recurrence },
          receipt: RECEIPT_TEMPLATES.reminder(text, dueAt || 'soon'),
          cardSent: !!tgLink,  // if card was sent via Telegram, skip duplicate text
        };
      }

      // ── crawl_url ─────────────────────────────────────────
      case 'crawl_url':
      case 'web_fetch': {
        const url = params.url as string;
        try {
          const content = await fetchAndExtract(url);
          return {
            tool,
            success: true,
            message: `Fetched ${url} — ${content.length} chars`,
            // Use 'summary' key so react-loop injects full content (not 1000-char JSON truncation)
            data: { url, summary: content },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: err instanceof Error ? err.message : `Failed to fetch ${url}`,
          };
        }
      }

      // ── trigger_workflow ──────────────────────────────────
      case 'trigger_workflow': {
        const flowPath = params.flowPath as string;
        const payload = (params.payload as Record<string, unknown>) || {};

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.windmillToken) {
          headers['Authorization'] = `Bearer ${config.windmillToken}`;
        }

        const resp = await fetch(
          `${config.windmillUrl}/api/w/admins/jobs/run/f/${flowPath}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          },
        );

        if (!resp.ok) {
          const body = await resp.text();
          return {
            tool,
            success: false,
            message: `Workflow trigger failed (${resp.status}): ${body.slice(0, 200)}`,
          };
        }

        const jobId = await resp.text();
        return {
          tool,
          success: true,
          message: `Workflow "${flowPath}" triggered — job ${jobId}`,
          data: { flowPath, jobId },
          receipt: RECEIPT_TEMPLATES.automation(flowPath),
        };
      }

      // ── generate_image ──────────────────────────────────────
      case 'generate_image': {
        const prompt = params.prompt as string;
        const width = params.width as number | undefined;
        const height = params.height as number | undefined;

        // Look up user's preferred image model from agent_configs
        const agentCfg = db.prepare(
          'SELECT preferred_image_model FROM agent_configs WHERE user_id = ?'
        ).get(userId) as { preferred_image_model?: string } | undefined;
        const preferredModel = agentCfg?.preferred_image_model || 'auto';

        // Map preference to forceProvider
        const forceProvider: 'pollinations' | 'huggingface' | undefined =
          preferredModel === 'huggingface-flux' ? 'huggingface' :
          preferredModel === 'pollinations' ? 'pollinations' :
          undefined;

        const result = await generateImage(prompt, { width, height, forceProvider });

        if (!result.success) {
          return {
            tool,
            success: false,
            message: `Image generation failed: ${result.error}`,
          };
        }

        // Persist to user_images table so image appears in dashboard gallery
        const imageId = `img-${uuid().slice(0, 12)}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        try {
          db.prepare(`
            INSERT INTO user_images (id, user_id, prompt, model, image_url, width, height, source, expires_at)
            VALUES (?, ?, ?, ?, ?, 1024, 1024, 'generated', ?)
          `).run(imageId, userId, prompt, 'huggingface-flux', result.url, expiresAt);
        } catch {
          // Non-fatal: gallery save failure doesn't break image delivery
        }

        return {
          tool,
          success: true,
          message: `Image generated successfully`,
          imageUrl: result.url,
          imageId,
          data: { url: result.url, prompt, imageId },
          receipt: RECEIPT_TEMPLATES.image(prompt),
        };
      }

      // ── generate_video ──────────────────────────────────────
      case 'generate_video': {
        const prompt = params.prompt as string;
        const duration = params.duration as number | undefined;

        const result = await generateVideo(prompt, { duration });

        if (!result.success) {
          return {
            tool,
            success: false,
            message: `Video generation failed: ${result.error}`,
          };
        }

        return {
          tool,
          success: true,
          message: `Video generation started. ETA: ~${result.estimatedTime}s`,
          videoUrl: result.url,
          data: { url: result.url, prompt, estimatedTime: result.estimatedTime },
        };
      }

      // ── generate_avatar ─────────────────────────────────────
      case 'generate_avatar': {
        const description = params.description as string;
        const style = (params.style as 'professional' | 'creative' | 'fun') || 'professional';

        const result = await generateAvatar(description, style);

        if (!result.success) {
          return {
            tool,
            success: false,
            message: `Avatar generation failed: ${result.error}`,
          };
        }

        // Save avatar to user profile
        db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(result.url, userId);

        return {
          tool,
          success: true,
          message: `Avatar generated and saved`,
          data: { url: result.url, style },
          receipt: RECEIPT_TEMPLATES.avatar(),
        };
      }

      // ── escalate_to_owner ──────────────────────────────────
      case 'escalate_to_owner': {
        const question = params.question as string;
        const context = (params.context as string) || '';
        const ownerUserId = params._ownerUserId as string;
        const ownerUsername = params._ownerUsername as string;
        const visitorName = (params._visitorName as string) || 'A visitor';

        if (!ownerUserId) {
          return { tool, success: false, message: 'Missing owner context for escalation' };
        }

        // Look up owner's Telegram chat ID
        const telegramLink = db.prepare(
          "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' ORDER BY linked_at DESC LIMIT 1"
        ).get(ownerUserId) as { external_id: string } | undefined;

        if (!telegramLink) {
          return { tool, success: false, message: 'Owner has no Telegram connected for escalation' };
        }

        // Check escalation notification preference
        const escalationPref = db.prepare('SELECT notif_escalations FROM agent_configs WHERE user_id = ?').get(ownerUserId) as { notif_escalations?: number } | undefined;
        if (escalationPref && escalationPref.notif_escalations === 0) {
          return { tool, success: false, message: 'Owner has disabled escalation notifications' };
        }

        const escalationId = `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        // Send Telegram notification first — we need the messageId for reply matching
        let notifMessageId = 0;
        try {
          const escapedName = escapeTelegramHtml(visitorName);
          const escapedQuestion = escapeTelegramHtml(question.slice(0, 300));
          const notifResult = await sendTelegramNotification(
            telegramLink.external_id,
            `📩 <b>${escapedName}</b> asked about your portfolio:\n<i>"${escapedQuestion}"</i>\n\nReply to this message with your answer — or just type normally to chat.`
          );
          notifMessageId = notifResult.messageId;
        } catch {
          return { tool, success: false, message: 'Failed to send escalation notification' };
        }

        // Store escalation state in Redis (24h TTL)
        try {
          const escalationData = JSON.stringify({
            id: escalationId,
            ownerUserId,
            ownerUsername,
            visitorName,
            question,
            context,
            status: 'pending',
            createdAt: new Date().toISOString(),
            notifMessageId,
          });
          await cacheSet(`escalation:${escalationId}`, escalationData, 86400);

          // Track pending escalations per owner
          const pendingKey = `escalations:owner:${ownerUserId}`;
          const existing = await cacheGet(pendingKey);
          const ids: string[] = existing ? JSON.parse(existing) : [];
          ids.push(escalationId);
          await cacheSet(pendingKey, JSON.stringify(ids), 86400);
        } catch {
          // Redis down — still sent notification, just won't track response
        }

        return {
          tool,
          success: true,
          message: `Escalated to ${ownerUsername} via Telegram`,
          data: { escalationId, question },
        };
      }

      // ── web_search ───────────────────────────────────────
      case 'web_search': {
        const query = params.query as string;
        const maxResults = (params.max_results as number) || 3;

        // If query contains a URL or bare domain and Tavily key missing → use crawl4ai directly
        const explicitUrlMatch = query.match(/https?:\/\/\S+/);
        const bareDomainMatch = !explicitUrlMatch && query.match(/\b([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+\.[a-zA-Z]{2,})\b/);
        const crawlTarget = explicitUrlMatch ? explicitUrlMatch[0] : (bareDomainMatch ? `https://${bareDomainMatch[1]}` : null);
        if (!process.env.TAVILY_API_KEY && crawlTarget) {
          try {
            const content = await fetchAndExtract(crawlTarget);
            return {
              tool,
              success: true,
              message: `Fetched ${crawlTarget} — ${content.length} chars`,
              data: { query, results: [], summary: content, url: crawlTarget },
            };
          } catch (err) {
            return {
              tool,
              success: false,
              message: err instanceof Error ? err.message : `Failed to fetch ${crawlTarget}`,
            };
          }
        }

        // Try SearXNG first (free, self-hosted, unlimited)
        let results: Awaited<ReturnType<typeof tavilySearch>>['results'] = [];
        try {
          const searxResult = await searxngSearch(query, maxResults);
          results = searxResult.results;
        } catch {
          // SearXNG failed, try Tavily fallback
        }

        // Tavily fallback if SearXNG returned nothing
        if (results.length === 0 && process.env.TAVILY_API_KEY) {
          try {
            const searchResult = await tavilySearch(query, maxResults);
            results = searchResult.results;
          } catch { /* fall through */ }
        }

        // Smart search fallback (crawl4ai site-specific)
        if (results.length === 0) {
          try {
            const smartResult = await smartSearch(query);
            if (smartResult) {
              return {
                tool,
                success: true,
                message: `Found results via site search for "${query}"`,
                data: { query, results: [], summary: smartResult },
              };
            }
          } catch { /* fall through */ }
        }

        if (results.length === 0) {
          return {
            tool,
            success: false,
            message: `No search results found for "${query}". Try rephrasing your query.`,
          };
        }

        if (results.length === 0) {
          return {
            tool,
            success: false,
            message: `No results found for "${query}".`,
          };
        }

        const summary = results
          .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content}`)
          .join('\n\n');

        return {
          tool,
          success: true,
          message: `Found ${results.length} results for "${query}"`,
          data: { query, results, summary },
        };
      }

      // ── take_screenshot ──────────────────────────────────────
      case 'take_screenshot': {
        const rawUrl = params.url as string;
        const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        try {
          const base64Png = await fetchScreenshot(targetUrl);
          const dataUrl = `data:image/png;base64,${base64Png}`;
          logger.info({ url: targetUrl }, 'take_screenshot: success');
          return {
            tool,
            success: true,
            message: `Screenshot captured for ${targetUrl}`,
            imageUrl: dataUrl,
            data: { url: targetUrl },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: err instanceof Error ? err.message : `Failed to screenshot ${targetUrl}`,
          };
        }
      }

      // ── get_links ────────────────────────────────────────────
      case 'get_links': {
        const rawUrl = params.url as string;
        const filter = (params.filter as 'internal' | 'external' | 'all') || 'all';
        const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        try {
          const links = await extractLinks(targetUrl, filter);
          if (links.length === 0) {
            return { tool, success: true, message: `No ${filter} links found on ${targetUrl}`, data: { links: [] } };
          }
          const formatted = links.slice(0, 50)
            .map((l, i) => `${i + 1}. [${l.text.slice(0, 80)}](${l.href}) (${l.type})`)
            .join('\n');
          return {
            tool,
            success: true,
            message: `Found ${links.length} ${filter} links on ${targetUrl}`,
            data: { links: links.slice(0, 50), summary: formatted, total: links.length },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: err instanceof Error ? err.message : `Failed to extract links from ${targetUrl}`,
          };
        }
      }

      // ── send_telegram ────────────────────────────────────────
      case 'send_telegram': {
        const message = params.message as string;

        const link = db.prepare(
          "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 ORDER BY linked_at DESC LIMIT 1"
        ).get(userId) as { external_id: string } | undefined;

        if (!link) {
          return {
            tool,
            success: false,
            message: 'No Telegram account linked. Go to Connections to connect Telegram first.',
          };
        }

        try {
          await sendTelegramNotification(link.external_id, message);
          return {
            tool,
            success: true,
            message: 'Telegram message sent successfully.',
          };
        } catch {
          return {
            tool,
            success: false,
            message: 'Failed to send Telegram message. Check bot configuration.',
          };
        }
      }

      // ── delete_reminder ──────────────────────────────────────
      case 'delete_reminder': {
        const reminderId = params.reminderId as string | undefined;
        const deleteAll = params.deleteAll as boolean | undefined;

        if (deleteAll) {
          const { changes } = db.prepare(
            'DELETE FROM reminders WHERE user_id = ? AND completed = 0'
          ).run(userId);
          return {
            tool,
            success: true,
            message: `Deleted ${changes} pending reminder${changes !== 1 ? 's' : ''}.`,
          };
        }

        if (reminderId) {
          const existing = db.prepare(
            'SELECT id, text FROM reminders WHERE id = ? AND user_id = ?'
          ).get(reminderId, userId) as { id: string; text: string } | undefined;
          if (!existing) {
            return { tool, success: false, message: `Reminder not found.` };
          }
          db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?').run(reminderId, userId);
          return {
            tool,
            success: true,
            message: `Deleted reminder: "${existing.text}"`,
          };
        }

        return { tool, success: false, message: 'Specify reminderId or set deleteAll: true.' };
      }

      case 'list_reminders': {
        const rows = db.prepare(`
          SELECT id, text, datetime as scheduled_time, channel
          FROM reminders
          WHERE user_id = ? AND completed = 0
          ORDER BY datetime ASC
          LIMIT 10
        `).all(userId) as Array<{id:string; text:string; scheduled_time:string; channel:string}>;

        if (rows.length === 0) {
          return { tool, success: true, message: 'You have no pending reminders.' };
        }

        const listUserTz = (db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as { timezone?: string } | undefined)?.timezone || 'Asia/Kolkata';
        const list = rows.map((r, i) => {
          let time = r.scheduled_time;
          try {
            time = new Date(r.scheduled_time).toLocaleString('en-IN',
              { timeZone: listUserTz, dateStyle: 'medium', timeStyle: 'short' });
          } catch { /* use raw */ }
          return `${i + 1}. ${r.text} — ${time}`;
        }).join('\n');

        return { tool, success: true, message: `Your ${rows.length} pending reminder(s):\n${list}` };
      }

      // ── create_note ──────────────────────────────────────────
      case 'create_note': {
        const title = params.title as string;
        const content = params.content as string;
        const tags = (params.tags as string[]) || [];
        const noteResult = db.prepare(`
          INSERT INTO notes (user_id, title, content, tags, created_at, updated_at)
          VALUES (?, ?, ?, ?, unixepoch('now')*1000, unixepoch('now')*1000)
        `).run(userId, title, content, JSON.stringify(tags));
        // Index in Meilisearch (async, non-blocking)
        indexNote(userId, String(noteResult.lastInsertRowid), title, content).catch(() => {});
        return {
          tool,
          success: true,
          message: `✅ Note saved: "${title}"${tags.length ? ` [${tags.join(', ')}]` : ''}\n\n${content}`,
          receipt: RECEIPT_TEMPLATES.memory(title),
        };
      }

      // ── search_notes ─────────────────────────────────────────
      case 'search_notes': {
        const query = (params.query as string).toLowerCase();
        const limit = (params.limit as number) || 5;
        const rows = db.prepare(`
          SELECT id, title, content, tags, created_at FROM notes
          WHERE user_id = ? AND archived = 0
            AND (lower(title) LIKE ? OR lower(content) LIKE ?)
          ORDER BY updated_at DESC LIMIT ?
        `).all(userId, `%${query}%`, `%${query}%`, limit) as Array<{id:number; title:string; content:string; tags:string; created_at:number}>;
        if (rows.length === 0) return { tool, success: true, message: `No notes found for "${query}".` };
        const list = rows.map((r, i) => {
          const preview = r.content.slice(0, 100).replace(/\n/g, ' ');
          const date = new Date(r.created_at).toLocaleDateString('en-IN');
          return `${i + 1}. **${r.title}** (${date})\n   ${preview}…`;
        }).join('\n\n');
        return { tool, success: true, message: `Found ${rows.length} note(s):\n\n${list}`, data: { rows } };
      }

      // ── track_habit ──────────────────────────────────────────
      case 'track_habit': {
        const habitName = (params.habitName as string).trim();
        const note = (params.note as string) || null;
        // Find existing habit (case-insensitive)
        let habit = db.prepare(`
          SELECT id, name, current_streak, longest_streak FROM habits
          WHERE user_id = ? AND lower(name) = lower(?) LIMIT 1
        `).get(userId, habitName) as { id: number; name: string; current_streak: number; longest_streak: number } | undefined;
        // Create if missing
        if (!habit) {
          const r = db.prepare(`
            INSERT INTO habits (user_id, name, description, frequency, icon, current_streak, longest_streak, created_at)
            VALUES (?, ?, '', 'daily', 'star', 0, 0, unixepoch('now')*1000)
          `).run(userId, habitName);
          habit = { id: r.lastInsertRowid as number, name: habitName, current_streak: 0, longest_streak: 0 };
          // Index new habit in Meilisearch (async)
          indexHabit(userId, String(habit.id), habitName).catch(() => {});
        }
        // Log today (UNIQUE index prevents double-log)
        try {
          db.prepare(`
            INSERT INTO habit_logs (habit_id, user_id, logged_at, note)
            VALUES (?, ?, unixepoch('now')*1000, ?)
          `).run(habit.id, userId, note);
        } catch {
          return { tool, success: false, message: `"${habit.name}" already logged today!` };
        }
        // Update streak
        const newStreak = habit.current_streak + 1;
        const newLongest = Math.max(newStreak, habit.longest_streak);
        db.prepare(`UPDATE habits SET current_streak = ?, longest_streak = ? WHERE id = ?`)
          .run(newStreak, newLongest, habit.id);
        eventBus.emit('habit.logged', { userId, habitName: habit.name, streak: newStreak });
        if ([7, 14, 21, 30, 50, 100].includes(newStreak)) {
          eventBus.emit('streak.milestone', { userId, habitName: habit.name, streak: newStreak });
        }
        const msg = newStreak > 1
          ? `✅ "${habit.name}" logged! 🔥 ${newStreak}-day streak${newLongest > habit.longest_streak ? ' (new record!)' : ''}`
          : `✅ "${habit.name}" logged for today!`;
        return { tool, success: true, message: msg, data: { habitId: habit.id, streak: newStreak } };
      }

      // ── start_focus ──────────────────────────────────────────
      case 'start_focus': {
        const goal = params.goal as string;
        const durationMin = (params.duration_min as number) || 25;
        const now = Date.now();
        db.prepare(`
          INSERT INTO focus_sessions (user_id, started_at, duration_min, goal, completed, pomodoro_count)
          VALUES (?, ?, ?, ?, 0, 0)
        `).run(userId, now, durationMin, goal);
        const sessionId = Number((db.prepare('SELECT last_insert_rowid() as id').get() as { id: number } | undefined)?.id ?? 0);
        // Set a reminder to end the session
        const { parseReminderTime } = await import('./pico-fleet.js');
        const userRow = db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as { timezone?: string } | undefined;
        const userTz = userRow?.timezone || 'Asia/Kolkata';
        const endTime = parseReminderTime(`in ${durationMin} minutes`, userTz);
        if (endTime) {
          db.prepare(`
            INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by)
            VALUES (?, ?, ?, ?, 'push', 'focus', 'agent')
          `).run(uuid(), userId, `Focus session complete: ${goal}`, endTime);
        }
        // Send focus start with inline "Done early" button via Telegram
        const focusTgLink = db.prepare(
          "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 ORDER BY linked_at DESC LIMIT 1"
        ).get(userId) as { external_id: string } | undefined;
        if (focusTgLink) {
          void sendTelegramButtons(
            focusTgLink.external_id,
            `🎯 Focus started: "${goal}"\n⏱️ ${durationMin} min — you've got this!`,
            [[
              { text: '✅ Done early', callback_data: `focus:done:${userId}` },
              { text: '⏸️ Pause', callback_data: `focus:pause:${userId}` },
            ]],
          );
        }
        return {
          tool,
          success: true,
          message: `🎯 Focus session started! Goal: "${goal}" — ${durationMin} min timer set.`,
          data: { sessionId, goal, durationMin, startedAt: now },
          receipt: RECEIPT_TEMPLATES.reminder(`Focus: ${goal}`, `in ${durationMin} min`),
        };
      }

      // ── create_flashcards ────────────────────────────────────
      case 'create_flashcards': {
        const topic = params.topic as string;
        const cards = params.cards as Array<{ q: string; a: string }>;
        const content = cards.map((c, i) => `Q${i + 1}: ${c.q}\nA${i + 1}: ${c.a}`).join('\n\n');
        db.prepare(`
          INSERT INTO notes (user_id, title, content, tags, created_at, updated_at)
          VALUES (?, ?, ?, ?, unixepoch('now')*1000, unixepoch('now')*1000)
        `).run(userId, `Flashcards: ${topic}`, content, JSON.stringify(['flashcard', topic]));
        return {
          tool,
          success: true,
          message: `Created ${cards.length} flashcards for "${topic}" and saved to Notes.`,
          data: { topic, count: cards.length },
          receipt: RECEIPT_TEMPLATES.memory(`Flashcards: ${topic}`),
        };
      }

      // ── meeting_notes ────────────────────────────────────────
      case 'meeting_notes': {
        const title = params.title as string;
        const attendees = (params.attendees as string[]) || [];
        const agenda = (params.agenda as string) || '';
        const notes = params.notes as string;
        const actionItems = (params.action_items as string[]) || [];
        const content = [
          attendees.length ? `**Attendees:** ${attendees.join(', ')}` : '',
          agenda ? `**Agenda:** ${agenda}` : '',
          `**Notes:**\n${notes}`,
          actionItems.length ? `**Action Items:**\n${actionItems.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : '',
        ].filter(Boolean).join('\n\n');
        db.prepare(`
          INSERT INTO notes (user_id, title, content, tags, created_at, updated_at)
          VALUES (?, ?, ?, ?, unixepoch('now')*1000, unixepoch('now')*1000)
        `).run(userId, title, content, JSON.stringify(['meeting', 'notes']));
        return {
          tool,
          success: true,
          message: `Meeting notes saved: "${title}"${actionItems.length ? ` (${actionItems.length} action items)` : ''}.`,
          receipt: RECEIPT_TEMPLATES.memory(title),
        };
      }

      // ── code_review ──────────────────────────────────────────
      case 'code_review': {
        const code = params.code as string;
        const language = (params.language as string) || 'unknown';
        const focus = (params.focus as string) || 'general quality, bugs, and improvements';
        const { routeChat } = await import('./llm.js');
        const sysPrompt = 'You are an expert code reviewer. Be concise, specific, and actionable. Focus on real issues, not style nits.';
        const userContent = `Review this ${language} code. Focus on: ${focus}\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide: 1) Overall assessment 2) Critical issues 3) Suggestions`;
        try {
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 100 },
          );
          return { tool, success: true, message: result.reply, data: { language, focus } };
        } catch (err) {
          return { tool, success: false, message: `Code review failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── github_pr ────────────────────────────────────────────
      case 'github_pr': {
        const title = params.title as string;
        const changes = params.changes as string;
        const branch = (params.branch as string) || 'feature-branch';
        const base = (params.base as string) || 'main';
        const { routeChat } = await import('./llm.js');
        const sysPrompt = 'You are a senior engineer. Write clear, professional GitHub PR descriptions. Use markdown.';
        const userContent = `Write a PR description.\nTitle: ${title}\nBranch: ${branch} → ${base}\nChanges:\n${changes}\n\nFormat: ## Summary, ## Changes, ## Testing`;
        try {
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 100 },
          );
          return { tool, success: true, message: result.reply, data: { title, branch, base } };
        } catch (err) {
          return { tool, success: false, message: `PR generation failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── seo_audit ────────────────────────────────────────────
      case 'seo_audit': {
        const url = params.url as string;
        try {
          const content = await fetchAndExtract(url);
          const { routeChat } = await import('./llm.js');
          const sysPrompt = 'You are an SEO expert. Analyze the page content for SEO issues. Be brief and actionable.';
          const userContent = `Audit this page for SEO:\nURL: ${url}\n\nContent (first 3000 chars):\n${content.slice(0, 3000)}\n\nCheck: title, meta description, headings, keyword density, content quality, page structure. Score out of 10 and list top 5 improvements.`;
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 150 },
          );
          return { tool, success: true, message: result.reply, data: { url } };
        } catch (err) {
          return { tool, success: false, message: `SEO audit failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── generate_social_post ─────────────────────────────────
      case 'generate_social_post': {
        const topic = params.topic as string;
        const platform = (params.platform as string) || 'twitter';
        const tone = (params.tone as string) || 'professional';
        const limits: Record<string, number> = { twitter: 280, linkedin: 3000, instagram: 2200, facebook: 63206 };
        const charLimit = limits[platform] || 280;
        const { routeChat } = await import('./llm.js');
        const sysPrompt = `You are a social media expert. Write engaging ${platform} posts. Be ${tone}. Stay under ${charLimit} characters.`;
        const userContent = `Write a ${tone} ${platform} post about: ${topic}\n\nInclude relevant hashtags. No markdown formatting — plain text only.`;
        try {
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 80 },
          );
          return { tool, success: true, message: result.reply, data: { topic, platform, tone } };
        } catch (err) {
          return { tool, success: false, message: `Social post generation failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── create_automation ────────────────────────────────────
      case 'create_automation': {
        const autoId = uuid();
        const name = (params.name as string) || 'My Automation';
        // Schema sends 'trigger' (manual|daily|weekly); fall back to 'trigger_type' for legacy callers
        const triggerType = (params.trigger as string) || (params.trigger_type as string) || 'manual';
        // Derive actionType from first step if provided; fall back to legacy 'action_type' param
        const steps = (params.steps as Array<{ action: string; params?: Record<string, unknown> }> | undefined) || [];
        const actionType = steps[0]?.action || (params.action_type as string) || 'telegram-message';
        const triggerConfig = JSON.stringify({
          schedule: params.schedule || '',
          keyword: params.keyword || '',
          steps,
        });
        const actionConfig = JSON.stringify({
          message: params.message || '',
          reminder_text: params.reminder_text || '',
          url: params.webhook_url || '',
          steps,
        });
        db.prepare(`
          INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
        `).run(autoId, userId, name, triggerType, triggerConfig, actionType, actionConfig);
        return {
          tool,
          success: true,
          message: `Automation "${name}" created! You can see it in your dashboard under Automations.`,
          data: { id: autoId },
          receipt: RECEIPT_TEMPLATES.automation(name),
        };
      }

      // ── youtube_summarize ────────────────────────────────────
      case 'youtube_summarize': {
        const url = params.url as string;
        try {
          const content = await fetchAndExtract(url);
          const { routeChat } = await import('./llm.js');
          const sysPrompt = 'You are a helpful assistant. Summarize YouTube video content concisely.';
          const userContent = `Summarize this YouTube video content:\nURL: ${url}\n\nExtracted content:\n${content.slice(0, 4000)}\n\nProvide: main topic, key points (5 bullets), and key takeaways.`;
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 120 },
          );
          return { tool, success: true, message: result.reply, data: { url } };
        } catch (err) {
          return { tool, success: false, message: `YouTube summarize failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── get_briefing ─────────────────────────────────────────
      case 'get_briefing': {
        const type = (params.type as string) || 'daily';
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        const since = type === 'weekly' ? now - 7 * dayMs : now - dayMs;
        // Collect stats
        const pendingReminders = (db.prepare(`SELECT COUNT(*) as n FROM reminders WHERE user_id = ? AND completed = 0`).get(userId) as { n: number }).n;
        const habitsDone = (db.prepare(`SELECT COUNT(*) as n FROM habit_logs WHERE user_id = ? AND logged_at > ?`).get(userId, since) as { n: number }).n;
        const notesSaved = (db.prepare(`SELECT COUNT(*) as n FROM notes WHERE user_id = ? AND created_at > ? AND archived = 0`).get(userId, since) as { n: number }).n;
        const focusSessions = (db.prepare(`SELECT COUNT(*) as n, SUM(duration_min) as total FROM focus_sessions WHERE user_id = ? AND started_at > ?`).get(userId, since) as { n: number; total: number | null });
        const recentNotes = db.prepare(`SELECT title FROM notes WHERE user_id = ? AND archived = 0 ORDER BY updated_at DESC LIMIT 3`).all(userId) as Array<{ title: string }>;
        const upcomingReminders = db.prepare(`SELECT text, datetime FROM reminders WHERE user_id = ? AND completed = 0 ORDER BY datetime ASC LIMIT 3`).all(userId) as Array<{ text: string; datetime: string }>;

        const lines: string[] = [
          `📋 **Your ${type === 'weekly' ? 'Weekly' : 'Daily'} Briefing**`,
          '',
          `📌 Pending reminders: ${pendingReminders}`,
          `✅ Habits logged (${type === 'weekly' ? '7 days' : 'today'}): ${habitsDone}`,
          `📝 Notes saved: ${notesSaved}`,
          `🎯 Focus sessions: ${focusSessions.n}${focusSessions.total ? ` (${focusSessions.total} min total)` : ''}`,
        ];
        if (upcomingReminders.length) {
          lines.push('', '⏰ **Upcoming:**');
          const briefUserTz = (db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as { timezone?: string } | undefined)?.timezone || 'Asia/Kolkata';
          upcomingReminders.forEach(r => {
            let t = r.datetime;
            try { t = new Date(r.datetime).toLocaleString('en-IN', { timeZone: briefUserTz, dateStyle: 'short', timeStyle: 'short' }); } catch { }
            lines.push(`  • ${r.text} — ${t}`);
          });
        }
        if (recentNotes.length) {
          lines.push('', '📄 **Recent notes:**');
          recentNotes.forEach(n => lines.push(`  • ${n.title}`));
        }
        return { tool, success: true, message: lines.join('\n') };
      }

      // ── list_workflows ───────────────────────────────────────
      case 'list_workflows': {
        const rows = db.prepare(`
          SELECT id, name, trigger_type, action_type, enabled, run_count, last_run
          FROM automations WHERE user_id = ?
          ORDER BY created_at DESC LIMIT 20
        `).all(userId) as Array<{id: string; name: string; trigger_type: string; action_type: string; enabled: number; run_count: number; last_run: string}>;
        if (rows.length === 0) return { tool, success: true, message: 'You have no automations yet. Create one by describing what you want to automate.' };
        const list = rows.map((r, i) => `${i + 1}. **${r.name}** — ${r.trigger_type}→${r.action_type} (${r.enabled ? '✅ active' : '⏸ paused'}, run ${r.run_count}x)`).join('\n');
        return { tool, success: true, message: `Your automations (${rows.length}):\n\n${list}`, data: { automations: rows } };
      }

      // ── run_workflow ─────────────────────────────────────────
      case 'run_workflow': {
        const workflowId = params.workflowId as number;
        const wf = db.prepare(`
          SELECT id, name, steps, enabled FROM user_workflows WHERE id = ? AND user_id = ?
        `).get(workflowId, userId) as { id: number; name: string; steps: string; enabled: number } | undefined;
        if (!wf) return { tool, success: false, message: `Workflow #${workflowId} not found.` };
        if (!wf.enabled) return { tool, success: false, message: `Workflow "${wf.name}" is disabled.` };
        let steps: Array<{ action: string; params?: Record<string, unknown> }> = [];
        try { steps = JSON.parse(wf.steps); } catch { return { tool, success: false, message: 'Workflow has invalid steps definition.' }; }
        const results: string[] = [];
        for (const step of steps.slice(0, 5)) {
          try {
            const stepResult = await runAction(userId, step.action, step.params || {});
            results.push(`✅ ${step.action}: ${stepResult.message.slice(0, 100)}`);
          } catch (err) {
            results.push(`❌ ${step.action}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        db.prepare(`UPDATE user_workflows SET last_run = unixepoch('now')*1000 WHERE id = ?`).run(workflowId);
        return {
          tool,
          success: true,
          message: `Ran "${wf.name}" (${steps.length} steps):\n${results.join('\n')}`,
          receipt: RECEIPT_TEMPLATES.automation(wf.name),
        };
      }

      // ── generate_video_story ─────────────────────────────────
      case 'generate_video_story': {
        const topic = params.topic as string;
        const style = (params.style as string) || 'cinematic';
        const durationSec = (params.duration_sec as number) || 60;
        const { routeChat } = await import('./llm.js');
        const sysPrompt = 'You are a professional screenwriter and video director. Write compelling video scripts.';
        const userContent = `Write a ${style} video story script about: ${topic}\nTarget duration: ${durationSec} seconds\n\nFormat:\n- TITLE\n- HOOK (opening 5 seconds)\n- ACT 1, 2, 3 (with scene descriptions and dialogue/narration)\n- CTA (call to action)\n- VISUAL NOTES`;
        try {
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 150 },
          );
          // Save to notes
          db.prepare(`
            INSERT INTO notes (user_id, title, content, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, unixepoch('now')*1000, unixepoch('now')*1000)
          `).run(userId, `Video Story: ${topic}`, result.reply, JSON.stringify(['video', 'script', style]));
          return { tool, success: true, message: result.reply, data: { topic, style, durationSec } };
        } catch (err) {
          return { tool, success: false, message: `Video story generation failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── summarize_url ────────────────────────────────────────
      case 'summarize_url': {
        const url = (params.url as string).trim();
        const format = (params.format as string) || 'bullets';
        const targetUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        try {
          const content = await fetchAndExtract(targetUrl);
          const { routeChat } = await import('./llm.js');
          const formatInstructions = {
            bullets: 'Summarize as 5-7 bullet points. Be concise.',
            paragraph: 'Summarize in 2-3 short paragraphs.',
            tldr: 'Give a 1-2 sentence TL;DR summary.',
          }[format] || 'Summarize as bullet points.';
          const sysPrompt = 'You are a helpful assistant that summarizes web content accurately and concisely.';
          const userContent = `${formatInstructions}\n\nURL: ${targetUrl}\nContent:\n${content.slice(0, 4000)}`;
          const result = await routeChat(
            [{ role: 'user', content: userContent }],
            { systemPrompt: sysPrompt, userCredits: 100 },
          );
          return { tool, success: true, message: result.reply, data: { url: targetUrl, format } };
        } catch (err) {
          return { tool, success: false, message: `URL summarize failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      // ── Expense Tracker ──────────────────────────────────────────────────

      case 'track_expense': {
        const amount = params.amount as number;
        let category = (params.category as string) || 'other';
        const description = (params.description as string) || '';
        const date = (params.date as string) || new Date().toISOString().slice(0, 10);
        const currency = (params.currency as string) || 'USD';

        // Auto-detect category from description using Indian merchant list
        if (category === 'other' && description) {
          const d = description.toLowerCase();
          for (const [key, cat] of Object.entries(INDIAN_MERCHANT_CATS)) {
            if (d.includes(key)) { category = cat; break; }
          }
        }

        const expenseInsert = db.prepare(`
          INSERT INTO expenses (user_id, amount, category, description, date, currency)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, amount, category, description, date, currency);
        const expenseId = expenseInsert.lastInsertRowid;

        // Check for expense spike (>2x category average over last 30 days)
        try {
          const avgRow = db.prepare(
            'SELECT AVG(amount) as avg FROM expenses WHERE user_id = ? AND category = ? AND date >= ?'
          ).get(userId, category, new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)) as { avg: number } | undefined;
          if (avgRow?.avg && amount > avgRow.avg * 2) {
            eventBus.emit('expense.spike', { userId, amount, category, averageForCategory: Math.round(avgRow.avg) });
          }
        } catch { /* non-fatal */ }

        // Check budget if set
        const budgetRow = db.prepare(`
          SELECT amount FROM budget_limits
          WHERE user_id = ? AND (category = ? OR category = 'total') AND period = 'monthly'
          ORDER BY category DESC LIMIT 1
        `).get(userId, category) as { amount: number } | undefined;

        const monthStart = new Date();
        monthStart.setDate(1);
        const monthStr = monthStart.toISOString().slice(0, 10);
        const spent = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
          WHERE user_id = ? AND date >= ? AND (? = 'total' OR category = ?)
        `).get(userId, monthStr, category, category) as { total: number };

        let budgetMsg = '';
        if (budgetRow && spent.total > budgetRow.amount * 0.9) {
          const pct = Math.round((spent.total / budgetRow.amount) * 100);
          budgetMsg = pct >= 100
            ? ` ⚠️ Budget exceeded! ${currency}${spent.total.toFixed(2)} of ${currency}${budgetRow.amount.toFixed(2)}`
            : ` (${pct}% of monthly budget used)`;
        }

        const emoji: Record<string, string> = {
          food: '🍽️', transport: '🚗', shopping: '🛍️', entertainment: '🎬',
          health: '💊', utilities: '💡', rent: '🏠', education: '📚',
          travel: '✈️', other: '💳',
        };
        const icon = emoji[category] || '💳';
        return {
          tool, success: true,
          message: `${icon} Logged ${currency}${amount.toFixed(2)} for ${category}: "${description}"${budgetMsg}`,
          data: { expenseId: Number(expenseId), description, amount, category },
        };
      }

      case 'list_expenses': {
        const period = (params.period as string) || 'month';
        const filterCat = params.category as string | undefined;

        const now = new Date();
        let dateFrom = '1970-01-01';
        if (period === 'today') {
          dateFrom = now.toISOString().slice(0, 10);
        } else if (period === 'week') {
          const d = new Date(now);
          d.setDate(d.getDate() - 7);
          dateFrom = d.toISOString().slice(0, 10);
        } else if (period === 'month') {
          dateFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        }

        const rows = db.prepare(`
          SELECT amount, category, description, date, currency
          FROM expenses
          WHERE user_id = ? AND date >= ? ${filterCat ? 'AND category = ?' : ''}
          ORDER BY date DESC, created_at DESC LIMIT 20
        `).all(userId, dateFrom, ...(filterCat ? [filterCat] : [])) as Array<{
          amount: number; category: string; description: string; date: string; currency: string;
        }>;

        if (rows.length === 0) {
          return { tool, success: true, message: `No expenses found for ${period}.` };
        }

        const total = rows.reduce((s, r) => s + r.amount, 0);
        const currency = rows[0].currency;
        const byCat: Record<string, number> = {};
        for (const r of rows) byCat[r.category] = (byCat[r.category] || 0) + r.amount;

        const topRows = rows.slice(0, 10);
        const lines = topRows.map(r => `• ${r.date} ${r.category}: ${currency}${r.amount.toFixed(2)}${r.description ? ` — ${r.description}` : ''}`);
        const catSummary = Object.entries(byCat)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => `${cat}: ${currency}${amt.toFixed(2)}`)
          .join(', ');

        return {
          tool, success: true,
          message: `Expenses (${period}): ${currency}${total.toFixed(2)} total\n\nBy category: ${catSummary}\n\nRecent:\n${lines.join('\n')}`,
          data: { total, currency, count: rows.length, byCategory: byCat },
        };
      }

      case 'set_budget': {
        const category = (params.category as string) || 'total';
        const amount = params.amount as number;
        const period = (params.period as string) || 'monthly';
        db.prepare(`
          INSERT INTO budget_limits (user_id, category, amount, period)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, category, period) DO UPDATE SET amount = excluded.amount
        `).run(userId, category, amount, period);
        return {
          tool, success: true,
          message: `Budget set: ${amount} per ${period} for ${category}.`,
        };
      }

      // ── browse_and_extract ─────────────────────────────────────
      case 'browse_and_extract': {
        const browseUrl = params.url as string;
        if (!browseUrl) return { tool, success: false, message: 'Please provide a URL to browse.' };
        try {
          const { navigatePage } = await import('../../../services/browser-agent.js');
          const result = await navigatePage(browseUrl);
          if (result.error) return { tool, success: false, message: `Browser error: ${result.error}` };
          return {
            tool, success: true,
            message: `**${result.title || browseUrl}**\n\n${(result.text || '').slice(0, 3000)}`,
            data: { url: result.url, linksCount: result.links?.length || 0 },
          };
        } catch {
          return { tool, success: false, message: 'Browser agent is not available.' };
        }
      }

      // ── check_page_status ──────────────────────────────────────
      case 'check_page_status': {
        const checkUrl = params.url as string;
        if (!checkUrl) return { tool, success: false, message: 'Please provide a URL to check.' };
        try {
          const { extractPageContent } = await import('../../../services/browser-agent.js');
          const result = await extractPageContent(checkUrl);
          if (result.error) return { tool, success: true, message: `${checkUrl} — Error: ${result.error}` };
          return { tool, success: true, message: `✅ ${checkUrl} is live\nTitle: ${result.title}` };
        } catch {
          return { tool, success: true, message: `❓ Could not reach ${checkUrl} — browser agent unavailable.` };
        }
      }

      // ── monitor_page_change ────────────────────────────────────
      case 'monitor_page_change': {
        const monUrl = params.url as string;
        const checkFor = (params.check_for as string) || '';
        const freqHours = (params.frequency_hours as number) || 24;
        if (!monUrl) return { tool, success: false, message: 'Please provide a URL to monitor.' };

        const { v4: monUuid } = await import('uuid');
        const monId = monUuid();
        db.prepare(`
          INSERT INTO page_monitors (id, user_id, url, check_for, frequency_hours, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(monId, userId, monUrl, checkFor, freqHours, Date.now());

        return {
          tool, success: true,
          message: `\u{1F441}\uFE0F Now monitoring: ${monUrl}\nChecking every ${freqHours}h${checkFor ? ` for: "${checkFor}"` : ''}\nI'll alert you when something changes.`,
          data: { monitorId: monId },
        };
      }

      // ── stop_monitoring ──────────────────────────────────────────
      case 'stop_monitoring': {
        const monUrl = params.url as string;
        if (monUrl) {
          db.prepare("UPDATE page_monitors SET enabled = 0 WHERE user_id = ? AND url LIKE ?").run(userId, `%${monUrl}%`);
        } else {
          db.prepare("UPDATE page_monitors SET enabled = 0 WHERE user_id = ?").run(userId);
        }
        return { tool, success: true, message: '\u2705 Page monitoring stopped.' };
      }

      // ── recall_entity ────────────────────────────────────────────
      case 'recall_entity': {
        const entityName = (params.name as string)?.trim();
        if (!entityName) return { tool, success: false, message: 'Please provide a name to recall.' };

        const { recallEntity } = await import('../../../services/graph-memory.js');
        const result = recallEntity(userId, entityName);
        if (!result) return { tool, success: true, message: `I don't have any information about "${entityName}" yet.` };

        const parts = [`**${result.entity.name}** (${result.entity.type})`];
        parts.push(`Mentioned ${result.mentions} times`);

        const props = result.entity.properties;
        if (Object.keys(props).length > 0) {
          parts.push('\nDetails:');
          for (const [k, v] of Object.entries(props)) {
            parts.push(`  \u2022 ${k}: ${v}`);
          }
        }

        if (result.relations.length > 0) {
          parts.push('\nConnected to:');
          for (const r of result.relations) {
            parts.push(`  \u2022 ${r.related_name} (${r.related_type}) \u2014 ${r.relation_type}`);
          }
        }

        return { tool, success: true, message: parts.join('\n') };
      }

      // ── check_calendar ────────────────────────────────────────
      case 'check_calendar': {
        const days = (params.days as number) || 7;
        try {
          const { getUpcomingEvents } = await import('../../../services/calendar-sync.js');
          const events = getUpcomingEvents(userId, days);
          if (!events || events.length === 0) return { tool, success: true, message: 'No upcoming events found.' };

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lines = events.map((e: any) => {
            const date = new Date(e.start_time).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
            const time = new Date(e.start_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            return `\u2022 ${e.title} \u2014 ${date} at ${time}`;
          });
          return { tool, success: true, message: `\u{1F4C5} Upcoming events (${days} days):\n${lines.join('\n')}` };
        } catch {
          return { tool, success: true, message: 'Calendar not connected. Connect via /dashboard/calendar.' };
        }
      }

      // ── create_calendar_event ──────────────────────────────────
      case 'create_calendar_event': {
        const title = params.title as string;
        const startTime = params.start_time as string;
        const duration = (params.duration_minutes as number) || 60;
        const attendees = params.attendees as string[] | undefined;
        const location = params.location as string | undefined;
        if (!title || !startTime) return { tool, success: false, message: 'Need a title and start time.' };

        try {
          const { createCalendarEvent } = await import('../../../services/calendar-sync.js');
          const result = await createCalendarEvent(userId, title, startTime, duration, attendees, location);
          if (result.success) {
            return { tool, success: true, message: `\u{1F4C5} Event created: "${title}" at ${new Date(startTime).toLocaleString('en-IN')}` };
          }
          return { tool, success: false, message: `Failed to create event: ${result.error}` };
        } catch {
          return { tool, success: false, message: 'Calendar not connected.' };
        }
      }

      // ── find_free_slot ──────────────────────────────────────────
      case 'find_free_slot': {
        const durationMin = (params.duration_minutes as number) || 60;
        const daysAhead = (params.days_ahead as number) || 7;
        const preference = (params.preference as string) || 'morning';
        const slots: Array<{ start: string; end: string; label: string }> = [];

        try {
          const { getUpcomingEvents } = await import('../../../services/calendar-sync.js');
          const events = getUpcomingEvents(userId, daysAhead);

          // Work hours based on preference
          let workStart = 9;
          let workEnd = 18;
          if (preference === 'afternoon') { workStart = 12; workEnd = 18; }
          else if (preference === 'evening') { workStart = 16; workEnd = 21; }
          else { workStart = 9; workEnd = 14; } // morning

          for (let day = 1; day <= daysAhead && slots.length < 5; day++) {
            const date = new Date(Date.now() + day * 86400000);
            if ([0, 6].includes(date.getDay())) continue; // skip weekends
            const dayStr = date.toISOString().slice(0, 10);

            for (let hour = workStart; hour < workEnd - Math.floor(durationMin / 60); hour++) {
              const slotStart = new Date(`${dayStr}T${String(hour).padStart(2, '0')}:00:00`);
              const slotEnd = new Date(slotStart.getTime() + durationMin * 60000);

              const conflict = events.some(e => {
                const eStart = new Date(e.start_time);
                const eEnd = e.end_time ? new Date(e.end_time) : new Date(e.start_time + 3600000);
                return slotStart.getTime() < eEnd.getTime() && slotEnd.getTime() > eStart.getTime();
              });

              if (!conflict) {
                const dayLabel = slotStart.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                slots.push({
                  start: slotStart.toISOString(),
                  end: slotEnd.toISOString(),
                  label: `${dayLabel} ${String(hour).padStart(2, '0')}:00`,
                });
                break; // one slot per day
              }
            }
          }

          const list = slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n');
          return {
            tool,
            success: true,
            message: slots.length
              ? `Free ${durationMin}-min slots (${preference}):\n${list}`
              : `No free ${durationMin}-minute slots in the next ${daysAhead} days.`,
            data: { slots },
          };
        } catch {
          return { tool, success: true, message: 'Calendar not connected. Connect via /dashboard/calendar to find free slots.' };
        }
      }

      // ── read_inbox ─────────────────────────────────────────────
      case 'read_inbox': {
        const limit = (params.limit as number) || 5;
        try {
          const { getGmailMessages } = await import('../../../services/gmail-sync.js');
          const messages = getGmailMessages(userId, limit);
          if (!messages || messages.length === 0) return { tool, success: true, message: 'No new emails.' };

          const lines = messages.map((m: { sender?: string; subject?: string }, i: number) => {
            const sender = m.sender?.split('<')[0]?.trim() || 'Unknown';
            return `${i + 1}. ${sender}: ${m.subject || '(no subject)'}`;
          });
          return { tool, success: true, message: `\u{1F4E7} Inbox (${messages.length} messages):\n${lines.join('\n')}` };
        } catch {
          return { tool, success: true, message: 'Gmail not connected. Connect via /dashboard/gmail.' };
        }
      }

      // ── search_memory ─────────────────────────────────────────
      case 'search_memory': {
        const query = (params.query as string)?.trim();
        if (!query) return { tool, success: false, message: 'Please provide a search query.' };

        // 1) Semantic search via Qdrant (meaning-based, not just keywords)
        let vecResults: Array<{ key: string; value: string; score: number }> = [];
        try {
          const sr = await semanticSearch(userId, query, 5);
          vecResults = sr.map(r => ({ key: r.key, value: r.value, score: r.score }));
        } catch { /* semantic search unavailable — continue with keyword search */ }

        // 2) FTS5 full-text search over conversation history
        let convResults: Array<{ content: string; created_at: string }> = [];
        try {
          convResults = db.prepare(`
            SELECT content, created_at FROM conversation_fts
            WHERE conversation_fts MATCH ? AND user_id = ?
            ORDER BY rank LIMIT 5
          `).all(query, userId) as Array<{ content: string; created_at: string }>;
        } catch {
          // FTS5 not available or query syntax error — fall through to memories-only
        }

        // 3) Keyword search over user_memories (key + value LIKE)
        const memResults = db.prepare(`
          SELECT key, value FROM user_memories
          WHERE user_id = ? AND (lower(key) LIKE ? OR lower(value) LIKE ?)
          LIMIT 5
        `).all(userId, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`) as Array<{ key: string; value: string }>;

        if (convResults.length === 0 && memResults.length === 0 && vecResults.length === 0) {
          return {
            tool, success: true,
            message: `I couldn't find anything about "${query}" in our past conversations or your memories.`,
          };
        }

        const parts: string[] = [];
        // Semantic results first (highest quality)
        if (vecResults.length > 0) {
          const vecText = vecResults.map(r => `• ${r.key}: ${r.value} (${Math.round(r.score * 100)}% match)`).join('\n');
          parts.push(`**Semantic matches:**\n${vecText}`);
        }
        if (convResults.length > 0) {
          const convText = convResults.map(r => {
            const rawDate = r.created_at;
            const date = rawDate
              ? new Date(typeof rawDate === 'number' ? rawDate : rawDate).toLocaleDateString('en-IN')
              : '';
            return `[${date}] ${String(r.content).slice(0, 200)}`;
          }).join('\n');
          parts.push(`**From past conversations:**\n${convText}`);
        }
        if (memResults.length > 0) {
          const memText = memResults.map(r => `• ${r.key}: ${r.value}`).join('\n');
          parts.push(`**From memories:**\n${memText}`);
        }

        const totalResults = vecResults.length + convResults.length + memResults.length;
        return {
          tool,
          success: true,
          message: `Found ${totalResults} result(s) for "${query}":\n\n${parts.join('\n\n')}`,
        };
      }

      // ── create_memory ────────────────────────────────────────
      case 'create_memory': {
        const key = (params.key as string)?.trim();
        const value = (params.value as string)?.trim();
        const category = (params.category as string) || 'preference';

        if (!key || !value) {
          return { tool, success: false, message: 'Please provide both a key and value to remember.' };
        }

        // Upsert: update if same key exists, insert if new
        const existing = db.prepare(
          'SELECT id FROM user_memories WHERE user_id = ? AND key = ?'
        ).get(userId, key) as { id: number } | undefined;

        if (existing) {
          db.prepare(
            'UPDATE user_memories SET value = ?, source = ?, updated_at = ? WHERE id = ?'
          ).run(value, 'explicit', Date.now(), existing.id);
        } else {
          db.prepare(
            'INSERT INTO user_memories (user_id, key, value, source, confidence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(userId, key, value, 'explicit', 1.0, Date.now(), Date.now());
        }

        // Also index in Qdrant for semantic search
        try {
          await upsertMemoryVector(userId, key, value);
        } catch { /* vector index unavailable — memory still saved in SQLite */ }

        // Index in Meilisearch
        try {
          await indexMemory(userId, key, value);
        } catch { /* search index unavailable */ }

        return {
          tool,
          success: true,
          message: `Saved to memory: "${key}" → "${value}" (${category})`,
          data: { key, value, category },
        };
      }

      // ── list_inbox ──────────────────────────────────────────────
      case 'list_inbox': {
        const limit = Math.min(Math.max(Number(params.limit) || 5, 1), 20);
        const messages = db.prepare(`
          SELECT source, sender, content, priority, received_at FROM inbox_messages
          WHERE user_id = ? AND archived = 0
          ORDER BY received_at DESC LIMIT ?
        `).all(userId, limit) as Array<{ source: string; sender: string | null; content: string; priority: string; received_at: number }>;

        if (messages.length === 0) {
          return { tool, success: true, message: 'Your inbox is empty! No unread messages.' };
        }

        const lines = messages.map((m, i) => {
          const sender = m.sender?.split('<')[0]?.trim() || m.source;
          const preview = m.content.slice(0, 60).replace(/\n/g, ' ');
          return `${i + 1}. [${m.source}] ${sender}: ${preview}...`;
        });
        return { tool, success: true, message: `📬 Inbox (${messages.length} messages):\n${lines.join('\n')}` };
      }

      // ── Goal System Tools ────────────────────────────────────
      case 'create_goal': {
        const { createGoal, planGoal } = await import('./goal-service.js');
        const title = params.title || params.goal || params.name;
        if (!title) return { tool, success: false, message: 'Goal title is required' };
        const goal = createGoal(userId, {
          title: String(title),
          description: params.description ? String(params.description) : undefined,
          category: params.category as any,
          target_date: params.target_date ? String(params.target_date) : undefined,
        });

        // Auto-plan: immediately decompose goal into steps so the user gets a full plan
        let planMessage = '';
        let autoPlanned = false;
        try {
          const plan = await planGoal(goal.id, userId);
          if (plan && plan.steps.length > 0) {
            autoPlanned = true;
            const stepLines = plan.steps.map((s, i) => `  ${i + 1}. ${s.title} (${s.assigned_agent}, ${s.effort})`);
            planMessage = `\n\n🗺️ Auto-planned ${plan.steps.length} steps:\n${stepLines.join('\n')}\n\nEstimated: ${plan.estimated_effort}`;
          } else {
            planMessage = '\n\n⚠️ Auto-planning did not produce steps. Use plan_goal with this goal id to finish setup.';
          }
        } catch {
          planMessage = '\n\n⚠️ Auto-planning failed. Use plan_goal with this goal id to retry.';
        }

        return { tool, success: true, message: `✅ Goal created: "${goal.title}" (id: ${goal.id}, ${goal.category}, assigned to ${goal.assigned_agent})${planMessage}`, data: { goalId: goal.id, status: goal.status, assignedAgent: goal.assigned_agent, autoPlanned } };
      }

      case 'list_goals': {
        const { getUserGoals } = await import('./goal-service.js');
        const goals = getUserGoals(userId, params.status as any, 10);
        if (goals.length === 0) return { tool, success: true, message: 'No goals found. Set one with "create_goal".' };
        const lines = goals.map((g, i) => `${i + 1}. ${g.title} (id: ${g.id}) [${g.status}] ${g.progress}% — ${g.assigned_agent}`);
        return { tool, success: true, message: `📋 Your goals:\n${lines.join('\n')}`, data: { goals: goals.map(g => ({ id: g.id, title: g.title, status: g.status, progress: g.progress })) } };
      }

      case 'plan_goal': {
        const { planGoal } = await import('./goal-service.js');
        const goalId = params.goal_id || params.id;
        if (!goalId) return { tool, success: false, message: 'Goal ID is required' };
        const plan = await planGoal(String(goalId), userId);
        if (!plan) return { tool, success: false, message: 'Goal not found or planning failed' };
        const stepLines = plan.steps.map((s, i) => `${i + 1}. ${s.title} (${s.assigned_agent}, ${s.effort})`);
        return { tool, success: true, message: `🗺️ Plan for "${plan.goal.title}":\n${stepLines.join('\n')}\n\nEstimated: ${plan.estimated_effort}` };
      }

      case 'execute_goal_step': {
        const { executeNextStep } = await import('./goal-service.js');
        const goalId = params.goal_id || params.id;
        if (!goalId) return { tool, success: false, message: 'Goal ID is required' };
        const step = await executeNextStep(String(goalId), userId);
        if (!step) return { tool, success: false, message: 'No actionable step found for this goal' };
        return { tool, success: true, message: `⚡ Executed step: "${step.title}" — Status: ${step.status}${step.result ? '\n\nResult: ' + step.result.slice(0, 500) : ''}` };
      }

      case 'goal_status': {
        const { getGoalWithSteps } = await import('./goal-service.js');
        const goalId = params.goal_id || params.id;
        if (!goalId) return { tool, success: false, message: 'Goal ID is required' };
        const goal = getGoalWithSteps(String(goalId), userId);
        if (!goal) return { tool, success: false, message: 'Goal not found' };
        const stepLines = goal.steps.map(s => `  ${s.status === 'completed' ? '✅' : s.status === 'in_progress' ? '🔄' : '⬜'} ${s.title} (${s.assigned_agent})`);
        return { tool, success: true, message: `📊 "${goal.title}" — ${goal.progress}% complete\nStatus: ${goal.status}\nSteps:\n${stepLines.join('\n')}` };
      }

      case 'save_artifact': {
        const { createWorkspaceArtifact, getGoal: getGoalForArtifact } = await import('./goal-service.js');
        const title = params.title || 'Untitled';
        const content = params.content || '';
        if (!content) return { tool, success: false, message: 'Artifact content is required' };
        // Verify goal ownership if goal_id provided
        const artifactGoalId = params.goal_id ? String(params.goal_id) : null;
        if (artifactGoalId) {
          const ownerGoal = getGoalForArtifact(artifactGoalId);
          if (!ownerGoal || ownerGoal.user_id !== userId) return { tool, success: false, message: 'Goal not found' };
        }
        const artifact = createWorkspaceArtifact(userId, artifactGoalId, String(title), String(content), (params.type as any) || 'note', params.agent ? String(params.agent) : undefined);
        return { tool, success: true, message: `📎 Artifact saved: "${artifact.title}" (${artifact.artifact_type})` };
      }

      // ── Unknown tool — try GeekOS plugin bridge as fallback
      default: {
        try {
          const { forwardToGeekOS } = await import('../../../routes/geekos-bridge.js');
          const bridgeResult = await forwardToGeekOS(userId, tool, params);
          if (bridgeResult) {
            return { tool, success: true, message: bridgeResult };
          }
        } catch (err) {
          logger.debug({ err, tool }, 'GeekOS plugin fallback unavailable');
        }
        return {
          tool,
          success: false,
          message: `Unknown tool "${tool}"`,
        };
      }
    }
}

/**
 * Execute a single parsed tool action on behalf of a user.
 *
 * This is the sole public entry point for action execution. It delegates
 * to the internal `runAction` switch, wrapping the call with duration
 * tracking and structured logging. On success the underlying
 * {@link ActionResult} is returned as-is; on failure a safe error result
 * is returned so the ReAct loop can feed the error as an observation
 * without crashing.
 *
 * @param userId - Authenticated user ID; all DB writes are scoped to this user
 * @param action - Parsed action containing the tool name and parameter map
 * @returns A structured result with `success`, `message`, and optional
 *          artifact/media IDs. Never throws.
 */
export async function executeAction(userId: string, action: ParsedAction): Promise<ActionResult> {
  const { tool, params } = action;
  const actionStart = Date.now();

  logger.info({ actionType: tool, userId }, 'action:executing');

  try {
    const result = await runAction(userId, tool, params);
    const duration = Date.now() - actionStart;
    logger.info({ actionType: tool, userId, duration, success: result.success }, 'action:completed');
    return result;
  } catch (err) {
    const duration = Date.now() - actionStart;
    logger.error({ actionType: tool, error: err instanceof Error ? err.message : String(err), userId, duration }, 'action:failed');
    return {
      tool,
      success: false,
      message: `Action "${tool}" failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
