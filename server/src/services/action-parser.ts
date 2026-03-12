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
  title: z.string().min(1).max(200).optional(),
  html: z.string().max(50000).default(''),
  css: z.string().max(50000).default(''),
  js: z.string().max(50000).default(''),
  // Template-based generation fields (all optional — executor fills defaults)
  template: z.string().optional(),
  name: z.string().optional(),
  theme: z.string().optional(),
  profession: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  skills: z.array(z.string()).optional(),
  email: z.string().optional(),
  tagline: z.string().optional(),
  productName: z.string().optional(),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  cta: z.string().optional(),
  existingArtifactId: z.string().optional(),
  baseUrl: z.string().optional(),
  selfDestruct: z.boolean().optional(),
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
  priority: z.coerce.number().int().min(1).max(10).default(5),
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
  max_results: z.coerce.number().int().min(1).max(10).default(3),
});

const sendTelegramToolSchema = z.object({
  message: z.string().min(1).max(4096),
});

const deleteReminderSchema = z.object({
  // Provide either a specific reminder ID or 'all' to wipe everything
  reminderId: z.string().optional(),
  deleteAll: z.boolean().optional(),
});

const listRemindersSchema = z.object({}).passthrough();

const takeScreenshotSchema = z.object({
  url: z.string().min(1).max(2000),
});

const getLinksSchema = z.object({
  url: z.string().min(1).max(2000),
  filter: z.enum(['internal', 'external', 'all']).default('all'),
});

// ── Phase 2 — 17 new tools ───────────────────────────────────

const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  tags: z.array(z.string().max(50)).max(10).default([]),
});

const searchNotesSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

const trackHabitSchema = z.object({
  habitName: z.string().min(1).max(200),
  note: z.string().max(500).optional(),
});

const startFocusSchema = z.object({
  goal: z.string().min(1).max(500),
  duration_min: z.coerce.number().int().min(5).max(120).default(25),
});

const createFlashcardsSchema = z.object({
  topic: z.string().min(1).max(200),
  cards: z.array(z.object({ q: z.string(), a: z.string() })).min(1).max(30),
});

const meetingNotesSchema = z.object({
  title: z.string().min(1).max(200),
  attendees: z.array(z.string()).max(20).default([]),
  agenda: z.string().max(2000).default(''),
  notes: z.string().min(1).max(20000),
  action_items: z.array(z.string()).max(20).default([]),
});

const codeReviewSchema = z.object({
  code: z.string().min(1).max(10000),
  language: z.string().max(50).optional(),
  focus: z.string().max(500).optional(),
});

const githubPrSchema = z.object({
  title: z.string().min(1).max(200),
  changes: z.string().min(1).max(5000),
  branch: z.string().max(100).optional(),
  base: z.string().max(100).optional(),
});

const seoAuditSchema = z.object({
  url: z.string().url(),
});

const generateSocialPostSchema = z.object({
  topic: z.string().min(1).max(500),
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook']).default('twitter'),
  tone: z.enum(['professional', 'casual', 'funny', 'inspiring']).default('professional'),
});

const createAutomationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  trigger: z.string().max(100).default('manual'),
  steps: z.array(z.object({
    action: z.string(),
    params: z.record(z.string(), z.unknown()).default({}),
  })).min(1).max(10),
});

const youtubeSummarizeSchema = z.object({
  url: z.string().min(1).max(2000),
});

const getBriefingSchema = z.object({
  type: z.enum(['daily', 'weekly']).default('daily'),
});

const listWorkflowsSchema = z.object({}).passthrough();

const runWorkflowSchema = z.object({
  workflowId: z.coerce.number().int().min(1),
});

const generateVideoStorySchema = z.object({
  topic: z.string().min(1).max(500),
  style: z.enum(['cinematic', 'documentary', 'comedy', 'dramatic']).default('cinematic'),
  duration_sec: z.coerce.number().int().min(30).max(300).default(60),
});

const summarizeUrlSchema = z.object({
  url: z.string().min(1).max(2000),
  format: z.enum(['bullets', 'paragraph', 'tldr']).default('bullets'),
});

export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  generate_code: generateCodeSchema,
  portfolio_add_project: portfolioAddProjectSchema,
  portfolio_update_bio: portfolioUpdateBioSchema,
  portfolio_update_skills: portfolioUpdateSkillsSchema,
  portfolio_remove_project: portfolioRemoveProjectSchema,
  // portfolio_update_theme intentionally removed — use generate_code for website changes
  send_email: sendEmailSchema,
  set_reminder: setReminderSchema,
  crawl_url: crawlUrlSchema,
  web_fetch: crawlUrlSchema, // alias for crawl_url
  trigger_workflow: triggerWorkflowSchema,
  generate_image: generateImageSchema,
  generate_video: generateVideoSchema,
  generate_avatar: generateAvatarSchema,
  escalate_to_owner: escalateToOwnerSchema,
  web_search: webSearchSchema,
  send_telegram: sendTelegramToolSchema,
  delete_reminder: deleteReminderSchema,
  list_reminders: listRemindersSchema,
  take_screenshot: takeScreenshotSchema,
  get_links: getLinksSchema,
  // Phase 2 tools
  create_note: createNoteSchema,
  search_notes: searchNotesSchema,
  track_habit: trackHabitSchema,
  start_focus: startFocusSchema,
  create_flashcards: createFlashcardsSchema,
  meeting_notes: meetingNotesSchema,
  code_review: codeReviewSchema,
  github_pr: githubPrSchema,
  seo_audit: seoAuditSchema,
  generate_social_post: generateSocialPostSchema,
  create_automation: createAutomationSchema,
  youtube_summarize: youtubeSummarizeSchema,
  get_briefing: getBriefingSchema,
  list_workflows: listWorkflowsSchema,
  run_workflow: runWorkflowSchema,
  generate_video_story: generateVideoStorySchema,
  summarize_url: summarizeUrlSchema,
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

// Matches <<<ACTION...ACTION>>> (canonical) OR <<<ACTION...>>> (stepfun/cheap model shorthand)
const ACTION_REGEX = /<<<ACTION\s*([\s\S]*?)(?:ACTION)?>>+>/g;

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
// Some models use <arg name="key">value</arg> format instead of <parameter=key>
const ARG_REGEX = /<arg\s+name="(\w+)">([\s\S]*?)<\/arg>/g;

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
    if (typeof parsed !== 'object' || parsed === null) {
      logger.warn({ block: rawBlock }, 'Action block missing "tool" field — skipping');
      continue;
    }

    const parsedObj = parsed as Record<string, unknown>;

    // If LLM omitted the tool wrapper but output generate_code params directly,
    // infer the tool (stepfun/cheap models sometimes skip the {"tool":...} envelope)
    if (!('tool' in parsedObj) || typeof parsedObj.tool !== 'string') {
      if ('template' in parsedObj || ('html' in parsedObj && 'css' in parsedObj)) {
        parsedObj.tool = 'generate_code';
        parsedObj.params = { ...parsedObj };
        delete (parsedObj.params as Record<string, unknown>).tool;
        delete (parsedObj.params as Record<string, unknown>).params;
      } else {
        logger.warn({ block: rawBlock }, 'Action block missing "tool" field — skipping');
        continue;
      }
    }

    const { tool, params } = parsedObj as { tool: string; params?: unknown };

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
    ARG_REGEX.lastIndex = 0;
    let paramMatch: RegExpExecArray | null;
    const parseXmlParamValue = (v: string): unknown => {
      const trimmed = v.trim();
      // Try parsing JSON arrays/objects (LLMs often pass them as JSON strings)
      if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
          (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try { return JSON.parse(trimmed); } catch { /* fall through */ }
      }
      return trimmed;
    };
    while ((paramMatch = PARAM_REGEX.exec(body)) !== null) {
      params[paramMatch[1]] = parseXmlParamValue(paramMatch[2]);
    }
    // Also support <arg name="key">value</arg> format (used by some models)
    while ((paramMatch = ARG_REGEX.exec(body)) !== null) {
      params[paramMatch[1]] = parseXmlParamValue(paramMatch[2]);
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
