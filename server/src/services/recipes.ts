import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

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
