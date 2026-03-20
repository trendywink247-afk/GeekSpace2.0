// src/dashboard/pages/office/OfficeCanvasRenderer.ts
// Pure canvas pixel-art renderer for the Agent Office Mission Control.
// Called every 33ms (~30fps) by the Stage component. Uses 16x24 pre-rendered sprite
// canvases for characters and fillRect() for UI overlays.
//
// Agents are positioned using smooth renderX/renderY pixel coordinates
// (interpolated in the Stage tick loop) rather than snapping to grid cells.
//
// The background is a single pixel-art image (864x800) that contains all
// furniture, walls, and floor. No code-drawn furniture needed.

import type { CanvasAgent, ParticleBeam } from './types';
import {
  CELL, COLS, ROWS, CANVAS_W, CANVAS_H,
  C,
} from './constants';
import { ROOMS } from './roomZones';
import { SMART_OBJECTS } from './smartObjects';
import { isPointOccupied } from './occupancy';
import { getAgentSprites, drawSpriteFrame } from './sprites';

// ---------------------------------------------------------------------------
// Background / Foreground image loading (pixel art office)
// ---------------------------------------------------------------------------

let bgImage: HTMLImageElement | null = null;
let fgImage: HTMLImageElement | null = null;
let bgLoaded = false;

/** Load office background + foreground images. Non-fatal on error. */
export function loadOfficeAssets(): Promise<void> {
  return new Promise((resolve) => {
    let loaded = 0;
    const checkDone = () => { if (++loaded >= 2) { bgLoaded = true; resolve(); } };

    bgImage = new Image();
    bgImage.onload = checkDone;
    bgImage.onerror = checkDone; // fallback to solid bg
    bgImage.src = '/office/office_bg.webp';

    fgImage = new Image();
    fgImage.onload = checkDone;
    fgImage.onerror = checkDone;
    fgImage.src = '/office/office_fg.webp';
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RenderState {
  agents: CanvasAgent[];
  beams: ParticleBeam[];
  tick: number;
  selectedAgentId: string | null;
  showDebug?: boolean;
  collisionMap?: boolean[][];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert hex "#RRGGBB" to "rgba(r,g,b,a)" */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Whether the pixel art background loaded successfully */
export function isBgLoaded(): boolean {
  return bgLoaded && !!bgImage && bgImage.complete && bgImage.naturalWidth > 0;
}

// ---------------------------------------------------------------------------
// drawBackground — pixel art image scaled to canvas (or solid fallback)
// ---------------------------------------------------------------------------

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  if (bgImage && bgLoaded && bgImage.complete && bgImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bgImage, 0, 0, CANVAS_W, CANVAS_H);
    return;
  }

  // Fallback: solid dark background while image is loading or on error
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

// ---------------------------------------------------------------------------
// drawForeground — pixel art layer drawn ON TOP of characters for depth
// ---------------------------------------------------------------------------

export function drawForeground(ctx: CanvasRenderingContext2D): void {
  if (fgImage && bgLoaded && fgImage.complete && fgImage.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fgImage, 0, 0, CANVAS_W, CANVAS_H);
  }
}

// ---------------------------------------------------------------------------
// drawAgent — 16x24 pixel-art sprites via cached canvas drawImage()
// Uses smooth renderX/renderY for sub-pixel positioning
// ---------------------------------------------------------------------------

export function drawAgent(ctx: CanvasRenderingContext2D, agent: CanvasAgent, tick: number, isSelected: boolean): void {
  const cx = Math.round(agent.renderX);
  const cy = Math.round(agent.renderY);
  const color = agent.color;
  const isWalking = agent.path && agent.path.length > 0 && agent.pathIndex < agent.path.length;

  // INTEGER scale only — 2x. Pixel art MUST use integer scale or it breaks.
  // 16x24 sprite × 2 = 32x48 drawn pixels. Exactly 1 tile wide, 1.5 tiles tall.
  const SCALE = 2;
  const DW = 16 * SCALE; // 32
  const DH = 24 * SCALE; // 48

  // Anchor: sprite drawn so feet sit at bottom of agent's tile.
  // Agent renderX/Y = tile center = (gridX*32+16, gridY*32+16).
  // Tile bottom = cy + 16. Sprite bottom = drawY + DH.
  // So drawY = (cy + 16) - DH = cy + 16 - 48 = cy - 32.
  const drawX = cx - DW / 2; // centered horizontally
  const drawY = cy - DH + 16; // feet at tile bottom

  // Glow for active agents
  if (agent.state !== 'idle') {
    ctx.fillStyle = hexToRgba(agent.color, 0.06);
    ctx.fillRect(cx - CELL, cy - CELL, CELL * 2, CELL * 2);
  }

  // Selection ring
  if (isSelected) {
    const a = tick % 2 === 0 ? 0.4 : 0.2;
    ctx.strokeStyle = hexToRgba(color, a);
    ctx.strokeRect(drawX - 2, drawY - 2, DW + 4, DH + 4);
  }

  // --- Determine sprite frame ---
  let frameCol = 0;
  let frameRow = 0;
  let mirror = false;

  if (isWalking && agent.path && agent.pathIndex < agent.path.length) {
    const WALK = [0, 1, 2, 1]; // ping-pong
    const frame = WALK[tick % 4];
    const step = agent.path[agent.pathIndex];
    const dx = step.x * CELL + CELL / 2 - agent.renderX;
    const dy = step.y * CELL + CELL / 2 - agent.renderY;

    // PNG sheet layout (verified by pixel inspection):
    //   Row 0: walk down (front face)
    //   Row 1: activity/sitting (NOT walk up!)
    //   Row 2: walk up (back view)
    //   Row 3: walk side (right, mirror for left)
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      const f = agent.facing ?? 'down';
      frameRow = f === 'up' ? 2 : (f === 'left' || f === 'right') ? 3 : 0;
      mirror = f === 'left';
    } else if (Math.abs(dy) >= Math.abs(dx)) {
      frameRow = dy > 0 ? 0 : 2; // down=0, up=2
      frameCol = frame;
    } else {
      frameRow = 3; // side
      mirror = dx < 0;
      frameCol = frame;
    }
  } else if (agent.state === 'typing' || agent.state === 'responding') {
    frameRow = 1; // activity row
    frameCol = tick % 2;
  } else {
    const f = agent.facing ?? 'down';
    frameRow = f === 'up' ? 2 : (f === 'left' || f === 'right') ? 3 : 0;
    mirror = f === 'left';
  }

  // --- Draw PNG sprite (or fallback) ---
  let drawn = drawSpriteFrame(ctx, agent.id, frameCol, frameRow, drawX, drawY, DW, DH, mirror);

  if (!drawn) {
    const sprites = getAgentSprites(agent.id);
    let sprite: HTMLCanvasElement;

    if (isWalking) {
      const frame = [0, 1, 2, 1][tick % 4];
      const dx = agent.targetX * CELL + CELL / 2 - agent.renderX;
      const dy = agent.targetY * CELL + CELL / 2 - agent.renderY;
      if (Math.abs(dx) > Math.abs(dy)) {
        sprite = dx > 0 ? sprites.walkRight[frame] : sprites.walkLeft[frame];
      } else {
        sprite = dy > 0 ? sprites.walkDown[frame] : sprites.walkUp[frame];
      }
    } else if (agent.state === 'typing' || agent.state === 'responding') {
      sprite = sprites.typing[tick % 2];
    } else {
      const f = agent.facing ?? 'down';
      switch (f) {
        case 'up': sprite = sprites.walkUp[0]; break;
        case 'right': sprite = sprites.walkRight[0]; break;
        case 'left': sprite = sprites.walkLeft[0]; break;
        default: sprite = sprites.idle;
      }
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, drawX, drawY, DW, DH);
    ctx.imageSmoothingEnabled = true;
    drawn = true;
  }

  // Shadow
  ctx.fillStyle = hexToRgba(color, 0.1);
  ctx.fillRect(cx - 6, drawY + DH, 12, 2);

  // Name label
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = hexToRgba(color, 0.7);
  ctx.fillText(agent.id.slice(0, 5).toUpperCase(), cx, drawY + DH + 11);
}

// ---------------------------------------------------------------------------
// drawStateIndicator — icon/animation above agent head per state
// Uses smooth renderX/renderY for sub-pixel positioning
// ---------------------------------------------------------------------------

export function drawStateIndicator(ctx: CanvasRenderingContext2D, agent: CanvasAgent, tick: number): void {
  const cx = agent.renderX;
  const cy = agent.renderY;
  // Position above sprite (2x scale: sprite is 48px tall, feet at cy+16)
  const DH = 48;
  const drawY = cy - DH + 16;
  const baseY = drawY - 8; // above sprite top with gap
  const bobOffset = tick % 4 < 2 ? 0 : -1;

  switch (agent.state) {
    case 'idle':
      // Tiny bob dot
      if (tick % 6 < 2) {
        ctx.fillStyle = hexToRgba(C.dim, 0.3);
        ctx.fillRect(cx, baseY + bobOffset, 1, 1);
      }
      break;

    case 'thinking': {
      const y = baseY + bobOffset;
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(cx - 1, y, 3, 1);
      ctx.fillRect(cx + 1, y + 1, 1, 1);
      ctx.fillRect(cx, y + 2, 1, 1);
      ctx.fillRect(cx, y + 4, 1, 1);
      break;
    }

    case 'typing':
    case 'responding': {
      const phase = tick % 3;
      for (let i = 0; i < 3; i++) {
        const alpha = i === phase ? 0.9 : 0.25;
        ctx.fillStyle = hexToRgba(agent.color, alpha);
        ctx.fillRect(cx - 3 + i * 3, baseY, 2, 2);
      }
      break;
    }

    case 'tool_call': {
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(cx - 1, baseY, 1, 3);
      ctx.fillRect(cx - 2, baseY - 1, 3, 1);
      ctx.fillRect(cx - 2, baseY + 3, 3, 1);
      ctx.fillRect(cx + 1, baseY, 1, 1);
      break;
    }

    case 'tool_result': {
      ctx.fillStyle = C.green;
      ctx.fillRect(cx, baseY - 1, 1, 5);
      ctx.fillRect(cx - 2, baseY + 1, 5, 1);
      ctx.fillRect(cx - 1, baseY, 1, 1);
      ctx.fillRect(cx + 1, baseY, 1, 1);
      ctx.fillRect(cx - 1, baseY + 2, 1, 1);
      ctx.fillRect(cx + 1, baseY + 2, 1, 1);
      break;
    }

    case 'done': {
      ctx.fillStyle = C.green;
      ctx.fillRect(cx - 2, baseY + 1, 1, 1);
      ctx.fillRect(cx - 1, baseY + 2, 1, 1);
      ctx.fillRect(cx, baseY + 1, 1, 1);
      ctx.fillRect(cx + 1, baseY, 1, 1);
      ctx.fillRect(cx + 2, baseY - 1, 1, 1);
      break;
    }

    case 'delegating': {
      ctx.fillStyle = C.cyan;
      const ax = cx - 2;
      const ay = baseY;
      ctx.fillRect(ax, ay + 1, 4, 1);
      ctx.fillRect(ax + 3, ay, 1, 1);
      ctx.fillRect(ax + 3, ay + 2, 1, 1);
      ctx.fillRect(ax + 4, ay + 1, 1, 1);
      break;
    }

    case 'comm_sent': {
      const slideX = (tick % 4) * 1;
      ctx.fillStyle = hexToRgba(C.cyan, 0.8);
      ctx.fillRect(cx - 2 + slideX, baseY, 4, 3);
      ctx.fillStyle = hexToRgba(C.bg, 0.5);
      ctx.fillRect(cx - 1 + slideX, baseY + 1, 2, 1);
      break;
    }

    case 'comm_received': {
      const arriveX = Math.min((tick % 4) * 1, 2);
      ctx.fillStyle = hexToRgba(C.green, 0.8);
      ctx.fillRect(cx - 4 + arriveX, baseY, 4, 3);
      ctx.fillStyle = hexToRgba(C.bg, 0.5);
      ctx.fillRect(cx - 3 + arriveX, baseY + 1, 2, 1);
      break;
    }

    case 'task_started': {
      ctx.fillStyle = C.cyan;
      ctx.fillRect(cx, baseY - 1, 1, 1);
      ctx.fillRect(cx - 1, baseY, 3, 1);
      ctx.fillRect(cx - 1, baseY + 1, 3, 1);
      ctx.fillRect(cx - 2, baseY + 2, 1, 1);
      ctx.fillRect(cx + 2, baseY + 2, 1, 1);
      ctx.fillStyle = tick % 2 === 0 ? '#F59E0B' : '#EF4444';
      ctx.fillRect(cx - 1, baseY + 2, 3, 1);
      ctx.fillRect(cx, baseY + 3, 1, 1);
      break;
    }

    case 'task_completed': {
      ctx.fillStyle = C.green;
      ctx.fillRect(cx, baseY - 1, 1, 1);
      ctx.fillRect(cx - 2, baseY, 1, 1);
      ctx.fillRect(cx + 2, baseY, 1, 1);
      ctx.fillRect(cx - 1, baseY, 3, 1);
      ctx.fillRect(cx, baseY + 1, 1, 1);
      ctx.fillRect(cx - 1, baseY + 2, 1, 1);
      ctx.fillRect(cx + 1, baseY + 2, 1, 1);
      break;
    }

    case 'task_failed': {
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
// Uses smooth renderX/renderY for sub-pixel beam endpoints
// ---------------------------------------------------------------------------

export function drawParticleBeam(ctx: CanvasRenderingContext2D, beam: ParticleBeam, agents: CanvasAgent[]): void {
  const from = agents.find(a => a.id === beam.fromAgentId);
  const to = agents.find(a => a.id === beam.toAgentId);
  if (!from || !to) return;

  const x1 = from.renderX;
  const y1 = from.renderY;
  const x2 = to.renderX;
  const y2 = to.renderY;

  const elapsed = Date.now() - beam.createdAt;
  const progress = Math.min(elapsed / beam.duration, 1);

  const numParticles = 10;
  for (let i = 0; i < numParticles; i++) {
    const t = (i / numParticles + progress) % 1;
    const px = Math.round(x1 + (x2 - x1) * t);
    const py = Math.round(y1 + (y2 - y1) * t);
    const edgeFade = Math.min(t, 1 - t) * 4;
    const alpha = Math.min(edgeFade, 0.7);
    ctx.fillStyle = hexToRgba(beam.color, alpha);
    ctx.fillRect(px - 1, py - 1, 2, 2);
  }
}

// ---------------------------------------------------------------------------
// drawTimeOfDayOverlay — tints the canvas based on time of day
// ---------------------------------------------------------------------------

export function drawTimeOfDayOverlay(ctx: CanvasRenderingContext2D): void {
  const hour = new Date().getHours();

  // 6-8am: warm sunrise tint
  // 8am-5pm: no tint (bright day)
  // 5-7pm: warm golden hour
  // 7-9pm: blue dusk
  // 9pm-6am: dark night with warm indoor lights

  let overlayColor = '';
  let alpha = 0;

  if (hour >= 6 && hour < 8) {
    overlayColor = '255, 200, 100'; // warm sunrise
    alpha = 0.05;
  } else if (hour >= 17 && hour < 19) {
    overlayColor = '255, 180, 80'; // golden hour
    alpha = 0.08;
  } else if (hour >= 19 && hour < 21) {
    overlayColor = '60, 80, 140'; // blue dusk
    alpha = 0.1;
  } else if (hour >= 21 || hour < 6) {
    overlayColor = '10, 10, 30'; // night
    alpha = 0.15;
  }

  if (alpha > 0) {
    ctx.fillStyle = `rgba(${overlayColor}, ${alpha})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

// ---------------------------------------------------------------------------
// drawAmbientEffects — subtle desk screen flickers + coffee steam
// ---------------------------------------------------------------------------

export function drawAmbientEffects(ctx: CanvasRenderingContext2D, tick: number): void {
  // Screen flickers on desks — every ~120 ticks, a random desk glows briefly (2 frames)
  if (tick % 120 < 2) {
    const deskIdx = Math.floor((tick / 120) % 4); // cycle through 4 desks
    const deskPositions: [number, number][] = [[3, 16], [5, 16], [9, 16], [11, 16]];
    const [dx, dy] = deskPositions[deskIdx];
    ctx.fillStyle = 'rgba(150, 200, 255, 0.15)';
    ctx.fillRect(dx * CELL + 4, dy * CELL - CELL + 4, CELL - 8, CELL * 0.6);
  }

  // Coffee steam — tiny particles near the coffee machine area
  if (tick % 3 === 0) {
    const steamX = 9 * CELL + CELL / 2;
    const steamY = 3 * CELL - (tick % 20);
    const steamAlpha = Math.max(0, 0.15 - (tick % 20) * 0.008);
    if (steamAlpha > 0) {
      ctx.fillStyle = `rgba(200, 200, 200, ${steamAlpha})`;
      ctx.fillRect(steamX - 1, steamY, 3, 2);
      ctx.fillRect(steamX + 2, steamY - 3, 2, 2);
    }
  }
}

// ---------------------------------------------------------------------------
// drawDebugOverlay — semi-transparent collision grid visualization
// Red = blocked, green = walkable, with grid lines for tile boundaries.
// ---------------------------------------------------------------------------

export function drawDebugOverlay(ctx: CanvasRenderingContext2D, collisionMap: boolean[][]): void {
  for (let r = 0; r < collisionMap.length; r++) {
    for (let c = 0; c < collisionMap[r].length; c++) {
      if (collisionMap[r][c]) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.15)'; // red = blocked
      } else {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)'; // green = walkable
      }
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 0.5;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, CANVAS_H);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(CANVAS_W, r * CELL);
    ctx.stroke();
  }

  // Draw coordinate labels for walkable tiles
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  for (let r = 0; r < collisionMap.length; r++) {
    for (let c = 0; c < collisionMap[r].length; c++) {
      if (!collisionMap[r][c]) {
        ctx.fillText(`${c},${r}`, c * CELL + CELL / 2, r * CELL + CELL / 2 + 3);
      }
    }
  }

  // Draw room zones
  for (const room of ROOMS) {
    ctx.fillStyle = room.color;
    ctx.fillRect(
      room.bounds.x * CELL,
      room.bounds.y * CELL,
      room.bounds.w * CELL,
      room.bounds.h * CELL,
    );
    // Room label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(room.label, room.bounds.x * CELL + 4, room.bounds.y * CELL + 12);
  }

  // Draw smart object footprints and interaction points
  for (const obj of SMART_OBJECTS) {
    // Object footprint (dark red)
    for (const fp of obj.footprint) {
      ctx.fillStyle = 'rgba(200, 0, 0, 0.2)';
      ctx.fillRect(fp.x * CELL + 1, fp.y * CELL + 1, CELL - 2, CELL - 2);
    }
    // Interaction points (blue = available, yellow = occupied)
    for (const ip of obj.interactionPoints) {
      const occupied = isPointOccupied(ip.x, ip.y);
      ctx.fillStyle = occupied
        ? 'rgba(255, 200, 0, 0.5)'
        : 'rgba(0, 150, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(
        ip.x * CELL + CELL / 2,
        ip.y * CELL + CELL / 2,
        4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      // Direction indicator
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      const cx = ip.x * CELL + CELL / 2;
      const cy = ip.y * CELL + CELL / 2;
      const angle =
        ip.facing === 'up' ? -Math.PI / 2
        : ip.facing === 'down' ? Math.PI / 2
        : ip.facing === 'left' ? Math.PI
        : 0;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 6, cy + Math.sin(angle) * 6);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// renderFrame — main entry, called every render tick
// Optional showDebug parameter draws the collision grid overlay.
// ---------------------------------------------------------------------------

export function renderFrame(ctx: CanvasRenderingContext2D, state: RenderState, showDebug?: boolean, collisionMap?: boolean[][]): void {
  const { agents, beams, tick, selectedAgentId } = state;

  // 1. Background (pixel art image or solid fallback)
  drawBackground(ctx);

  // 2. Particle beams (behind agents)
  for (let i = 0; i < beams.length; i++) {
    drawParticleBeam(ctx, beams[i], agents);
  }

  // 3. Ambient effects (desk screen flickers, coffee steam)
  drawAmbientEffects(ctx, tick);

  // 4. Agents sorted by renderY for depth — agents lower on screen draw on top
  const sortedAgents = [...agents].sort((a, b) => a.renderY - b.renderY);
  for (let i = 0; i < sortedAgents.length; i++) {
    const agent = sortedAgents[i];
    const isSelected = agent.id === selectedAgentId;
    drawAgent(ctx, agent, tick, isSelected);
    drawStateIndicator(ctx, agent, tick);
  }

  // 5. Foreground layer disabled — was causing agent head/body clipping
  // when walking through desk areas. Re-enable once depth masking is refined.
  // if (isBgLoaded()) { drawForeground(ctx); }

  // 6. Time-of-day lighting overlay — LAST layer on top of everything
  drawTimeOfDayOverlay(ctx);

  // 7. Debug overlay — collision grid visualization (only when enabled)
  if (showDebug && collisionMap) {
    drawDebugOverlay(ctx, collisionMap);
  }
}
