// src/dashboard/pages/office/OfficeCanvasRenderer.ts
// Pure canvas pixel-art renderer for the Agent Office Mission Control.
// Called every 200ms by the Stage component. Uses ONLY ctx.fillRect() — no
// images, paths, gradients, or text. All coordinates are in CELL-grid units
// converted to pixel coordinates at draw time.

import type { CanvasAgent, DoorState, ParticleBeam } from './types';
import {
  CELL, COLS, ROWS, CANVAS_W, CANVAS_H,
  DOOR_COL, DOOR_ROW_START, DOOR_ROW_END,
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  AGENT_COLORS, C,
} from './constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RenderState {
  agents: CanvasAgent[];
  door: DoorState;
  beams: ParticleBeam[];
  tick: number;
  selectedAgentId: string | null;
}

// ---------------------------------------------------------------------------
// Helpers — all pure, zero allocation where possible
// ---------------------------------------------------------------------------

/** Convert hex "#RRGGBB" to "rgba(r,g,b,a)" */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Grid → pixel X */
function gx(col: number): number { return col * CELL; }
/** Grid → pixel Y */
function gy(row: number): number { return row * CELL; }

// Pre-computed positions
const SERVER_RACK_X = 12;
const SERVER_RACK_Y = 13;
const WALL_ROWS = 3;

// Core desk entries — avoid Object.entries per frame
const CORE_DESK_ENTRIES: [string, { x: number; y: number }][] = [
  ['weebo', CORE_DESK_POSITIONS.weebo],
  ['edith', CORE_DESK_POSITIONS.edith],
  ['jarvis', CORE_DESK_POSITIONS.jarvis],
];

// Specialist entries
const SPEC_ENTRIES: [string, { x: number; y: number }][] = [
  ['aria', SPECIALIST_POSITIONS.aria],
  ['forge', SPECIALIST_POSITIONS.forge],
  ['pulse', SPECIALIST_POSITIONS.pulse],
  ['echo', SPECIALIST_POSITIONS.echo],
  ['cal', SPECIALIST_POSITIONS.cal],
  ['nova', SPECIALIST_POSITIONS.nova],
];

// ---------------------------------------------------------------------------
// drawBackground — floor, grid, walls, room labels
// ---------------------------------------------------------------------------

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  // Floor
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // --- Ambient room glows (radial approximation via concentric rects) ---
  // Main office center glow (very subtle cyan)
  for (let r = 0; r < 8; r++) {
    const alpha = 0.015 - r * 0.002;
    if (alpha <= 0) break;
    ctx.fillStyle = hexToRgba(C.cyan, alpha);
    ctx.fillRect(gx(4) + r * CELL, gy(4) + r * CELL, gx(20) - 2 * r * CELL, gy(12) - 2 * r * CELL);
  }
  // Lab center glow (subtle purple)
  for (let r = 0; r < 6; r++) {
    const alpha = 0.012 - r * 0.002;
    if (alpha <= 0) break;
    ctx.fillStyle = hexToRgba(C.purple, alpha);
    ctx.fillRect(gx(31) + r * CELL, gy(4) + r * CELL, gx(14) - 2 * r * CELL, gy(12) - 2 * r * CELL);
  }

  // --- Alternating floor tiles (very subtle checkerboard) ---
  for (let r = WALL_ROWS + 1; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.008)';
        ctx.fillRect(gx(c), gy(r), CELL, CELL);
      }
    }
  }

  // Cyan grid lines (4% opacity)
  ctx.fillStyle = hexToRgba(C.cyan, 0.04);
  for (let c = 0; c <= COLS; c++) {
    ctx.fillRect(gx(c), 0, 1, CANVAS_H);
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.fillRect(0, gy(r), CANVAS_W, 1);
  }

  // Main office wall (left room, top 3 rows)
  ctx.fillStyle = C.elevated;
  ctx.fillRect(0, 0, gx(DOOR_COL), gy(WALL_ROWS));

  // Wall panel detail lines (horizontal bands)
  ctx.fillStyle = hexToRgba(C.cyan, 0.06);
  ctx.fillRect(0, gy(1) - 1, gx(DOOR_COL), 1);
  ctx.fillRect(0, gy(2) - 1, gx(DOOR_COL), 1);

  // Specialist lab wall (right room, top 3 rows)
  ctx.fillStyle = C.elevated;
  ctx.fillRect(gx(DOOR_COL + 2), 0, gx(COLS) - gx(DOOR_COL + 2), gy(WALL_ROWS));

  // Lab wall panel detail
  ctx.fillStyle = hexToRgba(C.purple, 0.06);
  ctx.fillRect(gx(DOOR_COL + 2), gy(1) - 1, gx(COLS) - gx(DOOR_COL + 2), 1);
  ctx.fillRect(gx(DOOR_COL + 2), gy(2) - 1, gx(COLS) - gx(DOOR_COL + 2), 1);

  // Divider wall between rooms (columns 28-29, rows 0-3 and rows 9-ROWS)
  ctx.fillStyle = C.elevated;
  ctx.fillRect(gx(DOOR_COL), 0, gx(2), gy(DOOR_ROW_START));
  ctx.fillRect(gx(DOOR_COL), gy(DOOR_ROW_END + 1), gx(2), CANVAS_H - gy(DOOR_ROW_END + 1));

  // Wall edge highlights
  ctx.fillStyle = hexToRgba(C.cyan, 0.08);
  // Left room bottom edge
  ctx.fillRect(0, gy(WALL_ROWS), gx(DOOR_COL), 1);
  // Right room bottom edge
  ctx.fillRect(gx(DOOR_COL + 2), gy(WALL_ROWS), gx(COLS) - gx(DOOR_COL + 2), 1);

  // --- Neon accent strip at bottom of walls ---
  ctx.fillStyle = hexToRgba(C.cyan, 0.15);
  ctx.fillRect(0, gy(WALL_ROWS) - 2, gx(DOOR_COL), 2);
  ctx.fillStyle = hexToRgba(C.purple, 0.15);
  ctx.fillRect(gx(DOOR_COL + 2), gy(WALL_ROWS) - 2, gx(COLS) - gx(DOOR_COL + 2), 2);

  // Floor accent strip under walls
  ctx.fillStyle = hexToRgba(C.cyan, 0.03);
  ctx.fillRect(0, gy(WALL_ROWS) + 1, CANVAS_W, CELL);

  // --- Room label indicator bars (vertical on inner wall) ---
  // "OFFICE" indicator bar on left wall
  ctx.fillStyle = hexToRgba(C.cyan, 0.3);
  ctx.fillRect(gx(1), gy(0) + 4, 2, gy(WALL_ROWS) - 8);
  // "LAB" indicator bar on right wall
  ctx.fillStyle = hexToRgba(C.purple, 0.3);
  ctx.fillRect(gx(31), gy(0) + 4, 2, gy(WALL_ROWS) - 8);

  // Room label indicators (small colored dots in wall)
  // Main Office — cyan dot
  ctx.fillStyle = hexToRgba(C.cyan, 0.25);
  ctx.fillRect(gx(2), gy(1) + 4, 4, 4);
  ctx.fillStyle = hexToRgba(C.cyan, 0.12);
  ctx.fillRect(gx(2) - 1, gy(1) + 3, 6, 6); // glow ring
  // Specialist Lab — purple dot
  ctx.fillStyle = hexToRgba(C.purple, 0.25);
  ctx.fillRect(gx(32), gy(1) + 4, 4, 4);
  ctx.fillStyle = hexToRgba(C.purple, 0.12);
  ctx.fillRect(gx(32) - 1, gy(1) + 3, 6, 6); // glow ring

  // --- Wall corner accents (subtle geometric trim) ---
  // Top-left corner
  ctx.fillStyle = hexToRgba(C.cyan, 0.18);
  ctx.fillRect(0, 0, 6, 1);
  ctx.fillRect(0, 0, 1, 6);
  // Top-right corner
  ctx.fillRect(CANVAS_W - 6, 0, 6, 1);
  ctx.fillRect(CANVAS_W - 1, 0, 1, 6);
  // Bottom-left corner
  ctx.fillRect(0, CANVAS_H - 1, 6, 1);
  ctx.fillRect(0, CANVAS_H - 6, 1, 6);
  // Bottom-right corner
  ctx.fillRect(CANVAS_W - 6, CANVAS_H - 1, 6, 1);
  ctx.fillRect(CANVAS_W - 1, CANVAS_H - 6, 1, 6);
}

// ---------------------------------------------------------------------------
// drawDoor — animated door between the two rooms
// ---------------------------------------------------------------------------

export function drawDoor(ctx: CanvasRenderingContext2D, door: DoorState): void {
  const dx = gx(DOOR_COL);
  const doorW = CELL * 2;
  const topY = gy(DOOR_ROW_START);
  const doorH = gy(DOOR_ROW_END + 1) - topY;

  // Door frame (always visible)
  ctx.fillStyle = hexToRgba(C.cyan, 0.15);
  ctx.fillRect(dx - 1, topY, 1, doorH); // left frame
  ctx.fillRect(dx + doorW, topY, 1, doorH); // right frame
  ctx.fillRect(dx - 1, topY - 1, doorW + 2, 1); // top frame
  ctx.fillRect(dx - 1, topY + doorH, doorW + 2, 1); // bottom frame

  // Door panels based on animation frame (0 = fully closed, 5 = fully open)
  const openFraction = door.frame / 5;
  const closedH = Math.round(doorH * (1 - openFraction));

  if (closedH > 0) {
    // Top panel slides up
    const topPanel = Math.ceil(closedH / 2);
    ctx.fillStyle = C.card;
    ctx.fillRect(dx, topY, doorW, topPanel);

    // Bottom panel slides down
    const botPanel = closedH - topPanel;
    ctx.fillRect(dx, topY + doorH - botPanel, doorW, botPanel);

    // Panel detail lines
    ctx.fillStyle = hexToRgba(C.cyan, 0.08);
    if (topPanel > 4) {
      ctx.fillRect(dx + 4, topY + Math.floor(topPanel / 2), doorW - 8, 1);
    }
    if (botPanel > 4) {
      ctx.fillRect(dx + 4, topY + doorH - Math.floor(botPanel / 2), doorW - 8, 1);
    }
  }

  // When open, show a floor strip through the doorway
  if (openFraction > 0) {
    ctx.fillStyle = hexToRgba(C.cyan, 0.05 * openFraction);
    ctx.fillRect(dx, topY + Math.ceil(closedH / 2), doorW, doorH - closedH);
  }

  // Indicator light above door
  ctx.fillStyle = door.isOpen
    ? hexToRgba(C.green, 0.6)
    : hexToRgba(C.pink, 0.4);
  ctx.fillRect(dx + doorW / 2 - 2, topY - 4, 4, 3);
}

// ---------------------------------------------------------------------------
// drawDesk — 3x2 cell desk for core agents
// ---------------------------------------------------------------------------

export function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const px = gx(x);
  const py = gy(y);

  // Desk surface — two-tone gradient (darker front edge, lighter back)
  ctx.fillStyle = hexToRgba(color, 0.12);
  ctx.fillRect(px, py, CELL * 3, CELL);
  ctx.fillStyle = hexToRgba(color, 0.17);
  ctx.fillRect(px, py + CELL, CELL * 3, CELL);

  // Desk edge highlight (top glow bar)
  ctx.fillStyle = hexToRgba(color, 0.3);
  ctx.fillRect(px, py, CELL * 3, 2);

  // Desk border
  ctx.fillStyle = hexToRgba(color, 0.1);
  ctx.fillRect(px, py, 1, CELL * 2);
  ctx.fillRect(px + CELL * 3 - 1, py, 1, CELL * 2);
  ctx.fillRect(px, py + CELL * 2 - 1, CELL * 3, 1);

  // Monitor on desk (centered, 1 cell wide, ~0.6 cell tall)
  const monW = CELL;
  const monH = Math.round(CELL * 0.6);
  const monX = px + CELL; // centered on 3-wide desk
  const monY = py + 3; // slight offset from top

  // Screen glow behind monitor
  ctx.fillStyle = hexToRgba(color, 0.06);
  ctx.fillRect(monX - 3, monY - 2, monW + 6, monH + 4);
  ctx.fillStyle = hexToRgba(color, 0.03);
  ctx.fillRect(monX - 5, monY - 4, monW + 10, monH + 8);

  // Monitor body
  ctx.fillStyle = hexToRgba(color, 0.35);
  ctx.fillRect(monX, monY, monW, monH);

  // Screen (inner area, brighter)
  ctx.fillStyle = hexToRgba(color, 0.15);
  ctx.fillRect(monX + 2, monY + 2, monW - 4, monH - 4);

  // Scanline effect on screen (1px lines across screen)
  ctx.fillStyle = hexToRgba(color, 0.05);
  for (let sl = monY + 3; sl < monY + monH - 2; sl += 2) {
    ctx.fillRect(monX + 2, sl, monW - 4, 1);
  }

  // Monitor stand
  ctx.fillStyle = hexToRgba(color, 0.22);
  ctx.fillRect(monX + monW / 2 - 2, monY + monH, 4, 3);

  // Keyboard below monitor (wider, thin)
  const kbW = Math.round(CELL * 1.2);
  const kbX = monX + Math.round((monW - kbW) / 2);
  const kbY = monY + monH + 5;
  ctx.fillStyle = hexToRgba(color, 0.1);
  ctx.fillRect(kbX, kbY, kbW, 3);
  // Key dots on keyboard
  ctx.fillStyle = hexToRgba(color, 0.18);
  for (let k = 0; k < 4; k++) {
    ctx.fillRect(kbX + 2 + k * Math.round(kbW / 5), kbY + 1, 2, 1);
  }
}

// ---------------------------------------------------------------------------
// drawStation — specialist workbench
// ---------------------------------------------------------------------------

export function drawStation(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isDormant: boolean): void {
  const px = gx(x);
  const py = gy(y);
  const alpha = isDormant ? 0.06 : 0.15;
  const accentAlpha = isDormant ? 0.1 : 0.3;

  // Workbench surface (2x2 cells, L-shaped)
  ctx.fillStyle = hexToRgba(color, alpha);
  ctx.fillRect(px, py, CELL * 2, CELL * 2);

  // Bench top edge highlight
  ctx.fillStyle = hexToRgba(color, accentAlpha);
  ctx.fillRect(px, py, CELL * 2, 2);

  // Equipment on bench (smaller monitor-like shape)
  const eqW = Math.round(CELL * 0.8);
  const eqH = Math.round(CELL * 0.5);
  const eqX = px + Math.round(CELL * 0.6);
  const eqY = py + 3;

  ctx.fillStyle = hexToRgba(color, accentAlpha);
  ctx.fillRect(eqX, eqY, eqW, eqH);

  // Screen inner glow
  if (!isDormant) {
    ctx.fillStyle = hexToRgba(color, 0.08);
    ctx.fillRect(eqX + 2, eqY + 2, eqW - 4, eqH - 4);
  }

  // Side panel (tool rack)
  ctx.fillStyle = hexToRgba(color, isDormant ? 0.04 : 0.1);
  ctx.fillRect(px + 2, py + CELL, 3, CELL - 4);

  // Dormant overlay cross-hatch (diagonal lines)
  if (isDormant) {
    ctx.fillStyle = hexToRgba(C.dim, 0.08);
    for (let i = 0; i < CELL * 2; i += 6) {
      ctx.fillRect(px + i, py, 1, Math.min(i, CELL * 2));
    }
  }
}

// ---------------------------------------------------------------------------
// drawServerRack — blinking LEDs in the main office
// ---------------------------------------------------------------------------

export function drawServerRack(ctx: CanvasRenderingContext2D, tick: number): void {
  const px = gx(SERVER_RACK_X);
  const py = gy(SERVER_RACK_Y);
  const rackW = CELL * 2;
  const rackH = CELL * 2;

  // Ambient glow behind rack
  ctx.fillStyle = hexToRgba(C.cyan, 0.04);
  ctx.fillRect(px - 4, py - 4, rackW + 8, rackH + 8);
  ctx.fillStyle = hexToRgba(C.cyan, 0.02);
  ctx.fillRect(px - 8, py - 8, rackW + 16, rackH + 16);

  // Rack body
  ctx.fillStyle = C.card;
  ctx.fillRect(px, py, rackW, rackH);

  // Rack border — brighter cyan
  ctx.fillStyle = hexToRgba(C.cyan, 0.15);
  ctx.fillRect(px, py, rackW, 1);
  ctx.fillRect(px, py, 1, rackH);
  ctx.fillRect(px + rackW - 1, py, 1, rackH);
  ctx.fillRect(px, py + rackH - 1, rackW, 1);

  // Horizontal shelf lines (more shelves)
  ctx.fillStyle = hexToRgba(C.dim, 0.15);
  ctx.fillRect(px + 2, py + Math.round(rackH * 0.2), rackW - 4, 1);
  ctx.fillRect(px + 2, py + Math.round(rackH * 0.4), rackW - 4, 1);
  ctx.fillRect(px + 2, py + Math.round(rackH * 0.6), rackW - 4, 1);
  ctx.fillRect(px + 2, py + Math.round(rackH * 0.8), rackW - 4, 1);

  // Blinking LEDs — 5 rows of 4 LEDs each, alternating on tick, varied colors
  const ledColors = [C.green, C.cyan, '#F59E0B', C.pink];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      const on = (tick + row * 2 + col) % 3 !== 0;
      const ledX = px + 4 + col * 7;
      const ledY = py + 3 + row * Math.round(rackH / 5);
      const ledColor = ledColors[(col + row) % ledColors.length];
      ctx.fillStyle = on
        ? hexToRgba(ledColor, 0.8)
        : hexToRgba(ledColor, 0.12);
      ctx.fillRect(ledX, ledY, 3, 2);
      // LED glow when on
      if (on) {
        ctx.fillStyle = hexToRgba(ledColor, 0.12);
        ctx.fillRect(ledX - 1, ledY - 1, 5, 4);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Sprite color helpers
// ---------------------------------------------------------------------------

/** Darken a hex color by mixing toward black */
function darken(hex: string, amount: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  return `rgb(${r},${g},${b})`;
}

/** Lighten a hex color by mixing toward white */
function lighten(hex: string, amount: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * amount);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * amount);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * amount);
  return `rgb(${r},${g},${b})`;
}

// Skin tone for all agents (warm pixel-art tone)
const SKIN = '#F5CFA0';
const SKIN_SHADOW = '#D4A574';

// ---------------------------------------------------------------------------
// Per-agent sprite drawers — each is a unique pixel-art character
// Sprite grid: 12 wide x 20 tall, drawn from (ox, oy) top-left
// ---------------------------------------------------------------------------

/** Weebo — cyan hoodie, anime sparkle, big round head */
function drawWeeboSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  // Hair (rows 0-1) — spiky cyan hair
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 2, oy + bob, 8, 1);
  ctx.fillRect(ox + 1, oy + 1 + bob, 10, 1);
  // Sparkle accessory on top-right
  ctx.fillStyle = hexToRgba('#FFFFFF', da * 0.9);
  ctx.fillRect(ox + 9, oy + bob, 1, 1);
  ctx.fillRect(ox + 10, oy + 1 + bob, 1, 1);
  // Head (rows 2-7) — round, 10 wide
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 1, oy + 2 + bob, 10, 6);
  // Rounded head corners (knock off)
  ctx.fillStyle = 'rgba(0,0,0,0)';
  // -- use bg to cut corners
  ctx.fillStyle = hexToRgba(C.bg, 1);
  ctx.fillRect(ox + 1, oy + 2 + bob, 1, 1);
  ctx.fillRect(ox + 10, oy + 2 + bob, 1, 1);
  ctx.fillRect(ox + 1, oy + 7 + bob, 1, 1);
  ctx.fillRect(ox + 10, oy + 7 + bob, 1, 1);
  // Big anime eyes (row 4) — 2x2 each, dark with highlight
  ctx.fillStyle = hexToRgba('#0A0A20', da);
  ctx.fillRect(ox + 3, oy + 4 + bob, 2, 2);
  ctx.fillRect(ox + 7, oy + 4 + bob, 2, 2);
  // Eye highlights
  ctx.fillStyle = hexToRgba('#FFFFFF', da * 0.9);
  ctx.fillRect(ox + 3, oy + 4 + bob, 1, 1);
  ctx.fillRect(ox + 7, oy + 4 + bob, 1, 1);
  // Small smile (row 6)
  ctx.fillStyle = hexToRgba('#C08060', da);
  ctx.fillRect(ox + 5, oy + 6 + bob, 2, 1);
  // Shadow under chin
  ctx.fillStyle = hexToRgba(SKIN_SHADOW, da);
  ctx.fillRect(ox + 3, oy + 7 + bob, 6, 1);
  // Neck (row 8)
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  // Body — hoodie (rows 9-14)
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 1, oy + 9 + bob, 10, 6);
  // Hoodie pocket (darker center)
  ctx.fillStyle = hexToRgba(color, da * 0.6);
  ctx.fillRect(ox + 4, oy + 12 + bob, 4, 2);
  // Hoodie hood edge
  ctx.fillStyle = lighten(color, 0.3);
  ctx.fillRect(ox + 1, oy + 9 + bob, 10, 1);
  // Arms (slightly darker)
  ctx.fillStyle = darken(color, 0.2);
  ctx.fillRect(ox + 1, oy + 10 + bob, 2, 4);
  ctx.fillRect(ox + 9, oy + 10 + bob, 2, 4);
  // Legs (rows 15-19)
  const lf = frame;
  ctx.fillStyle = hexToRgba('#2A2A4A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 15, 3, 4);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 15, 3, 4);
  // Shoes
  ctx.fillStyle = hexToRgba(color, da * 0.8);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 19, 3, 1);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 19, 3, 1);
}

/** Edith — purple business jacket, glasses, angular head */
function drawEdithSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  // Hair (rows 0-1) — neat dark purple
  ctx.fillStyle = darken(color, 0.4);
  ctx.fillRect(ox + 2, oy + bob, 8, 2);
  ctx.fillRect(ox + 1, oy + 1 + bob, 10, 1);
  // Head (rows 2-7) — angular/squared, full 10 wide
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 1, oy + 2 + bob, 10, 6);
  // Angular jaw — no rounded corners, sharp
  // Glasses (row 3-4) — thin horizontal frames
  ctx.fillStyle = hexToRgba('#3A3A6A', da);
  ctx.fillRect(ox + 2, oy + 3 + bob, 8, 1); // frame top
  // Left lens
  ctx.fillRect(ox + 2, oy + 4 + bob, 3, 2);
  // Right lens
  ctx.fillRect(ox + 7, oy + 4 + bob, 3, 2);
  // Bridge
  ctx.fillRect(ox + 5, oy + 4 + bob, 2, 1);
  // Eyes behind glasses
  ctx.fillStyle = hexToRgba('#1A1A30', da);
  ctx.fillRect(ox + 3, oy + 4 + bob, 1, 1);
  ctx.fillRect(ox + 8, oy + 4 + bob, 1, 1);
  // Lens shine
  ctx.fillStyle = hexToRgba('#FFFFFF', da * 0.3);
  ctx.fillRect(ox + 2, oy + 4 + bob, 1, 1);
  ctx.fillRect(ox + 7, oy + 4 + bob, 1, 1);
  // Neutral mouth
  ctx.fillStyle = hexToRgba('#C08060', da);
  ctx.fillRect(ox + 4, oy + 6 + bob, 3, 1);
  // Neck
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  // Body — business jacket (rows 9-14) wider shoulders
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 0, oy + 9 + bob, 12, 6);
  // Lapels (lighter V on chest)
  ctx.fillStyle = lighten(color, 0.25);
  ctx.fillRect(ox + 4, oy + 9 + bob, 1, 3);
  ctx.fillRect(ox + 7, oy + 9 + bob, 1, 3);
  ctx.fillRect(ox + 5, oy + 10 + bob, 1, 2);
  ctx.fillRect(ox + 6, oy + 10 + bob, 1, 2);
  // White shirt underneath
  ctx.fillStyle = hexToRgba('#E0E0F0', da);
  ctx.fillRect(ox + 5, oy + 12 + bob, 2, 2);
  // Shoulder pads (darker)
  ctx.fillStyle = darken(color, 0.2);
  ctx.fillRect(ox + 0, oy + 9 + bob, 2, 2);
  ctx.fillRect(ox + 10, oy + 9 + bob, 2, 2);
  // Legs (rows 15-19) — dress pants
  const lf = frame;
  ctx.fillStyle = hexToRgba('#1A1A3A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 15, 3, 4);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 15, 3, 4);
  // Heels
  ctx.fillStyle = hexToRgba('#2A2A40', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 19, 3, 1);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 19, 3, 1);
}

/** Jarvis — green bow tie, butler vest, upright posture */
function drawJarvisSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  // Hair (rows 0-1) — slicked back, dark
  ctx.fillStyle = hexToRgba('#2A3A1A', da);
  ctx.fillRect(ox + 2, oy + bob, 8, 1);
  ctx.fillRect(ox + 1, oy + 1 + bob, 10, 1);
  // Side part accent
  ctx.fillStyle = hexToRgba('#3A4A2A', da);
  ctx.fillRect(ox + 2, oy + bob, 3, 1);
  // Head (rows 2-7) — clean round
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 1, oy + 2 + bob, 10, 6);
  // Rounded corners
  ctx.fillStyle = hexToRgba(C.bg, 1);
  ctx.fillRect(ox + 1, oy + 2 + bob, 1, 1);
  ctx.fillRect(ox + 10, oy + 2 + bob, 1, 1);
  // Distinguished eyes — smaller, composed
  ctx.fillStyle = hexToRgba('#1A1A30', da);
  ctx.fillRect(ox + 3, oy + 4 + bob, 2, 1);
  ctx.fillRect(ox + 7, oy + 4 + bob, 2, 1);
  // Thin eyebrows
  ctx.fillStyle = hexToRgba('#2A3A1A', da);
  ctx.fillRect(ox + 3, oy + 3 + bob, 2, 1);
  ctx.fillRect(ox + 7, oy + 3 + bob, 2, 1);
  // Polite smile
  ctx.fillStyle = hexToRgba('#C08060', da);
  ctx.fillRect(ox + 4, oy + 6 + bob, 4, 1);
  // Neck
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  // Bow tie (row 8, below chin) — green
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 4, oy + 8 + bob, 1, 1);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  ctx.fillRect(ox + 7, oy + 8 + bob, 1, 1);
  // Center knot
  ctx.fillStyle = darken(color, 0.3);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  // Body — butler vest (rows 9-14)
  // Dark outer vest
  ctx.fillStyle = hexToRgba('#1A1A2A', da);
  ctx.fillRect(ox + 1, oy + 9 + bob, 10, 6);
  // White shirt center strip
  ctx.fillStyle = hexToRgba('#E8E8F8', da);
  ctx.fillRect(ox + 4, oy + 9 + bob, 4, 6);
  // Vest overlay sides
  ctx.fillStyle = hexToRgba('#2A2A3A', da);
  ctx.fillRect(ox + 1, oy + 9 + bob, 3, 6);
  ctx.fillRect(ox + 8, oy + 9 + bob, 3, 6);
  // Vest buttons
  ctx.fillStyle = hexToRgba(color, da * 0.7);
  ctx.fillRect(ox + 5, oy + 10 + bob, 1, 1);
  ctx.fillRect(ox + 5, oy + 12 + bob, 1, 1);
  // Arms (dark sleeves)
  ctx.fillStyle = hexToRgba('#1A1A2A', da);
  ctx.fillRect(ox + 0, oy + 10 + bob, 1, 4);
  ctx.fillRect(ox + 11, oy + 10 + bob, 1, 4);
  // White gloves
  ctx.fillStyle = hexToRgba('#E8E8F8', da);
  ctx.fillRect(ox + 0, oy + 14 + bob, 1, 1);
  ctx.fillRect(ox + 11, oy + 14 + bob, 1, 1);
  // Legs (rows 15-19) — formal pants
  const lf = frame;
  ctx.fillStyle = hexToRgba('#1A1A30', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 15, 3, 4);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 15, 3, 4);
  // Polished shoes
  ctx.fillStyle = hexToRgba('#0A0A18', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 19, 3, 1);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 19, 3, 1);
}

/** Aria — pink beret, flowing hair, artist smock */
function drawAriaSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  // Beret (rows 0-1) — pink beret tilted
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 1, oy + bob, 9, 1);
  ctx.fillRect(ox + 2, oy + 1 + bob, 8, 1);
  // Beret bobble
  ctx.fillStyle = lighten(color, 0.3);
  ctx.fillRect(ox + 5, oy - 1 + bob, 2, 1);
  // Flowing hair — extra pixels on left side
  ctx.fillStyle = hexToRgba('#8B4513', da);
  ctx.fillRect(ox + 0, oy + 2 + bob, 2, 5);
  ctx.fillRect(ox + 0, oy + 7 + bob, 1, 3);
  ctx.fillRect(ox + 10, oy + 2 + bob, 2, 4);
  ctx.fillRect(ox + 11, oy + 3 + bob, 1, 4);
  // Head (rows 2-7) — soft round
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 2, oy + 2 + bob, 8, 6);
  // Rounded corners
  ctx.fillStyle = hexToRgba(C.bg, 1);
  ctx.fillRect(ox + 2, oy + 2 + bob, 1, 1);
  ctx.fillRect(ox + 9, oy + 2 + bob, 1, 1);
  // Expressive eyes — with lashes
  ctx.fillStyle = hexToRgba('#1A1A30', da);
  ctx.fillRect(ox + 4, oy + 4 + bob, 2, 2);
  ctx.fillRect(ox + 7, oy + 4 + bob, 2, 2);
  // Lashes (1px above each eye)
  ctx.fillStyle = hexToRgba('#1A1A30', da);
  ctx.fillRect(ox + 3, oy + 3 + bob, 1, 1);
  ctx.fillRect(ox + 9, oy + 3 + bob, 1, 1);
  // Eye color
  ctx.fillStyle = hexToRgba(color, da * 0.6);
  ctx.fillRect(ox + 4, oy + 4 + bob, 1, 1);
  ctx.fillRect(ox + 7, oy + 4 + bob, 1, 1);
  // Rosie cheeks
  ctx.fillStyle = hexToRgba(color, da * 0.25);
  ctx.fillRect(ox + 3, oy + 5 + bob, 1, 1);
  ctx.fillRect(ox + 9, oy + 5 + bob, 1, 1);
  // Small smile
  ctx.fillStyle = hexToRgba('#C08060', da);
  ctx.fillRect(ox + 5, oy + 6 + bob, 3, 1);
  // Neck
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  // Body — artist smock (rows 9-14) loose, colorful
  ctx.fillStyle = hexToRgba('#F0F0F0', da);
  ctx.fillRect(ox + 1, oy + 9 + bob, 10, 6);
  // Paint splashes on smock
  ctx.fillStyle = hexToRgba(color, da * 0.7);
  ctx.fillRect(ox + 3, oy + 11 + bob, 2, 1);
  ctx.fillStyle = hexToRgba('#FFD700', da * 0.6);
  ctx.fillRect(ox + 7, oy + 10 + bob, 2, 1);
  ctx.fillStyle = hexToRgba('#6366F1', da * 0.5);
  ctx.fillRect(ox + 2, oy + 13 + bob, 1, 1);
  // Smock collar
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 3, oy + 9 + bob, 6, 1);
  // Arms (smock sleeves, puffy)
  ctx.fillStyle = hexToRgba('#E0E0E0', da);
  ctx.fillRect(ox + 0, oy + 10 + bob, 2, 3);
  ctx.fillRect(ox + 10, oy + 10 + bob, 2, 3);
  // Paintbrush in right hand
  ctx.fillStyle = hexToRgba('#8B4513', da);
  ctx.fillRect(ox + 11, oy + 13 + bob, 1, 2);
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 11, oy + 12 + bob, 1, 1);
  // Legs (rows 15-19)
  const lf = frame;
  ctx.fillStyle = hexToRgba('#4A3A6A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 15, 3, 4);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 15, 3, 4);
  // Cute shoes
  ctx.fillStyle = hexToRgba(color, da * 0.7);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 19, 3, 1);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 19, 3, 1);
}

/** Forge — amber safety goggles, wide build, work apron */
function drawForgeSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  // Safety goggles band (row 0-1) across forehead
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 1, oy + bob, 10, 1);
  ctx.fillStyle = darken(color, 0.2);
  ctx.fillRect(ox + 0, oy + 1 + bob, 12, 1);
  // Hard hat brim accent
  ctx.fillStyle = lighten(color, 0.3);
  ctx.fillRect(ox + 3, oy + bob, 6, 1);
  // Head (rows 2-7) — wider, sturdy face
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 1, oy + 2 + bob, 10, 6);
  // Goggles over eyes (row 3-5)
  ctx.fillStyle = hexToRgba(color, da * 0.8);
  ctx.fillRect(ox + 2, oy + 3 + bob, 8, 1); // strap
  // Left goggle lens
  ctx.fillStyle = hexToRgba('#202040', da);
  ctx.fillRect(ox + 2, oy + 4 + bob, 3, 2);
  ctx.fillStyle = hexToRgba(color, da * 0.4);
  ctx.fillRect(ox + 2, oy + 4 + bob, 1, 1); // lens shine
  // Right goggle lens
  ctx.fillStyle = hexToRgba('#202040', da);
  ctx.fillRect(ox + 7, oy + 4 + bob, 3, 2);
  ctx.fillStyle = hexToRgba(color, da * 0.4);
  ctx.fillRect(ox + 7, oy + 4 + bob, 1, 1); // lens shine
  // Goggle bridge
  ctx.fillStyle = hexToRgba('#404060', da);
  ctx.fillRect(ox + 5, oy + 4 + bob, 2, 1);
  // Stubble/chin
  ctx.fillStyle = hexToRgba(SKIN_SHADOW, da);
  ctx.fillRect(ox + 3, oy + 7 + bob, 6, 1);
  // Determined mouth
  ctx.fillStyle = hexToRgba('#A07050', da);
  ctx.fillRect(ox + 4, oy + 6 + bob, 4, 1);
  // Neck (thick)
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 4, oy + 8 + bob, 4, 1);
  // Body — work apron over broad frame (rows 9-14)
  // Base shirt (dark)
  ctx.fillStyle = hexToRgba('#3A3A2A', da);
  ctx.fillRect(ox + 0, oy + 9 + bob, 12, 6);
  // Leather apron (front)
  ctx.fillStyle = hexToRgba('#6B4A2A', da);
  ctx.fillRect(ox + 2, oy + 9 + bob, 8, 6);
  // Apron straps
  ctx.fillStyle = hexToRgba('#5A3A1A', da);
  ctx.fillRect(ox + 3, oy + 9 + bob, 1, 3);
  ctx.fillRect(ox + 8, oy + 9 + bob, 1, 3);
  // Tool pocket on apron
  ctx.fillStyle = hexToRgba(color, da * 0.5);
  ctx.fillRect(ox + 4, oy + 12 + bob, 4, 2);
  ctx.fillStyle = hexToRgba(color, da * 0.8);
  ctx.fillRect(ox + 5, oy + 12 + bob, 1, 2); // wrench in pocket
  // Broad shoulders / arms
  ctx.fillStyle = hexToRgba('#3A3A2A', da);
  ctx.fillRect(ox + 0, oy + 9 + bob, 2, 5);
  ctx.fillRect(ox + 10, oy + 9 + bob, 2, 5);
  // Gloves
  ctx.fillStyle = hexToRgba(color, da * 0.6);
  ctx.fillRect(ox + 0, oy + 14 + bob, 2, 1);
  ctx.fillRect(ox + 10, oy + 14 + bob, 2, 1);
  // Legs (rows 15-19) — heavy work boots
  const lf = frame;
  ctx.fillStyle = hexToRgba('#2A2A1A', da);
  ctx.fillRect(ox + 1 + (lf === 1 ? 1 : 0), oy + 15, 4, 3);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 15, 4, 3);
  // Big boots
  ctx.fillStyle = hexToRgba('#4A3A1A', da);
  ctx.fillRect(ox + 1 + (lf === 1 ? 1 : 0), oy + 18, 4, 2);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 18, 4, 2);
  // Boot soles
  ctx.fillStyle = hexToRgba('#2A1A0A', da);
  ctx.fillRect(ox + 1 + (lf === 1 ? 1 : 0), oy + 19, 4, 1);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 19, 4, 1);
}

/** Pulse — teal headset, lab coat */
function drawPulseSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  // Neat hair (rows 0-1)
  ctx.fillStyle = hexToRgba('#2A2A3A', da);
  ctx.fillRect(ox + 2, oy + bob, 8, 1);
  ctx.fillRect(ox + 1, oy + 1 + bob, 10, 1);
  // Head (rows 2-7) — neat, professional
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 1, oy + 2 + bob, 10, 6);
  // Rounded corners
  ctx.fillStyle = hexToRgba(C.bg, 1);
  ctx.fillRect(ox + 1, oy + 2 + bob, 1, 1);
  ctx.fillRect(ox + 10, oy + 2 + bob, 1, 1);
  // Headset earpiece on left side
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 0, oy + 3 + bob, 1, 3);
  ctx.fillStyle = lighten(color, 0.3);
  ctx.fillRect(ox + 0, oy + 4 + bob, 1, 1);
  // Headset band across top
  ctx.fillStyle = hexToRgba(color, da * 0.5);
  ctx.fillRect(ox + 1, oy + 2 + bob, 3, 1);
  // Headset mic
  ctx.fillStyle = hexToRgba(color, da * 0.7);
  ctx.fillRect(ox + 1, oy + 6 + bob, 2, 1);
  // Focused eyes
  ctx.fillStyle = hexToRgba('#1A1A30', da);
  ctx.fillRect(ox + 3, oy + 4 + bob, 2, 1);
  ctx.fillRect(ox + 7, oy + 4 + bob, 2, 1);
  // Analytical expression — straight line mouth
  ctx.fillStyle = hexToRgba('#C08060', da);
  ctx.fillRect(ox + 5, oy + 6 + bob, 2, 1);
  // Neck
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  // Body — lab coat (rows 9-14)
  // White lab coat
  ctx.fillStyle = hexToRgba('#E8ECF0', da);
  ctx.fillRect(ox + 1, oy + 9 + bob, 10, 6);
  // Coat edges (slightly darker)
  ctx.fillStyle = hexToRgba('#C8CCD0', da);
  ctx.fillRect(ox + 1, oy + 9 + bob, 1, 6);
  ctx.fillRect(ox + 10, oy + 9 + bob, 1, 6);
  // Teal scrubs underneath (visible in center)
  ctx.fillStyle = hexToRgba(color, da * 0.7);
  ctx.fillRect(ox + 4, oy + 9 + bob, 4, 2);
  // ID badge
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 2, oy + 10 + bob, 2, 3);
  ctx.fillStyle = hexToRgba('#FFFFFF', da * 0.5);
  ctx.fillRect(ox + 2, oy + 11 + bob, 2, 1);
  // Coat buttons
  ctx.fillStyle = hexToRgba('#808080', da);
  ctx.fillRect(ox + 5, oy + 11 + bob, 1, 1);
  ctx.fillRect(ox + 5, oy + 13 + bob, 1, 1);
  // Arms (coat sleeves)
  ctx.fillStyle = hexToRgba('#D8DDE0', da);
  ctx.fillRect(ox + 0, oy + 10 + bob, 1, 4);
  ctx.fillRect(ox + 11, oy + 10 + bob, 1, 4);
  // Legs (rows 15-19) — neat slacks
  const lf = frame;
  ctx.fillStyle = hexToRgba('#2A3A3A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 15, 3, 4);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 15, 3, 4);
  // Clean shoes
  ctx.fillStyle = hexToRgba('#1A2A2A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 19, 3, 1);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 19, 3, 1);
}

/** Echo — indigo headband, casual shirt, warm open stance */
function drawEchoSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  // Warm hair (rows 0-1) — curly/wavy
  ctx.fillStyle = hexToRgba('#5A3A2A', da);
  ctx.fillRect(ox + 1, oy + bob, 10, 1);
  ctx.fillRect(ox + 0, oy + 1 + bob, 12, 1);
  // Volume on sides
  ctx.fillRect(ox + 0, oy + 2 + bob, 1, 2);
  ctx.fillRect(ox + 11, oy + 2 + bob, 1, 2);
  // Headband accessory
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 1, oy + 1 + bob, 10, 1);
  // Head (rows 2-7) — warm, rounded
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 1, oy + 2 + bob, 10, 6);
  // Rounded corners
  ctx.fillStyle = hexToRgba(C.bg, 1);
  ctx.fillRect(ox + 1, oy + 2 + bob, 1, 1);
  ctx.fillRect(ox + 10, oy + 2 + bob, 1, 1);
  ctx.fillRect(ox + 1, oy + 7 + bob, 1, 1);
  ctx.fillRect(ox + 10, oy + 7 + bob, 1, 1);
  // Kind eyes — open and warm
  ctx.fillStyle = hexToRgba('#1A1A30', da);
  ctx.fillRect(ox + 3, oy + 4 + bob, 2, 2);
  ctx.fillRect(ox + 7, oy + 4 + bob, 2, 2);
  // Eye shine (big, friendly)
  ctx.fillStyle = hexToRgba('#FFFFFF', da * 0.7);
  ctx.fillRect(ox + 3, oy + 4 + bob, 1, 1);
  ctx.fillRect(ox + 7, oy + 4 + bob, 1, 1);
  // Warm smile
  ctx.fillStyle = hexToRgba('#C08060', da);
  ctx.fillRect(ox + 4, oy + 6 + bob, 4, 1);
  ctx.fillRect(ox + 3, oy + 6 + bob, 1, 1);
  ctx.fillRect(ox + 8, oy + 6 + bob, 1, 1);
  // Neck
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  // Body — casual shirt (rows 9-14)
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 1, oy + 9 + bob, 10, 6);
  // Shirt collar (V-neck)
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 5, oy + 9 + bob, 2, 1);
  // Shirt stripes (horizontal, lighter)
  ctx.fillStyle = lighten(color, 0.2);
  ctx.fillRect(ox + 2, oy + 11 + bob, 8, 1);
  ctx.fillRect(ox + 2, oy + 13 + bob, 8, 1);
  // Open arms — wider stance
  ctx.fillStyle = darken(color, 0.15);
  ctx.fillRect(ox + 0, oy + 10 + bob, 2, 4);
  ctx.fillRect(ox + 10, oy + 10 + bob, 2, 4);
  // Hands (open, friendly)
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 0, oy + 14 + bob, 1, 1);
  ctx.fillRect(ox + 11, oy + 14 + bob, 1, 1);
  // Legs (rows 15-19)
  const lf = frame;
  ctx.fillStyle = hexToRgba('#3A3A5A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 15, 3, 4);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 15, 3, 4);
  // Casual sneakers
  ctx.fillStyle = hexToRgba('#FFFFFF', da * 0.7);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 19, 3, 1);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 19, 3, 1);
}

/** Cal — lime clipboard, polo shirt, organized */
function drawCalSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  // Clean short hair (rows 0-1)
  ctx.fillStyle = hexToRgba('#2A3A2A', da);
  ctx.fillRect(ox + 2, oy + bob, 8, 1);
  ctx.fillRect(ox + 2, oy + 1 + bob, 8, 1);
  // Head (rows 2-7) — tidy
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 1, oy + 2 + bob, 10, 6);
  // Rounded corners
  ctx.fillStyle = hexToRgba(C.bg, 1);
  ctx.fillRect(ox + 1, oy + 2 + bob, 1, 1);
  ctx.fillRect(ox + 10, oy + 2 + bob, 1, 1);
  // Alert eyes
  ctx.fillStyle = hexToRgba('#1A1A30', da);
  ctx.fillRect(ox + 3, oy + 4 + bob, 2, 1);
  ctx.fillRect(ox + 7, oy + 4 + bob, 2, 1);
  // Eyebrows (raised, attentive)
  ctx.fillStyle = hexToRgba('#2A3A2A', da);
  ctx.fillRect(ox + 3, oy + 3 + bob, 2, 1);
  ctx.fillRect(ox + 7, oy + 3 + bob, 2, 1);
  // Organized smile
  ctx.fillStyle = hexToRgba('#C08060', da);
  ctx.fillRect(ox + 5, oy + 6 + bob, 2, 1);
  // Neck
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  // Body — polo shirt (rows 9-14)
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 1, oy + 9 + bob, 10, 6);
  // Polo collar
  ctx.fillStyle = darken(color, 0.2);
  ctx.fillRect(ox + 3, oy + 9 + bob, 6, 1);
  ctx.fillStyle = lighten(color, 0.2);
  ctx.fillRect(ox + 5, oy + 9 + bob, 2, 2);
  // Polo buttons
  ctx.fillStyle = hexToRgba('#E0E0E0', da);
  ctx.fillRect(ox + 5, oy + 10 + bob, 1, 1);
  ctx.fillRect(ox + 5, oy + 11 + bob, 1, 1);
  // Arms
  ctx.fillStyle = darken(color, 0.15);
  ctx.fillRect(ox + 0, oy + 10 + bob, 2, 4);
  ctx.fillRect(ox + 10, oy + 10 + bob, 2, 4);
  // Clipboard in left hand (held out front)
  ctx.fillStyle = hexToRgba('#D4C8A0', da);
  ctx.fillRect(ox + 0, oy + 13 + bob, 3, 3);
  // Clipboard paper
  ctx.fillStyle = hexToRgba('#FFFFFF', da * 0.8);
  ctx.fillRect(ox + 0, oy + 14 + bob, 3, 2);
  // Clipboard clip
  ctx.fillStyle = hexToRgba(color, da);
  ctx.fillRect(ox + 1, oy + 13 + bob, 1, 1);
  // Legs (rows 15-19)
  const lf = frame;
  ctx.fillStyle = hexToRgba('#2A3A2A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 15, 3, 4);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 15, 3, 4);
  // Clean shoes
  ctx.fillStyle = hexToRgba('#4A4A3A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 19, 3, 1);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 19, 3, 1);
}

/** Nova — magenta spiky hair, magnifying glass, explorer vest */
function drawNovaSprite(ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number): void {
  const bob = frame === 1 ? -1 : 0;
  // Spiky hair (rows 0-1) — 2-3 pixels sticking up
  ctx.fillStyle = hexToRgba(color, da * 0.8);
  ctx.fillRect(ox + 3, oy - 1 + bob, 1, 1);
  ctx.fillRect(ox + 6, oy - 1 + bob, 2, 1);
  ctx.fillRect(ox + 9, oy - 1 + bob, 1, 1);
  ctx.fillStyle = darken(color, 0.3);
  ctx.fillRect(ox + 1, oy + bob, 10, 1);
  ctx.fillRect(ox + 1, oy + 1 + bob, 10, 1);
  // Head (rows 2-7)
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 1, oy + 2 + bob, 10, 6);
  // Rounded corners
  ctx.fillStyle = hexToRgba(C.bg, 1);
  ctx.fillRect(ox + 1, oy + 2 + bob, 1, 1);
  ctx.fillRect(ox + 10, oy + 2 + bob, 1, 1);
  // Bright curious eyes
  ctx.fillStyle = hexToRgba('#1A1A30', da);
  ctx.fillRect(ox + 3, oy + 4 + bob, 2, 2);
  ctx.fillRect(ox + 7, oy + 4 + bob, 2, 2);
  // Eye sparkle
  ctx.fillStyle = hexToRgba('#FFFFFF', da * 0.9);
  ctx.fillRect(ox + 4, oy + 4 + bob, 1, 1);
  ctx.fillRect(ox + 8, oy + 4 + bob, 1, 1);
  // Excited grin
  ctx.fillStyle = hexToRgba('#C08060', da);
  ctx.fillRect(ox + 4, oy + 6 + bob, 4, 1);
  ctx.fillRect(ox + 5, oy + 7 + bob, 2, 1);
  // Neck
  ctx.fillStyle = hexToRgba(SKIN, da);
  ctx.fillRect(ox + 5, oy + 8 + bob, 2, 1);
  // Body — explorer vest (rows 9-14)
  // Base T-shirt
  ctx.fillStyle = hexToRgba('#3A3A4A', da);
  ctx.fillRect(ox + 1, oy + 9 + bob, 10, 6);
  // Vest overlay
  ctx.fillStyle = hexToRgba(color, da * 0.7);
  ctx.fillRect(ox + 1, oy + 9 + bob, 3, 6);
  ctx.fillRect(ox + 8, oy + 9 + bob, 3, 6);
  // Vest pockets (2 on front)
  ctx.fillStyle = darken(color, 0.2);
  ctx.fillRect(ox + 2, oy + 11 + bob, 2, 2);
  ctx.fillRect(ox + 8, oy + 11 + bob, 2, 2);
  // Pocket flaps
  ctx.fillStyle = hexToRgba(color, da * 0.9);
  ctx.fillRect(ox + 2, oy + 11 + bob, 2, 1);
  ctx.fillRect(ox + 8, oy + 11 + bob, 2, 1);
  // Vest zipper
  ctx.fillStyle = hexToRgba('#C0C0C0', da * 0.5);
  ctx.fillRect(ox + 5, oy + 9 + bob, 1, 5);
  // Arms
  ctx.fillStyle = hexToRgba('#3A3A4A', da);
  ctx.fillRect(ox + 0, oy + 10 + bob, 1, 4);
  ctx.fillRect(ox + 11, oy + 10 + bob, 1, 4);
  // Magnifying glass in right hand
  ctx.fillStyle = hexToRgba('#C0C0C0', da);
  ctx.fillRect(ox + 11, oy + 13 + bob, 1, 2); // handle
  ctx.fillStyle = hexToRgba(color, da * 0.8);
  ctx.fillRect(ox + 10, oy + 11 + bob, 2, 2); // lens ring
  ctx.fillStyle = hexToRgba('#A0D0FF', da * 0.5);
  ctx.fillRect(ox + 10, oy + 12 + bob, 2, 1); // lens glass
  // Legs (rows 15-19) — cargo pants
  const lf = frame;
  ctx.fillStyle = hexToRgba('#4A3A2A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 15, 3, 4);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 15, 3, 4);
  // Cargo pockets on legs
  ctx.fillStyle = hexToRgba('#5A4A3A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 17, 2, 1);
  ctx.fillRect(ox + 8 + (lf === 1 ? -1 : 0), oy + 17, 2, 1);
  // Adventure boots
  ctx.fillStyle = hexToRgba('#6A4A2A', da);
  ctx.fillRect(ox + 2 + (lf === 1 ? 1 : 0), oy + 19, 3, 1);
  ctx.fillRect(ox + 7 + (lf === 1 ? -1 : 0), oy + 19, 3, 1);
}

// Sprite dispatch table — avoids repeated switch/if at draw time
const SPRITE_DRAWERS: Record<string, (ctx: CanvasRenderingContext2D, ox: number, oy: number, color: string, da: number, frame: number) => void> = {
  weebo: drawWeeboSprite,
  edith: drawEdithSprite,
  jarvis: drawJarvisSprite,
  aria: drawAriaSprite,
  forge: drawForgeSprite,
  pulse: drawPulseSprite,
  echo: drawEchoSprite,
  cal: drawCalSprite,
  nova: drawNovaSprite,
};

// ---------------------------------------------------------------------------
// drawAgent — detailed pixel art sprite per agent, 12x20 with unique design
// ---------------------------------------------------------------------------

export function drawAgent(ctx: CanvasRenderingContext2D, agent: CanvasAgent, tick: number, isSelected: boolean): void {
  const cx = gx(agent.x) + CELL / 2; // center of the cell
  const cy = gy(agent.y) + CELL / 2;
  const color = agent.color;
  const da = agent.isDormant ? 0.3 : 1.0; // dormant alpha
  const isWalking = agent.x !== agent.targetX || agent.y !== agent.targetY;

  // Sprite is 12 wide x 20 tall, anchored at center
  const spriteW = 12;
  const spriteH = 20;
  const ox = cx - Math.floor(spriteW / 2);
  const oy = cy - Math.floor(spriteH / 2) - 1; // shift up slightly

  // Agent glow for active (non-idle, non-dormant) agents
  if (agent.state !== 'idle' && !agent.isDormant) {
    ctx.fillStyle = hexToRgba(agent.color, 0.08);
    ctx.fillRect(gx(agent.x) - CELL, gy(agent.y) - CELL, CELL * 4, CELL * 4);
    ctx.fillStyle = hexToRgba(agent.color, 0.04);
    ctx.fillRect(gx(agent.x) - CELL * 2, gy(agent.y) - CELL * 2, CELL * 6, CELL * 6);
  }

  // Selected agent — pulsing ring
  if (isSelected) {
    const pulseAlpha = tick % 2 === 0 ? 0.4 : 0.2;
    ctx.fillStyle = hexToRgba(color, pulseAlpha);
    const ringX = ox - 3;
    const ringY = oy - 3;
    const ringW = spriteW + 6;
    const ringH = spriteH + 6;
    ctx.fillRect(ringX, ringY, ringW, 1);            // top
    ctx.fillRect(ringX, ringY + ringH, ringW, 1);    // bottom
    ctx.fillRect(ringX, ringY, 1, ringH);             // left
    ctx.fillRect(ringX + ringW - 1, ringY, 1, ringH); // right
    // Corner accents
    ctx.fillRect(ringX - 1, ringY - 1, 3, 1);
    ctx.fillRect(ringX - 1, ringY - 1, 1, 3);
    ctx.fillRect(ringX + ringW - 2, ringY - 1, 3, 1);
    ctx.fillRect(ringX + ringW, ringY - 1, 1, 3);
    ctx.fillRect(ringX - 1, ringY + ringH, 3, 1);
    ctx.fillRect(ringX - 1, ringY + ringH - 2, 1, 3);
    ctx.fillRect(ringX + ringW - 2, ringY + ringH, 3, 1);
    ctx.fillRect(ringX + ringW, ringY + ringH - 2, 1, 3);
  }

  // Walking animation frame (leg phase + body bob)
  const walkFrame = isWalking ? (tick % 2) : 0;

  // Draw the agent-specific sprite
  const drawer = SPRITE_DRAWERS[agent.id];
  if (drawer) {
    drawer(ctx, ox, oy, color, da, walkFrame);
  } else {
    // Fallback for unknown agents — simple colored rectangle
    ctx.fillStyle = hexToRgba(color, da);
    ctx.fillRect(ox, oy, spriteW, spriteH);
  }

  // Shadow under feet
  ctx.fillStyle = hexToRgba(color, da * 0.08);
  ctx.fillRect(cx - 6, oy + spriteH, 12, 2);
  ctx.fillStyle = hexToRgba(color, da * 0.04);
  ctx.fillRect(cx - 8, oy + spriteH + 1, 16, 1);

  // Name label below sprite
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = hexToRgba(color, da * 0.7);
  ctx.fillText(agent.id.slice(0, 5).toUpperCase(), cx, oy + spriteH + 9);
}

// ---------------------------------------------------------------------------
// drawStateIndicator — icon/animation above agent head per state
// ---------------------------------------------------------------------------

export function drawStateIndicator(ctx: CanvasRenderingContext2D, agent: CanvasAgent, tick: number): void {
  const cx = gx(agent.x) + CELL / 2;
  const baseY = gy(agent.y) + CELL / 2 - 17; // above head (taller 20px sprites)
  const bobOffset = tick % 4 < 2 ? 0 : -1;

  switch (agent.state) {
    case 'idle':
      // Tiny bob dot — very subtle
      if (tick % 6 < 2) {
        ctx.fillStyle = hexToRgba(C.dim, 0.3);
        ctx.fillRect(cx, baseY + bobOffset, 1, 1);
      }
      break;

    case 'thinking': {
      // Yellow "?" that bobs
      const y = baseY + bobOffset;
      ctx.fillStyle = '#FBBF24'; // yellow
      // ? shape: top bar, right side, middle bar, bottom dot
      ctx.fillRect(cx - 1, y, 3, 1);     // top
      ctx.fillRect(cx + 1, y + 1, 1, 1); // right curve
      ctx.fillRect(cx, y + 2, 1, 1);     // middle
      ctx.fillRect(cx, y + 4, 1, 1);     // dot
      break;
    }

    case 'typing':
    case 'responding': {
      // Animated dots (3 dots cycling)
      const phase = tick % 3;
      for (let i = 0; i < 3; i++) {
        const alpha = i === phase ? 0.9 : 0.25;
        ctx.fillStyle = hexToRgba(agent.color, alpha);
        ctx.fillRect(cx - 3 + i * 3, baseY, 2, 2);
      }
      break;
    }

    case 'tool_call': {
      // Orange wrench pixel art
      ctx.fillStyle = '#F59E0B'; // orange
      // Wrench shape
      ctx.fillRect(cx - 1, baseY, 1, 3);     // handle
      ctx.fillRect(cx - 2, baseY - 1, 3, 1); // jaw top
      ctx.fillRect(cx - 2, baseY + 3, 3, 1); // jaw bottom
      ctx.fillRect(cx + 1, baseY, 1, 1);     // head
      break;
    }

    case 'tool_result': {
      // Green gear pixel art
      ctx.fillStyle = C.green;
      // Gear: cross shape with center
      ctx.fillRect(cx, baseY - 1, 1, 5);     // vertical
      ctx.fillRect(cx - 2, baseY + 1, 5, 1); // horizontal
      ctx.fillRect(cx - 1, baseY, 1, 1);     // tl
      ctx.fillRect(cx + 1, baseY, 1, 1);     // tr
      ctx.fillRect(cx - 1, baseY + 2, 1, 1); // bl
      ctx.fillRect(cx + 1, baseY + 2, 1, 1); // br
      break;
    }

    case 'done': {
      // Green checkmark
      ctx.fillStyle = C.green;
      ctx.fillRect(cx - 2, baseY + 1, 1, 1);
      ctx.fillRect(cx - 1, baseY + 2, 1, 1);
      ctx.fillRect(cx, baseY + 1, 1, 1);
      ctx.fillRect(cx + 1, baseY, 1, 1);
      ctx.fillRect(cx + 2, baseY - 1, 1, 1);
      break;
    }

    case 'delegating': {
      // Cyan arrow pointing right
      ctx.fillStyle = C.cyan;
      const ax = cx - 2;
      const ay = baseY;
      ctx.fillRect(ax, ay + 1, 4, 1);     // shaft
      ctx.fillRect(ax + 3, ay, 1, 1);     // arrow top
      ctx.fillRect(ax + 3, ay + 2, 1, 1); // arrow bottom
      ctx.fillRect(ax + 4, ay + 1, 1, 1); // arrow tip
      break;
    }

    case 'comm_sent': {
      // Small envelope moving right
      const slideX = (tick % 4) * 1;
      ctx.fillStyle = hexToRgba(C.cyan, 0.8);
      ctx.fillRect(cx - 2 + slideX, baseY, 4, 3);     // envelope body
      ctx.fillStyle = hexToRgba(C.bg, 0.5);
      ctx.fillRect(cx - 1 + slideX, baseY + 1, 2, 1); // fold line
      break;
    }

    case 'comm_received': {
      // Small envelope arriving (slide from left)
      const arriveX = Math.min((tick % 4) * 1, 2);
      ctx.fillStyle = hexToRgba(C.green, 0.8);
      ctx.fillRect(cx - 4 + arriveX, baseY, 4, 3);
      ctx.fillStyle = hexToRgba(C.bg, 0.5);
      ctx.fillRect(cx - 3 + arriveX, baseY + 1, 2, 1);
      break;
    }

    case 'task_started': {
      // Cyan rocket
      ctx.fillStyle = C.cyan;
      ctx.fillRect(cx, baseY - 1, 1, 1);     // nose
      ctx.fillRect(cx - 1, baseY, 3, 1);     // upper body
      ctx.fillRect(cx - 1, baseY + 1, 3, 1); // lower body
      // Fins
      ctx.fillRect(cx - 2, baseY + 2, 1, 1);
      ctx.fillRect(cx + 2, baseY + 2, 1, 1);
      // Flame (flicker)
      ctx.fillStyle = tick % 2 === 0 ? '#F59E0B' : '#EF4444';
      ctx.fillRect(cx - 1, baseY + 2, 3, 1);
      ctx.fillRect(cx, baseY + 3, 1, 1);
      break;
    }

    case 'task_completed': {
      // Green star (5 pixels in a cross + 4 diagonals)
      ctx.fillStyle = C.green;
      ctx.fillRect(cx, baseY - 1, 1, 1); // top
      ctx.fillRect(cx - 2, baseY, 1, 1); // left
      ctx.fillRect(cx + 2, baseY, 1, 1); // right
      ctx.fillRect(cx - 1, baseY, 3, 1); // center row
      ctx.fillRect(cx, baseY + 1, 1, 1); // bottom center
      ctx.fillRect(cx - 1, baseY + 2, 1, 1); // bottom left
      ctx.fillRect(cx + 1, baseY + 2, 1, 1); // bottom right
      break;
    }

    case 'task_failed': {
      // Red X
      ctx.fillStyle = C.pink;
      ctx.fillRect(cx - 2, baseY - 1, 1, 1);
      ctx.fillRect(cx + 2, baseY - 1, 1, 1);
      ctx.fillRect(cx - 1, baseY, 1, 1);
      ctx.fillRect(cx + 1, baseY, 1, 1);
      ctx.fillRect(cx, baseY + 1, 1, 1);
      ctx.fillRect(cx - 1, baseY + 2, 1, 1);
      ctx.fillRect(cx + 1, baseY + 2, 1, 1);
      ctx.fillRect(cx - 2, baseY + 3, 1, 1);
      ctx.fillRect(cx + 2, baseY + 3, 1, 1);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// drawParticleBeam — colored 2x2 rectangles traveling between two agents
// ---------------------------------------------------------------------------

export function drawParticleBeam(ctx: CanvasRenderingContext2D, beam: ParticleBeam, agents: CanvasAgent[]): void {
  const from = agents.find(a => a.id === beam.fromAgentId);
  const to = agents.find(a => a.id === beam.toAgentId);
  if (!from || !to) return;

  const x1 = gx(from.x) + CELL / 2;
  const y1 = gy(from.y) + CELL / 2;
  const x2 = gx(to.x) + CELL / 2;
  const y2 = gy(to.y) + CELL / 2;

  const elapsed = Date.now() - beam.createdAt;
  const progress = Math.min(elapsed / beam.duration, 1);

  // 10 particles along the line, spaced by progress
  const numParticles = 10;
  for (let i = 0; i < numParticles; i++) {
    const t = (i / numParticles + progress) % 1;
    const px = Math.round(x1 + (x2 - x1) * t);
    const py = Math.round(y1 + (y2 - y1) * t);

    // Fade particles near edges
    const edgeFade = Math.min(t, 1 - t) * 4;
    const alpha = Math.min(edgeFade, 0.7);

    ctx.fillStyle = hexToRgba(beam.color, alpha);
    ctx.fillRect(px - 1, py - 1, 2, 2);
  }
}

// ---------------------------------------------------------------------------
// renderFrame — main entry, called every CANVAS_TICK_MS
// ---------------------------------------------------------------------------

export function renderFrame(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { agents, door, beams, tick, selectedAgentId } = state;

  // 1. Clear + background
  drawBackground(ctx);

  // 2. Furniture: desks, stations, server rack
  for (let i = 0; i < CORE_DESK_ENTRIES.length; i++) {
    const [id, pos] = CORE_DESK_ENTRIES[i];
    drawDesk(ctx, pos.x, pos.y, AGENT_COLORS[id as keyof typeof AGENT_COLORS]);
  }

  for (let i = 0; i < SPEC_ENTRIES.length; i++) {
    const [id, pos] = SPEC_ENTRIES[i];
    const agent = agents.find(a => a.id === id);
    const isDormant = agent?.isDormant ?? true;
    drawStation(ctx, pos.x, pos.y, AGENT_COLORS[id as keyof typeof AGENT_COLORS], isDormant);
  }

  drawServerRack(ctx, tick);

  // 3. Door
  drawDoor(ctx, door);

  // 4. Particle beams (behind agents)
  for (let i = 0; i < beams.length; i++) {
    drawParticleBeam(ctx, beams[i], agents);
  }

  // 5. Agents + state indicators
  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const isSelected = agent.id === selectedAgentId;
    drawAgent(ctx, agent, tick, isSelected);
    drawStateIndicator(ctx, agent, tick);
  }
}
