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
import { DateTime } from 'luxon';
import type { ParsedAction } from './action-parser.js';
import { config } from '../config.js';
import { RECEIPT_TEMPLATES, type ReceiptItem } from './receipts.js';
import { generateImage, generateVideo, generateAvatar } from './media-generation.js';
import { cacheSet, cacheGet, cacheDel } from './cache.js';
import { sendTelegramNotification, escapeTelegramHtml } from './telegram.js';
import { tavilySearch } from './tavily.js';
import { fetchAndExtract, fetchScreenshot, extractLinks, smartSearch } from './web-research.js';

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
            const { renderWebsiteTemplate } = await import('./website-templates.js');
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

        // Calculate expiration (48 hours for self-destruct, null for saved)
        const expiresAt = selfDestruct !== false
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

        // No TAVILY key: try smartSearch (site-aware crawl4ai fallback)
        if (!process.env.TAVILY_API_KEY) {
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
          } catch { /* fall through to error */ }
          return {
            tool,
            success: false,
            message: `No TAVILY_API_KEY configured and no matching news site found for "${query}". Add TAVILY_API_KEY to .env for general web search.`,
          };
        }

        let results: Awaited<ReturnType<typeof tavilySearch>>['results'];
        try {
          const searchResult = await tavilySearch(query, maxResults);
          results = searchResult.results;
        } catch (searchErr) {
          return {
            tool,
            success: false,
            message: searchErr instanceof Error ? searchErr.message : `Search failed for "${query}"`,
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
