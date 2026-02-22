// ============================================================
// PicoContext Loader
// Assembles full user context for PicoClaw — injected into every LLM call.
// Target: < 800 tokens for the context block.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';

export interface PicoContext {
  recentMemories: string;      // last 20 memories, summarized
  activeReminders: string;     // next 5 due reminders
  pendingTasks: string;        // in-progress/queued pico tasks
  failedTasks: string;         // recently failed tasks for awareness
  portfolio: string;           // headline + skills
  integrations: string;        // connected channels
  personality: string;         // weebo/jarvis/edith
  modelPreference: string;     // local/cloud/premium/auto
  todaySummary: string;        // latest auto_summary memory
  contextStatus: 'full' | 'partial' | 'error'; // degradation indicator
}

export function loadPicoContext(userId: string): PicoContext {
  const errors: string[] = [];

  try {
    // Recent memories (last 20, prefer auto_summary first)
    let memories: { key: string; value: string; category: string }[] = [];
    try {
      memories = db.prepare(`
        SELECT key, value, category FROM agent_memory
        WHERE user_id = ?
        ORDER BY CASE WHEN key LIKE '%auto_summary%' THEN 0 ELSE 1 END ASC,
                 updated_at DESC
        LIMIT 20
      `).all(userId) as { key: string; value: string; category: string }[];
    } catch (e) {
      errors.push('memories');
      logger.warn({ userId, error: e }, 'Failed to load memories for context');
    }

    const todaySummary = memories.find(m => m.key?.includes('auto_summary'))?.value || '';
    const recentMemories = memories
      .filter(m => !m.key?.includes('auto_summary'))
      .slice(0, 10)
      .map(m => `• [${m.category}] ${m.key}: ${m.value}`)
      .join('\n') || 'No memories yet.';

    // Active reminders (next 5 due)
    let activeReminders = 'No active reminders.';
    try {
      const reminders = db.prepare(`
        SELECT text, datetime, category FROM reminders
        WHERE user_id = ? AND completed = 0
        ORDER BY datetime ASC LIMIT 5
      `).all(userId) as { text: string; datetime: string; category: string }[];

      activeReminders = reminders.length > 0
        ? reminders.map(r => `• [${r.category}] ${r.text} — due ${r.datetime}`).join('\n')
        : 'No active reminders.';
    } catch (e) {
      errors.push('reminders');
      logger.warn({ userId, error: e }, 'Failed to load reminders for context');
    }

    // Pending Pico tasks (queued/running)
    let pendingTasks = 'No active tasks.';
    try {
      const tasks = db.prepare(`
        SELECT pt.description, pt.status, COALESCE(pa.name, 'Weebo') as agent_name, pt.attempts
        FROM pico_tasks pt
        LEFT JOIN pico_agents pa ON pt.agent_id = pa.id
        WHERE pt.user_id = ? AND pt.status IN ('queued', 'running')
        ORDER BY pt.created_at DESC LIMIT 5
      `).all(userId) as { description: string; status: string; agent_name: string; attempts: number }[];

      pendingTasks = tasks.length > 0
        ? tasks.map(t => `• [${t.agent_name}/${t.status}${t.attempts ? ` (attempt ${t.attempts})` : ''}] ${t.description}`).join('\n')
        : 'No active tasks.';
    } catch (e) {
      errors.push('pending_tasks');
      logger.warn({ userId, error: e }, 'Failed to load pending tasks for context');
    }

    // Recently failed tasks (last 3, for awareness)
    let failedTasks = 'No recent failures.';
    try {
      const failed = db.prepare(`
        SELECT pt.description, pt.result, COALESCE(pa.name, 'Weebo') as agent_name
        FROM pico_tasks pt
        LEFT JOIN pico_agents pa ON pt.agent_id = pa.id
        WHERE pt.user_id = ? AND pt.status = 'failed'
        ORDER BY pt.completed_at DESC LIMIT 3
      `).all(userId) as { description: string; result: string; agent_name: string }[];

      failedTasks = failed.length > 0
        ? failed.map(t => `• [${t.agent_name}] ${t.description} — ${t.result?.slice(0, 100) || 'Failed'}`).join('\n')
        : 'No recent failures.';
    } catch (e) {
      errors.push('failed_tasks');
      // Don't log — non-critical
    }

    // Portfolio snapshot
    let portfolioSnap = 'Portfolio not set up yet.';
    try {
      const portfolio = db.prepare(`
        SELECT headline, about, skills FROM portfolios WHERE user_id = ?
      `).get(userId) as { headline: string; about: string; skills: string } | undefined;

      if (portfolio) {
        const skillsList = (() => { try { return JSON.parse(portfolio?.skills || '[]').slice(0, 5).join(', '); } catch { return ''; } })();
        portfolioSnap = `Headline: ${portfolio.headline || 'Not set'}\nSkills: ${skillsList || 'None listed'}`;
      }
    } catch (e) {
      errors.push('portfolio');
      logger.warn({ userId, error: e }, 'Failed to load portfolio for context');
    }

    // Connected integrations
    let integrationsStr = 'None connected';
    try {
      const integrations = db.prepare(`
        SELECT name FROM integrations WHERE user_id = ? AND status = 'connected'
      `).all(userId) as { name: string }[];

      integrationsStr = integrations.length > 0
        ? integrations.map(i => i.name).join(', ')
        : 'None connected';
    } catch (e) {
      errors.push('integrations');
      logger.warn({ userId, error: e }, 'Failed to load integrations for context');
    }

    // Agent config
    let personality = 'jarvis';
    let modelPreference = 'auto';
    try {
      const agentConfig = db.prepare(
        'SELECT personality, model_preference FROM agent_configs WHERE user_id = ?'
      ).get(userId) as { personality: string; model_preference: string } | undefined;
      personality = agentConfig?.personality || 'jarvis';
      modelPreference = agentConfig?.model_preference || 'auto';
    } catch (e) {
      errors.push('agent_config');
      // Use defaults
    }

    const contextStatus: PicoContext['contextStatus'] = errors.length === 0 ? 'full' : errors.length < 3 ? 'partial' : 'error';

    if (errors.length > 0) {
      logger.warn({ userId, errors, contextStatus }, 'PicoContext loaded with errors');
    }

    return {
      recentMemories,
      activeReminders,
      pendingTasks,
      failedTasks,
      portfolio: portfolioSnap,
      integrations: integrationsStr,
      personality,
      modelPreference,
      todaySummary,
      contextStatus,
    };
  } catch (err) {
    logger.error({ userId, error: err }, 'PicoContext critical failure — returning minimal context');
    return {
      recentMemories: 'Context unavailable.',
      activeReminders: 'Context unavailable.',
      pendingTasks: 'Context unavailable.',
      failedTasks: 'Context unavailable.',
      portfolio: 'Context unavailable.',
      integrations: 'Context unavailable.',
      personality: 'jarvis',
      modelPreference: 'auto',
      todaySummary: '',
      contextStatus: 'error',
    };
  }
}

export function formatContextBlock(ctx: PicoContext): string {
  const statusNote = ctx.contextStatus !== 'full' ? ` [${ctx.contextStatus.toUpperCase()} MODE]` : '';

  return `--- PICO CONTEXT${statusNote} ---
Today's Summary: ${ctx.todaySummary || 'No summary yet.'}

Recent Memories:
${ctx.recentMemories}

Active Reminders:
${ctx.activeReminders}

Pending Tasks:
${ctx.pendingTasks}

Recent Failures:
${ctx.failedTasks}

Portfolio:
${ctx.portfolio}

Connected: ${ctx.integrations}
--- END CONTEXT ---`;
}
