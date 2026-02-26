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

// ── Word-overlap helper (Task 68.14) ─────────────────────────────────────────
function wordOverlapRatio(a: string, b: string): number {
  const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean);
  const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (!wordsA.length || !wordsB.length) return 0;
  const setA = new Set(wordsA);
  const common = wordsB.filter(w => setA.has(w)).length;
  return common / Math.max(wordsA.length, wordsB.length);
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

  // Task 68.14: Load existing clusters to detect similarity and merge instead of creating new ones
  const existingClusters = db.prepare(
    `SELECT id, canonical_summary, suggestion_ids FROM suggestion_clusters`
  ).all() as Array<{ id: string; canonical_summary: string; suggestion_ids: string }>;

  for (const suggestion of suggestions) {
    const demandScore = config.isTestMode ? 7 : 5;
    const impactScore = config.isTestMode ? 6 : 5;
    const effortScore = config.isTestMode ? 4 : 5;
    const riskScore = config.isTestMode ? 2 : 3;
    const overallScore = config.isTestMode ? 7 : 5;
    const rationale = config.isTestMode ? 'Test stub — deterministic scores' : 'Auto-triaged';

    // Task 68.14: Check if existing cluster has >= 50% word overlap with suggestion title
    let matchedClusterId: string | null = null;
    for (const cluster of existingClusters) {
      if (wordOverlapRatio(suggestion.title, cluster.canonical_summary) >= 0.5) {
        matchedClusterId = cluster.id;
        break;
      }
    }

    if (matchedClusterId) {
      // Add this suggestion to the existing cluster
      const existing = existingClusters.find(c => c.id === matchedClusterId)!;
      let ids: string[] = [];
      try { ids = JSON.parse(existing.suggestion_ids) as string[]; } catch { ids = []; }
      if (!ids.includes(suggestion.id)) {
        ids.push(suggestion.id);
      }
      db.prepare(
        `UPDATE suggestion_clusters SET suggestion_ids = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(JSON.stringify(ids), matchedClusterId);

      // Update the cluster's score
      db.prepare(`
        INSERT OR REPLACE INTO suggestion_scores (id, cluster_id, demand_score, impact_score, effort_score, risk_score, overall_score, rationale)
        VALUES ((SELECT id FROM suggestion_scores WHERE cluster_id = ?), ?, ?, ?, ?, ?, ?, ?)
      `).run(matchedClusterId, matchedClusterId, demandScore, impactScore, effortScore, riskScore, overallScore, rationale);

      // Update suggestion status to triaged
      db.prepare(`UPDATE suggestions SET status = 'triaged', updated_at = datetime('now') WHERE id = ?`).run(suggestion.id);

      results.push({ clusterId: matchedClusterId, demandScore, impactScore, effortScore, riskScore, overallScore, rationale });
      logger.info({ clusterId: matchedClusterId, suggestionId: suggestion.id, merged: true }, 'Suggestion merged into existing cluster');
    } else {
      // Create a new cluster for this suggestion
      const clusterId = uuid();

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

      // Update existingClusters cache so subsequent suggestions in the same batch can match
      existingClusters.push({ id: clusterId, canonical_summary: suggestion.title, suggestion_ids: JSON.stringify([suggestion.id]) });

      results.push({ clusterId, demandScore, impactScore, effortScore, riskScore, overallScore, rationale });
      logger.info({ clusterId, suggestionId: suggestion.id, merged: false }, 'Suggestion triaged into new cluster');
    }
  }

  return results;
}
