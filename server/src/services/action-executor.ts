// ============================================================
// Action Executor — Runs Validated Tool Actions Against the DB
//
// Takes a parsed action (from action-parser) and executes the
// corresponding database operation. Returns a structured result
// so the caller can relay outcome back to the user/frontend.
// ============================================================

import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { sendAgentEmail, resolveEmailAddress } from './email.js';
import { parseReminderTime } from './pico-fleet.js';
import type { ParsedAction } from './action-parser.js';
import { config } from '../config.js';
import { RECEIPT_TEMPLATES, type ReceiptItem } from './receipts.js';
import { generateImage, generateVideo, generateAvatar } from './media-generation.js';
import { cacheSet, cacheGet, cacheDel } from './cache.js';
import { sendTelegramNotification, sendTelegramMessage, escapeTelegramHtml } from './telegram.js';
import { tavilySearch } from './tavily.js';

// ── Types ───────────────────────────────────────────────────

export interface ActionResult {
  tool: string;
  success: boolean;
  message: string;
  artifactId?: string;
  previewUrl?: string;
  imageUrl?: string;  // Set by generate_image / generate_avatar actions
  videoUrl?: string;  // Set by generate_video action
  data?: Record<string, unknown>;
  receipt?: ReceiptItem; // Visual confirmation of action taken
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
        const title = params.title as string;
        const html = (params.html as string) || '';
        const css = (params.css as string) || '';
        const js = (params.js as string) || '';
        const selfDestruct = params.selfDestruct as boolean | undefined;
        // When injected by the builder route, update an existing artifact instead of creating a new one
        const existingArtifactId = params.existingArtifactId as string | undefined;

        const baseUrl = params.baseUrl as string | undefined;

        // Check if we should update an existing artifact (builder "edit" flow)
        if (existingArtifactId) {
          const existing = db.prepare(
            'SELECT id FROM generated_artifacts WHERE id = ? AND user_id = ?'
          ).get(existingArtifactId, userId) as { id: string } | undefined;

          if (existing) {
            db.prepare(
              `UPDATE generated_artifacts SET title = ?, html = ?, css = ?, js = ? WHERE id = ? AND user_id = ?`
            ).run(title, html, css, js, existingArtifactId, userId);

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

        // Calculate expiration (48 hours for self-destruct, null for saved)
        const expiresAt = selfDestruct !== false
          ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          : null;

        db.prepare(
          `INSERT INTO generated_artifacts (id, user_id, type, title, html, css, js, expires_at)
           VALUES (?, ?, 'code', ?, ?, ?, ?, ?)`,
        ).run(id, userId, title, html, css, js, expiresAt);

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

        const projects: unknown[] = row ? JSON.parse(row.projects) : [];

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

        const projects: { name: string; [key: string]: unknown }[] = row
          ? JSON.parse(row.projects)
          : [];

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
        const theme = JSON.stringify({
          mode: 'dark',
          accentColor: params.accentColor as string,
        });

        db.prepare(
          `UPDATE users SET theme = ? WHERE id = ?`,
        ).run(theme, userId);

        return {
          tool,
          success: true,
          message: `Theme accent color updated to ${params.accentColor}`,
        };
      }

      // ── send_email ──────────────────────────────────────
      case 'send_email': {
        const to = resolveEmailAddress(userId);
        if (!to) {
          return {
            tool,
            success: false,
            message: 'No email address configured. Add one in Settings → Connections.',
          };
        }

        const sent = await sendAgentEmail(
          userId,
          params.subject as string,
          params.body as string,
        );

        if (!sent) {
          return {
            tool,
            success: false,
            message: 'Email could not be sent — check server configuration.',
          };
        }

        return {
          tool,
          success: true,
          message: `Email sent to ${to}`,
          data: { to, subject: params.subject as string },
          receipt: RECEIPT_TEMPLATES.email(to),
        };
      }

      // ── set_reminder ────────────────────────────────────────
      case 'set_reminder': {
        const text = params.text as string;
        const reminderId = uuid();
        const dueAt = params.datetime as string || parseReminderTime(text);
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

        db.prepare(
          'INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(reminderId, userId, text, dueAt, channel, category, 'agent', scheduledFor);

        db.prepare(
          `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created reminder', ?, 'bell')`
        ).run(uuid(), userId, text);

        return {
          tool,
          success: true,
          message: `Reminder set: "${text}"${dueAt ? ` (${dueAt})` : ''}`,
          data: { reminderId, text, datetime: dueAt, channel },
          receipt: RECEIPT_TEMPLATES.reminder(text, dueAt || 'soon'),
        };
      }

      // ── crawl_url ─────────────────────────────────────────
      case 'crawl_url': {
        const url = params.url as string;
        const priority = (params.priority as number) || 5;

        const resp = await fetch(`${config.crawl4aiUrl}/crawl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: [url], priority }),
        });

        if (!resp.ok) {
          return {
            tool,
            success: false,
            message: `Crawl failed with status ${resp.status}`,
          };
        }

        const result = await resp.json() as { results?: Array<{ markdown?: string; url?: string }> };
        const markdown = result.results?.[0]?.markdown || '';
        const truncated = markdown.length > 4000 ? markdown.slice(0, 4000) + '\n\n[truncated]' : markdown;

        return {
          tool,
          success: true,
          message: `Crawled ${url} — ${markdown.length} chars`,
          data: { url, content: truncated },
        };
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

        return {
          tool,
          success: true,
          message: `Image generated successfully`,
          imageUrl: result.url,
          data: { url: result.url, prompt },
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
        db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(result.url, userId);

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

      // ── web_search ─────────────────────────────────────────
      case 'web_search': {
        const query = params.query as string;
        try {
          const searchResult = await tavilySearch(query, 5);
          if (searchResult.results.length === 0) {
            return {
              tool,
              success: false,
              message: 'No search results found for that query.',
            };
          }
          const summary = searchResult.results
            .map((r, i) => `${i + 1}. ${r.title}\n   ${r.content}\n   Source: ${r.url}`)
            .join('\n\n');
          return {
            tool,
            success: true,
            message: `Found ${searchResult.results.length} results for "${query}"`,
            data: { query, results: searchResult.results, summary },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: `Web search failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      // ── telegram_notify ────────────────────────────────────
      case 'telegram_notify': {
        const message = params.message as string;

        // Look up user's linked Telegram chat ID
        const telegramLink = db.prepare(
          "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 ORDER BY linked_at DESC LIMIT 1"
        ).get(userId) as { external_id: string } | undefined;

        if (!telegramLink) {
          return {
            tool,
            success: false,
            message: 'No Telegram account connected. Link your Telegram in Connections.',
          };
        }

        try {
          await sendTelegramMessage(telegramLink.external_id, message);
          return {
            tool,
            success: true,
            message: `Telegram notification sent`,
            data: { chatId: telegramLink.external_id },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: `Telegram send failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      // ── Unknown tool (should not happen after parser validation)
      default:
        return {
          tool,
          success: false,
          message: `Unknown tool "${tool}"`,
        };
    }
}

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
