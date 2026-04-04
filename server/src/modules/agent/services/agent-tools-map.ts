/**
 * Agent Tools Map — Per-personality tool access control
 *
 * Each AI personality has a specific set of tools they can use.
 * This forces delegation to be meaningful: Aria literally can't
 * write code, she must delegate to Forge. Cal can't generate images,
 * she must delegate to Aria.
 *
 * Weebo (the router/generalist) can use all tools.
 *
 * @module services/agent-tools-map
 */

import type { AnyAgentId } from '../types/goals.js';

// ── All Available Tool Names (from action-executor.ts) ───────

export const ALL_TOOLS = [
  'generate_code', 'code_review', 'github_pr',
  'portfolio_add_project', 'portfolio_update_bio', 'portfolio_update_skills',
  'portfolio_remove_project', 'portfolio_update_theme',
  'send_email', 'set_reminder', 'delete_reminder', 'list_reminders',
  'crawl_url', 'web_fetch', 'web_search',
  'trigger_workflow', 'create_automation', 'list_workflows', 'run_workflow',
  'generate_image', 'generate_video', 'generate_avatar', 'generate_video_story',
  'generate_social_post',
  'escalate_to_owner',
  'take_screenshot', 'get_links',
  'send_telegram',
  'create_note', 'search_notes',
  'track_habit', 'start_focus', 'create_flashcards',
  'meeting_notes',
  'seo_audit', 'youtube_summarize', 'get_briefing',
  'create_goal', 'list_goals', 'goal_status', 'plan_goal', 'execute_goal_step',
  'save_artifact', 'search_memory',
] as const;

export type ToolName = typeof ALL_TOOLS[number];

// ── Per-Personality Tool Access ──────────────────────────────

/**
 * Maps each personality to the tools they specialize in.
 * Weebo has access to ALL tools (she's the router/generalist).
 * Other agents have focused tool sets matching their expertise.
 *
 * Shared tools (available to all): set_reminder, create_note, search_notes,
 * search_memory, escalate_to_owner, save_artifact, create_goal, list_goals,
 * goal_status
 */

const SHARED_TOOLS: ToolName[] = [
  'set_reminder', 'delete_reminder', 'list_reminders',
  'create_note', 'search_notes', 'search_memory',
  'escalate_to_owner', 'save_artifact',
  'create_goal', 'list_goals', 'goal_status',
  'send_telegram',
];

const PERSONALITY_TOOLS: Record<string, ToolName[]> = {
  // Weebo: The Darling — router/generalist, all tools
  weebo: [...ALL_TOOLS],

  // Forge: The Builder — code, technical, debugging
  forge: [
    ...SHARED_TOOLS,
    'generate_code', 'code_review', 'github_pr',
    'crawl_url', 'web_fetch', 'web_search',
    'take_screenshot', 'get_links',
    'plan_goal', 'execute_goal_step',
  ],

  // Aria: The Creative — design, content, media
  aria: [
    ...SHARED_TOOLS,
    'generate_image', 'generate_video', 'generate_avatar', 'generate_video_story',
    'generate_social_post',
    'portfolio_add_project', 'portfolio_update_bio', 'portfolio_update_skills',
    'portfolio_update_theme',
    'web_search',
  ],

  // Pulse: The Analyst — data, research, analytics
  pulse: [
    ...SHARED_TOOLS,
    'web_search', 'crawl_url', 'web_fetch',
    'seo_audit', 'youtube_summarize', 'get_briefing',
    'take_screenshot', 'get_links',
    'plan_goal', 'execute_goal_step',
  ],

  // Echo: The Coach — habits, wellness, motivation
  echo: [
    ...SHARED_TOOLS,
    'track_habit', 'start_focus', 'create_flashcards',
    'get_briefing',
    'plan_goal', 'execute_goal_step',
  ],

  // Cal: The Organizer — scheduling, planning, organizing
  cal: [
    ...SHARED_TOOLS,
    'meeting_notes',
    'trigger_workflow', 'create_automation', 'list_workflows', 'run_workflow',
    'plan_goal', 'execute_goal_step',
    'get_briefing',
    'send_email',
  ],

  // Edith: The Boss — review, audit, security, admin
  edith: [
    ...SHARED_TOOLS,
    'code_review', 'seo_audit',
    'web_search', 'crawl_url', 'web_fetch',
    'take_screenshot', 'get_links',
    'plan_goal', 'execute_goal_step',
    'generate_code', 'github_pr',
  ],

  // Jarvis: The Helper — automation, integration, execution
  jarvis: [
    ...SHARED_TOOLS,
    'trigger_workflow', 'create_automation', 'list_workflows', 'run_workflow',
    'send_email',
    'crawl_url', 'web_fetch', 'web_search',
    'take_screenshot', 'get_links',
    'plan_goal', 'execute_goal_step',
  ],

  // Nova: The Explorer — research, learning, exploration
  nova: [
    ...SHARED_TOOLS,
    'web_search', 'crawl_url', 'web_fetch',
    'youtube_summarize', 'get_briefing',
    'take_screenshot', 'get_links',
    'create_flashcards',
  ],
};

// ── API ──────────────────────────────────────────────────────

/**
 * Get the tools available to a specific personality.
 * Falls back to all tools if personality not found.
 */
export function getToolsForAgent(agentId: AnyAgentId | string): Set<ToolName> {
  const tools = PERSONALITY_TOOLS[agentId];
  if (!tools) return new Set(ALL_TOOLS);
  return new Set(tools);
}

/**
 * Check if a specific agent can use a specific tool.
 */
export function canAgentUseTool(agentId: AnyAgentId | string, tool: string): boolean {
  const tools = getToolsForAgent(agentId);
  return tools.has(tool as ToolName);
}

/**
 * Filter tools block in system prompt to only show tools available to the active agent.
 * Returns a filtered version of the tools block string.
 */
export function filterToolsBlock(toolsBlock: string, agentId: AnyAgentId | string): string {
  const allowedTools = getToolsForAgent(agentId);

  // Split tools block by <<<ACTION>>> blocks
  const sections = toolsBlock.split(/(?=<<<ACTION>>>)/);
  const filtered = sections.filter(section => {
    // Keep non-tool sections (intro text)
    if (!section.startsWith('<<<ACTION>>>')) return true;

    // Extract tool name from the section
    const toolMatch = section.match(/tool:\s*(\w+)/);
    if (!toolMatch) return true;

    return allowedTools.has(toolMatch[1] as ToolName);
  });

  return filtered.join('');
}

/**
 * Get the best agent to delegate a tool call to, given the current agent can't use it.
 */
export function findAgentForTool(tool: string): AnyAgentId {
  for (const [agentId, tools] of Object.entries(PERSONALITY_TOOLS)) {
    if (agentId === 'weebo') continue; // Don't delegate to generalist
    if (tools.includes(tool as ToolName)) {
      return agentId as AnyAgentId;
    }
  }
  return 'weebo'; // Fallback to Weebo
}
