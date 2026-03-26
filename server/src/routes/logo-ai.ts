// Logo AI — Together AI FLUX (images) + Moonshot (parametric SVG + refinement)
// Endpoints: ai-visual, ai-suggest, ai-evolve, ai-refine, brand-kit, status

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import {
  type LogoCategory, type LogoType, STYLE_TEMPLATES,
  buildPrompt, pickTemplates, sanitizePromptFragment,
  REFINE_SYSTEM_PROMPT, BRAND_KIT_SYSTEM_PROMPT,
} from './logo-prompts.js';

export const logoAiRouter = Router();

interface LogoParams {
  shape: 'squircle' | 'circle' | 'chat-left' | 'chat-right';
  cornerRadius: number; gradientFrom: string; gradientTo: string; gradientAngle: number;
  letterStrokeWidth: number; crossbarY: number; crossbarThickness: number;
  crossbarStyle: 'solid' | 'agent-dots' | 'none';
  innerElement: 'none' | 'constellation' | 'ai-eye' | 'neural';
  agentDotColor: string; showGlowRing: boolean; glowOpacity: number;
}

const VALID_LOGO_TYPES: LogoType[] = ['icon', 'wordmark', 'lettermark', 'emblem', 'abstract', 'mascot'];
const VALID_CATEGORIES: LogoCategory[] = ['minimal', 'geometric', 'gradient', 'wordmark', 'emblem', 'abstract', 'indian', 'mascot'];

function safeName(v: unknown, fallback: string, max = 50): string {
  return String(v || fallback).replace(/[<>{}[\]\\]/g, '').trim().slice(0, max);
}

function safeString(v: unknown, fallback: string, max = 200): string {
  return String(v || fallback).replace(/[<>{}[\]\\]/g, '').trim().slice(0, max);
}

/** Generate a single image via Together AI FLUX.1-schnell */
async function generateFluxImage(prompt: string): Promise<string> {
  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.togetherApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'black-forest-labs/FLUX.1-schnell',
      prompt,
      width: 512,
      height: 512,
      steps: 4,
      n: 1,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Together ${response.status}: ${err.slice(0, 100)}`);
  }

  const data = await response.json() as {
    data?: { url?: string; b64_json?: string }[];
  };
  const img = data.data?.[0];
  return img?.url || (img?.b64_json ? `data:image/jpeg;base64,${img.b64_json}` : '');
}

/** Call Moonshot chat completions */
async function callMoonshot(system: string, user: string, maxTokens = 1024): Promise<string> {
  const response = await fetch(`${config.moonshotDirectBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.moonshotDirectApiKey}`,
    },
    body: JSON.stringify({
      model: 'moonshot-v1-8k',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.8,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    logger.error({ status: response.status, body: errText }, 'Moonshot API error');
    throw new Error(`Moonshot ${response.status}`);
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ---- POST /ai-visual — FLUX logo generation with industry + logoType ----

logoAiRouter.post('/ai-visual', requireAuth, async (req: AuthRequest, res) => {
  res.setTimeout(90000);

  if (!config.togetherApiKey) {
    return res.status(503).json({ error: 'Image generation not configured' });
  }

  const {
    direction,
    batch = 0,
    companyName,
    industry,
    logoType,
    style,
  } = req.body as {
    direction?: string;
    batch?: number;
    companyName?: string;
    industry?: string;
    logoType?: string;
    style?: string;
  };

  const name = safeName(companyName, 'Agentin');
  const safeIndustry = industry ? safeString(industry, '') : undefined;
  const safeLogoType = VALID_LOGO_TYPES.includes(logoType as LogoType)
    ? (logoType as LogoType)
    : undefined;
  const safeCategory = VALID_CATEGORIES.includes(style as LogoCategory)
    ? (style as LogoCategory)
    : undefined;
  const offset = (Number(batch) || 0) * 4;

  // Build 4 prompts from style templates, optionally filtered by category
  const safeDir = direction ? sanitizePromptFragment(direction) : '';
  const templates = pickTemplates(4, offset, safeCategory);
  const prompts = templates.map((t, i) => {
    const base = buildPrompt({ companyName: name, industry: safeIndustry, logoType: safeLogoType, template: t });
    return {
      name: `${t.name} #${offset + i + 1}`,
      prompt: safeDir ? `${base}, ${safeDir}` : base,
    };
  });

  try {
    const results = await Promise.allSettled(
      prompts.map(async (p) => ({
        name: p.name,
        url: await generateFluxImage(p.prompt),
        prompt: p.prompt,
      }))
    );

    const concepts = results
      .filter((r): r is PromiseFulfilledResult<{ name: string; url: string; prompt: string }> =>
        r.status === 'fulfilled' && !!r.value.url
      )
      .map((r) => r.value);

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) logger.warn({ failed, total: prompts.length }, 'Some logo generations failed');
    if (concepts.length === 0) return res.status(502).json({ error: 'All image generations failed' });

    return res.json({ concepts });
  } catch (err: any) {
    logger.error({ err }, 'Logo AI visual failed');
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ---- POST /ai-refine — conversational refinement ----

logoAiRouter.post('/ai-refine', requireAuth, async (req: AuthRequest, res) => {
  res.setTimeout(90000);

  if (!config.moonshotDirectApiKey || !config.togetherApiKey) {
    return res.status(503).json({ error: 'Refine requires both Moonshot and Together AI configured' });
  }

  const { instruction, currentPrompt, companyName, style } = req.body as {
    instruction?: string;
    currentPrompt?: string;
    companyName?: string;
    style?: string;
  };

  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: 'instruction is required (string)' });
  }
  if (!currentPrompt || typeof currentPrompt !== 'string') {
    return res.status(400).json({ error: 'currentPrompt is required (string)' });
  }

  const safeInstruction = safeString(instruction, '', 300);
  const safeCurrentPrompt = safeString(currentPrompt, '', 500);
  const safeCo = safeName(companyName, 'Agentin');
  const safeStyle = safeString(style, 'modern');

  const userMessage = `Company: "${safeCo}", Style: "${safeStyle}"\nCurrent prompt: ${safeCurrentPrompt}\nInstruction: ${safeInstruction}`;

  try {
    const modifiedPrompt = await callMoonshot(REFINE_SYSTEM_PROMPT, userMessage, 512);
    if (!modifiedPrompt || modifiedPrompt.length < 10) {
      return res.status(502).json({ error: 'AI returned invalid refinement' });
    }

    // Generate 4 variations from the modified prompt with slight seed variance
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, (_, i) => {
        const seedVariant = i === 0
          ? modifiedPrompt
          : `${modifiedPrompt}, seed:${Date.now() + i}`;
        return generateFluxImage(seedVariant).then((url) => ({
          name: `Refined #${i + 1}`,
          url,
          prompt: modifiedPrompt,
          instruction: safeInstruction,
        }));
      })
    );

    const concepts = results
      .filter((r): r is PromiseFulfilledResult<{ name: string; url: string; prompt: string; instruction: string }> =>
        r.status === 'fulfilled' && !!r.value.url
      )
      .map((r) => r.value);

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) logger.warn({ failed }, 'Some refined generations failed');
    if (concepts.length === 0) return res.status(502).json({ error: 'All refined generations failed' });

    return res.json({ concepts, modifiedPrompt });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return res.status(504).json({ error: 'AI request timed out' });
    }
    logger.error({ err }, 'Logo AI refine failed');
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ---- POST /brand-kit — AI-generated brand identity ----

logoAiRouter.post('/brand-kit', requireAuth, async (req: AuthRequest, res) => {
  res.setTimeout(90000);

  if (!config.moonshotDirectApiKey) {
    return res.status(503).json({ error: 'Moonshot API key not configured' });
  }

  const { companyName, industry, style, primaryColor } = req.body as {
    companyName?: string;
    industry?: string;
    style?: string;
    primaryColor?: string;
  };

  if (!companyName || typeof companyName !== 'string') {
    return res.status(400).json({ error: 'companyName is required (string)' });
  }

  const safeCo = safeName(companyName, 'Company');
  const safeInd = safeString(industry, 'technology');
  const safeSt = safeString(style, 'modern');
  const safeColor = primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : '';

  const userMessage = [
    `Company: "${safeCo}"`,
    `Industry: ${safeInd}`,
    `Style: ${safeSt}`,
    safeColor ? `Primary color: ${safeColor}` : '',
  ].filter(Boolean).join('\n');

  try {
    const raw = await callMoonshot(BRAND_KIT_SYSTEM_PROMPT, userMessage, 2048);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'AI returned invalid brand kit format' });
    }

    const kit = JSON.parse(jsonMatch[0]) as {
      colors?: { name: string; hex: string; usage: string }[];
      fonts?: { name: string; category: string; usage: string; googleFontsUrl: string }[];
      taglines?: string[];
      socialSizes?: { platform: string; width: number; height: number }[];
    };

    // Validate and sanitize the response
    const colors = (kit.colors || []).slice(0, 6).map((c) => ({
      name: String(c.name || '').slice(0, 30),
      hex: /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#888888',
      usage: String(c.usage || '').slice(0, 100),
    }));

    const fonts = (kit.fonts || []).slice(0, 4).map((f) => ({
      name: String(f.name || '').slice(0, 40),
      category: String(f.category || 'sans-serif').slice(0, 20),
      usage: String(f.usage || '').slice(0, 60),
      googleFontsUrl: String(f.googleFontsUrl || '').slice(0, 120),
    }));

    const taglines = (kit.taglines || []).slice(0, 5).map((t) => String(t).slice(0, 80));

    const socialSizes = (kit.socialSizes || []).slice(0, 8).map((s) => ({
      platform: String(s.platform || '').slice(0, 30),
      width: Math.min(4096, Math.max(100, Number(s.width) || 1080)),
      height: Math.min(4096, Math.max(100, Number(s.height) || 1080)),
    }));

    return res.json({ colors, fonts, taglines, socialSizes });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return res.status(504).json({ error: 'AI request timed out' });
    }
    logger.error({ err }, 'Logo AI brand-kit failed');
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ---- POST /ai-suggest — parametric SVG suggestions (Moonshot) ----

const PARAM_SYSTEM = `You are a creative logo designer for "Agentin" — an AI agent chat platform. The logo is a parametric SVG: an "A" letter cut out of a shape with gradient fills.
Valid parameters: shape ("squircle"|"circle"|"chat-left"|"chat-right"), cornerRadius (2-15), gradientFrom/gradientTo (hex), gradientAngle (0-360), letterStrokeWidth (1-4), crossbarY (0.4-0.75), crossbarThickness (0.5-5), crossbarStyle ("solid"|"agent-dots"|"none"), innerElement ("none"|"constellation"|"ai-eye"|"neural"), agentDotColor (hex), showGlowRing (bool), glowOpacity (0-1).
Brand colors: Violet #8B5CF6, Emerald #10B981, Gold #F59E0B, Purple #7C3AED, Rose #EC4899.
Return ONLY a JSON array of 4 objects: [{"name":"...", "params":{...}}]. No markdown.`;

logoAiRouter.post('/ai-suggest', requireAuth, async (req: AuthRequest, res) => {
  res.setTimeout(90000);

  if (!config.moonshotDirectApiKey) {
    return res.status(503).json({ error: 'Moonshot API key not configured' });
  }

  const { direction } = req.body as { direction?: string };
  const userPrompt = direction
    ? `User wants: "${safeString(direction, '', 200)}". Suggest 4 creative logo variations.`
    : 'Suggest 4 diverse logo variations for an AI agent chat platform.';

  try {
    const raw = await callMoonshot(PARAM_SYSTEM, userPrompt, 2048);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'AI returned invalid format' });
    }

    const variants = JSON.parse(jsonMatch[0]) as { name: string; params: LogoParams }[];
    const validated = variants.slice(0, 6).map((v) => ({
      name: String(v.name || 'Untitled').slice(0, 40),
      params: clampParams(v.params),
    }));

    return res.json({ variants: validated });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return res.status(504).json({ error: 'AI request timed out' });
    }
    logger.error({ err }, 'Logo AI suggest failed');
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ---- POST /ai-evolve — blend selected styles ----

logoAiRouter.post('/ai-evolve', requireAuth, async (req: AuthRequest, res) => {
  res.setTimeout(90000);

  if (!config.moonshotDirectApiKey || !config.togetherApiKey) {
    return res.status(503).json({ error: 'Evolve requires both Moonshot and Together AI configured' });
  }

  const {
    selectedPrompts,
    direction,
    similarity = 0.5,
    companyName = 'Agentin',
    style = 'modern tech',
  } = req.body as {
    selectedPrompts: string[];
    direction?: string;
    similarity?: number;
    companyName?: string;
    style?: string;
  };

  if (!Array.isArray(selectedPrompts) || selectedPrompts.length === 0) {
    return res.status(400).json({ error: 'selectedPrompts must be a non-empty array of strings' });
  }

  const safePrompts = selectedPrompts.slice(0, 5).map((p) => String(p).slice(0, 200));
  const safeCo = safeName(companyName, 'Agentin');
  const safeStyle = safeString(style, 'modern tech', 50);
  const safeDir = direction ? safeString(direction, '', 200) : '';
  const clampedSim = Math.min(1, Math.max(0, Number(similarity) || 0.5));

  const creativityLevel = 1 - clampedSim; // invert: low similarity = high creativity
  const creativityDesc = creativityLevel > 0.7 ? 'wildly different, experimental, unexpected directions' : creativityLevel > 0.4 ? 'moderately different, fresh takes while keeping the core vibe' : 'very close to the originals, subtle variations only';
  const evolveSystem = `You are a creative director. The user liked these logo concepts: [${safePrompts.join('; ')}]. Generate 6 NEW FLUX image-generation prompts that evolve from these.${safeDir ? ' Incorporate this direction: ' + safeDir + '.' : ''} Each prompt describes a logo for "${safeCo}" in ${safeStyle} style. Creativity level: ${creativityDesc}. Each prompt must be a complete standalone FLUX prompt (60-120 words) ending with "no text no letters no words". Return ONLY a JSON array of 6 strings. No markdown.`;

  const userMessage = 'Generate 6 evolved prompts now.';

  try {
    const raw = await callMoonshot(evolveSystem, userMessage);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn({ raw: raw.slice(0, 200) }, 'Moonshot evolve returned invalid format');
      return res.status(502).json({ error: 'AI returned invalid format for evolved prompts' });
    }

    const evolvedPrompts = (JSON.parse(jsonMatch[0]) as string[]).slice(0, 6);
    if (evolvedPrompts.length === 0) {
      return res.status(502).json({ error: 'AI returned empty prompt list' });
    }

    const fluxResults = await Promise.allSettled(
      evolvedPrompts.map(async (prompt, i) => ({
        name: `Evolved #${i + 1}`,
        url: await generateFluxImage(`${prompt}, no text no letters no words`),
        prompt,
      }))
    );

    const concepts = fluxResults
      .filter((r): r is PromiseFulfilledResult<{ name: string; url: string; prompt: string }> =>
        r.status === 'fulfilled' && !!r.value.url
      )
      .map((r) => r.value);

    const failed = fluxResults.filter((r) => r.status === 'rejected').length;
    if (failed > 0) logger.warn({ failed, total: evolvedPrompts.length }, 'Some evolved logo generations failed');
    if (concepts.length === 0) return res.status(502).json({ error: 'All evolved image generations failed' });

    return res.json({ concepts });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return res.status(504).json({ error: 'AI request timed out' });
    }
    logger.error({ err }, 'Logo AI evolve failed');
    return res.status(500).json({ error: 'Internal error' });
  }
});

// ---- GET /status ----

logoAiRouter.get('/status', (_req, res) => {
  res.json({
    available: !!config.moonshotDirectApiKey,
    model: 'moonshot-v1-8k',
    visualAvailable: !!config.togetherApiKey,
    visualProvider: 'together-flux',
    evolveAvailable: !!(config.moonshotDirectApiKey && config.togetherApiKey),
    refineAvailable: !!(config.moonshotDirectApiKey && config.togetherApiKey),
    brandKitAvailable: !!config.moonshotDirectApiKey,
    styleCategories: ['minimal', 'geometric', 'gradient', 'wordmark', 'emblem', 'abstract', 'indian', 'mascot'],
    logoTypes: ['icon', 'wordmark', 'lettermark', 'emblem', 'abstract', 'mascot'],
    totalTemplates: STYLE_TEMPLATES.length,
  });
});

// ---- Helpers ----

function clampParams(p: any): LogoParams {
  const shapes = ['squircle', 'circle', 'chat-left', 'chat-right'];
  const crossbarStyles = ['solid', 'agent-dots', 'none'];
  const innerElements = ['none', 'constellation', 'ai-eye', 'neural'];
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || min));
  const hex = (v: any, fallback: string) => /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : fallback;

  return {
    shape: shapes.includes(p?.shape) ? p.shape : 'squircle',
    cornerRadius: clamp(p?.cornerRadius, 2, 15),
    gradientFrom: hex(p?.gradientFrom, '#8B5CF6'),
    gradientTo: hex(p?.gradientTo, '#F59E0B'),
    gradientAngle: clamp(p?.gradientAngle, 0, 360),
    letterStrokeWidth: clamp(p?.letterStrokeWidth, 1, 4),
    crossbarY: clamp(p?.crossbarY, 0.4, 0.75),
    crossbarThickness: clamp(p?.crossbarThickness, 0.5, 5),
    crossbarStyle: crossbarStyles.includes(p?.crossbarStyle) ? p.crossbarStyle : 'solid',
    innerElement: innerElements.includes(p?.innerElement) ? p.innerElement : 'none',
    agentDotColor: hex(p?.agentDotColor, '#10B981'),
    showGlowRing: !!p?.showGlowRing,
    glowOpacity: clamp(p?.glowOpacity, 0, 1),
  };
}
