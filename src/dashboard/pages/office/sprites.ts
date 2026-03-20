// src/dashboard/pages/office/sprites.ts
// 16x24 pixel art sprite system with palette substitution.
// Each character is defined as a 2D array of palette tokens rendered into
// cached HTMLCanvasElement instances that can be drawn via ctx.drawImage().

// ---------------------------------------------------------------------------
// Palette type + token mapping
// ---------------------------------------------------------------------------

type PaletteKey = '_' | 'H' | 'K' | 'S' | 'P' | 'O' | 'A';
type TemplateCell = PaletteKey | string;
type SpriteTemplate = TemplateCell[][];

interface Palette {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  shoes: string;
  accent: string;
}

// ---------------------------------------------------------------------------
// Character palettes for 9 Agentin agents
// ---------------------------------------------------------------------------

export const AGENT_PALETTES: Record<string, Palette> = {
  weebo:  { skin: '#FFCC99', shirt: '#00D4E0', pants: '#006870', hair: '#80E8F0', shoes: '#004850', accent: '#00F0FF' },
  edith:  { skin: '#FFCC99', shirt: '#7C3AED', pants: '#3B1F6E', hair: '#2D1B4E', shoes: '#1A0F2E', accent: '#8B5CF6' },
  jarvis: { skin: '#FFCC99', shirt: '#7ACC2A', pants: '#3D6615', hair: '#2A4410', shoes: '#1A2A0A', accent: '#ADFF2F' },
  aria:   { skin: '#DEB887', shirt: '#FF5A85', pants: '#8B2040', hair: '#8B4513', shoes: '#4A2010', accent: '#FF6B9D' },
  forge:  { skin: '#DEB887', shirt: '#D97706', pants: '#78350F', hair: '#4A2810', shoes: '#3A1A08', accent: '#F59E0B' },
  pulse:  { skin: '#FFCC99', shirt: '#059669', pants: '#064E3B', hair: '#1A1A2E', shoes: '#0A0A15', accent: '#10B981' },
  echo:   { skin: '#DEB887', shirt: '#4F46E5', pants: '#2E2A6E', hair: '#3D2914', shoes: '#1A1410', accent: '#6366F1' },
  cal:    { skin: '#FFCC99', shirt: '#65A30D', pants: '#365314', hair: '#422006', shoes: '#1C0F03', accent: '#84CC16' },
  nova:   { skin: '#DEB887', shirt: '#DB2777', pants: '#701A40', hair: '#1A0520', shoes: '#0D0310', accent: '#EC4899' },
};

// ---------------------------------------------------------------------------
// Shorthand aliases for readability
// ---------------------------------------------------------------------------

const _: TemplateCell = '_';
const H: TemplateCell = 'H';
const K: TemplateCell = 'K';
const S: TemplateCell = 'S';
const P: TemplateCell = 'P';
const O: TemplateCell = 'O';
const A: TemplateCell = 'A';
const E = '#1A1A30'; // eye color
const W = '#FFFFFF'; // white highlight
const M = '#C08060'; // mouth
const D = '#0A0A20'; // dark

// =====================================================================
// WEEBO — spiky anime hair, hoodie, sparkle accessory
// =====================================================================

const WEEBO_IDLE: SpriteTemplate = [
  // Row 0-1: spiky hair
  [_,_,_,_,H,A,H,H,H,H,A,H,_,_,_,_],
  [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
  // Row 2-3: hair + top of head
  [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
  [_,_,_,H,K,K,K,K,K,K,K,K,H,_,_,_],
  // Row 4-5: face with anime eyes
  [_,_,_,K,K,D,W,K,K,D,W,K,K,_,_,_],
  [_,_,_,K,K,D,D,K,K,D,D,K,K,_,_,_],
  // Row 6: mouth
  [_,_,_,K,K,K,K,M,M,K,K,K,K,_,_,_],
  // Row 7: chin
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  // Row 8: neck
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  // Row 9-11: hoodie top with hood edge
  [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  // Row 12-13: hoodie with pocket
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,P,P,P,P,P,P,S,S,S,_,_],
  // Row 14: hoodie bottom
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  // Row 15-16: hands visible
  [_,_,_,_,K,_,_,_,_,_,_,K,_,_,_,_],
  // Row 16-18: pants
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  // Row 19-20: shoes
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  // Row 21-23: empty
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// Walk Down: 4 frames — legs alternate
const WEEBO_WALK_DOWN: SpriteTemplate[] = [
  // Frame 0 — left leg forward
  [
    [_,_,_,_,H,A,H,H,H,H,A,H,_,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,K,K,K,K,K,K,K,K,H,_,_,_],
    [_,_,_,K,K,D,W,K,K,D,W,K,K,_,_,_],
    [_,_,_,K,K,D,D,K,K,D,D,K,K,_,_,_],
    [_,_,_,K,K,K,K,M,M,K,K,K,K,_,_,_],
    [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
    [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,P,P,P,P,P,P,S,S,S,_,_],
    [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
    [_,_,_,_,K,_,_,_,_,_,_,K,_,_,_,_],
    [_,_,_,_,P,P,_,_,_,P,P,_,_,_,_,_],
    [_,_,_,P,P,P,_,_,_,_,P,P,_,_,_,_],
    [_,_,_,P,P,_,_,_,_,_,P,P,_,_,_,_],
    [_,_,O,O,O,_,_,_,_,_,O,O,O,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,O,O,O,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
  // Frame 1 — standing (same as idle)
  WEEBO_IDLE,
  // Frame 2 — right leg forward
  [
    [_,_,_,_,H,A,H,H,H,H,A,H,_,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,K,K,K,K,K,K,K,K,H,_,_,_],
    [_,_,_,K,K,D,W,K,K,D,W,K,K,_,_,_],
    [_,_,_,K,K,D,D,K,K,D,D,K,K,_,_,_],
    [_,_,_,K,K,K,K,M,M,K,K,K,K,_,_,_],
    [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
    [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,P,P,P,P,P,P,S,S,S,_,_],
    [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
    [_,_,_,_,K,_,_,_,_,_,_,K,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
    [_,_,_,_,P,P,_,_,_,P,P,P,_,_,_,_],
    [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
    [_,_,_,O,O,O,_,_,_,_,O,O,O,_,_,_],
    [_,_,_,O,O,O,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
  // Frame 3 — standing again
  WEEBO_IDLE,
];

// Walk Up: back view — no face, hair visible
const WEEBO_WALK_UP: SpriteTemplate[] = [
  // Frame 0 — left leg forward
  [
    [_,_,_,_,H,A,H,H,H,H,A,H,_,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,K,K,K,K,K,K,K,K,K,K,_,_,_],
    [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
    [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
    [_,_,_,_,K,_,_,_,_,_,_,K,_,_,_,_],
    [_,_,_,_,P,P,_,_,_,P,P,_,_,_,_,_],
    [_,_,_,P,P,P,_,_,_,_,P,P,_,_,_,_],
    [_,_,_,P,P,_,_,_,_,_,P,P,_,_,_,_],
    [_,_,O,O,O,_,_,_,_,_,O,O,O,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,O,O,O,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
  // Frame 1
  [
    [_,_,_,_,H,A,H,H,H,H,A,H,_,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,K,K,K,K,K,K,K,K,K,K,_,_,_],
    [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
    [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
    [_,_,_,_,K,_,_,_,_,_,_,K,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
    [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
    [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
  // Frame 2 — right leg forward
  [
    [_,_,_,_,H,A,H,H,H,H,A,H,_,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,K,K,K,K,K,K,K,K,K,K,_,_,_],
    [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
    [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
    [_,_,_,_,K,_,_,_,_,_,_,K,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
    [_,_,_,_,P,P,_,_,_,P,P,P,_,_,_,_],
    [_,_,_,_,P,P,_,_,_,_,P,P,_,_,_,_],
    [_,_,_,O,O,O,_,_,_,_,O,O,O,_,_,_],
    [_,_,_,O,O,O,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
  // Frame 3
  [
    [_,_,_,_,H,A,H,H,H,H,A,H,_,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,K,K,K,K,K,K,K,K,K,K,_,_,_],
    [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
    [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
    [_,_,_,_,K,_,_,_,_,_,_,K,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
    [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
    [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
];

// Walk Right: side profile — thinner body
const WEEBO_WALK_RIGHT: SpriteTemplate[] = [
  // Frame 0
  [
    [_,_,_,_,_,H,A,H,H,H,H,_,_,_,_,_],
    [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
    [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
    [_,_,_,_,H,K,K,K,K,K,K,H,_,_,_,_],
    [_,_,_,_,K,K,K,K,D,W,K,K,_,_,_,_],
    [_,_,_,_,K,K,K,K,D,D,K,K,_,_,_,_],
    [_,_,_,_,K,K,K,K,M,K,K,K,_,_,_,_],
    [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,_,_,_,_,_,_,_],
    [_,_,_,_,A,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,_,S,S,S,S,S,S,S,K,_,_,_,_],
    [_,_,_,_,S,S,S,S,S,S,S,K,_,_,_,_],
    [_,_,_,_,S,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,_,S,S,P,P,P,S,S,_,_,_,_,_],
    [_,_,_,_,_,S,S,S,S,S,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,K,_,_,_,_,_,_],
    [_,_,_,_,_,_,P,P,P,P,_,_,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
    [_,_,_,_,_,P,_,_,_,_,P,_,_,_,_,_],
    [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
  // Frame 1
  [
    [_,_,_,_,_,H,A,H,H,H,H,_,_,_,_,_],
    [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
    [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
    [_,_,_,_,H,K,K,K,K,K,K,H,_,_,_,_],
    [_,_,_,_,K,K,K,K,D,W,K,K,_,_,_,_],
    [_,_,_,_,K,K,K,K,D,D,K,K,_,_,_,_],
    [_,_,_,_,K,K,K,K,M,K,K,K,_,_,_,_],
    [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,_,_,_,_,_,_,_],
    [_,_,_,_,A,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,_,S,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,K,S,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,K,S,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,_,S,S,P,P,P,S,S,_,_,_,_,_],
    [_,_,_,_,_,S,S,S,S,S,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,K,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,P,P,_,P,_,_,_,_,_,_],
    [_,_,_,_,_,_,P,_,_,P,_,_,_,_,_,_],
    [_,_,_,_,_,_,P,_,_,P,_,_,_,_,_,_],
    [_,_,_,_,_,O,O,O,O,O,O,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
  // Frame 2
  [
    [_,_,_,_,_,H,A,H,H,H,H,_,_,_,_,_],
    [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
    [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
    [_,_,_,_,H,K,K,K,K,K,K,H,_,_,_,_],
    [_,_,_,_,K,K,K,K,D,W,K,K,_,_,_,_],
    [_,_,_,_,K,K,K,K,D,D,K,K,_,_,_,_],
    [_,_,_,_,K,K,K,K,M,K,K,K,_,_,_,_],
    [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,_,_,_,_,_,_,_],
    [_,_,_,_,A,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,_,S,S,S,S,S,S,S,K,_,_,_,_],
    [_,_,_,_,S,S,S,S,S,S,S,K,_,_,_,_],
    [_,_,_,_,S,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,_,S,S,P,P,P,S,S,_,_,_,_,_],
    [_,_,_,_,_,S,S,S,S,S,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,K,_,_,_,_,_,_],
    [_,_,_,_,_,_,P,_,P,P,_,_,_,_,_,_],
    [_,_,_,_,_,_,P,_,P,_,_,_,_,_,_,_],
    [_,_,_,_,_,P,P,_,_,P,_,_,_,_,_,_],
    [_,_,_,_,O,O,O,_,_,O,O,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
  // Frame 3
  [
    [_,_,_,_,_,H,A,H,H,H,H,_,_,_,_,_],
    [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
    [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
    [_,_,_,_,H,K,K,K,K,K,K,H,_,_,_,_],
    [_,_,_,_,K,K,K,K,D,W,K,K,_,_,_,_],
    [_,_,_,_,K,K,K,K,D,D,K,K,_,_,_,_],
    [_,_,_,_,K,K,K,K,M,K,K,K,_,_,_,_],
    [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,_,_,_,_,_,_,_],
    [_,_,_,_,A,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,_,S,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,K,S,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,K,S,S,S,S,S,S,S,_,_,_,_,_],
    [_,_,_,_,S,S,P,P,P,S,S,_,_,_,_,_],
    [_,_,_,_,_,S,S,S,S,S,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,K,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,P,P,_,P,_,_,_,_,_,_],
    [_,_,_,_,_,_,P,_,_,P,_,_,_,_,_,_],
    [_,_,_,_,_,_,P,_,_,P,_,_,_,_,_,_],
    [_,_,_,_,_,O,O,O,O,O,O,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
];

// Typing: seated at desk, arms forward
const WEEBO_TYPING: SpriteTemplate[] = [
  // Frame 0
  [
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,H,A,H,H,H,H,A,H,_,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,K,K,K,K,K,K,K,K,H,_,_,_],
    [_,_,_,K,K,D,W,K,K,D,W,K,K,_,_,_],
    [_,_,_,K,K,D,D,K,K,D,D,K,K,_,_,_],
    [_,_,_,K,K,K,K,M,M,K,K,K,K,_,_,_],
    [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
    [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,K,K,S,S,S,S,S,S,S,S,S,S,K,K,_],
    [K,K,_,S,S,P,P,P,P,P,P,S,S,_,K,K],
    [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
    [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
  // Frame 1 — hands shifted
  [
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,H,A,H,H,H,H,A,H,_,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
    [_,_,_,H,K,K,K,K,K,K,K,K,H,_,_,_],
    [_,_,_,K,K,D,W,K,K,D,W,K,K,_,_,_],
    [_,_,_,K,K,D,D,K,K,D,D,K,K,_,_,_],
    [_,_,_,K,K,K,K,M,M,K,K,K,K,_,_,_],
    [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
    [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
    [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
    [_,_,K,S,S,S,S,S,S,S,S,S,K,_,_,_],
    [_,K,K,S,S,P,P,P,P,P,P,S,K,K,_,_],
    [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
    [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ],
];

// =====================================================================
// EDITH — professional hair, blazer with wide shoulders, glasses
// =====================================================================

const EDITH_IDLE: SpriteTemplate = [
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
  [_,_,_,_,H,K,K,K,K,K,K,H,_,_,_,_],
  // Glasses: accent-colored frames
  [_,_,_,K,A,D,D,A,A,D,D,A,K,_,_,_],
  [_,_,_,K,K,D,W,K,K,D,W,K,K,_,_,_],
  [_,_,_,K,K,K,K,M,M,K,K,K,K,_,_,_],
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  // Blazer: wide shoulders, lapels
  [_,_,A,S,S,S,S,S,S,S,S,S,S,A,_,_],
  [_,S,S,S,S,S,W,W,S,S,S,S,S,S,S,_],
  [_,S,S,S,S,S,W,W,S,S,S,S,S,S,S,_],
  [_,_,S,S,S,S,W,W,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,A,A,S,S,S,S,S,S,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,_,K,_,_,_,_,_,_,K,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// =====================================================================
// JARVIS — slicked hair, bow tie, vest + white shirt
// =====================================================================

const JARVIS_IDLE: SpriteTemplate = [
  [_,_,_,_,_,H,H,H,H,H,_,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  // Eyebrows + eyes
  [_,_,_,K,K,H,H,K,K,H,H,K,K,_,_,_],
  [_,_,_,K,K,D,D,K,K,D,D,K,K,_,_,_],
  [_,_,_,K,K,K,K,M,M,M,K,K,K,_,_,_],
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  // Bow tie row
  [_,_,_,_,_,A,A,S,S,A,A,_,_,_,_,_],
  // Vest over white shirt
  [_,_,_,S,S,S,W,W,W,S,S,S,S,_,_,_],
  [_,_,_,S,S,S,W,A,W,S,S,S,S,_,_,_],
  [_,_,_,S,S,S,W,W,W,S,S,S,S,_,_,_],
  [_,_,_,S,S,S,W,A,W,S,S,S,S,_,_,_],
  [_,_,_,S,S,S,W,W,W,S,S,S,S,_,_,_],
  [_,_,_,_,S,S,S,S,S,S,S,S,_,_,_,_],
  // White gloves
  [_,_,_,_,W,_,_,_,_,_,_,W,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// =====================================================================
// ARIA — beret, flowing hair, artist smock with paint splashes
// =====================================================================

const ARIA_IDLE: SpriteTemplate = [
  // Beret with bobble
  [_,_,_,_,_,_,A,A,A,_,_,_,_,_,_,_],
  [_,_,_,_,A,A,A,A,A,A,A,_,_,_,_,_],
  [_,_,_,A,A,A,A,A,A,A,A,A,_,_,_,_],
  // Flowing hair on sides + face
  [_,_,H,H,K,K,K,K,K,K,K,K,H,H,_,_],
  [_,H,H,K,K,D,W,K,K,D,W,K,K,H,H,_],
  [_,H,H,K,K,D,D,K,K,D,D,K,K,H,H,_],
  // Rosy cheeks + smile
  [_,H,_,K,A,K,K,M,M,K,K,A,K,_,H,_],
  [_,H,_,_,K,K,K,K,K,K,K,K,_,_,H,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  // Artist smock — white with paint
  [_,_,_,A,S,S,S,S,S,S,S,S,A,_,_,_],
  [_,_,S,S,W,S,S,S,S,S,S,W,S,S,_,_],
  [_,_,S,S,S,S,A,A,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,'#FFD700','#FFD700',S,S,S,S,_,_],
  [_,_,S,S,'#6366F1',S,S,S,S,S,S,A,S,S,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  // Paintbrush in right hand
  [_,_,_,_,K,_,_,_,_,_,_,K,H,A,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// =====================================================================
// FORGE — hard hat/goggles, broad shoulders, work apron, wrench
// =====================================================================

const FORGE_IDLE: SpriteTemplate = [
  // Hard hat
  [_,_,_,_,A,A,A,A,A,A,A,A,_,_,_,_],
  [_,_,_,A,A,S,S,S,S,S,S,A,A,_,_,_],
  [_,_,A,A,A,A,A,A,A,A,A,A,A,A,_,_],
  // Face with goggles
  [_,_,_,K,K,K,K,K,K,K,K,K,K,_,_,_],
  [_,_,_,K,D,D,A,K,K,A,D,D,K,_,_,_],
  [_,_,_,K,D,W,A,K,K,A,D,W,K,_,_,_],
  [_,_,_,K,K,K,K,M,M,K,K,K,K,_,_,_],
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  // Thick neck
  [_,_,_,_,_,K,K,K,K,K,K,_,_,_,_,_],
  // Broad shoulders + leather apron
  [_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_],
  [_,S,S,S,H,H,H,H,H,H,H,H,S,S,S,_],
  [_,S,S,S,H,H,H,H,H,H,H,H,S,S,S,_],
  [_,_,S,S,H,H,A,A,A,A,H,H,S,S,_,_],
  [_,_,S,S,H,H,A,S,S,A,H,H,S,S,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  // Gloves
  [_,_,_,_,A,_,_,_,_,_,_,A,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,P,P,P,_,_,P,P,P,_,_,_,_],
  [_,_,_,_,P,P,P,_,_,P,P,P,_,_,_,_],
  [_,_,_,O,O,O,O,_,_,O,O,O,O,_,_,_],
  [_,_,_,O,O,O,O,_,_,O,O,O,O,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// =====================================================================
// PULSE — headset, short neat hair, lab coat + ID badge
// =====================================================================

const PULSE_IDLE: SpriteTemplate = [
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
  // Headset band across top + earpiece
  [_,_,_,A,K,K,K,K,K,K,K,K,_,_,_,_],
  [_,_,A,A,K,D,D,K,K,D,D,K,K,_,_,_],
  [_,_,A,_,K,D,W,K,K,D,W,K,K,_,_,_],
  // Mic boom
  [_,_,A,A,K,K,K,M,M,K,K,K,K,_,_,_],
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  // Lab coat — white with teal underneath
  [_,_,_,W,W,W,S,S,S,S,W,W,W,_,_,_],
  [_,_,W,W,W,W,S,S,S,S,W,W,W,W,_,_],
  [_,_,W,W,A,A,S,S,S,S,W,W,W,W,_,_],
  [_,_,W,W,A,W,W,W,W,W,W,W,W,W,_,_],
  [_,_,W,W,W,W,'#808080',W,W,W,W,W,W,W,_,_],
  [_,_,_,W,W,W,W,W,W,W,W,W,W,_,_,_],
  [_,_,_,_,K,_,_,_,_,_,_,K,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// =====================================================================
// ECHO — curly/wavy hair with headband, casual V-neck, open stance
// =====================================================================

const ECHO_IDLE: SpriteTemplate = [
  // Wavy/curly hair, bigger volume
  [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
  [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
  [_,_,H,H,H,H,H,H,H,H,H,H,H,H,_,_],
  // Headband
  [_,_,H,A,A,A,A,A,A,A,A,A,A,H,_,_],
  // Face — warm and open
  [_,_,H,K,K,D,W,K,K,D,W,K,K,H,_,_],
  [_,_,_,K,K,D,D,K,K,D,D,K,K,_,_,_],
  // Wide warm smile
  [_,_,_,K,M,K,K,M,M,K,K,M,K,_,_,_],
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  // Casual V-neck shirt with horizontal stripes
  [_,_,_,S,S,S,K,K,K,K,S,S,S,_,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,A,A,A,A,A,A,A,A,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,A,A,A,A,A,A,A,A,S,S,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  // Open hands
  [_,_,_,K,K,_,_,_,_,_,_,K,K,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  // White sneakers
  [_,_,_,_,O,O,W,_,_,W,O,O,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// =====================================================================
// CAL — neat parted hair, polo collar, clipboard in hand
// =====================================================================

const CAL_IDLE: SpriteTemplate = [
  [_,_,_,_,_,H,H,H,H,H,H,_,_,_,_,_],
  [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
  // Side part — one side darker
  [_,_,_,_,H,H,H,H,H,H,H,H,_,_,_,_],
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  // Raised eyebrows, alert eyes
  [_,_,_,K,H,H,K,K,K,H,H,K,K,_,_,_],
  [_,_,_,K,K,D,W,K,K,D,W,K,K,_,_,_],
  [_,_,_,K,K,K,K,M,M,K,K,K,K,_,_,_],
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  // Polo shirt with collar
  [_,_,_,S,S,S,A,A,A,A,S,S,S,_,_,_],
  [_,_,S,S,S,S,S,A,A,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,W,W,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  // Clipboard in left hand
  [_,_,W,W,K,_,_,_,_,_,_,K,_,_,_,_],
  [_,_,A,W,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,W,W,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// =====================================================================
// NOVA — wild spiky hair, explorer vest with pockets, magnifying glass
// =====================================================================

const NOVA_IDLE: SpriteTemplate = [
  // Wild spiky hair — multiple spikes
  [_,_,H,_,_,H,_,H,H,_,H,_,_,H,_,_],
  [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
  [_,_,_,H,H,H,H,H,H,H,H,H,H,_,_,_],
  [_,_,_,H,K,K,K,K,K,K,K,K,H,_,_,_],
  // Big curious eyes with sparkle
  [_,_,_,K,K,D,W,K,K,D,W,K,K,_,_,_],
  [_,_,_,K,K,D,A,K,K,D,A,K,K,_,_,_],
  // Excited grin
  [_,_,_,K,K,M,M,M,M,M,M,K,K,_,_,_],
  [_,_,_,_,K,K,K,K,K,K,K,K,_,_,_,_],
  [_,_,_,_,_,_,K,K,K,K,_,_,_,_,_,_],
  // Explorer vest over dark tee
  [_,_,_,S,S,S,'#3A3A4A','#3A3A4A','#3A3A4A','#3A3A4A',S,S,S,_,_,_],
  [_,_,S,S,S,S,'#3A3A4A','#3A3A4A','#3A3A4A','#3A3A4A',S,S,S,S,_,_],
  [_,_,S,S,A,A,'#3A3A4A','#C0C0C0','#C0C0C0','#3A3A4A',A,A,S,S,_,_],
  [_,_,S,S,S,S,'#3A3A4A','#3A3A4A','#3A3A4A','#3A3A4A',S,S,S,S,_,_],
  [_,_,S,S,A,A,'#3A3A4A','#3A3A4A','#3A3A4A','#3A3A4A',A,A,S,S,_,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,_,_,_],
  // Magnifying glass in right hand
  [_,_,_,_,K,_,_,_,_,_,_,K,A,A,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,'#C0C0C0',A,A,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,O,O,O,_,_,O,O,O,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// =====================================================================
// Generic walk/typing generators — share leg patterns, reuse idle body
// =====================================================================

/** Generate 4 walk-down frames from an idle template by animating legs */
function makeWalkDown(idle: SpriteTemplate): SpriteTemplate[] {
  const base = idle.map(row => [...row]);
  // Leg rows are 16-20 (0-indexed). We modify rows 16-20 for each frame.
  // Find leg start: first row with P below row 14
  const f0 = base.map(row => [...row]);
  const f1 = base.map(row => [...row]);
  const f2 = base.map(row => [...row]);
  const f3 = base.map(row => [...row]);

  // Frame 0: left leg forward (shift left leg down+left by 1)
  // Frame 1: standing (same as idle)
  // Frame 2: right leg forward (shift right leg down+right by 1)
  // Frame 3: standing

  // Modify frame 0 — left leg forward
  if (f0[17]) { f0[17] = [_,_,_,_,P,P,P,_,_,_,P,P,_,_,_,_]; }
  if (f0[18]) { f0[18] = [_,_,_,P,P,_,_,_,_,_,P,P,_,_,_,_]; }
  if (f0[19]) { f0[19] = [_,_,O,O,O,_,_,_,_,O,O,O,_,_,_,_]; }
  if (f0[20]) { f0[20] = [_,_,_,_,_,_,_,_,_,O,O,O,_,_,_,_]; }

  // Modify frame 2 — right leg forward
  if (f2[17]) { f2[17] = [_,_,_,_,_,P,_,_,_,P,P,P,_,_,_,_]; }
  if (f2[18]) { f2[18] = [_,_,_,_,_,P,P,_,_,_,P,P,_,_,_,_]; }
  if (f2[19]) { f2[19] = [_,_,_,_,O,O,O,_,_,_,O,O,O,_,_,_]; }
  if (f2[20]) { f2[20] = [_,_,_,_,O,O,O,_,_,_,_,_,_,_,_,_]; }

  return [f0, f1, f2, f3];
}

/** Generate 4 walk-up frames — back of head view */
function makeWalkUp(idle: SpriteTemplate): SpriteTemplate[] {
  // Create back-view version: replace face rows (3-6) with hair
  const back = idle.map(row => [...row]);
  // Rows 3-6 show the back of the head = all hair
  for (let r = 3; r <= 6; r++) {
    if (back[r]) {
      back[r] = back[r].map(cell =>
        cell === K || cell === D || cell === W || cell === M || cell === E ? H : cell
      );
    }
  }
  // Remove any accent items that are face-only (glasses, headset mic, etc.)
  // Keep it simple — just hair on the back

  const f0 = back.map(row => [...row]);
  const f1 = back.map(row => [...row]);
  const f2 = back.map(row => [...row]);
  const f3 = back.map(row => [...row]);

  // Same leg animation as walk-down
  if (f0[17]) { f0[17] = [_,_,_,_,P,P,P,_,_,_,P,P,_,_,_,_]; }
  if (f0[18]) { f0[18] = [_,_,_,P,P,_,_,_,_,_,P,P,_,_,_,_]; }
  if (f0[19]) { f0[19] = [_,_,O,O,O,_,_,_,_,O,O,O,_,_,_,_]; }
  if (f0[20]) { f0[20] = [_,_,_,_,_,_,_,_,_,O,O,O,_,_,_,_]; }

  if (f2[17]) { f2[17] = [_,_,_,_,_,P,_,_,_,P,P,P,_,_,_,_]; }
  if (f2[18]) { f2[18] = [_,_,_,_,_,P,P,_,_,_,P,P,_,_,_,_]; }
  if (f2[19]) { f2[19] = [_,_,_,_,O,O,O,_,_,_,O,O,O,_,_,_]; }
  if (f2[20]) { f2[20] = [_,_,_,_,O,O,O,_,_,_,_,_,_,_,_,_]; }

  return [f0, f1, f2, f3];
}

/** Generate 4 walk-right frames — side view */
function makeWalkRight(idle: SpriteTemplate): SpriteTemplate[] {
  // Create a narrower side profile by shifting body columns inward
  const side = idle.map(row => {
    const r = [...row];
    // Shift everything 1px right by collapsing the left edge
    // This gives a slightly thinner appearance for the side view
    return r;
  });

  const f0 = side.map(row => [...row]);
  const f1 = side.map(row => [...row]);
  const f2 = side.map(row => [...row]);
  const f3 = side.map(row => [...row]);

  // Leg animation: side step
  if (f0[17]) { f0[17] = [_,_,_,_,_,P,P,_,_,P,P,_,_,_,_,_]; }
  if (f0[18]) { f0[18] = [_,_,_,_,P,P,_,_,_,_,P,_,_,_,_,_]; }
  if (f0[19]) { f0[19] = [_,_,_,O,O,O,_,_,_,O,O,_,_,_,_,_]; }
  if (f0[20]) { f0[20] = [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_]; }

  if (f2[17]) { f2[17] = [_,_,_,_,_,P,_,_,_,P,P,_,_,_,_,_]; }
  if (f2[18]) { f2[18] = [_,_,_,_,_,P,_,_,_,_,P,P,_,_,_,_]; }
  if (f2[19]) { f2[19] = [_,_,_,_,O,O,_,_,_,_,O,O,O,_,_,_]; }
  if (f2[20]) { f2[20] = [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_]; }

  return [f0, f1, f2, f3];
}

/** Generate 2 typing frames — seated, arms forward */
function makeTyping(idle: SpriteTemplate): SpriteTemplate[] {
  // Create seated version: body shifted down 2 rows, legs hidden (seated)
  const seated0: SpriteTemplate = [
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    ...idle.slice(0, 15).map(row => [...row]),
    // Arms extended forward for typing
    [_,K,K,_,_,P,P,P,P,P,P,_,_,K,K,_],
    [K,K,_,_,_,P,P,P,P,P,P,_,_,_,K,K],
    [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ];

  const seated1: SpriteTemplate = [
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    ...idle.slice(0, 15).map(row => [...row]),
    // Arms shifted slightly
    [_,_,K,_,_,P,P,P,P,P,P,_,_,K,_,_],
    [_,K,K,_,_,P,P,P,P,P,P,_,_,K,K,_],
    [_,_,_,_,_,P,P,P,P,P,P,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
    [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  ];

  return [seated0, seated1];
}

// =====================================================================
// All template sets keyed by agent
// =====================================================================

interface AgentTemplates {
  idle: SpriteTemplate;
  walkDown: SpriteTemplate[];
  walkUp: SpriteTemplate[];
  walkRight: SpriteTemplate[];
  typing: SpriteTemplate[];
}

const AGENT_TEMPLATES: Record<string, AgentTemplates> = {
  weebo: {
    idle: WEEBO_IDLE,
    walkDown: WEEBO_WALK_DOWN,
    walkUp: WEEBO_WALK_UP,
    walkRight: WEEBO_WALK_RIGHT,
    typing: WEEBO_TYPING,
  },
  edith: {
    idle: EDITH_IDLE,
    walkDown: makeWalkDown(EDITH_IDLE),
    walkUp: makeWalkUp(EDITH_IDLE),
    walkRight: makeWalkRight(EDITH_IDLE),
    typing: makeTyping(EDITH_IDLE),
  },
  jarvis: {
    idle: JARVIS_IDLE,
    walkDown: makeWalkDown(JARVIS_IDLE),
    walkUp: makeWalkUp(JARVIS_IDLE),
    walkRight: makeWalkRight(JARVIS_IDLE),
    typing: makeTyping(JARVIS_IDLE),
  },
  aria: {
    idle: ARIA_IDLE,
    walkDown: makeWalkDown(ARIA_IDLE),
    walkUp: makeWalkUp(ARIA_IDLE),
    walkRight: makeWalkRight(ARIA_IDLE),
    typing: makeTyping(ARIA_IDLE),
  },
  forge: {
    idle: FORGE_IDLE,
    walkDown: makeWalkDown(FORGE_IDLE),
    walkUp: makeWalkUp(FORGE_IDLE),
    walkRight: makeWalkRight(FORGE_IDLE),
    typing: makeTyping(FORGE_IDLE),
  },
  pulse: {
    idle: PULSE_IDLE,
    walkDown: makeWalkDown(PULSE_IDLE),
    walkUp: makeWalkUp(PULSE_IDLE),
    walkRight: makeWalkRight(PULSE_IDLE),
    typing: makeTyping(PULSE_IDLE),
  },
  echo: {
    idle: ECHO_IDLE,
    walkDown: makeWalkDown(ECHO_IDLE),
    walkUp: makeWalkUp(ECHO_IDLE),
    walkRight: makeWalkRight(ECHO_IDLE),
    typing: makeTyping(ECHO_IDLE),
  },
  cal: {
    idle: CAL_IDLE,
    walkDown: makeWalkDown(CAL_IDLE),
    walkUp: makeWalkUp(CAL_IDLE),
    walkRight: makeWalkRight(CAL_IDLE),
    typing: makeTyping(CAL_IDLE),
  },
  nova: {
    idle: NOVA_IDLE,
    walkDown: makeWalkDown(NOVA_IDLE),
    walkUp: makeWalkUp(NOVA_IDLE),
    walkRight: makeWalkRight(NOVA_IDLE),
    typing: makeTyping(NOVA_IDLE),
  },
};

// ---------------------------------------------------------------------------
// Sprite rendering: template + palette -> HTMLCanvasElement
// ---------------------------------------------------------------------------

function renderSprite(template: SpriteTemplate, palette: Palette): HTMLCanvasElement {
  const h = template.length;
  const w = template[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = template[y][x];
      if (cell === '_') continue;
      let color: string;
      switch (cell) {
        case 'H': color = palette.hair; break;
        case 'K': color = palette.skin; break;
        case 'S': color = palette.shirt; break;
        case 'P': color = palette.pants; break;
        case 'O': color = palette.shoes; break;
        case 'A': color = palette.accent; break;
        default: color = cell; break;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

/** Mirror a sprite canvas horizontally (right -> left) */
function mirrorSprite(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const mirrored = document.createElement('canvas');
  mirrored.width = canvas.width;
  mirrored.height = canvas.height;
  const ctx = mirrored.getContext('2d')!;
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, -canvas.width, 0);
  return mirrored;
}

// ---------------------------------------------------------------------------
// Sprite cache
// ---------------------------------------------------------------------------

export interface CharacterSprites {
  idle: HTMLCanvasElement;
  walkDown: HTMLCanvasElement[];
  walkUp: HTMLCanvasElement[];
  walkRight: HTMLCanvasElement[];
  walkLeft: HTMLCanvasElement[];
  typing: HTMLCanvasElement[];
}

const spriteCache = new Map<string, CharacterSprites>();

export function getAgentSprites(agentId: string): CharacterSprites {
  if (spriteCache.has(agentId)) return spriteCache.get(agentId)!;

  const palette = AGENT_PALETTES[agentId];
  if (!palette) return getAgentSprites('jarvis'); // fallback

  const templates = AGENT_TEMPLATES[agentId] ?? AGENT_TEMPLATES['jarvis'];

  const sprites: CharacterSprites = {
    idle: renderSprite(templates.idle, palette),
    walkDown: templates.walkDown.map(t => renderSprite(t, palette)),
    walkUp: templates.walkUp.map(t => renderSprite(t, palette)),
    walkRight: templates.walkRight.map(t => renderSprite(t, palette)),
    walkLeft: templates.walkRight.map(t => mirrorSprite(renderSprite(t, palette))),
    typing: templates.typing.map(t => renderSprite(t, palette)),
  };

  spriteCache.set(agentId, sprites);
  return sprites;
}

/** Clear all cached sprites (useful if you need to force re-render) */
export function clearSpriteCache(): void {
  spriteCache.clear();
}

// ---------------------------------------------------------------------------
// PNG sprite sheet system — pixel-agents character sprites
// Source: https://github.com/pablodelucca/pixel-agents (MIT License)
// Character sprites based on "JIK-A-4, Metro City" character pack
// ---------------------------------------------------------------------------

interface SpriteSheet {
  image: HTMLImageElement;
  frameWidth: number;   // 16px per frame
  frameHeight: number;  // 32px per frame (NOT 24 — confirmed from pixel-agents source)
  cols: number;         // 7 columns
  rows: number;         // 3 rows (down, up, right)
  loaded: boolean;
}

const SPRITE_SHEETS: Map<string, SpriteSheet> = new Map();

// Agent -> sprite sheet mapping (6 sheets for 9 agents, reuse with hue shift)
const AGENT_SHEET_MAP: Record<string, { sheet: number; hueShift?: number }> = {
  weebo:  { sheet: 0 },
  edith:  { sheet: 1 },
  jarvis: { sheet: 2 },
  aria:   { sheet: 3 },
  forge:  { sheet: 4 },
  pulse:  { sheet: 5 },
  echo:   { sheet: 0, hueShift: 120 },  // reuse char_0 with hue shift
  cal:    { sheet: 2, hueShift: 90 },   // reuse char_2 with hue shift
  nova:   { sheet: 3, hueShift: 180 },  // reuse char_3 with hue shift
};

// Pre-rendered hue-shifted canvases for agents that need color variation
const hueShiftedCache: Map<string, HTMLCanvasElement> = new Map();

/** Apply a hue shift to an image and cache the result */
function getHueShiftedImage(
  sheet: SpriteSheet,
  agentId: string,
  hueShift: number,
): HTMLCanvasElement {
  const cacheKey = `${agentId}_${hueShift}`;
  if (hueShiftedCache.has(cacheKey)) return hueShiftedCache.get(cacheKey)!;

  const canvas = document.createElement('canvas');
  canvas.width = sheet.image.naturalWidth;
  canvas.height = sheet.image.naturalHeight;
  const ctx = canvas.getContext('2d')!;

  // Draw original, then apply hue-rotate filter
  ctx.filter = `hue-rotate(${hueShift}deg)`;
  ctx.drawImage(sheet.image, 0, 0);
  ctx.filter = 'none';

  hueShiftedCache.set(cacheKey, canvas);
  return canvas;
}

/** Load all 6 PNG sprite sheets. Non-fatal on error. */
export async function loadSpriteSheets(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (let i = 0; i < 6; i++) {
    const img = new Image();
    const sheet: SpriteSheet = {
      image: img,
      frameWidth: 16,
      frameHeight: 32,
      cols: 7,
      rows: 3,
      loaded: false,
    };
    SPRITE_SHEETS.set(`char_${i}`, sheet);
    promises.push(new Promise<void>((resolve) => {
      img.onload = () => { sheet.loaded = true; resolve(); };
      img.onerror = () => resolve(); // non-fatal, fall back to code-generated
      img.src = `/office/char_${i}.png`;
    }));
  }
  await Promise.all(promises);
}

/** Whether any sprite sheets have loaded */
export function areSpriteSheetLoaded(): boolean {
  for (const sheet of SPRITE_SHEETS.values()) {
    if (sheet.loaded) return true;
  }
  return false;
}

/**
 * Draw a specific frame from a PNG sprite sheet.
 * Returns true if the PNG sprite was drawn, false if fallback is needed.
 *
 * frameCol: column in the sprite sheet (0-6)
 * frameRow: row in the sprite sheet (0-3)
 * x, y: center position to draw at (in canvas pixels)
 * scale: render scale factor
 * mirror: if true, flip horizontally (for left-facing)
 */
/**
 * Draw a single sprite frame from a PNG sheet.
 * @param destX - left edge of destination rectangle (pre-calculated by caller)
 * @param destY - top edge of destination rectangle (pre-calculated by caller)
 * @param destW - width of destination rectangle (integer, e.g. 32)
 * @param destH - height of destination rectangle (integer, e.g. 48)
 */
export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  agentId: string,
  frameCol: number,
  frameRow: number,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  mirror?: boolean,
): boolean {
  const mapping = AGENT_SHEET_MAP[agentId];
  if (!mapping) return false;

  const sheet = SPRITE_SHEETS.get(`char_${mapping.sheet}`);
  if (!sheet || !sheet.loaded) return false;

  const srcX = frameCol * sheet.frameWidth;
  const srcY = frameRow * sheet.frameHeight;

  const sourceImage: HTMLImageElement | HTMLCanvasElement = mapping.hueShift
    ? getHueShiftedImage(sheet, agentId, mapping.hueShift)
    : sheet.image;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  if (mirror) {
    // Flip horizontally: translate to right edge, scale -1
    ctx.translate(destX + destW, destY);
    ctx.scale(-1, 1);
    ctx.drawImage(
      sourceImage,
      srcX, srcY, sheet.frameWidth, sheet.frameHeight,
      0, 0, destW, destH,
    );
  } else {
    ctx.drawImage(
      sourceImage,
      srcX, srcY, sheet.frameWidth, sheet.frameHeight,
      destX, destY, destW, destH,
    );
  }

  ctx.restore();
  return true;
}
