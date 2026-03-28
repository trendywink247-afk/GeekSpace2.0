/**
 * @fileoverview Premium agent routes — specialist session management and response quality metrics.
 *
 * Endpoints:
 * - GET  /quality               — Satisfaction rate from message reactions
 * - POST /deploy-premium        — Deploy a named specialist session (paid plans, 100 credits)
 * - POST /premium-chat/:sessionId — Chat within an active specialist session
 * - DELETE /premium-session/:sessionId — End a specialist session
 *
 * All routes except /quality require a paid subscription plan.
 */
// Extracted from agent.ts — Sprint 3 decomposition
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { validateBody, deployPremiumSchema, premiumChatSchema } from '../../../middleware/validate.js';
import { db } from '../../../db/index.js';
import { computeCreditCost, deductSubscriptionCredits } from '../services/llm.js';
import { edithChat } from '../../../services/edith.js';
import { logger } from '../../../logger.js';
import { config } from '../../../config.js';
import { generateCodename, buildPremiumPrompt, getDeployMessage } from '../services/premium-agent.js';

const router = Router();

router.get('/quality', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    // Total messages sent by this user
    const totalRow = db.prepare(
      `SELECT COUNT(*) as count FROM conversation_log WHERE user_id = ?`
    ).get(userId) as { count: number };

    // Positive reactions
    const positiveRow = db.prepare(
      `SELECT COUNT(*) as count FROM message_reactions WHERE user_id = ? AND reaction IN ('👍', '❤️', '🔥')`
    ).get(userId) as { count: number };

    // Negative reactions
    const negativeRow = db.prepare(
      `SELECT COUNT(*) as count FROM message_reactions WHERE user_id = ? AND reaction = '👎'`
    ).get(userId) as { count: number };

    const positive = positiveRow.count;
    const negative = negativeRow.count;
    const total = totalRow.count;
    const totalReacted = positive + negative;
    const satisfactionRate = totalReacted > 0 ? Math.round((positive / totalReacted) * 100) : null;

    // Trend: compare this week vs last week (reaction counts)
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const thisWeekStart = new Date(now - weekMs).toISOString();
    const lastWeekStart = new Date(now - 2 * weekMs).toISOString();

    const thisWeekPositive = (db.prepare(
      `SELECT COUNT(*) as count FROM message_reactions WHERE user_id = ? AND reaction IN ('👍', '❤️', '🔥') AND created_at >= ?`
    ).get(userId, thisWeekStart) as { count: number }).count;

    const lastWeekPositive = (db.prepare(
      `SELECT COUNT(*) as count FROM message_reactions WHERE user_id = ? AND reaction IN ('👍', '❤️', '🔥') AND created_at >= ? AND created_at < ?`
    ).get(userId, lastWeekStart, thisWeekStart) as { count: number }).count;

    const trend = lastWeekPositive === 0
      ? (thisWeekPositive > 0 ? 'up' : 'neutral')
      : thisWeekPositive > lastWeekPositive ? 'up'
      : thisWeekPositive < lastWeekPositive ? 'down'
      : 'neutral';

    res.json({
      totalMessages: total,
      positiveReactions: positive,
      negativeReactions: negative,
      satisfactionRate,
      trend,
      hasEnoughData: totalReacted >= 5,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to get agent quality metrics');
    res.status(500).json({ error: 'Failed to get quality metrics' });
  }
});

// ---- Premium Agent (Specialist Sessions) ----

router.post('/deploy-premium', requireAuth, validateBody(deployPremiumSchema), async (req: AuthRequest, res) => {
  const { task } = req.body as { task: string };
  const userId = req.userId!;

  try {
    // Check subscription: must be paid plan
    const sub = db.prepare('SELECT plan, credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string; credits_remaining: number } | undefined;
    if (!sub || sub.plan === 'free') {
      res.status(403).json({ error: 'Premium agent requires a paid plan.' });
      return;
    }
    if (sub.credits_remaining < 100) {
      res.status(403).json({ error: 'Not enough credits to deploy a specialist (100 required).' });
      return;
    }

    // Deduct deployment cost
    deductSubscriptionCredits(userId, 100);

    const codename = generateCodename();
    const agentConfig = db.prepare('SELECT personality FROM agent_configs WHERE user_id = ?').get(userId) as { personality?: string } | undefined;
    const personalityId = agentConfig?.personality || 'jarvis';

    const sessionId = uuid();
    db.prepare(`INSERT INTO premium_sessions (id, user_id, agent_codename, task, credits_used) VALUES (?, ?, ?, ?, 100)`).run(sessionId, userId, codename, task);

    const message = getDeployMessage(codename, personalityId);

    res.json({ sessionId, codename, status: 'active', message, creditsUsed: 100 });
  } catch (err) {
    logger.error({ err, userId }, 'Deploy premium agent error');
    res.status(500).json({ error: 'Failed to deploy specialist.' });
  }
});

router.post('/premium-chat/:sessionId', requireAuth, validateBody(premiumChatSchema), async (req: AuthRequest, res) => {
  const { message } = req.body as { message: string };
  const { sessionId } = req.params;
  const userId = req.userId!;

  try {
    const session = db.prepare('SELECT * FROM premium_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId) as Record<string, unknown> | undefined;
    if (!session) { res.status(404).json({ error: 'Session not found.' }); return; }
    if (session.status !== 'active') { res.status(400).json({ error: 'Session has ended.' }); return; }

    // Check credits
    const sub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number } | undefined;
    if (!sub || sub.credits_remaining <= 0) {
      res.json({ text: 'You have no credits remaining. Please upgrade your plan.', provider: 'builtin', model: '', latencyMs: 0, creditsUsed: 0, sessionCreditsTotal: session.credits_used as number, messagesCount: session.messages_count as number, creditsRemaining: 0 });
      return;
    }

    const agentConfig = db.prepare('SELECT personality FROM agent_configs WHERE user_id = ?').get(userId) as { personality?: string } | undefined;
    const personalityId = agentConfig?.personality || 'jarvis';
    const premiumSystemPrompt = buildPremiumPrompt(session.task as string, session.agent_codename as string, personalityId);

    const edithResult = await edithChat(message, premiumSystemPrompt);

    const creditCost = computeCreditCost('edith', edithResult.tokensIn, edithResult.tokensOut);
    deductSubscriptionCredits(userId, creditCost);

    // Update session stats
    const newCreditsUsed = (session.credits_used as number) + creditCost;
    const newMessagesCount = (session.messages_count as number) + 1;
    db.prepare('UPDATE premium_sessions SET credits_used = ?, messages_count = ?, model_used = ? WHERE id = ?').run(newCreditsUsed, newMessagesCount, config.moonshotReasoningModel, sessionId);

    // Log usage
    db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
      VALUES (?, ?, 'edith', ?, ?, ?, ?, 'web', 'premium-agent')`).run(
      uuid(), userId, config.moonshotReasoningModel, edithResult.tokensIn, edithResult.tokensOut, creditCost,
    );

    const updatedSub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number };

    res.json({
      text: edithResult.text,
      provider: 'edith',
      model: config.moonshotReasoningModel,
      latencyMs: edithResult.latencyMs,
      creditsUsed: creditCost,
      sessionCreditsTotal: newCreditsUsed,
      messagesCount: newMessagesCount,
      creditsRemaining: updatedSub.credits_remaining,
    });
  } catch (err) {
    logger.error({ err, userId, sessionId }, 'Premium chat error');
    res.status(500).json({ error: 'Failed to process message.' });
  }
});

router.delete('/premium-session/:sessionId', requireAuth, (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  const userId = req.userId!;

  const session = db.prepare('SELECT * FROM premium_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId) as Record<string, unknown> | undefined;
  if (!session) { res.status(404).json({ error: 'Session not found.' }); return; }

  db.prepare("UPDATE premium_sessions SET status = 'completed', ended_at = datetime('now') WHERE id = ?").run(sessionId);

  const createdAt = new Date(session.created_at as string).getTime();
  const duration = Math.round((Date.now() - createdAt) / 1000);

  res.json({
    sessionId,
    codename: session.agent_codename,
    creditsUsed: session.credits_used,
    messagesCount: session.messages_count,
    duration,
    status: 'completed',
  });
});

export default router;
