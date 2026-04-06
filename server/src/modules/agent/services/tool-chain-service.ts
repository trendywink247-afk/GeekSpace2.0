/**
 * Tool Chain Service — Learn from successful tool sequences
 *
 * After a successful ReAct loop completes, record the tool sequence.
 * Next time a similar request comes in, suggest the same chain.
 */

import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';

export interface ToolChain {
  id: string;
  user_id: string;
  pattern: string;
  pattern_hash: string;
  tool_sequence: Array<{ tool: string; success: boolean }>;
  success_count: number;
  failure_count: number;
  last_used: string;
  created_at: string;
}

interface ToolChainRow extends Omit<ToolChain, 'tool_sequence'> {
  tool_sequence: string;
}

function parseRow(row: ToolChainRow): ToolChain {
  return {
    ...row,
    tool_sequence: (() => {
      try {
        return JSON.parse(row.tool_sequence);
      } catch {
        return [];
      }
    })(),
  };
}

/**
 * Generate a normalized pattern from a user request.
 * Removes specific entities (dates, names, URLs) to find similar requests.
 */
function normalizePattern(request: string): string {
  return request
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '<URL>')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '<DATE>')
    .replace(/\b\d{1,2}:\d{2}\b/g, '<TIME>')
    .replace(/\b\d+\b/g, '<NUM>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function hashPattern(pattern: string): string {
  return createHash('md5').update(pattern).digest('hex').slice(0, 16);
}

/**
 * Record a successful tool chain after a ReAct loop completes.
 */
export function recordToolChain(
  userId: string,
  request: string,
  toolSequence: Array<{ tool: string; success: boolean }>,
): void {
  try {
    if (toolSequence.length === 0) return;

    const pattern = normalizePattern(request);
    const patternHash = hashPattern(pattern);

    // Check if this pattern exists for this user
    const existing = db
      .prepare(
        `SELECT id, success_count, failure_count FROM tool_chains
       WHERE user_id = ? AND pattern_hash = ?`,
      )
      .get(userId, patternHash) as
      | { id: string; success_count: number; failure_count: number }
      | undefined;

    const allSucceeded = toolSequence.every((t) => t.success);

    if (existing) {
      db.prepare(
        `UPDATE tool_chains SET
          success_count = success_count + ?,
          failure_count = failure_count + ?,
          tool_sequence = ?,
          last_used = datetime('now')
        WHERE id = ?`,
      ).run(
        allSucceeded ? 1 : 0,
        allSucceeded ? 0 : 1,
        JSON.stringify(toolSequence),
        existing.id,
      );
    } else {
      db.prepare(
        `INSERT INTO tool_chains (id, user_id, pattern, pattern_hash, tool_sequence, success_count, failure_count)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        uuid(),
        userId,
        pattern,
        patternHash,
        JSON.stringify(toolSequence),
        allSucceeded ? 1 : 0,
        allSucceeded ? 0 : 1,
      );
    }

    logger.debug({ userId, tools: toolSequence.length, allSucceeded }, 'tool-chain: recorded');
  } catch (err) {
    logger.debug({ err }, 'tool-chain: record failed');
  }
}

/**
 * Find similar tool chains from past successful runs.
 * Used to suggest reusing a known-good sequence.
 */
export function findSimilarChains(userId: string, request: string, limit = 3): ToolChain[] {
  try {
    const pattern = normalizePattern(request);
    const patternHash = hashPattern(pattern);

    // Exact match first
    const exact = db
      .prepare(
        `SELECT * FROM tool_chains
       WHERE user_id = ? AND pattern_hash = ? AND success_count > failure_count
       LIMIT 1`,
      )
      .get(userId, patternHash) as ToolChainRow | undefined;

    if (exact) return [parseRow(exact)];

    // Fuzzy: find chains with overlapping keywords
    const keywords = pattern.split(' ').filter((w) => w.length > 4);
    if (keywords.length === 0) return [];

    const likeClauses = keywords
      .slice(0, 5)
      .map(() => 'pattern LIKE ?')
      .join(' OR ');
    const likeParams = keywords.slice(0, 5).map((k) => `%${k}%`);

    const fuzzy = db
      .prepare(
        `SELECT * FROM tool_chains
       WHERE user_id = ? AND success_count > failure_count
         AND (${likeClauses})
       ORDER BY success_count DESC, last_used DESC
       LIMIT ?`,
      )
      .all(userId, ...likeParams, limit) as ToolChainRow[];

    return fuzzy.map(parseRow);
  } catch (err) {
    logger.debug({ err }, 'tool-chain: find failed');
    return [];
  }
}

/**
 * Format suggested chains as a hint for the system prompt.
 */
export function formatSuggestedChainsForPrompt(userId: string, request: string): string {
  const chains = findSimilarChains(userId, request, 2);
  if (chains.length === 0) return '';

  const lines = ['## Past Successful Patterns (consider reusing)'];
  for (const chain of chains) {
    const tools = chain.tool_sequence.map((t) => t.tool).join(' → ');
    const total = chain.success_count + chain.failure_count;
    const successRate = ((chain.success_count / total) * 100).toFixed(0);
    lines.push(
      `- For requests like "${chain.pattern.slice(0, 80)}": ${tools} (${successRate}% success, used ${total}×)`,
    );
  }
  return '\n' + lines.join('\n');
}
