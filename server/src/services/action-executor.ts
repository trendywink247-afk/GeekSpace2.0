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
import type { ParsedAction } from './action-parser.js';

// ── Types ───────────────────────────────────────────────────

export interface ActionResult {
  tool: string;
  success: boolean;
  message: string;
  artifactId?: string;
  data?: Record<string, unknown>;
}

// ── Executor ────────────────────────────────────────────────

export function executeAction(userId: string, action: ParsedAction): ActionResult {
  const { tool, params } = action;

  try {
    switch (tool) {
      // ── generate_code ───────────────────────────────────
      case 'generate_code': {
        const title = params.title as string;
        const html = (params.html as string) || '';
        const css = (params.css as string) || '';
        const js = (params.js as string) || '';
        const id = uuid();

        db.prepare(
          `INSERT INTO generated_artifacts (id, user_id, type, title, html, css, js)
           VALUES (?, ?, 'code', ?, ?, ?, ?)`,
        ).run(id, userId, title, html, css, js);

        return {
          tool,
          success: true,
          message: `Created project "${title}"`,
          artifactId: id,
          data: { title, html, css, js },
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
