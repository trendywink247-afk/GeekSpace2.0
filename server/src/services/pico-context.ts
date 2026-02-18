// ============================================================
// PicoContext Loader
// Assembles full user context for PicoClaw — injected into every LLM call.
// Target: < 800 tokens for the context block.
// ============================================================

import { db } from '../db/index.js';

export interface PicoContext {
  recentMemories: string;      // last 20 memories, summarized
  activeReminders: string;     // next 5 due reminders
  pendingTasks: string;        // in-progress/queued pico tasks
  portfolio: string;           // headline + skills
  integrations: string;        // connected channels
  personality: string;         // weebo/jarvis/edith
  modelPreference: string;     // local/cloud/premium/auto
  todaySummary: string;        // latest auto_summary memory
}

export function loadPicoContext(userId: string): PicoContext {
  // Recent memories (last 20, prefer auto_summary first)
  const memories = db.prepare(`
    SELECT content, tags FROM agent_memory
    WHERE user_id = ?
    ORDER BY CASE WHEN tags LIKE '%auto_summary%' THEN 0 ELSE 1 END ASC,
             created_at DESC
    LIMIT 20
  `).all(userId) as { content: string; tags: string }[];

  const todaySummary = memories.find(m => m.tags?.includes('auto_summary'))?.content || '';
  const recentMemories = memories
    .filter(m => !m.tags?.includes('auto_summary'))
    .slice(0, 10)
    .map(m => `• ${m.content}`)
    .join('\n') || 'No memories yet.';

  // Active reminders (next 5 due)
  const reminders = db.prepare(`
    SELECT text, datetime, category FROM reminders
    WHERE user_id = ? AND completed = 0
    ORDER BY datetime ASC LIMIT 5
  `).all(userId) as { text: string; datetime: string; category: string }[];

  const activeReminders = reminders.length > 0
    ? reminders.map(r => `• [${r.category}] ${r.text} — due ${r.datetime}`).join('\n')
    : 'No active reminders.';

  // Pending Pico tasks
  const tasks = db.prepare(`
    SELECT pt.description, pt.status, pa.name as agent_name
    FROM pico_tasks pt
    JOIN pico_agents pa ON pt.agent_id = pa.id
    WHERE pt.user_id = ? AND pt.status IN ('queued', 'running')
    ORDER BY pt.created_at DESC LIMIT 5
  `).all(userId) as { description: string; status: string; agent_name: string }[];

  const pendingTasks = tasks.length > 0
    ? tasks.map(t => `• [${t.agent_name}/${t.status}] ${t.description}`).join('\n')
    : 'No active tasks.';

  // Portfolio snapshot
  const portfolio = db.prepare(`
    SELECT headline, about, skills FROM portfolios WHERE user_id = ?
  `).get(userId) as { headline: string; about: string; skills: string } | undefined;

  const skillsList = (() => { try { return JSON.parse(portfolio?.skills || '[]').slice(0, 5).join(', '); } catch { return ''; } })();
  const portfolioSnap = portfolio
    ? `Headline: ${portfolio.headline || 'Not set'}\nSkills: ${skillsList || 'None listed'}`
    : 'Portfolio not set up yet.';

  // Connected integrations
  const integrations = db.prepare(`
    SELECT name FROM integrations WHERE user_id = ? AND status = 'connected'
  `).all(userId) as { name: string }[];

  const integrationsStr = integrations.length > 0
    ? integrations.map(i => i.name).join(', ')
    : 'None connected';

  // Agent config
  const agentConfig = db.prepare(
    'SELECT personality, model_preference FROM agent_configs WHERE user_id = ?'
  ).get(userId) as { personality: string; model_preference: string } | undefined;

  return {
    recentMemories,
    activeReminders,
    pendingTasks,
    portfolio: portfolioSnap,
    integrations: integrationsStr,
    personality: agentConfig?.personality || 'jarvis',
    modelPreference: agentConfig?.model_preference || 'auto',
    todaySummary,
  };
}

export function formatContextBlock(ctx: PicoContext): string {
  return `--- PICO CONTEXT ---
Today's Summary: ${ctx.todaySummary || 'No summary yet.'}

Recent Memories:
${ctx.recentMemories}

Active Reminders:
${ctx.activeReminders}

Pending Tasks:
${ctx.pendingTasks}

Portfolio:
${ctx.portfolio}

Connected: ${ctx.integrations}
--- END CONTEXT ---`;
}
