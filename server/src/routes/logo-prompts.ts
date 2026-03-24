// ============================================================
// Logo AI — prompt templates, industry mapping, and helpers
// Extracted from logo-ai.ts to keep each file under 500 lines
// ============================================================

// ---- Logo style categories with FLUX-optimized prompt templates ----

export type LogoCategory =
  | 'minimal'
  | 'geometric'
  | 'gradient'
  | 'wordmark'
  | 'emblem'
  | 'abstract'
  | 'indian'
  | 'mascot';

export type LogoType = 'icon' | 'wordmark' | 'lettermark' | 'emblem' | 'abstract' | 'mascot';

export interface StyleTemplate {
  category: LogoCategory;
  name: string;
  prompt: string;
}

// Each template is a self-contained FLUX.1-schnell prompt.
// All include background control and "no text, no letters" to suppress garbled text.
export const STYLE_TEMPLATES: StyleTemplate[] = [
  // -- Minimal (3) --
  {
    category: 'minimal',
    name: 'Clean Negative Space',
    prompt: 'single clean logo mark, negative space design, one solid color on dark background, ultra-minimal vector, sharp edges, centered composition, no text no letters no words',
  },
  {
    category: 'minimal',
    name: 'Monoline',
    prompt: 'monoline logo mark, single continuous line forming a symbol, white on solid black background, thin precise strokes, elegant simplicity, no text no letters no words',
  },
  {
    category: 'minimal',
    name: 'Dot Grid',
    prompt: 'minimal logo built from evenly spaced dots, two-tone palette, solid dark background, geometric precision, Swiss design influence, no text no letters no words',
  },

  // -- Geometric (3) --
  {
    category: 'geometric',
    name: 'Sacred Geometry',
    prompt: 'geometric logo mark, overlapping circles and triangles, sacred geometry proportions, gold lines on deep navy background, mathematical precision, no text no letters no words',
  },
  {
    category: 'geometric',
    name: 'Isometric Cube',
    prompt: 'isometric 3D cube logo, impossible geometry illusion, three-tone flat color, solid dark background, clean sharp vector, no text no letters no words',
  },
  {
    category: 'geometric',
    name: 'Tessellation',
    prompt: 'tessellating geometric pattern forming a logo mark, interlocking hexagons, emerald and violet palette, dark background, mathematical art, no text no letters no words',
  },

  // -- Gradient (3) --
  {
    category: 'gradient',
    name: 'Aurora Gradient',
    prompt: 'bold gradient logo mark, aurora borealis color flow from violet to emerald to gold, glowing edges, solid black background, modern tech aesthetic, no text no letters no words',
  },
  {
    category: 'gradient',
    name: 'Neon Mesh',
    prompt: 'mesh gradient logo mark, neon pink to electric blue to lime, soft glowing surface, dark background, premium tech startup, no text no letters no words',
  },
  {
    category: 'gradient',
    name: 'Metallic Sheen',
    prompt: 'metallic gradient logo mark, chrome silver to rose gold, reflective surface, subtle 3D depth, solid dark background, luxury tech brand, no text no letters no words',
  },

  // -- Wordmark (2) --
  {
    category: 'wordmark',
    name: 'Custom Lettering',
    prompt: 'custom hand-lettered logotype, flowing connected script, single elegant word, cream on charcoal background, artisan typography, no extra symbols',
  },
  {
    category: 'wordmark',
    name: 'Bold Sans Serif',
    prompt: 'ultra bold geometric sans-serif logotype, thick uniform weight, single word, violet gradient fill, solid black background, modern branding, no extra symbols',
  },

  // -- Emblem (3) --
  {
    category: 'emblem',
    name: 'Shield Crest',
    prompt: 'heraldic shield emblem logo, ornate crest with laurel wreath, gold on deep navy, regal symmetry, premium badge design, no text no letters no words',
  },
  {
    category: 'emblem',
    name: 'Circular Seal',
    prompt: 'circular seal emblem logo, concentric rings with icon center, embossed gold on black, official stamp aesthetic, balanced symmetry, no text no letters no words',
  },
  {
    category: 'emblem',
    name: 'Tech Badge',
    prompt: 'modern tech badge emblem, hexagonal frame with circuit pattern, neon emerald glow on dark background, futuristic seal, no text no letters no words',
  },

  // -- Abstract (3) --
  {
    category: 'abstract',
    name: 'Fluid Form',
    prompt: 'abstract fluid logo mark, organic flowing shape, liquid metal effect, iridescent violet and emerald, dark background, contemporary art, no text no letters no words',
  },
  {
    category: 'abstract',
    name: 'Paper Fold',
    prompt: 'abstract folded paper logo, origami-inspired shape, subtle shadows creating depth, single warm color on white background, tactile minimalism, no text no letters no words',
  },
  {
    category: 'abstract',
    name: 'Particle Cloud',
    prompt: 'abstract particle cloud logo mark, scattered dots converging into form, bokeh glow effect, violet to white gradient, solid black background, dynamic energy, no text no letters no words',
  },

  // -- Indian Traditional (3) --
  {
    category: 'indian',
    name: 'Rangoli Pattern',
    prompt: 'rangoli-inspired logo mark, intricate symmetrical pattern, saffron orange and deep red, dotted flower petals, solid dark background, Indian heritage art, no text no letters no words',
  },
  {
    category: 'indian',
    name: 'Mandala',
    prompt: 'mandala logo mark, concentric geometric petals, gold and emerald on deep indigo background, spiritual symmetry, meditative precision, no text no letters no words',
  },
  {
    category: 'indian',
    name: 'Mughal Motif',
    prompt: 'Mughal arch motif logo mark, ornate floral arabesque, ivory and gold on maroon background, royal Indian heritage, jali screen pattern, no text no letters no words',
  },

  // -- Mascot (2) --
  {
    category: 'mascot',
    name: 'Friendly Bot',
    prompt: 'friendly robot mascot logo, rounded cute character, waving hand, simple flat design, emerald and violet accents, solid light background, kawaii tech, no text no letters no words',
  },
  {
    category: 'mascot',
    name: 'Animal Spirit',
    prompt: 'geometric animal face logo, owl or fox stylized portrait, low-poly faceted design, bold two-tone palette, solid dark background, wise and approachable, no text no letters no words',
  },
];

// ---- Industry prompt fragments ----

const INDUSTRY_FRAGMENTS: Record<string, string> = {
  'tech':        'technology company, digital innovation, clean modern',
  'ai':          'artificial intelligence, neural network concept, futuristic tech',
  'chat':        'messaging platform, communication, speech bubble concept',
  'fintech':     'financial technology, trust and security, precision',
  'health':      'healthcare wellness, caring professional, clean clinical',
  'education':   'edtech learning, growth and knowledge, approachable',
  'food':        'food and beverage, appetizing warmth, organic feel',
  'ecommerce':   'online marketplace, shopping and commerce, vibrant',
  'gaming':      'gaming entertainment, dynamic energy, bold colors',
  'music':       'music and audio, rhythm and flow, sonic waves',
  'fitness':     'fitness wellness, strength and vitality, energetic',
  'travel':      'travel hospitality, exploration and adventure, scenic',
  'legal':       'legal services, authority and trust, classic elegance',
  'realestate':  'real estate property, solid foundations, architectural',
  'fashion':     'fashion and style, haute couture elegance, bold',
  'media':       'media entertainment, creative storytelling, cinematic',
  'consulting':  'consulting advisory, professional expertise, refined',
  'nonprofit':   'nonprofit social impact, community and compassion, warm',
  'crypto':      'blockchain cryptocurrency, decentralized digital, futuristic',
  'saas':        'SaaS cloud software, scalable platform, modern interface',
};

// ---- Logo type prompt fragments ----

const LOGO_TYPE_FRAGMENTS: Record<LogoType, string> = {
  icon:       'icon mark, standalone symbol, app-icon ready, centered single graphic',
  wordmark:   'wordmark logotype, stylized lettering of the company name, typography-focused',
  lettermark: 'lettermark monogram, single initial letter stylized, bold distinctive character',
  emblem:     'emblem badge, enclosed frame with central motif, official seal style',
  abstract:   'abstract mark, non-representational shape, unique memorable form',
  mascot:     'mascot character, friendly illustrated figure, approachable personality',
};

/**
 * Build a complete FLUX prompt from components.
 * Combines company name, industry, logo type, and style template.
 */
export function buildPrompt(opts: {
  companyName: string;
  industry?: string;
  logoType?: LogoType;
  template: StyleTemplate;
}): string {
  const parts: string[] = [];

  // Base: what we are making
  parts.push(`Professional logo for "${opts.companyName}"`);

  // Industry context
  const industryKey = findIndustryKey(opts.industry);
  if (industryKey) {
    parts.push(INDUSTRY_FRAGMENTS[industryKey]);
  } else if (opts.industry) {
    parts.push(sanitizePromptFragment(opts.industry));
  } else {
    parts.push('technology company');
  }

  // Logo type
  if (opts.logoType && LOGO_TYPE_FRAGMENTS[opts.logoType]) {
    parts.push(LOGO_TYPE_FRAGMENTS[opts.logoType]);
  }

  // Style template (already includes background and no-text)
  parts.push(opts.template.prompt);

  return parts.join(', ');
}

/**
 * Pick N style templates, optionally filtered by category.
 * Returns a deterministic rotation based on batch offset.
 */
export function pickTemplates(
  count: number,
  offset: number,
  category?: LogoCategory,
): StyleTemplate[] {
  const pool = category
    ? STYLE_TEMPLATES.filter((t) => t.category === category)
    : STYLE_TEMPLATES;

  if (pool.length === 0) return STYLE_TEMPLATES.slice(0, count);

  const result: StyleTemplate[] = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[(offset + i) % pool.length]);
  }
  return result;
}

/**
 * Map freeform industry text to a known key (fuzzy match).
 */
function findIndustryKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  // Direct match
  if (INDUSTRY_FRAGMENTS[lower]) return lower;
  // Substring match
  for (const key of Object.keys(INDUSTRY_FRAGMENTS)) {
    if (lower.includes(key) || key.includes(lower)) return key;
  }
  return undefined;
}

/**
 * Strip dangerous characters from user-supplied prompt fragments.
 */
export function sanitizePromptFragment(s: string): string {
  return s
    .replace(/[<>{}[\]\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

/**
 * Moonshot system prompt for the /ai-refine endpoint.
 */
export const REFINE_SYSTEM_PROMPT = `You are an expert logo design director. The user will give you a current FLUX image-generation prompt and an instruction to modify it. Your job is to return a single modified prompt that incorporates the instruction while keeping the overall style coherent.

Rules:
- Keep the output under 200 words.
- Always end with "no text no letters no words" to prevent garbled text.
- If the instruction mentions a color, replace or add it.
- If the instruction says "more minimal", remove ornate details.
- If the instruction says "Indian touch", add Indian design elements (rangoli, mandala, paisley, lotus, jali patterns).
- If the instruction says "bolder", increase weight/contrast/size descriptors.
- Return ONLY the modified prompt string. No explanation, no markdown, no quotes.`;

/**
 * Moonshot system prompt for the /brand-kit endpoint.
 */
export const BRAND_KIT_SYSTEM_PROMPT = `You are a brand identity consultant. Given a company name, optional industry, style, and primary color, generate a complete brand kit.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "colors": [
    { "name": "Primary", "hex": "#HEXVAL", "usage": "Main brand color, buttons, headers" },
    { "name": "Secondary", "hex": "#HEXVAL", "usage": "Accents, links, highlights" },
    { "name": "Dark", "hex": "#HEXVAL", "usage": "Text, backgrounds" },
    { "name": "Light", "hex": "#HEXVAL", "usage": "Backgrounds, cards" },
    { "name": "Accent", "hex": "#HEXVAL", "usage": "CTAs, warnings, badges" }
  ],
  "fonts": [
    { "name": "FontName", "category": "sans-serif|serif|monospace|display", "usage": "Headings", "googleFontsUrl": "https://fonts.google.com/specimen/FontName" },
    { "name": "FontName", "category": "sans-serif|serif|monospace", "usage": "Body text", "googleFontsUrl": "https://fonts.google.com/specimen/FontName" }
  ],
  "taglines": ["Tagline 1", "Tagline 2", "Tagline 3"],
  "socialSizes": [
    { "platform": "Instagram Post", "width": 1080, "height": 1080 },
    { "platform": "Instagram Story", "width": 1080, "height": 1920 },
    { "platform": "Facebook Cover", "width": 820, "height": 312 },
    { "platform": "Twitter Header", "width": 1500, "height": 500 },
    { "platform": "LinkedIn Banner", "width": 1584, "height": 396 },
    { "platform": "YouTube Thumbnail", "width": 1280, "height": 720 }
  ]
}

Rules:
- Colors must be valid 6-digit hex codes.
- If a primary color is given, use it as the Primary and derive others harmoniously.
- Taglines should be punchy (under 8 words each) and relevant to the industry.
- Fonts must exist on Google Fonts.
- Always return exactly 5 colors, 2 fonts, 3 taglines, and 6 social sizes.`;
