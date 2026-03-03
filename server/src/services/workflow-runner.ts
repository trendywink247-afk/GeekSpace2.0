// ============================================================
// User Workflow Runner -- Phase 96
//
// Executes user-defined multi-agent workflows sequentially.
// Each step calls the appropriate agent (Weebo/Jarvis/Edith/PicoClaw),
// substitutes template variables ({{user_input}}, {{previous_output}},
// {{<output_key>}}), and stores outputs in a shared context.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { routeChat } from './llm.js';
import { edithChat } from './edith.js';
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';

// ---- Types ----

export interface WorkflowStepDef {
  agent: 'weebo' | 'jarvis' | 'edith' | 'picoclaw';
  prompt_template: string;
  output_key: string;
}

export interface UserWorkflow {
  id: number;
  user_id: string;
  name: string;
  description: string;
  steps: WorkflowStepDef[];
  trigger: string;
  enabled: boolean;
  last_run: number | null;
  created_at: number;
}

export interface UserWorkflowRun {
  id: number;
  workflow_id: number;
  started_at: number;
  finished_at: number | null;
  status: 'running' | 'completed' | 'failed';
  context: Record<string, string>;
  error: string | null;
}

// ---- Agent system prompts ----

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  weebo: 'You are Weebo, a friendly and helpful AI assistant focused on task management, reminders, and personal productivity. Keep responses concise and actionable.',
  jarvis: 'You are Jarvis, an analytical AI that specializes in planning, research, and breaking down complex tasks into clear steps. Be thorough and structured.',
  edith: 'You are Edith, an advanced reasoning AI that handles complex technical and analytical tasks. Provide deep insights and comprehensive analysis.',
  picoclaw: 'You are PicoClaw, an automation specialist that handles multi-step workflows and technical orchestration. Be precise and systematic.',
};

// ---- DB helpers ----

function parseWorkflow(row: Record<string, unknown>): UserWorkflow {
  let steps: WorkflowStepDef[] = [];
  try {
    steps = JSON.parse(row.steps as string || '[]');
  } catch { /* malformed JSON -- return empty */ }
  return {
    id: row.id as number,
    user_id: row.user_id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    steps,
    trigger: (row.trigger as string) || 'manual',
    enabled: Boolean(row.enabled),
    last_run: (row.last_run as number) || null,
    created_at: row.created_at as number,
  };
}

function parseRun(row: Record<string, unknown>): UserWorkflowRun {
  let context: Record<string, string> = {};
  try {
    context = JSON.parse(row.context as string || '{}');
  } catch { /* malformed */ }
  return {
    id: row.id as number,
    workflow_id: row.workflow_id as number,
    started_at: row.started_at as number,
    finished_at: (row.finished_at as number) || null,
    status: (row.status as UserWorkflowRun['status']) || 'running',
    context,
    error: (row.error as string) || null,
  };
}

// ---- Template substitution ----

export function substituteTemplate(
  template: string,
  context: Record<string, string>,
  userInput: string,
): string {
  let result = template;
  result = result.replace(/\{\{user_input\}\}/g, userInput);
  // Replace {{previous_output}} with the most recently added output
  const keys = Object.keys(context);
  if (keys.length > 0) {
    const lastKey = keys[keys.length - 1];
    result = result.replace(/\{\{previous_output\}\}/g, context[lastKey] || '');
  }
  // Replace any {{key}} references from context
  for (const [key, value] of Object.entries(context)) {
    result = result.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), value);
  }
  return result;
}

// ---- LLM dispatch ----

async function callAgent(
  agent: string,
  prompt: string,
): Promise<string> {
  // In TEST_MODE, return deterministic stub outputs
  if (config.isTestMode) {
    return `[${agent.toUpperCase()} TEST RESPONSE] Processed: ${prompt.slice(0, 50)}`;
  }

  const systemPrompt = AGENT_SYSTEM_PROMPTS[agent] || AGENT_SYSTEM_PROMPTS.weebo;

  if (agent === 'edith') {
    try {
      const response = await edithChat(prompt, systemPrompt);
      return response.text;
    } catch (err) {
      logger.warn({ err, agent }, 'Edith call failed, falling back to routeChat');
    }
  }

  if (agent === 'picoclaw') {
    try {
      const available = await isPicoClawAvailable();
      if (available) {
        const response = await queryPicoClaw(prompt, systemPrompt);
        return response.text;
      }
    } catch (err) {
      logger.warn({ err, agent }, 'PicoClaw call failed, falling back to routeChat');
    }
  }

  // weebo / jarvis / fallback
  const response = await routeChat(
    [{ role: 'user', content: prompt }],
    { systemPrompt },
  );
  return response.reply;
}

// ---- Main execution ----

export async function runUserWorkflow(
  workflowId: number,
  userId: string,
  userInput: string,
): Promise<UserWorkflowRun> {
  const workflowRow = db.prepare(
    'SELECT * FROM user_workflows WHERE id = ? AND user_id = ?'
  ).get(workflowId, userId) as Record<string, unknown> | undefined;

  if (!workflowRow) {
    throw new Error(`Workflow ${workflowId} not found for user ${userId}`);
  }

  const workflow = parseWorkflow(workflowRow);

  if (!workflow.enabled) {
    throw new Error(`Workflow "${workflow.name}" is disabled`);
  }

  const startedAt = Date.now();
  const runResult = db.prepare(`
    INSERT INTO user_workflow_runs (workflow_id, started_at, status, context)
    VALUES (?, ?, 'running', '{}')
  `).run(workflowId, startedAt);
  const runId = runResult.lastInsertRowid as number;

  const context: Record<string, string> = {};

  try {
    for (const step of workflow.steps) {
      const prompt = substituteTemplate(step.prompt_template, context, userInput);
      logger.info({ runId, workflowId, agent: step.agent, outputKey: step.output_key }, 'Executing workflow step');

      const output = await callAgent(step.agent, prompt);
      context[step.output_key] = output;

      db.prepare(
        'UPDATE user_workflow_runs SET context = ? WHERE id = ?'
      ).run(JSON.stringify(context), runId);
    }

    const finishedAt = Date.now();
    db.prepare(
      'UPDATE user_workflow_runs SET status = ?, finished_at = ?, context = ? WHERE id = ?'
    ).run('completed', finishedAt, JSON.stringify(context), runId);

    db.prepare('UPDATE user_workflows SET last_run = ? WHERE id = ?').run(startedAt, workflowId);

    logger.info({ runId, workflowId, steps: workflow.steps.length }, 'Workflow completed');

    return {
      id: runId,
      workflow_id: workflowId,
      started_at: startedAt,
      finished_at: finishedAt,
      status: 'completed',
      context,
      error: null,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const finishedAt = Date.now();

    db.prepare(
      'UPDATE user_workflow_runs SET status = ?, finished_at = ?, error = ? WHERE id = ?'
    ).run('failed', finishedAt, errorMsg, runId);

    logger.error({ runId, workflowId, err }, 'Workflow execution failed');

    return {
      id: runId,
      workflow_id: workflowId,
      started_at: startedAt,
      finished_at: finishedAt,
      status: 'failed',
      context,
      error: errorMsg,
    };
  }
}

// ---- Query helpers ----

export function getUserWorkflowList(userId: string): UserWorkflow[] {
  const rows = db.prepare(
    'SELECT * FROM user_workflows WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as Array<Record<string, unknown>>;
  return rows.map(parseWorkflow);
}

export function getUserWorkflowById(id: number, userId: string): UserWorkflow | null {
  const row = db.prepare(
    'SELECT * FROM user_workflows WHERE id = ? AND user_id = ?'
  ).get(id, userId) as Record<string, unknown> | undefined;
  return row ? parseWorkflow(row) : null;
}

export function getWorkflowRuns(workflowId: number, userId: string, limit = 10): UserWorkflowRun[] {
  const wf = db.prepare('SELECT id FROM user_workflows WHERE id = ? AND user_id = ?').get(workflowId, userId);
  if (!wf) return [];
  const rows = db.prepare(
    'SELECT * FROM user_workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?'
  ).all(workflowId, limit) as Array<Record<string, unknown>>;
  return rows.map(parseRun);
}

export function getWorkflowRun(runId: number, userId: string): UserWorkflowRun | null {
  const row = db.prepare(`
    SELECT r.* FROM user_workflow_runs r
    JOIN user_workflows w ON w.id = r.workflow_id
    WHERE r.id = ? AND w.user_id = ?
  `).get(runId, userId) as Record<string, unknown> | undefined;
  return row ? parseRun(row) : null;
}

// ---- Pre-built template seeding ----

export function seedWorkflowTemplates(userId: string): void {
  const existing = db.prepare(
    'SELECT COUNT(*) as cnt FROM user_workflows WHERE user_id = ?'
  ).get(userId) as { cnt: number };

  if (existing.cnt > 0) return;

  const templates: Array<{ name: string; description: string; steps: WorkflowStepDef[] }> = [
    {
      name: 'Daily Briefing',
      description: 'Summarize your reminders with Weebo, then add a motivational note with Edith',
      steps: [
        {
          agent: 'weebo',
          prompt_template: 'Summarize the following for a daily briefing: {{user_input}}. Keep it brief and actionable.',
          output_key: 'summary',
        },
        {
          agent: 'edith',
          prompt_template: 'Here is a daily briefing summary: {{summary}}\n\nAdd a short motivational note to end the briefing on a positive note.',
          output_key: 'final_briefing',
        },
      ],
    },
    {
      name: 'Task Decomposer',
      description: 'Jarvis breaks a complex task into subtasks, Weebo turns them into reminders',
      steps: [
        {
          agent: 'jarvis',
          prompt_template: 'Break down this task into 3-5 clear, actionable subtasks:\n\n{{user_input}}\n\nList each subtask on a new line starting with a dash.',
          output_key: 'subtasks',
        },
        {
          agent: 'weebo',
          prompt_template: 'Here are the subtasks for a project:\n{{subtasks}}\n\nCreate a brief, friendly reminder summary that I can use to track progress. Format it as a simple checklist.',
          output_key: 'reminder_plan',
        },
      ],
    },
    {
      name: 'Research & Summarize',
      description: 'Jarvis researches a topic, Weebo simplifies it for a non-technical audience',
      steps: [
        {
          agent: 'jarvis',
          prompt_template: 'Research and explain this topic in depth:\n\n{{user_input}}\n\nProvide key concepts, examples, and important considerations.',
          output_key: 'research',
        },
        {
          agent: 'weebo',
          prompt_template: 'Here is a detailed research summary:\n{{research}}\n\nRewrite this for a non-technical audience in simple, friendly language. Keep it under 150 words.',
          output_key: 'simplified_summary',
        },
      ],
    },
  ];

  for (const t of templates) {
    try {
      db.prepare(`
        INSERT INTO user_workflows (user_id, name, description, steps, trigger, enabled, created_at)
        VALUES (?, ?, ?, ?, 'manual', 1, ?)
      `).run(userId, t.name, t.description, JSON.stringify(t.steps), Date.now());
    } catch (err) {
      logger.warn({ err, userId, name: t.name }, 'Failed to seed workflow template');
    }
  }
}
