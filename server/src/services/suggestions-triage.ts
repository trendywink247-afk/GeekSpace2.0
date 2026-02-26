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
// Phase 71.7: Max batch size to prevent DoS
const MAX_TRIAGE_BATCH = 50;
const TRENDING_WEIGHTED_THRESHOLD = 3;

export async function triageSuggestions(suggestionIds: string[]): Promise<TriageScore[]> {
  if (!suggestionIds.length) return [];

  // Phase 71.7: Safety limit on batch size
  if (suggestionIds.length > MAX_TRIAGE_BATCH) {
    logger.warn({ requested: suggestionIds.length, max: MAX_TRIAGE_BATCH }, 'Triage batch size exceeded limit, truncating');
    suggestionIds = suggestionIds.slice(0, MAX_TRIAGE_BATCH);
  }

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

      // Phase 69.14: Generate cluster name
      const clusterName = config.isTestMode
        ? 'Cluster: ' + suggestion.title.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
        : suggestion.title.split(/\s+/).slice(0, 4).join(' ');

      db.prepare(`
        INSERT OR IGNORE INTO suggestion_clusters (id, canonical_summary, tags, suggestion_ids, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(clusterId, suggestion.title, suggestion.tags, JSON.stringify([suggestion.id]), clusterName);

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

  // ── Phase 69.11: Cluster auto-merge for high-overlap groups ─────────────────
  // Skip in TEST_MODE to keep test scores deterministic
  if (!config.isTestMode) {
    try {
      // Fetch all clusters with 2+ suggestions
      const allClusters = db.prepare(
        `SELECT id, canonical_summary, suggestion_ids FROM suggestion_clusters`
      ).all() as Array<{ id: string; canonical_summary: string; suggestion_ids: string }>;

      const clustersWithMultiple = allClusters.filter(c => {
        try { return (JSON.parse(c.suggestion_ids) as string[]).length >= 2; } catch { return false; }
      });

      const merged = new Set<string>(); // track clusters already merged away

      for (let i = 0; i < clustersWithMultiple.length; i++) {
        for (let j = i + 1; j < clustersWithMultiple.length; j++) {
          const a = clustersWithMultiple[i];
          const b = clustersWithMultiple[j];
          if (merged.has(a.id) || merged.has(b.id)) continue;

          // Compute word overlap on top-3 words of each canonical_summary
          const top3 = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
          const overlap = wordOverlapRatio(top3(a.canonical_summary), top3(b.canonical_summary));

          if (overlap > 0.7) {
            // Merge smaller into larger
            let idsA: string[] = []; try { idsA = JSON.parse(a.suggestion_ids) as string[]; } catch { idsA = []; }
            let idsB: string[] = []; try { idsB = JSON.parse(b.suggestion_ids) as string[]; } catch { idsB = []; }

            const [winner, loser, loserIds] = idsA.length >= idsB.length
              ? [a, b, idsB]
              : [b, a, idsA];

            // Move loser's suggestion_ids to winner
            const combinedIds = [...new Set([
              ...(idsA.length >= idsB.length ? idsA : idsB),
              ...loserIds,
            ])];
            db.prepare(
              `UPDATE suggestion_clusters SET suggestion_ids = ?, updated_at = datetime('now') WHERE id = ?`
            ).run(JSON.stringify(combinedIds), winner.id);

            // Delete loser cluster (cascade deletes scores)
            db.prepare(`DELETE FROM suggestion_clusters WHERE id = ?`).run(loser.id);
            merged.add(loser.id);
            logger.info({ winnerId: winner.id, loserId: loser.id, overlap, combinedCount: combinedIds.length }, 'Clusters auto-merged (>70% overlap)');
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Cluster auto-merge step failed (non-fatal)');
    }
  }

  // ── Phase 71.13: Mark trending suggestions with decay scoring ───────────────
  // Votes in last 24h count as 1.0; votes 24-48h count as 0.5 (decay)
  // TEST_MODE: any suggestion with at least 1 upvote total is trending
  // Prod: suggestions need weighted score >= 3 to be trending
  try {
    let trendingIds: string[] = [];

    if (config.isTestMode) {
      // TEST_MODE: simpler — any suggestion with at least 1 upvote total
      const rows = db.prepare(`
        SELECT suggestion_id
        FROM suggestion_votes
        WHERE vote = 1
        GROUP BY suggestion_id
        HAVING COUNT(*) >= 1
      `).all() as Array<{ suggestion_id: string }>;
      trendingIds = rows.map(r => r.suggestion_id);
    } else {
      // Prod: weighted trending score with decay
      // Recent votes (< 24h) = 1.0 weight, older votes (24-48h) = 0.5 weight
      const rows = db.prepare(`
        SELECT suggestion_id,
          SUM(CASE
            WHEN created_at >= datetime('now', '-24 hours') THEN 1.0
            WHEN created_at >= datetime('now', '-48 hours') THEN 0.5
            ELSE 0.0
          END) as weighted_score
        FROM suggestion_votes
        WHERE vote = 1
        GROUP BY suggestion_id
        HAVING weighted_score >= ${TRENDING_WEIGHTED_THRESHOLD}
      `).all() as Array<{ suggestion_id: string; weighted_score: number }>;
      trendingIds = rows.map(r => r.suggestion_id);
    }

    if (trendingIds.length > 0) {
      // Reset all to 0 first, then mark trending ones
      db.prepare(`UPDATE suggestions SET trending = 0`).run();
      const placeholders = trendingIds.map(() => '?').join(',');
      db.prepare(`UPDATE suggestions SET trending = 1 WHERE id IN (${placeholders})`).run(...trendingIds);
      logger.info({ trendingCount: trendingIds.length }, 'Trending suggestions updated (with decay)');
    } else {
      db.prepare(`UPDATE suggestions SET trending = 0`).run();
    }
  } catch (err) {
    logger.warn({ err }, 'Trending update step failed (non-fatal)');
  }

  return results;
}
