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

const setReminderSchema = z.object({
  text: z.string().min(1).max(500),
  datetime: z.string().max(100).optional(),
  channel: z.enum(['push', 'telegram']).optional(),
  category: z.string().max(50).optional(),
});

const triggerWorkflowSchema = z.object({
  flowPath: z.string().min(1).max(500),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const generateImageSchema = z.object({
  prompt: z.string().min(1).max(1000),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
});

const generateVideoSchema = z.object({
  prompt: z.string().min(1).max(1000),
  duration: z.number().int().min(3).max(10).optional(),
});

const generateAvatarSchema = z.object({
  description: z.string().min(1).max(500),
  style: z.enum(['professional', 'creative', 'fun']).optional(),
});

const escalateToOwnerSchema = z.object({
  question: z.string().min(1).max(1000),
  context: z.string().max(500).optional(),
});

const webSearchSchema = z.object({
  query: z.string().min(1).max(500),
});

const telegramNotifySchema = z.object({
  message: z.string().min(1).max(1000),
});

export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  generate_code: generateCodeSchema,
  portfolio_add_project: portfolioAddProjectSchema,
  portfolio_update_bio: portfolioUpdateBioSchema,
  portfolio_update_skills: portfolioUpdateSkillsSchema,
  portfolio_remove_project: portfolioRemoveProjectSchema,
  portfolio_update_theme: portfolioUpdateThemeSchema,
  send_email: sendEmailSchema,
  set_reminder: setReminderSchema,
  crawl_url: crawlUrlSchema,
  trigger_workflow: triggerWorkflowSchema,
  generate_image: generateImageSchema,
  generate_video: generateVideoSchema,
  generate_avatar: generateAvatarSchema,
  escalate_to_owner: escalateToOwnerSchema,
  web_search: webSearchSchema,
  telegram_notify: telegramNotifySchema,
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

const ACTION_REGEX = /<<<ACTION\s*([\s\S]*?)ACTION>>+>/g;

/**
 * Fix unescaped newlines in JSON string values.
 * LLMs sometimes output raw newlines inside JSON strings instead of \n.
 */
function fixUnescapedNewlines(jsonStr: string): string {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    const prevChar = i > 0 ? jsonStr[i - 1] : '';

    if (!inString) {
      // Not in a string - just copy and track if we enter a string
      result += char;
      if (char === '"' && !escaped) {
        inString = true;
      }
    } else {
      // Inside a string
      if (escaped) {
        // Previous char was backslash, this char is escaped
        result += char;
        escaped = false;
      } else if (char === '\\') {
        // Start of escape sequence
        result += char;
        escaped = true;
      } else if (char === '"') {
        // End of string
        result += char;
        inString = false;
      } else if (char === '\n') {
        // Unescaped newline - replace with escaped version
        result += '\\n';
      } else if (char === '\r') {
        // Carriage return - replace with escaped version
        result += '\\r';
      } else if (char === '\t') {
        // Tab - replace with escaped version
        result += '\\t';
      } else {
        result += char;
      }
    }
  }

  return result;
}

/**
 * Try to parse JSON, fixing common LLM formatting issues if needed.
 */
function parseJsonLlm(jsonStr: string): unknown {
  // Try normal parsing first
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try fixing unescaped newlines
    const fixed = fixUnescapedNewlines(jsonStr);
    return JSON.parse(fixed);
  }
}
const TOOL_CALL_REGEX = /<tool_call>\s*<function=(\w+)>([\s\S]*?)<\/function>\s*<\/tool_call>/g;
const PARAM_REGEX = /<parameter=(\w+)>([\s\S]*?)<\/parameter>/g;

export function parseActions(llmResponse: string): ParseResult {
  const actions: ParsedAction[] = [];

  // Strip action blocks from the text
  let text = llmResponse.replace(ACTION_REGEX, '').trim();
  text = text.replace(TOOL_CALL_REGEX, '').trim();

  // Reset regex lastIndex since we use the global flag
  ACTION_REGEX.lastIndex = 0;
  TOOL_CALL_REGEX.lastIndex = 0;

  // Parse <<<ACTION ... ACTION>>> format
  let match: RegExpExecArray | null;
  while ((match = ACTION_REGEX.exec(llmResponse)) !== null) {
    const rawBlock = match[1].trim();

    // Parse JSON (with LLM formatting fixes)
    let parsed: unknown;
    try {
      parsed = parseJsonLlm(rawBlock);
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

  // Parse <tool_call><function=name><parameter=key>value</parameter></function></tool_call> format
  while ((match = TOOL_CALL_REGEX.exec(llmResponse)) !== null) {
    const toolName = match[1];
    const body = match[2];

    // Extract all parameters from the function body
    const params: Record<string, unknown> = {};
    PARAM_REGEX.lastIndex = 0;
    let paramMatch: RegExpExecArray | null;
    while ((paramMatch = PARAM_REGEX.exec(body)) !== null) {
      params[paramMatch[1]] = paramMatch[2].trim();
    }

    // Tool name is used directly — all registered tools are valid
    const tool = toolName;
    const schema = TOOL_SCHEMAS[tool];
    if (!schema) {
      logger.warn({ toolName }, 'Unknown function in tool_call — skipping');
      continue;
    }

    // Validate params with Zod
    const result = schema.safeParse(params);
    if (!result.success) {
      logger.warn(
        { tool, errors: result.error.flatten() },
        'Tool_call params failed validation — skipping',
      );
      continue;
    }

    actions.push({ tool, params: result.data as Record<string, unknown> });
  }

  return { text, actions };
}
