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
// drawAgent — pixel sprite with head, body, legs, walking animation
// ---------------------------------------------------------------------------

export function drawAgent(ctx: CanvasRenderingContext2D, agent: CanvasAgent, tick: number, isSelected: boolean): void {
  const cx = gx(agent.x) + CELL / 2; // center of the cell
  const cy = gy(agent.y) + CELL / 2;
  const color = agent.color;
  const dormantAlpha = agent.isDormant ? 0.3 : 1.0;
  const isWalking = agent.x !== agent.targetX || agent.y !== agent.targetY;

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
    // Ring as 4 edges of a rectangle around the sprite
    const ringX = cx - 8;
    const ringY = cy - 10;
    const ringW = 16;
    const ringH = 20;
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

  // Head: 6x6 block centered
  const headX = cx - 3;
  const headY = cy - 9;
  ctx.fillStyle = dormantAlpha < 1 ? hexToRgba(color, dormantAlpha) : color;
  ctx.fillRect(headX, headY, 6, 6);

  // Eyes: 2 dark pixels on the head
  ctx.fillStyle = dormantAlpha < 1 ? hexToRgba(C.bg, 0.6) : C.bg;
  ctx.fillRect(headX + 1, headY + 2, 1, 1); // left eye
  ctx.fillRect(headX + 4, headY + 2, 1, 1); // right eye

  // Body: 8x5 centered below head
  const bodyX = cx - 4;
  const bodyY = headY + 6;
  ctx.fillStyle = dormantAlpha < 1 ? hexToRgba(color, dormantAlpha * 0.8) : hexToRgba(color, 0.8);
  ctx.fillRect(bodyX, bodyY, 8, 5);

  // Legs: 2 legs, each 2x3, with walking animation
  const legY = bodyY + 5;
  const legPhase = isWalking ? (tick % 2) : 0;

  ctx.fillStyle = dormantAlpha < 1 ? hexToRgba(color, dormantAlpha * 0.6) : hexToRgba(color, 0.6);

  // Left leg
  const leftLegX = bodyX + 1 + (legPhase === 0 ? 0 : 1);
  ctx.fillRect(leftLegX, legY, 2, 3);

  // Right leg
  const rightLegX = bodyX + 5 + (legPhase === 0 ? 0 : -1);
  ctx.fillRect(rightLegX, legY, 2, 3);

  // Shadow under feet
  ctx.fillStyle = hexToRgba(color, dormantAlpha * 0.06);
  ctx.fillRect(cx - 5, legY + 3, 10, 1);
}

// ---------------------------------------------------------------------------
// drawStateIndicator — icon/animation above agent head per state
// ---------------------------------------------------------------------------

export function drawStateIndicator(ctx: CanvasRenderingContext2D, agent: CanvasAgent, tick: number): void {
  const cx = gx(agent.x) + CELL / 2;
  const baseY = gy(agent.y) + CELL / 2 - 13; // above head
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
