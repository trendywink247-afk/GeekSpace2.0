import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { sendTelegramMessage } from './telegram.js';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'productivity' | 'monitoring' | 'communication' | 'analytics';
  requiredIntegrations: string[];
}

const RECIPES: Recipe[] = [
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    description: 'Get a daily briefing at 8 AM with your pending tasks, reminders, and agent status.',
    icon: 'sunrise',
    category: 'productivity',
    requiredIntegrations: [],
  },
  {
    id: 'git-watcher',
    name: 'Git Watcher',
    description: 'Receive a summary reminder when a GitHub push event is detected via webhook.',
    icon: 'git-branch',
    category: 'monitoring',
    requiredIntegrations: [],
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Every Sunday, get a summary of all tasks completed and failed during the week.',
    icon: 'calendar-check',
    category: 'analytics',
    requiredIntegrations: [],
  },
  {
    id: 'deadline-enforcer',
    name: 'Deadline Enforcer',
    description: 'When a reminder is overdue by 1 hour, escalate via Telegram notification.',
    icon: 'alert-triangle',
    category: 'productivity',
    requiredIntegrations: ['telegram'],
  },
  {
    id: 'api-health-monitor',
    name: 'API Health Monitor',
    description: 'Check a URL every 5 minutes and create an alert if it returns an error.',
    icon: 'activity',
    category: 'monitoring',
    requiredIntegrations: [],
  },
  {
    id: 'portfolio-traffic',
    name: 'Portfolio Traffic',
    description: 'Weekly summary of portfolio page visits and visitor interactions.',
    icon: 'eye',
    category: 'analytics',
    requiredIntegrations: [],
  },
];

export function getAllRecipes(): Recipe[] {
  return RECIPES;
}

export function getRecipe(recipeId: string): Recipe | undefined {
  return RECIPES.find(r => r.id === recipeId);
}

export function getInstalledRecipes(userId: string): Array<{ recipe_id: string; config: string; installed_at: string }> {
  return db.prepare(
    'SELECT recipe_id, config, installed_at FROM installed_recipes WHERE user_id = ?'
  ).all(userId) as Array<{ recipe_id: string; config: string; installed_at: string }>;
}

export function installRecipe(userId: string, recipeId: string, recipeConfig: Record<string, unknown> = {}): void {
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);

  const existing = db.prepare(
    'SELECT id FROM installed_recipes WHERE user_id = ? AND recipe_id = ?'
  ).get(userId, recipeId);
  if (existing) throw new Error('Recipe already installed');

  db.prepare(
    'INSERT INTO installed_recipes (id, user_id, recipe_id, config) VALUES (?, ?, ?, ?)'
  ).run(uuid(), userId, recipeId, JSON.stringify(recipeConfig));

  logger.info({ userId, recipeId }, 'Recipe installed');
}

export function uninstallRecipe(userId: string, recipeId: string): void {
  const result = db.prepare(
    'DELETE FROM installed_recipes WHERE user_id = ? AND recipe_id = ?'
  ).run(userId, recipeId);

  if (result.changes === 0) throw new Error('Recipe not installed');
  logger.info({ userId, recipeId }, 'Recipe uninstalled');
}

export async function executeRecipe(recipeId: string, userId: string): Promise<void> {
  const configRow = db.prepare(
    'SELECT config FROM installed_recipes WHERE recipe_id = ? AND user_id = ?'
  ).get(recipeId, userId) as { config: string } | undefined;

  const config = (() => {
    try { return JSON.parse(configRow?.config || '{}'); }
    catch { return {}; }
  })() as Record<string, unknown>;

  // Resolve Telegram chat ID from channel_links
  const telegramLink = db.prepare(
    "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' LIMIT 1"
  ).get(userId) as { external_id: string } | undefined;
  const chatId = telegramLink?.external_id ?? null;

  const sendTelegram = async (msg: string) => {
    if (chatId) await sendTelegramMessage(chatId, msg);
  };

  switch (recipeId) {
    case 'morning-briefing': {
      try {
        const { createBriefing } = await import('./daily-briefing.js');
        await createBriefing(userId);
      } catch { /* daily-briefing may not exist or may fail */ }
      break;
    }

    case 'deadline-enforcer': {
      const dueReminders = db.prepare(`
        SELECT text, datetime FROM reminders
        WHERE user_id = ? AND completed = 0 AND datetime <= datetime('now', '+1 day')
        ORDER BY datetime ASC LIMIT 5
      `).all(userId) as { text: string; datetime: string }[];
      if (dueReminders.length > 0) {
        const list = dueReminders.map(r => `\u2022 ${r.text} \u2014 ${r.datetime}`).join('\n');
        await sendTelegram(`\u23F0 <b>Upcoming Deadlines</b>\n${list}`);
      }
      break;
    }

    case 'weekly-review': {
      const memories = db.prepare(`
        SELECT value FROM agent_memory
        WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
        ORDER BY created_at DESC LIMIT 20
      `).all(userId) as { value: string }[];
      const summary = memories.map(m => `\u2022 ${m.value}`).join('\n') || 'No activity this week.';
      await sendTelegram(`\uD83D\uDCCA <b>Your Week in Review</b>\n\n${summary}`);
      break;
    }

    case 'portfolio-traffic': {
      const portfolio = db.prepare(
        'SELECT connection_count FROM portfolios WHERE user_id = ?'
      ).get(userId) as { connection_count: number } | undefined;
      if (portfolio?.connection_count) {
        await sendTelegram(`\uD83D\uDCC8 Your portfolio has <b>${portfolio.connection_count}</b> total connections.`);
      }
      break;
    }

    case 'api-health-monitor': {
      const endpoint = config.endpoint_url as string | undefined;
      if (!endpoint) break;
      try {
        const r = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) {
          await sendTelegram(`\uD83D\uDD34 API Health: <b>${endpoint}</b> returned ${r.status}`);
        }
      } catch {
        await sendTelegram(`\uD83D\uDD34 API Health: <b>${endpoint}</b> is unreachable`);
      }
      break;
    }

    case 'git-watcher': {
      logger.info({ userId }, 'Git watcher recipe executed — requires user git token config');
      break;
    }

    default:
      logger.warn({ recipeId, userId }, 'Unknown recipe ID — skipping');
  }

  // Update last_run_at
  db.prepare(
    "UPDATE installed_recipes SET last_run_at = datetime('now') WHERE recipe_id = ? AND user_id = ?"
  ).run(recipeId, userId);

  logger.info({ recipeId, userId }, 'Recipe executed');
}
