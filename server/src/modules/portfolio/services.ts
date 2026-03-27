import { db } from '../../db/index.js';

interface PortfolioSuggestion {
  id: string;
  field: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  confidence: number;
}

export function generatePortfolioSuggestions(userId: string): PortfolioSuggestion[] {
  const suggestions: PortfolioSuggestion[] = [];

  const memories = db.prepare(`
    SELECT * FROM agent_memory
    WHERE user_id = ? AND category IN ('project', 'accomplishment', 'milestone')
    ORDER BY confidence DESC, updated_at DESC
    LIMIT 10
  `).all(userId) as Array<{ id: string; key: string; value: string; confidence: number; category: string }>;

  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId) as {
    headline?: string;
    about?: string;
    skills?: string;
  } | undefined;

  for (const memory of memories) {
    const memoryText = `${memory.key} ${memory.value}`.toLowerCase();
    const portfolioText = `${portfolio?.headline || ''} ${portfolio?.about || ''} ${portfolio?.skills || ''}`.toLowerCase();

    if (!portfolioText.includes(memory.key.toLowerCase())) {
      suggestions.push({
        id: `sugg_${memory.id}`,
        field: memory.key.includes('project') ? 'projects' : 'about',
        currentValue: portfolio?.about || '',
        suggestedValue: memory.value,
        reason: `From your ${memory.category}: ${memory.key}`,
        confidence: memory.confidence,
      });
    }
  }

  return suggestions;
}

export function applySuggestion(userId: string, suggestionId: string): boolean {
  const memoryId = suggestionId.replace('sugg_', '');

  const memory = db.prepare('SELECT * FROM agent_memory WHERE id = ? AND user_id = ?').get(memoryId, userId) as {
    key: string;
    value: string;
    category: string;
  } | undefined;

  if (!memory) return false;

  if (memory.category === 'project') {
    const current = db.prepare('SELECT projects FROM portfolios WHERE user_id = ?').get(userId) as { projects: string } | undefined;
    let projects: unknown[];
    try { projects = JSON.parse(current?.projects || '[]'); } catch { projects = []; }
    projects.push({
      name: memory.key,
      description: memory.value,
      added_from_memory: true,
    });
    db.prepare('UPDATE portfolios SET projects = ? WHERE user_id = ?').run(JSON.stringify(projects), userId);
  } else {
    const current = db.prepare('SELECT about FROM portfolios WHERE user_id = ?').get(userId) as { about: string } | undefined;
    const updated = `${current?.about || ''}\n\n${memory.key}: ${memory.value}`.trim();
    db.prepare('UPDATE portfolios SET about = ? WHERE user_id = ?').run(updated, userId);
  }

  db.prepare('UPDATE agent_memory SET source = ? WHERE id = ?').run('applied_to_portfolio', memoryId);
  return true;
}
