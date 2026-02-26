import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface TriageScore {
  clusterId: string;
  demandScore: number;
  impactScore: number;
  effortScore: number;
  riskScore: number;
  overallScore: number;
  rationale: string;
}

// In TEST_MODE: returns deterministic stub scores without calling LLM
// In prod: would call LLM (left as stub for now — safe for prod)
export async function triageSuggestions(suggestionIds: string[]): Promise<TriageScore[]> {
  if (!suggestionIds.length) return [];

  const placeholders = suggestionIds.map(() => '?').join(',');
  const suggestions = db.prepare(
    `SELECT id, title, body, tags FROM suggestions WHERE id IN (${placeholders}) AND status = 'new'`
  ).all(...suggestionIds) as Array<{id: string; title: string; body: string; tags: string}>;

  if (!suggestions.length) return [];

  const results: TriageScore[] = [];

  // One cluster per suggestion (naive clustering). Prod would group similar ones.
  for (const suggestion of suggestions) {
    const clusterId = uuid();
    const demandScore = config.isTestMode ? 7 : 5;
    const impactScore = config.isTestMode ? 6 : 5;
    const effortScore = config.isTestMode ? 4 : 5;
    const riskScore = config.isTestMode ? 2 : 3;
    const overallScore = config.isTestMode ? 7 : 5;
    const rationale = config.isTestMode ? 'Test stub — deterministic scores' : 'Auto-triaged';

    db.prepare(`
      INSERT OR IGNORE INTO suggestion_clusters (id, canonical_summary, tags, suggestion_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(clusterId, suggestion.title, suggestion.tags, JSON.stringify([suggestion.id]));

    db.prepare(`
      INSERT OR REPLACE INTO suggestion_scores (id, cluster_id, demand_score, impact_score, effort_score, risk_score, overall_score, rationale)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuid(), clusterId, demandScore, impactScore, effortScore, riskScore, overallScore, rationale);

    // Update suggestion status to triaged
    db.prepare(`UPDATE suggestions SET status = 'triaged', updated_at = datetime('now') WHERE id = ?`).run(suggestion.id);

    results.push({ clusterId, demandScore, impactScore, effortScore, riskScore, overallScore, rationale });
    logger.info({ clusterId, suggestionId: suggestion.id }, 'Suggestion triaged');
  }

  return results;
}
