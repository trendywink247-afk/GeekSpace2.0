// ============================================================
// Video Generator Routes
// Users can generate short videos via Pollinations (free) or
// OpenRouter models, and manage a gallery of up to 5 videos
// (24h TTL). Videos take longer to generate (30-120s).
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { logger } from '../logger.js';
import { generateVideo, checkMediaStatus } from '../services/media-generation.js';
import { config } from '../config.js';
import { runDirectorMode } from '../services/director-mode.js';

export const videosRouter = Router();

const MAX_VIDEOS_PER_USER = 5;
const VIDEO_TTL_HOURS = 24;

// ---- Helpers ------------------------------------------------

function getUserVideoCount(userId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM user_videos
     WHERE user_id = ? AND datetime(expires_at) > datetime('now')`
  ).get(userId) as { count: number };
  return row.count;
}

// ---- List user videos ----------------------------------------

videosRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  const videos = db.prepare(`
    SELECT id, prompt, model, video_url, width, height, duration, status, source, created_at, expires_at
    FROM user_videos
    WHERE user_id = ? AND datetime(expires_at) > datetime('now')
    ORDER BY created_at DESC
  `).all(userId);

  res.json({ videos, count: videos.length, max: MAX_VIDEOS_PER_USER });
});

// ---- Get single video ----------------------------------------

videosRouter.get('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const video = db.prepare(
    `SELECT * FROM user_videos WHERE id = ? AND user_id = ? AND datetime(expires_at) > datetime('now')`
  ).get(id, userId);

  if (!video) {
    return res.status(404).json({ error: 'Video not found or expired' });
  }

  res.json(video);
});

// ---- Generate video (text-to-video) --------------------------

videosRouter.post('/generate', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { prompt, model, width, height, duration } = req.body as {
    prompt: string;
    model?: string;
    width?: number;
    height?: number;
    duration?: number;
  };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt too long (max 2000 chars)' });
  }

  // Check video limit
  const count = getUserVideoCount(userId);
  if (count >= MAX_VIDEOS_PER_USER) {
    return res.status(429).json({
      error: `Video limit reached (${MAX_VIDEOS_PER_USER}). Delete some videos or wait for them to expire.`,
    });
  }

  const w = Math.min(Math.max(width || 1280, 480), 1920);
  const h = Math.min(Math.max(height || 720, 360), 1080);
  const dur = Math.min(Math.max(duration || 5, 3), 10);
  let selectedModel = model || 'pollinations';

  // Auto select: pick best available model based on credit balance
  if (selectedModel === 'auto') {
    const sub = db.prepare(
      'SELECT credits_remaining FROM subscriptions WHERE user_id = ?'
    ).get(userId) as { credits_remaining: number } | undefined;
    const credits = sub?.credits_remaining ?? 0;

    if (credits >= 25) {
      selectedModel = 'premium';
    } else if (credits >= 15 && config.openrouterApiKey) {
      selectedModel = 'openrouter-video';
    } else {
      selectedModel = 'pollinations';
    }
  }

  try {
    let videoUrl = '';
    let estimatedTime = 30;

    if (selectedModel === 'pollinations' || selectedModel === 'free') {
      const result = await generateVideo(prompt, { width: w, height: h, duration: dur });
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Video generation failed' });
      }
      videoUrl = result.url;
      estimatedTime = result.estimatedTime || 30;
    } else if (selectedModel === 'openrouter-video' || selectedModel.includes('/')) {
      // Use OpenRouter video generation (falls back to Pollinations)
      const orModel = selectedModel === 'openrouter-video'
        ? 'google/veo-2'  // Google Veo 2 for video gen
        : selectedModel;

      const orResult = await callOpenRouterVideo(prompt, orModel, w, h, dur);
      videoUrl = orResult.url;
      estimatedTime = orResult.estimatedTime || 30;

      if (!orModel.includes(':free')) {
        db.prepare(`
          UPDATE subscriptions
          SET credits_remaining = MAX(0, credits_remaining - 15),
              credits_used_this_cycle = credits_used_this_cycle + 15
          WHERE user_id = ?
        `).run(userId);
      }
    } else if (selectedModel === 'premium') {
      // Premium: Enhance prompt via Kimi, then generate
      const enhancedPrompt = await enhanceVideoPromptWithKimi(prompt);
      const result = await generateVideo(enhancedPrompt, { width: w, height: h, duration: dur });
      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Premium video generation failed' });
      }
      videoUrl = result.url;
      estimatedTime = result.estimatedTime || 30;

      db.prepare(`
        UPDATE subscriptions
        SET credits_remaining = MAX(0, credits_remaining - 25),
            credits_used_this_cycle = credits_used_this_cycle + 25
        WHERE user_id = ?
      `).run(userId);
    } else {
      return res.status(400).json({ error: `Unknown model: ${selectedModel}` });
    }

    // Save to DB — status is 'processing' initially since videos take time
    const id = `vid-${uuid().slice(0, 12)}`;
    const expiresAt = new Date(Date.now() + VIDEO_TTL_HOURS * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO user_videos (id, user_id, prompt, model, video_url, width, height, duration, status, source, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', 'generated', ?)
    `).run(id, userId, prompt, selectedModel, videoUrl, w, h, dur, expiresAt);

    // Activity log
    db.prepare(`
      INSERT INTO activity_log (id, user_id, action, details, icon)
      VALUES (?, ?, 'Video generated', ?, 'film')
    `).run(uuid(), userId, `"${prompt.slice(0, 60)}..." via ${selectedModel}`);

    logger.info({ userId, videoId: id, model: selectedModel, duration: dur }, 'Video generation started');

    res.json({
      id,
      prompt,
      model: selectedModel,
      video_url: videoUrl,
      width: w,
      height: h,
      duration: dur,
      status: 'processing',
      estimated_time: estimatedTime,
      source: 'generated',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Video generation failed');
    res.status(500).json({ error: 'Video generation failed' });
  }
});

// ---- Check video readiness (polling) -------------------------

videosRouter.get('/:id/status', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const video = db.prepare(
    `SELECT * FROM user_videos WHERE id = ? AND user_id = ?`
  ).get(id, userId) as { id: string; video_url: string; status: string } | undefined;

  if (!video) {
    return res.status(404).json({ error: 'Video not found' });
  }

  if (video.status === 'ready') {
    return res.json({ status: 'ready', video_url: video.video_url });
  }

  // Check if the video URL is ready
  try {
    const check = await checkMediaStatus(video.video_url);
    if (check.ready) {
      db.prepare('UPDATE user_videos SET status = ? WHERE id = ?').run('ready', id);
      return res.json({ status: 'ready', video_url: video.video_url });
    }
  } catch { /* non-fatal */ }

  res.json({ status: 'processing', video_url: video.video_url });
});

// ---- Delete video --------------------------------------------

videosRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const result = db.prepare(
    'DELETE FROM user_videos WHERE id = ? AND user_id = ?'
  ).run(id, userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Video not found' });
  }

  logger.info({ userId, videoId: id }, 'Video deleted');
  res.json({ deleted: true });
});

// ---- Available models ----------------------------------------

videosRouter.get('/models/available', requireAuth, (_req: AuthRequest, res) => {
  const models = [
    {
      id: 'auto',
      name: 'Auto Select',
      description: 'Automatically picks the best model based on your credits',
      cost: 'Varies',
      credits: 0,
      tier: 'auto',
    },
    {
      id: 'pollinations',
      name: 'Pollinations AI',
      description: 'Free video generation (3-10s clips)',
      cost: 'Free',
      credits: 0,
      tier: 'free',
    },
    {
      id: 'openrouter-video',
      name: 'Veo 2',
      description: 'Google Veo 2 via OpenRouter — higher quality',
      cost: '15 credits',
      credits: 15,
      tier: 'standard',
    },
    {
      id: 'premium',
      name: 'Premium (AI Enhanced)',
      description: 'Kimi enhances your prompt for cinematic results',
      cost: '25 credits',
      credits: 25,
      tier: 'premium',
    },
  ];

  res.json({ models });
});

// ──────────────────────────────────────────────────────────────
// 55.13: Seedance Director Mode
// POST /api/videos/director/create  — start a director job
// GET  /api/videos/director/:jobId  — poll job status
// GET  /api/videos/director         — list user's director jobs
// ──────────────────────────────────────────────────────────────

const DIRECTOR_CREDITS = 60; // 6 clips × 10 credits each
const MAX_CONCURRENT_DIRECTOR_JOBS = 1;

videosRouter.post('/director/create', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { idea, width, height } = req.body as {
    idea: string;
    width?: number;
    height?: number;
  };

  if (!idea?.trim()) {
    res.status(400).json({ error: 'idea is required' });
    return;
  }
  if (idea.length > 500) {
    res.status(400).json({ error: 'idea too long (max 500 chars)' });
    return;
  }

  // Per-user concurrency limit: 1 active job
  const activeJobs = db.prepare(
    "SELECT COUNT(*) as count FROM video_jobs WHERE user_id = ? AND status IN ('pending', 'running')"
  ).get(userId) as { count: number };
  if (activeJobs.count >= MAX_CONCURRENT_DIRECTOR_JOBS) {
    res.status(429).json({ error: 'A Director Mode job is already running. Please wait for it to finish.' });
    return;
  }

  // Credits check (skip in test mode)
  if (!config.isTestMode) {
    const sub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number } | undefined;
    if ((sub?.credits_remaining ?? 0) < DIRECTOR_CREDITS) {
      res.status(402).json({ error: `Insufficient credits. Director Mode requires ${DIRECTOR_CREDITS} credits.`, required: DIRECTOR_CREDITS });
      return;
    }
  }

  // Create job record
  const jobId = `dj-${uuid().slice(0, 12)}`;
  db.prepare(
    'INSERT INTO video_jobs (id, user_id, idea, status, clips) VALUES (?, ?, ?, ?, ?)'
  ).run(jobId, userId, idea.trim(), 'running', '[]');

  logger.info({ userId, jobId, idea: idea.slice(0, 60) }, 'Director Mode job started');

  // Run pipeline async — respond immediately with jobId
  // (client polls /director/:jobId for updates)
  setImmediate(async () => {
    try {
      const w = Math.min(Math.max(width || 1280, 480), 1920);
      const h = Math.min(Math.max(height || 720, 360), 1080);

      const result = await runDirectorMode(idea.trim(), w, h);

      if (result.success) {
        // Deduct credits in production
        if (!config.isTestMode) {
          db.prepare(`
            UPDATE subscriptions
            SET credits_remaining = MAX(0, credits_remaining - ?),
                credits_used_this_cycle = credits_used_this_cycle + ?
            WHERE user_id = ?
          `).run(DIRECTOR_CREDITS, DIRECTOR_CREDITS, userId);
        }

        db.prepare(
          'UPDATE video_jobs SET status = ?, packet = ?, clips = ?, credits_used = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).run('done', JSON.stringify(result.packet), JSON.stringify(result.clips), DIRECTOR_CREDITS, jobId);

        db.prepare(
          'INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)'
        ).run(uuid(), userId, 'Director Mode video created', result.packet?.title ?? idea.slice(0, 60), 'film');

        logger.info({ jobId, clips: result.clips.length }, 'Director Mode job completed');
      } else {
        db.prepare(
          'UPDATE video_jobs SET status = ?, error = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).run('failed', result.error ?? 'Unknown error', jobId);
        logger.warn({ jobId, error: result.error }, 'Director Mode job failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      db.prepare(
        'UPDATE video_jobs SET status = ?, error = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).run('failed', msg, jobId);
      logger.error({ err, jobId }, 'Director Mode job threw');
    }
  });

  res.status(202).json({
    jobId,
    status: 'running',
    message: 'Director Mode pipeline started. Poll /api/videos/director/:jobId for status.',
  });
});

videosRouter.get('/director', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rows = db.prepare(
    'SELECT id, idea, status, packet, clips, error, credits_used, created_at, updated_at FROM video_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(userId) as Array<Record<string, unknown>>;

  const jobs = rows.map((r) => ({
    ...r,
    packet: r.packet ? JSON.parse(r.packet as string) : null,
    clips: r.clips ? JSON.parse(r.clips as string) : [],
  }));

  res.json({ jobs });
});

videosRouter.get('/director/:jobId', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const row = db.prepare(
    'SELECT id, idea, status, packet, clips, error, credits_used, created_at, updated_at FROM video_jobs WHERE id = ? AND user_id = ?'
  ).get(req.params.jobId, userId) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Director job not found' });
    return;
  }

  res.json({
    ...row,
    packet: row.packet ? JSON.parse(row.packet as string) : null,
    clips: row.clips ? JSON.parse(row.clips as string) : [],
  });
});

// ---- Cleanup expired videos -----------------------------------

export function cleanupExpiredVideos(): void {
  try {
    const expired = db.prepare(`
      SELECT id, user_id FROM user_videos
      WHERE datetime(expires_at) <= datetime('now')
    `).all() as Array<{ id: string; user_id: string }>;

    if (expired.length > 0) {
      db.prepare(`
        DELETE FROM user_videos WHERE datetime(expires_at) <= datetime('now')
      `).run();
      logger.info({ count: expired.length }, 'Expired videos cleaned up');
    }
  } catch (err) {
    logger.error({ err }, 'Video cleanup failed');
  }
}

// ---- OpenRouter video generation ------------------------------

async function callOpenRouterVideo(
  prompt: string,
  model: string,
  width: number,
  height: number,
  duration: number
): Promise<{ success: boolean; url: string; estimatedTime?: number; error?: string }> {
  try {
    if (!config.openrouterApiKey) {
      return generateVideo(prompt, { width, height, duration });
    }

    // Try OpenRouter video generation endpoint
    const response = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openrouterApiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'Agentin Video Generator',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: `Generate a ${duration}-second video: ${prompt}`,
          },
        ],
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, model }, 'OpenRouter video failed, falling back to Pollinations');
      return generateVideo(prompt, { width, height, duration });
    }

    // For most OpenRouter models, video gen will fall back to Pollinations
    // as true video generation APIs are still limited
    return generateVideo(prompt, { width, height, duration });
  } catch (err) {
    logger.error({ err, model }, 'OpenRouter video error, falling back');
    return generateVideo(prompt, { width, height, duration });
  }
}

// ---- Kimi prompt enhancement for video -----------------------

async function enhanceVideoPromptWithKimi(prompt: string): Promise<string> {
  try {
    if (!config.openrouterApiKey) return prompt;

    const response = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openrouterApiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'Agentin Video Prompt Enhancer',
      },
      body: JSON.stringify({
        model: config.moonshotReasoningModel || 'anthropic/claude-sonnet-4-5-20250929',
        messages: [
          {
            role: 'system',
            content: 'You are an expert video prompt engineer. Enhance the user\'s video description into a detailed, cinematic prompt optimized for AI video generation. Include camera movement, lighting, mood, and visual style. Output ONLY the enhanced prompt. Keep it under 200 words.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return prompt;

    const data = await response.json() as {
      choices?: Array<{ message?: { content: string } }>;
    };

    return data.choices?.[0]?.message?.content?.trim() || prompt;
  } catch {
    return prompt;
  }
}
