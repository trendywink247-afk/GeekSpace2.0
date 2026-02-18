// ============================================================
// Action Parser — Structured Tool-Use Extraction
//
// Extracts structured action blocks from LLM responses.
// Actions are delimited by <<<ACTION ... ACTION>>> markers
// and validated against per-tool Zod schemas.
// ============================================================

import { z } from 'zod';
import { logger } from '../logger.js';

// ── Tool Schemas ────────────────────────────────────────────

const generateCodeSchema = z.object({
  title: z.string().min(1).max(200),
  html: z.string().max(50000).default(''),
  css: z.string().max(50000).default(''),
  js: z.string().max(50000).default(''),
});

const portfolioAddProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  tags: z.array(z.string()).max(10).default([]),
  liveUrl: z.string().url().optional(),
  repoUrl: z.string().url().optional(),
});

const portfolioUpdateBioSchema = z.object({
  bio: z.string().max(5000),
});

const portfolioUpdateSkillsSchema = z.object({
  skills: z.array(z.string().max(50)).max(30),
});

const portfolioRemoveProjectSchema = z.object({
  projectTitle: z.string().min(1),
});

const portfolioUpdateThemeSchema = z.object({
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const sendEmailSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

const crawlUrlSchema = z.object({
  url: z.string().url(),
  priority: z.number().int().min(1).max(10).default(5),
});

const triggerWorkflowSchema = z.object({
  flowPath: z.string().min(1).max(500),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  generate_code: generateCodeSchema,
  portfolio_add_project: portfolioAddProjectSchema,
  portfolio_update_bio: portfolioUpdateBioSchema,
  portfolio_update_skills: portfolioUpdateSkillsSchema,
  portfolio_remove_project: portfolioRemoveProjectSchema,
  portfolio_update_theme: portfolioUpdateThemeSchema,
  send_email: sendEmailSchema,
  crawl_url: crawlUrlSchema,
  trigger_workflow: triggerWorkflowSchema,
};

// ── Types ───────────────────────────────────────────────────

export interface ParsedAction {
  tool: string;
  params: Record<string, unknown>;
}

export interface ParseResult {
  text: string;
  actions: ParsedAction[];
}

// ── Parser ──────────────────────────────────────────────────

const ACTION_REGEX = /<<<ACTION\s*\n([\s\S]*?)\nACTION>>>/g;

export function parseActions(llmResponse: string): ParseResult {
  const actions: ParsedAction[] = [];

  // Strip action blocks from the text
  const text = llmResponse.replace(ACTION_REGEX, '').trim();

  // Reset regex lastIndex since we use the global flag
  ACTION_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ACTION_REGEX.exec(llmResponse)) !== null) {
    const rawBlock = match[1].trim();

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBlock);
    } catch {
      logger.warn({ block: rawBlock }, 'Action block contains invalid JSON — skipping');
      continue;
    }

    // Basic structure check
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('tool' in parsed) ||
      typeof (parsed as Record<string, unknown>).tool !== 'string'
    ) {
      logger.warn({ block: rawBlock }, 'Action block missing "tool" field — skipping');
      continue;
    }

    const { tool, params } = parsed as { tool: string; params?: unknown };

    // Validate tool name
    const schema = TOOL_SCHEMAS[tool];
    if (!schema) {
      logger.warn({ tool }, 'Unknown tool in action block — skipping');
      continue;
    }

    // Validate params with Zod
    const result = schema.safeParse(params ?? {});
    if (!result.success) {
      logger.warn(
        { tool, errors: result.error.flatten() },
        'Action block params failed validation — skipping',
      );
      continue;
    }

    actions.push({ tool, params: result.data as Record<string, unknown> });
  }

  return { text, actions };
}
