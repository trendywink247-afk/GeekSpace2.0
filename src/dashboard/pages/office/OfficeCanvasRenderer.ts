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
import { getAgentBehaviorMode, getAgentPose } from './agentBehavior';
import type { CanvasEffectState } from './CanvasEffects';

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

export function drawAgent(ctx: CanvasRenderingContext2D, agent: CanvasAgent, tick: number, isSelected: boolean, theme?: 'day' | 'night'): void {
  const cx = Math.round(agent.renderX);
  const cy = Math.round(agent.renderY);
  const color = agent.color;
  const isWalking = agent.path && agent.path.length > 0 && agent.pathIndex < agent.path.length;

  // INTEGER scale only — 2x. Pixel art MUST use integer scale or it breaks.
  // 16x32 sprite × 2 = 32x64 drawn pixels. 1 tile wide, 2 tiles tall.
  // Frame size confirmed from pixel-agents source: 16×32, 3 rows (down/up/right).
  const SCALE = 2;
  const DW = 16 * SCALE; // 32
  const DH = 32 * SCALE; // 64

  // Anchor: sprite feet at tile bottom.
  // Sitting offset: shift sprite down when at furniture interaction point
  const behaviorMode = getAgentBehaviorMode(agent.id);
  const isAtFurniture = !isWalking && (behaviorMode === 'wandering' || behaviorMode === 'socializing' || behaviorMode === 'group-meeting');
  const pose = isAtFurniture ? getAgentPose(agent.id) : 'none';

  // Pose-specific visual offsets:
  // sit  → deep sink into chair (8px down, 8px toward furniture)
  // lean → slight lean toward counter (3px down, 4px toward)
  // stand → no offset (standing at whiteboards/displays)
  let sittingOffset = 0;
  let furnitureOffsetX = 0, furnitureOffsetY = 0;

  if (pose === 'sit') {
    sittingOffset = 8;
    if (agent.facing === 'up') furnitureOffsetY = -8;
    else if (agent.facing === 'down') furnitureOffsetY = 8;
    else if (agent.facing === 'left') furnitureOffsetX = -8;
    else if (agent.facing === 'right') furnitureOffsetX = 8;
  } else if (pose === 'lean') {
    sittingOffset = 3;
    if (agent.facing === 'up') furnitureOffsetY = -4;
    else if (agent.facing === 'down') furnitureOffsetY = 4;
    else if (agent.facing === 'left') furnitureOffsetX = -4;
    else if (agent.facing === 'right') furnitureOffsetX = 4;
  }
  // stand / none: no offset — agent stands normally

  // Idle bobbing: subtle 1px sine bob when stationary and not at furniture
  const isIdle = !isWalking && !isAtFurniture;
  const bobOffset = isIdle ? Math.round(Math.sin(tick * 0.3) * 1) : 0;

  const drawX = cx - DW / 2 + furnitureOffsetX;
  const drawY = cy - DH + 16 + sittingOffset + bobOffset + furnitureOffsetY;

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

    // PNG sheet: 3 rows of 16×32 (confirmed from pixel-agents source)
    //   Row 0: walk DOWN (front face)
    //   Row 1: walk UP (back view)
    //   Row 2: walk RIGHT (side, mirror for left)
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      const f = agent.facing ?? 'down';
      frameRow = f === 'up' ? 1 : (f === 'left' || f === 'right') ? 2 : 0;
      mirror = f === 'left';
    } else if (Math.abs(dy) >= Math.abs(dx)) {
      frameRow = dy > 0 ? 0 : 1; // down=0, up=1
      frameCol = frame;
    } else {
      frameRow = 2; // right (mirror for left)
      mirror = dx < 0;
      frameCol = frame;
    }
  } else if (agent.state === 'typing' || agent.state === 'responding') {
    // Typing frames: columns 3-4, direction row based on facing
    const f = agent.facing ?? 'down';
    frameRow = f === 'up' ? 1 : (f === 'left' || f === 'right') ? 2 : 0;
    mirror = f === 'left';
    frameCol = 3 + (tick % 2);
  } else if (isAtFurniture) {
    // At furniture: use activity animation (typing frames) to look busy
    const f = agent.facing ?? 'down';
    frameRow = f === 'up' ? 1 : (f === 'left' || f === 'right') ? 2 : 0;
    mirror = f === 'left';
    // Alternate between typing frames at a slower pace (every other tick)
    frameCol = 3 + (Math.floor(tick / 2) % 2);
  } else {
    // Standing idle: use walk frame 1 (neutral standing pose)
    const f = agent.facing ?? 'down';
    frameRow = f === 'up' ? 1 : (f === 'left' || f === 'right') ? 2 : 0;
    mirror = f === 'left';
    frameCol = 1; // frame 1 = standing pose (not 0 which is mid-stride)
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

  // Name label with background pill for readability
  ctx.save();
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  const nameText = agent.id.slice(0, 6).toUpperCase();
  const nameX = cx;
  const nameY = drawY + DH + 12;
  const nameMetrics = ctx.measureText(nameText);
  const namePadX = 3;
  const namePillW = nameMetrics.width + namePadX * 2;
  const namePillH = 11;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(nameX - namePillW / 2, nameY - namePillH + 2, namePillW, namePillH, 3);
  ctx.fill();
  ctx.shadowColor = color;
  ctx.shadowBlur = theme === 'day' ? 1 : 4;
  ctx.fillStyle = hexToRgba(color, 0.95);
  ctx.fillText(nameText, nameX, nameY);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Working status label above agent head
  if (agent.state !== 'idle' && agent.state !== 'done') {
    const labelText = agent.state === 'thinking' ? 'analyzing...'
      : agent.state === 'tool_call' ? `using ${agent.lastTool || 'tool'}...`
      : agent.state === 'responding' ? 'writing...'
      : agent.state === 'typing' ? 'typing...'
      : agent.state === 'delegating' ? 'delegating...'
      : agent.state === 'task_started' ? 'starting...'
      : '';

    if (labelText) {
      ctx.save();
      ctx.font = '8px monospace';
      const labelX = drawX + DW / 2;
      const labelY = drawY - 14;

      // Background pill
      const metrics = ctx.measureText(labelText);
      const padX = 4, padY = 2;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      const pillW = metrics.width + padX * 2;
      const pillH = 12 + padY * 2;
      const pillX = labelX - pillW / 2;
      const pillY = labelY - pillH / 2;
      ctx.roundRect(pillX, pillY, pillW, pillH, 4);
      ctx.fill();

      // Text
      ctx.textAlign = 'center';
      ctx.fillStyle = hexToRgba(color, 0.95);
      ctx.fillText(labelText, labelX, labelY + 3);
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------------------
// drawStateIndicator — icon/animation above agent head per state
// Uses smooth renderX/renderY for sub-pixel positioning
// ---------------------------------------------------------------------------

export function drawStateIndicator(ctx: CanvasRenderingContext2D, agent: CanvasAgent, tick: number): void {
  const cx = agent.renderX;
  const cy = agent.renderY;
  // Position above sprite (2x scale: 16×32 sprite = 64px tall, feet at cy+16)
  const spriteTop = cy - 64 + 16; // = cy - 48
  const baseY = spriteTop - 6;
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
      // Pulsing "?" in agent color with glow
      const pulseAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 300);
      ctx.save();
      ctx.fillStyle = hexToRgba(agent.color, pulseAlpha);
      ctx.shadowColor = agent.color;
      ctx.shadowBlur = 6;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', cx, baseY + 4 + bobOffset);
      ctx.shadowBlur = 0;
      ctx.restore();
      break;
    }

    case 'typing':
    case 'responding': {
      // Animated dots "..." with cascading fade
      const dotCount = 1 + (Math.floor(Date.now() / 400) % 3);
      const dots = '.'.repeat(dotCount);
      ctx.save();
      ctx.fillStyle = hexToRgba(agent.color, 0.9);
      ctx.shadowColor = agent.color;
      ctx.shadowBlur = 4;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(dots, cx, baseY + 4);
      ctx.shadowBlur = 0;
      ctx.restore();
      break;
    }

    case 'tool_call': {
      // Wrench icon - pixel art style with glow
      ctx.save();
      ctx.fillStyle = '#F59E0B';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 4;
      // Wrench head
      ctx.fillRect(cx - 2, baseY - 1, 1, 1);
      ctx.fillRect(cx + 1, baseY - 1, 1, 1);
      ctx.fillRect(cx - 2, baseY, 4, 1);
      // Handle
      ctx.fillRect(cx, baseY + 1, 1, 3);
      ctx.fillRect(cx - 1, baseY + 3, 3, 1);
      ctx.shadowBlur = 0;
      ctx.restore();
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

export function drawAmbientEffects(ctx: CanvasRenderingContext2D, tick: number, agents?: CanvasAgent[], theme?: 'day' | 'night'): void {
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

  // Desk monitor glow — small colored rectangles at desk positions, glows in agent color
  // when the agent is nearby (at their desk)
  if (agents) {
    const deskAssignments: Array<{ x: number; y: number; agentId: string }> = [
      { x: 4, y: 14, agentId: 'weebo' },
      { x: 14, y: 14, agentId: 'edith' },
      { x: 7, y: 19, agentId: 'jarvis' },
      { x: 20, y: 13, agentId: 'aria' },
      { x: 2, y: 5, agentId: 'forge' },
      { x: 17, y: 13, agentId: 'pulse' },
      { x: 4, y: 3, agentId: 'echo' },
      { x: 24, y: 14, agentId: 'cal' },
      { x: 8, y: 3, agentId: 'nova' },
    ];

    for (const desk of deskAssignments) {
      const agent = agents.find(a => a.id === desk.agentId);
      if (!agent) continue;

      const dist = Math.abs(agent.x - desk.x) + Math.abs(agent.y - desk.y);
      const isNearDesk = dist <= 2;
      const color = agent.color;

      // Monitor rectangle (4x3px) at desk
      const monX = desk.x * CELL + CELL / 2 - 2;
      const monY = desk.y * CELL - 4;

      if (isNearDesk) {
        // Active glow — brighter at night, dimmer in day
        const nightBoost = theme === 'night' ? 1.3 : 0.7;
        const breath = (0.2 + 0.15 * Math.sin(Date.now() / 1000 + desk.x)) * nightBoost;
        ctx.save();
        ctx.fillStyle = hexToRgba(color, Math.min(breath, 1));
        ctx.shadowColor = color;
        ctx.shadowBlur = theme === 'night' ? 8 : 4;
        ctx.fillRect(monX, monY, 4, 3);
        ctx.shadowBlur = 0;
        ctx.restore();
      } else {
        // Dim standby glow — slightly brighter at night
        const standbyAlpha = theme === 'night' ? 0.08 : 0.03;
        ctx.fillStyle = hexToRgba(color, standbyAlpha);
        ctx.fillRect(monX, monY, 4, 3);
      }
    }
  }

  // Ambient floor grid pulse — very subtle breathing grid lines
  {
    const gridAlpha = 0.015 + 0.015 * Math.sin(Date.now() / 2000);
    ctx.strokeStyle = `rgba(0, 240, 255, ${gridAlpha})`;
    ctx.lineWidth = 0.5;
    // Only draw every 4th line for subtlety
    for (let c = 0; c <= COLS; c += 4) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, CANVAS_H);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r += 4) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(CANVAS_W, r * CELL);
      ctx.stroke();
    }
  }

  // Server rack blinking — blink dots when any agent is in tool_call state
  if (agents) {
    const anyToolCall = agents.some(a => a.state === 'tool_call');
    // Server rack area (upper-right blocked zone, approximate position)
    const rackX = 15 * CELL + 4;
    const rackY = 9 * CELL + 4;

    if (anyToolCall) {
      // Active blinking — green/amber dots cycling
      const phase = Math.floor(Date.now() / 200) % 4;
      for (let i = 0; i < 3; i++) {
        const dotColor = ((i + phase) % 2 === 0) ? '#ADFF2F' : '#F59E0B';
        const dotAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 150 + i);
        ctx.fillStyle = hexToRgba(dotColor, dotAlpha);
        ctx.fillRect(rackX, rackY + i * 6, 2, 2);
        ctx.fillRect(rackX + 4, rackY + i * 6 + 3, 2, 2);
      }
    } else {
      // Idle standby — dim green dots
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(173, 255, 47, 0.08)';
        ctx.fillRect(rackX, rackY + i * 6, 2, 2);
      }
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

export function renderFrame(ctx: CanvasRenderingContext2D, state: RenderState, showDebug?: boolean, collisionMap?: boolean[][], effectState?: CanvasEffectState, theme?: 'day' | 'night'): void {
  const { agents, beams, tick, selectedAgentId } = state;
  const activeTheme = theme ?? 'night';

  // 1. Background (pixel art image or solid fallback)
  drawBackground(ctx);

  // 2. Particle beams (behind agents)
  for (let i = 0; i < beams.length; i++) {
    drawParticleBeam(ctx, beams[i], agents);
  }

  // 3. Ambient effects (desk screen flickers, coffee steam, monitor glow, grid pulse, server rack)
  drawAmbientEffects(ctx, tick, agents, activeTheme);

  // 3b. Meeting room ambient glow when agents are collaborating
  {
    const meetingAgents = agents.filter(a =>
      a.x >= 16 && a.x <= 25 && a.y >= 12 && a.y <= 19 &&
      a.state !== 'idle' && a.state !== 'done'
    );
    if (meetingAgents.length > 0) {
      ctx.save();
      const gradient = ctx.createRadialGradient(
        21 * CELL, 16 * CELL, 0,
        21 * CELL, 16 * CELL, 5 * CELL,
      );
      const glowColor = meetingAgents.length >= 2 ? '0, 240, 255' : '139, 92, 246';
      gradient.addColorStop(0, `rgba(${glowColor}, 0.08)`);
      gradient.addColorStop(1, `rgba(${glowColor}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(16 * CELL, 12 * CELL, 10 * CELL, 8 * CELL);
      ctx.restore();
    }
  }

  // 4. Apply cinematic zoom transform if active (tier 3 effect)
  const hasZoom = effectState && effectState.zoomScale !== 1 && effectState.zoomTarget;
  if (hasZoom) {
    ctx.save();
    const cx = effectState.zoomTarget!.x;
    const cy = effectState.zoomTarget!.y;
    ctx.translate(cx, cy);
    ctx.scale(effectState.zoomScale, effectState.zoomScale);
    ctx.translate(-cx, -cy);
  }

  // 5. Agents sorted by renderY for depth — agents lower on screen draw on top
  const sortedAgents = [...agents].sort((a, b) => a.renderY - b.renderY);
  for (let i = 0; i < sortedAgents.length; i++) {
    const agent = sortedAgents[i];
    const isSelected = agent.id === selectedAgentId;

    // Dim non-spotlight agents when spotlight is active (tier 2/3 effect)
    if (effectState && effectState.spotlightAgent && agent.id !== effectState.spotlightAgent) {
      ctx.globalAlpha = effectState.dimOpacity;
    }

    drawAgent(ctx, agent, tick, isSelected, activeTheme);
    drawStateIndicator(ctx, agent, tick);

    // Restore full opacity after each agent
    ctx.globalAlpha = 1;
  }

  // 6. Restore zoom transform
  if (hasZoom) {
    ctx.restore();
  }

  // 7. Foreground layer disabled — was causing agent head/body clipping
  // when walking through desk areas. Re-enable once depth masking is refined.
  // if (isBgLoaded()) { drawForeground(ctx); }

  // 8. Draw ambient particles (from CanvasEffects) — dimmer in day mode
  if (effectState) {
    const particleAlphaMultiplier = activeTheme === 'day' ? 0.5 : 1.0;
    for (const p of effectState.particles) {
      ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha * particleAlphaMultiplier})`;
      ctx.fillRect(p.x, p.y, 1, 1);
    }
  }

  // 9. Theme-based overlay — replaces raw time-of-day overlay
  if (activeTheme === 'day') {
    // Warm overlay for day mode
    ctx.fillStyle = 'rgba(255, 248, 220, 0.08)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else {
    // Night mode: subtle blue tint overlay
    ctx.fillStyle = 'rgba(0, 10, 40, 0.15)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // 10. Debug overlay — collision grid visualization (only when enabled)
  if (showDebug && collisionMap) {
    drawDebugOverlay(ctx, collisionMap);
  }
}
