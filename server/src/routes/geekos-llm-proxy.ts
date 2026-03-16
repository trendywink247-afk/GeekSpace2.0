// ============================================================
// GeekOS LLM Proxy — OpenAI-compatible endpoint for ElizaOS
//
// ElizaOS thinks it's calling OpenAI, but we route through
// Agentin's provider waterfall (Ollama → Groq → Gemini → etc.)
// Internal Docker network only — NOT exposed via Caddy.
// ============================================================

import { Router } from 'express';
import { routeChat, type ChatMessage } from '../services/llm.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { v4 as uuid } from 'uuid';

export const geekosLlmProxyRouter = Router();

// POST /api/geekos-llm/v1/chat/completions — OpenAI-compatible
geekosLlmProxyRouter.post('/v1/chat/completions', async (req, res) => {
  const userId = req.headers['x-agentin-user-id'] as string;
  if (!userId) {
    res.status(400).json({ error: { message: 'Missing X-Agentin-User-Id header', type: 'invalid_request_error' } });
    return;
  }

  const { messages, max_tokens } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: { message: 'messages array is required', type: 'invalid_request_error' } });
    return;
  }

  try {
    // Get user credits for routing
    const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number } | undefined;
    const userCredits = user?.credits ?? 0;

    // Extract system prompt if present
    const systemMessages = messages.filter((m: { role: string }) => m.role === 'system');
    const systemPrompt = systemMessages.length > 0 ? systemMessages.map((m: { content: string }) => m.content).join('\n') : '';
    const chatMessages: ChatMessage[] = messages
      .filter((m: { role: string }) => m.role !== 'system')
      .map((m: { role: string; content: string }) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const result = await routeChat(chatMessages, {
      systemPrompt,
      agentName: 'GeekOS',
      userCredits,
      userId,
    });

    // Deduct credits if applicable
    if (result.creditCost > 0) {
      db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(result.creditCost, userId);
    }

    // Log usage
    db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'geekos', 'geekos.chat')`).run(
      uuid(), userId, result.provider, result.model, result.tokensIn, result.tokensOut, result.creditCost,
    );

    // Return OpenAI-compatible response
    res.json({
      id: `chatcmpl-${uuid()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: result.reply },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: result.tokensIn,
        completion_tokens: result.tokensOut,
        total_tokens: result.tokensIn + result.tokensOut,
      },
    });
  } catch (err) {
    logger.error({ err, userId }, 'GeekOS LLM proxy error');
    res.status(500).json({
      error: { message: 'Internal proxy error', type: 'server_error' },
    });
  }
});

// GET /api/geekos-llm/v1/models — list available models (ElizaOS queries this)
geekosLlmProxyRouter.get('/v1/models', (_req, res) => {
  res.json({
    object: 'list',
    data: [{
      id: 'agentin-default',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'agentin',
    }],
  });
});
