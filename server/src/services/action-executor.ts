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

// ── Types ───────────────────────────────────────────────────

export interface ActionResult {
  tool: string;
  success: boolean;
  message: string;
  artifactId?: string;
  previewUrl?: string;
  data?: Record<string, unknown>;
}

// ── Executor ────────────────────────────────────────────────

export async function executeAction(userId: string, action: ParsedAction): Promise<ActionResult> {
  const { tool, params } = action;

  try {
    switch (tool) {
      // ── generate_code ───────────────────────────────────
      case 'generate_code': {
        const title = params.title as string;
        const html = (params.html as string) || '';
        const css = (params.css as string) || '';
        const js = (params.js as string) || '';
        const selfDestruct = params.selfDestruct as boolean | undefined;
        const id = uuid();

        // Calculate expiration (24 hours for self-destruct, null for saved)
        const expiresAt = selfDestruct !== false
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : null;

        db.prepare(
          `INSERT INTO generated_artifacts (id, user_id, type, title, html, css, js, expires_at)
           VALUES (?, ?, 'code', ?, ?, ?, ?, ?)`,
        ).run(id, userId, title, html, css, js, expiresAt);

        // Build preview URL if baseUrl provided
        const baseUrl = params.baseUrl as string | undefined;
        const previewUrl = baseUrl ? `${baseUrl}/preview/${userId}/${id}` : undefined;

        return {
          tool,
          success: true,
          message: `Created project "${title}"${previewUrl ? `. Live preview: ${previewUrl}` : ''}`,
          artifactId: id,
          previewUrl,
          data: { title, html, css, js, previewUrl },
        };
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

        return {
          tool,
          success: true,
          message: `Added project "${params.title}" to portfolio`,
        };
      }

      // ── portfolio_update_bio ────────────────────────────
      case 'portfolio_update_bio': {
        db.prepare(
          `UPDATE portfolios SET about = ? WHERE user_id = ?`,
        ).run(params.bio as string, userId);

        return {
          tool,
          success: true,
          message: 'Portfolio bio updated',
        };
      }

      // ── portfolio_update_skills ─────────────────────────
      case 'portfolio_update_skills': {
        db.prepare(
          `UPDATE portfolios SET skills = ? WHERE user_id = ?`,
        ).run(JSON.stringify(params.skills as string[]), userId);

        return {
          tool,
          success: true,
          message: 'Portfolio skills updated',
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
        };
      }

      // ── set_reminder ────────────────────────────────────────
      case 'set_reminder': {
        const text = params.text as string;
        const reminderId = uuid();
        const dueAt = params.datetime as string || parseReminderTime(text);
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
          'INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(reminderId, userId, text, dueAt, channel, category, 'agent');

        db.prepare(
          `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created reminder', ?, 'bell')`
        ).run(uuid(), userId, text);

        return {
          tool,
          success: true,
          message: `Reminder set: "${text}"${dueAt ? ` (${dueAt})` : ''}`,
          data: { reminderId, text, datetime: dueAt, channel },
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
        };
      }

      // ── Unknown tool (should not happen after parser validation)
      default:
        return {
          tool,
          success: false,
          message: `Unknown tool "${tool}"`,
        };
    }
  } catch (err) {
    logger.error({ err, tool, userId }, 'Action execution failed');
    return {
      tool,
      success: false,
      message: `Action "${tool}" failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
