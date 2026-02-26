// ============================================================
// Seedance Director Mode
// Converts a one-line user idea into a "Director Packet" and
// then generates 6 × 5-second clips via fal.ai Seedance,
// returning clip URLs for the frontend to stitch/display.
//
// Director Packet JSON schema:
// {
//   title: string,
//   genre: string,
//   styleGuide: string,        // lighting, palette, mood
//   transitions: string,       // e.g. "match cut", "dissolve"
//   shotlist: [
//     { index: 1..6, prompt: string, cameraMove: string }
//   ]
// }
// ============================================================

import { config } from '../config.js';
import { logger } from '../logger.js';
import { generateFalClip, type FalClipResult } from './fal-video.js';

export interface DirectorShot {
  index: number;
  prompt: string;
  cameraMove: string;
}

export interface DirectorPacket {
  title: string;
  genre: string;
  styleGuide: string;
  transitions: string;
  shotlist: DirectorShot[];
}

export interface DirectorJobResult {
  success: boolean;
  packet?: DirectorPacket;
  clips: FalClipResult[];
  error?: string;
}

// ── TEST_MODE Director Packet stub ──────────────────────────

function stubDirectorPacket(idea: string): DirectorPacket {
  return {
    title: `Director: ${idea.slice(0, 40)}`,
    genre: 'Cinematic Short',
    styleGuide: 'Deep shadows, neon accents, high contrast',
    transitions: 'Match cut, dissolve',
    shotlist: Array.from({ length: 6 }, (_, i) => ({
      index: i + 1,
      prompt: `Shot ${i + 1}: ${idea.slice(0, 60)} — ${['wide establishing', 'medium close-up', 'extreme close-up', 'over-the-shoulder', 'low angle', 'birds-eye'][i]} shot`,
      cameraMove: ['static', 'slow push-in', 'pan right', 'tilt up', 'dolly back', 'arc'][i],
    })),
  };
}

// ── LLM Director Packet generation ─────────────────────────

const DIRECTOR_SYSTEM_PROMPT = `You are an expert AI film director. Given a one-line idea, produce a JSON Director Packet for a 30-second film (6 clips × 5s each).

Return ONLY valid JSON matching this exact schema:
{
  "title": "string (3-7 words)",
  "genre": "string (e.g. 'Cyberpunk Thriller')",
  "styleGuide": "string (lighting + palette + mood, max 20 words)",
  "transitions": "string (e.g. 'match cut between shots 1-2, dissolve elsewhere')",
  "shotlist": [
    { "index": 1, "prompt": "string (detailed video generation prompt, 20-40 words)", "cameraMove": "string" },
    { "index": 2, "prompt": "...", "cameraMove": "..." },
    { "index": 3, "prompt": "...", "cameraMove": "..." },
    { "index": 4, "prompt": "...", "cameraMove": "..." },
    { "index": 5, "prompt": "...", "cameraMove": "..." },
    { "index": 6, "prompt": "...", "cameraMove": "..." }
  ]
}

Rules:
- Exactly 6 shots.
- Each shot prompt must include the styleGuide mood and be self-contained for video gen.
- No commentary, no markdown, just raw JSON.`;

async function generateDirectorPacket(idea: string): Promise<DirectorPacket> {
  if (config.isTestMode) {
    return stubDirectorPacket(idea);
  }

  // Try OpenRouter (preferred for coherent structured output)
  const apiKey = config.openrouterApiKey || config.openrouterFreeApiKey;
  const model = config.openrouterModel || 'anthropic/claude-sonnet-4-5-20250929';

  if (!apiKey) {
    logger.warn('No LLM API key — using stub Director Packet');
    return stubDirectorPacket(idea);
  }

  try {
    const res = await fetch(`${config.openrouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': config.publicUrl,
        'X-Title': 'Agentin Director Mode',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
          { role: 'user', content: idea },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, 'Director Packet LLM call failed — using stub');
      return stubDirectorPacket(idea);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';

    // Strip ```json fences if present
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const packet = JSON.parse(jsonStr) as DirectorPacket;

    // Validate minimally
    if (!Array.isArray(packet.shotlist) || packet.shotlist.length < 6) {
      logger.warn('Director Packet invalid — using stub');
      return stubDirectorPacket(idea);
    }

    return packet;
  } catch (err) {
    logger.warn({ err }, 'Director Packet generation error — using stub');
    return stubDirectorPacket(idea);
  }
}

// ── Director Job (packet + 6 clips) ─────────────────────────

/**
 * Run the full Director Mode pipeline:
 * 1. LLM generates Director Packet from idea
 * 2. Generate 6 fal.ai clips (sequentially to respect rate limits)
 * Returns packet + clip results
 */
export async function runDirectorMode(
  idea: string,
  width: number = 1280,
  height: number = 720
): Promise<DirectorJobResult> {
  try {
    logger.info({ idea: idea.slice(0, 80) }, 'Director Mode: generating packet');
    const packet = await generateDirectorPacket(idea);

    logger.info({ title: packet.title, shots: packet.shotlist.length }, 'Director Mode: packet ready, generating clips');

    const clips: FalClipResult[] = [];
    for (const shot of packet.shotlist.slice(0, 6)) {
      const result = await generateFalClip(
        { prompt: shot.prompt, width, height, duration: 5 },
        shot.index - 1
      );
      clips.push(result);
      // Brief gap between API calls in production
      if (!config.isTestMode && shot.index < 6) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const successCount = clips.filter((c) => c.success).length;
    logger.info({ successCount, total: clips.length }, 'Director Mode: clips generated');

    return { success: true, packet, clips };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.error({ err }, 'Director Mode pipeline error');
    return { success: false, clips: [], error: msg };
  }
}
