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

import type { CanvasAgent, ParticleBeam, SpeechBubble } from './types';
import {
  CELL, COLS, ROWS, CANVAS_W, CANVAS_H,
  C,
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
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

/**
 * Complete render state snapshot passed to the main render function.
 * @property agents - All agents on the canvas with positions and states
 * @property beams - Active particle beams connecting agents (communications)
 * @property tick - Current frame number for animation timing
 * @property selectedAgentId - Currently selected agent for highlighting, or null
 * @property showDebug - Whether to overlay grid + collision visualization
 * @property collisionMap - Optional parsed collision grid from image (auto-loaded if available)
 */
interface RenderState {
  agents: CanvasAgent[];
  beams: ParticleBeam[];
  canvasBubbles: SpeechBubble[];
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

// ---------------------------------------------------------------------------
// Trail particles — emitted when agents walk
// ---------------------------------------------------------------------------

interface TrailParticle {
  x: number;
  y: number;
  color: string;
  alpha: number;
  born: number;
}

const trailParticles: TrailParticle[] = [];
const TRAIL_TTL = 800;
const TRAIL_MAX = 120;
const TRAIL_EMIT_INTERVAL = 3; // emit every N ticks

/** Emit trail particles for walking agents */
export function emitTrailParticles(agents: CanvasAgent[], tick: number): void {
  if (tick % TRAIL_EMIT_INTERVAL !== 0) return;
  for (const a of agents) {
    if (!a.path || a.path.length === 0 || a.pathIndex >= a.path.length) continue;
    if (trailParticles.length >= TRAIL_MAX) break;
    // Emit 1-2 particles at agent feet position
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      trailParticles.push({
        x: a.renderX + (Math.random() - 0.5) * 8,
        y: a.renderY + 12 + Math.random() * 4,
        color: a.color,
        alpha: 0.25 + Math.random() * 0.1,
        born: Date.now(),
      });
    }
  }
}

/** Draw and cull trail particles */
function drawTrailParticles(ctx: CanvasRenderingContext2D): void {
  const now = Date.now();
  let writeIdx = 0;
  for (let i = 0; i < trailParticles.length; i++) {
    const p = trailParticles[i];
    const age = now - p.born;
    if (age >= TRAIL_TTL) continue;
    const t = age / TRAIL_TTL;
    const alpha = p.alpha * (1 - t);
    const size = 2 * (1 - t * 0.5);
    ctx.fillStyle = hexToRgba(p.color, alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
    trailParticles[writeIdx++] = p;
  }
  trailParticles.length = writeIdx;
}

// ---------------------------------------------------------------------------
// Ambient floating particles — background atmosphere
// ---------------------------------------------------------------------------

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  baseAlpha: number;
  phase: number;
}

let ambientParticles: AmbientParticle[] = [];
const AMBIENT_COLORS = ['#8B5CF6', '#A78BFA', '#F59E0B', '#10B981'];

/** Initialize ambient floating particles (call once) */
export function initAmbientParticles(count: number): void {
  ambientParticles = [];
  for (let i = 0; i < count; i++) {
    ambientParticles.push({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.2,
      color: AMBIENT_COLORS[i % AMBIENT_COLORS.length],
      baseAlpha: 0.03 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

/** Draw ambient floating particles with gentle drift */
function drawAmbientParticles(ctx: CanvasRenderingContext2D, tick: number, theme: 'day' | 'night'): void {
  const alphaMultiplier = theme === 'day' ? 0.5 : 1.0;
  for (const p of ambientParticles) {
    // Drift
    p.x += p.vx;
    p.y += p.vy;
    // Wrap around edges
    if (p.x < 0) p.x = CANVAS_W;
    if (p.x > CANVAS_W) p.x = 0;
    if (p.y < 0) p.y = CANVAS_H;
    if (p.y > CANVAS_H) p.y = 0;
    // Breathing alpha
    const alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(tick * 0.05 + p.phase)) * alphaMultiplier;
    const size = 2 + Math.sin(tick * 0.03 + p.phase) * 1;
    ctx.fillStyle = hexToRgba(p.color, alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Whether the pixel art background loaded successfully */
export function isBgLoaded(): boolean {
  return bgLoaded && !!bgImage && bgImage.complete && bgImage.naturalWidth > 0;
}

// ---------------------------------------------------------------------------
// drawBackground — pixel art image scaled to canvas (or solid fallback)
// ---------------------------------------------------------------------------

/**
 * Draws the pixel-art office background image scaled to fill the canvas.
 * Falls back to a solid dark fill while the image is loading or on error.
 * Disables image smoothing so pixel art renders crisply at integer scale.
 * @param ctx - The 2D rendering context of the office canvas.
 */
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

/**
 * Draws the pixel-art foreground layer on top of all agents, creating a depth
 * illusion (e.g. desks or walls occluding agents behind them).
 * No-ops silently if the foreground image has not loaded yet.
 * @param ctx - The 2D rendering context of the office canvas.
 */
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

/**
 * Draws a single agent's pixel-art sprite, name label, state indicator glow,
 * and selection ring at its smooth pixel position.
 *
 * Sprite selection logic (in priority order):
 * 1. PNG sprite sheet (3 rows × 5 cols: down/up/right × idle/walk×3/type×2)
 * 2. Pre-rendered HTMLCanvasElement sprites as fallback
 *
 * Pose offsets are applied when the agent is seated at or leaning against
 * furniture, making characters visually "use" the smart object.
 *
 * @param ctx - The 2D rendering context of the office canvas.
 * @param agent - The agent to render, including smooth renderX/renderY coords.
 * @param tick - Current frame counter used for walk animation cycling.
 * @param isSelected - Whether to draw the pulsing selection ring around this agent.
 * @param theme - `'day'` or `'night'`; affects name-label glow intensity.
 */
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
  const isAtFurniture = !isWalking && (behaviorMode === 'wandering' || behaviorMode === 'socializing' || behaviorMode === 'group-meeting' || behaviorMode === 'resting');
  const pose = isAtFurniture ? getAgentPose(agent.id) : 'none';

  // Pose-specific visual offsets:
  // sit  → deep sink into chair (8px down, 8px toward furniture)
  // lean → slight lean toward counter (3px down, 4px toward)
  // stand → no offset (standing at whiteboards/displays)
  let sittingOffset = 0;
  let furnitureOffsetX = 0, furnitureOffsetY = 0;

  if (pose === 'sit') {
    // Deeper sink into furniture: agent looks embedded in chair/seat
    sittingOffset = 12;
    // Shift agent toward the furniture they're facing for tighter visual fit
    const shiftAmount = 12;
    if (agent.facing === 'up') furnitureOffsetY = -shiftAmount;
    else if (agent.facing === 'down') furnitureOffsetY = shiftAmount;
    else if (agent.facing === 'left') furnitureOffsetX = -shiftAmount;
    else if (agent.facing === 'right') furnitureOffsetX = shiftAmount;
  } else if (pose === 'lean') {
    sittingOffset = 4;
    const leanShift = 6;
    if (agent.facing === 'up') furnitureOffsetY = -leanShift;
    else if (agent.facing === 'down') furnitureOffsetY = leanShift;
    else if (agent.facing === 'left') furnitureOffsetX = -leanShift;
    else if (agent.facing === 'right') furnitureOffsetX = leanShift;
  }
  // stand / none: no offset — agent stands normally

  // Idle bobbing: subtle 1px sine bob when stationary and not at furniture
  const isIdle = !isWalking && !isAtFurniture;
  const bobOffset = isIdle ? Math.round(Math.sin(tick * 0.3) * 1) : 0;

  // Bounce effect on task completion (damped sine, 500ms)
  let bounceOffset = 0;
  if (agent.fx?.bounceStart) {
    const elapsed = Date.now() - agent.fx.bounceStart;
    const duration = 500;
    if (elapsed < duration) {
      const t = elapsed / duration;
      bounceOffset = -Math.abs(Math.sin(t * Math.PI * 2.5)) * 6 * (1 - t);
    } else {
      agent.fx.bounceStart = undefined;
      agent.fx.bounceY = 0;
    }
  }

  const drawX = cx - DW / 2 + furnitureOffsetX;
  const drawY = cy - DH + 16 + sittingOffset + bobOffset + bounceOffset + furnitureOffsetY;

  // Radial glow halo — brighter for active agents, pulsing on delegation
  {
    const isActive = agent.state !== 'idle' && agent.state !== 'done';
    const pulseT = Math.sin(Date.now() / 1000 + cx * 0.01) * 0.5 + 0.5;
    let glowAlpha = isActive ? 0.18 + pulseT * 0.22 : 0.04;
    let glowRadius = isActive ? CELL * 3 : CELL * 1.5;

    // Delegation glow pulse: 3 bright pulses over 1.5s
    if (agent.fx?.glowStart) {
      const elapsed = Date.now() - agent.fx.glowStart;
      const duration = 1500;
      if (elapsed < duration) {
        const t = elapsed / duration;
        const pulse = Math.sin(t * Math.PI * 3) * (1 - t);
        glowAlpha += Math.max(0, pulse * 0.3);
        glowRadius = CELL * 4;
      } else {
        agent.fx.glowStart = undefined;
      }
    }

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    grad.addColorStop(0, hexToRgba(agent.color, glowAlpha));
    grad.addColorStop(0.6, hexToRgba(agent.color, glowAlpha * 0.3));
    grad.addColorStop(1, hexToRgba(agent.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Expanding ripple rings for active agents (thinking/tool_call/typing/responding)
    if (isActive && (agent.state === 'thinking' || agent.state === 'tool_call' || agent.state === 'typing' || agent.state === 'responding')) {
      const now = Date.now();
      const ringPeriod = 1500; // 1.5s per ring cycle
      for (let ringIdx = 0; ringIdx < 2; ringIdx++) {
        const ringPhase = ((now + ringIdx * 750) % ringPeriod) / ringPeriod; // stagger 2 rings
        const ringRadius = CELL + ringPhase * CELL * 2.5;
        const ringAlpha = (1 - ringPhase) * 0.25;
        ctx.strokeStyle = hexToRgba(agent.color, ringAlpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
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

/**
 * Draws a small icon or animation above an agent's head that reflects its current state:
 * thinking (spinning dots), tool_call (wrench), responding (pencil), delegating (arrow), etc.
 * Idles produce no indicator. The indicator bobs gently using tick-based offset.
 * @param ctx - The 2D rendering context of the office canvas.
 * @param agent - The agent whose state drives the indicator type and position.
 * @param tick - Current frame counter used for animation cycling and bobbing.
 */
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

/**
 * Draws an animated particle beam between two agents, visualizing inter-agent communication.
 * Particles are 2×2px colored rectangles that travel from the source to the target agent
 * along the straight line between their smooth pixel positions. No-ops if either agent
 * is not found in the agents array or if the beam has expired.
 * @param ctx - The 2D rendering context of the office canvas.
 * @param beam - The beam descriptor (source/target agent IDs, color, duration).
 * @param agents - All canvas agents, used to resolve agent positions by ID.
 */
/**
 * Draws an animated particle beam connecting two agents, representing communication/delegation.
 * The beam consists of 10 particles flowing from source to destination, with soft fading at edges.
 * Particles disappear when beam duration expires.
 * No-ops silently if source or destination agent not found on canvas.
 *
 * **Particle animation:**
 * - Flow direction: from source agent (fromAgentId) to destination (toAgentId)
 * - 10 particles evenly spaced, continuously flowing along the beam path
 * - Fade effect: edges of beam (start/end) fade to 0 alpha, center stays opaque
 * - Life cycle: beam fades over `duration` milliseconds, then no longer drawn
 *
 * @param ctx - The 2D rendering context of the office canvas
 * @param beam - ParticleBeam object with source, destination, color, creation time, and duration
 * @param agents - All agents on canvas (used to resolve fromAgentId and toAgentId to positions)
 *
 * @example
 * ```typescript
 * const beam: ParticleBeam = {
 *   id: 'beam-comm-1',
 *   fromAgentId: 'weebo',
 *   toAgentId: 'edith',
 *   color: '#A78BFA',
 *   createdAt: Date.now(),
 *   duration: 2000,  // Visible for 2 seconds
 * };
 * drawParticleBeam(ctx, beam, allAgents);
 * ```
 */
export function drawParticleBeam(ctx: CanvasRenderingContext2D, beam: ParticleBeam, agents: CanvasAgent[]): void {
  const from = agents.find(a => a.id === beam.fromAgentId);
  const to = agents.find(a => a.id === beam.toAgentId);
  if (!from || !to) return;

  const x1 = from.renderX;
  const y1 = from.renderY;
  const x2 = to.renderX;
  const y2 = to.renderY;

  const elapsed = Date.now() - beam.createdAt;
  const lifeProgress = Math.min(elapsed / beam.duration, 1);
  const fadeOut = lifeProgress > 0.7 ? 1 - (lifeProgress - 0.7) / 0.3 : 1;

  // Bezier control point: offset perpendicular to the line for organic curve
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const curveOffset = 30;
  const cpx = mx + (-dy / (Math.sqrt(dx * dx + dy * dy) || 1)) * curveOffset;
  const cpy = my + (dx / (Math.sqrt(dx * dx + dy * dy) || 1)) * curveOffset;

  // Draw glow line along bezier
  ctx.save();
  ctx.shadowColor = beam.color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = hexToRgba(beam.color, 0.2 * fadeOut);
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Animated particles along the bezier curve
  const numParticles = 18;
  const flowSpeed = Date.now() / 600;
  for (let i = 0; i < numParticles; i++) {
    const t = ((i / numParticles) + flowSpeed) % 1;
    // Quadratic bezier point
    const u = 1 - t;
    const px = u * u * x1 + 2 * u * t * cpx + t * t * x2;
    const py = u * u * y1 + 2 * u * t * cpy + t * t * y2;
    const edgeFade = Math.min(t, 1 - t) * 4;
    const alpha = Math.min(edgeFade, 0.85) * fadeOut;
    const size = 2 + edgeFade * 1;
    ctx.fillStyle = hexToRgba(beam.color, alpha);
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Energy orb — bright glowing sphere traveling along the beam (one per beam)
  const orbT = (Date.now() % 800) / 800; // 800ms cycle
  const orbU = 1 - orbT;
  const orbX = orbU * orbU * x1 + 2 * orbU * orbT * cpx + orbT * orbT * x2;
  const orbY = orbU * orbU * y1 + 2 * orbU * orbT * cpy + orbT * orbT * y2;
  const orbAlpha = Math.min(orbT, 1 - orbT) * 4 * fadeOut;
  ctx.save();
  ctx.shadowColor = beam.color;
  ctx.shadowBlur = 12;
  const orbGrad = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 5);
  orbGrad.addColorStop(0, hexToRgba(beam.color, Math.min(orbAlpha, 0.9)));
  orbGrad.addColorStop(0.5, hexToRgba(beam.color, Math.min(orbAlpha * 0.5, 0.4)));
  orbGrad.addColorStop(1, hexToRgba(beam.color, 0));
  ctx.fillStyle = orbGrad;
  ctx.beginPath();
  ctx.arc(orbX, orbY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// drawTimeOfDayOverlay — tints the canvas based on time of day
// ---------------------------------------------------------------------------

/**
 * Applies a semi-transparent color tint over the canvas to simulate time of day:
 * - 06:00–08:00 → warm orange sunrise tint
 * - 08:00–17:00 → no tint (bright daylight)
 * - 17:00–19:00 → warm amber sunset tint
 * - 19:00–06:00 → deep blue/indigo night tint
 * @param ctx - The 2D rendering context of the office canvas.
 */
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

/**
 * Draws ambient environmental details that bring the office to life:
 * desk screen flickers, coffee steam particles, desk monitor glows, foliage sway,
 * and window light reflections. These effects run independently of agent state.
 *
 * **Ambient effects breakdown:**
 * - **Screen flickers:** Random desk monitor pulse every ~120 ticks (2 frames each)
 * - **Coffee steam:** Tiny smoke particles rising from coffee machine (constant)
 * - **Desk monitor glows:** Colored rectangles at each desk, glow in agent color when agent nearby
 * - **Foliage sway:** Potted plants on windowsill bob gently (sine wave motion)
 * - **Window reflections:** Moving light patterns across window panes (night only)
 *
 * @param ctx - The 2D rendering context of the office canvas
 * @param tick - Current frame counter (used for timing and cycling animations)
 * @param agents - Optional array of agents (used to color desk glows based on nearby agent)
 * @param theme - `'day'` or `'night'`; affects glow intensity and window reflections
 *
 * **Call order:** After background, before agents (so effects appear behind sprites)
 *
 * @example
 * ```typescript
 * // In render loop:
 * drawBackground(ctx);
 * drawAmbientEffects(ctx, frameCount, agents, 'night');
 * drawAgents(ctx);
 * ```
 */
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
    ctx.strokeStyle = `rgba(139, 92, 246, ${gridAlpha})`;
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

/**
 * Overlays developer debug visualization showing:
 * - Collision map (blocked tiles in red, walkable in green)
 * - Grid lines (every tile boundary)
 * - Tile coordinates for walkable tiles (for manual position verification)
 * - Room zone boundaries (colored rectangles)
 * - Smart object interaction points (dots with direction arrows)
 *
 * **Visual legend:**
 * - Red tiles (alpha 0.15) — Blocked by collision map
 * - Green tiles (alpha 0.1) — Walkable tiles
 * - Room zones — Semi-transparent colored overlays
 * - Yellow dots — Reserved interaction points
 * - Blue dots — Available interaction points
 * - White arrows — Facing direction for each interaction point
 *
 * **Performance note:** This overlay has minimal performance impact (simple fills + text)
 * but should only be enabled during development. **Call only when `showDebug = true`.**
 *
 * @param ctx - The 2D rendering context of the office canvas
 * @param collisionMap - 2D boolean grid (true = blocked, false = walkable)
 *
 * @example
 * ```typescript
 * if (showDebugMode) {
 *   drawDebugOverlay(ctx, collisionGrid);
 * }
 * ```
 */
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
// Environmental storytelling overlays — dynamic mini-icons on objects
// ---------------------------------------------------------------------------

const ALL_DESK_POSITIONS: Record<string, { x: number; y: number }> = {
  ...CORE_DESK_POSITIONS,
  ...SPECIALIST_POSITIONS,
};

/** Draw tiny document icons near desks of working agents */
function drawDeskDocuments(ctx: CanvasRenderingContext2D, agents: CanvasAgent[], tick: number): void {
  for (const agent of agents) {
    if (agent.state === 'idle' || agent.state === 'done') continue;
    const desk = ALL_DESK_POSITIONS[agent.id];
    if (!desk) continue;
    // Only show when agent is near their desk
    if (Math.abs(agent.x - desk.x) > 2 || Math.abs(agent.y - desk.y) > 2) continue;

    const baseX = desk.x * CELL + CELL + 4;
    const baseY = desk.y * CELL - 6;
    const bob1 = Math.sin(tick * 0.08) * 0.5;
    const bob2 = Math.cos(tick * 0.08) * 0.5;

    // Doc icon 1 — small rectangle with "text lines"
    ctx.fillStyle = hexToRgba(agent.color, 0.25);
    ctx.fillRect(baseX, baseY + bob1, 4, 5);
    ctx.fillStyle = hexToRgba(agent.color, 0.12);
    ctx.fillRect(baseX + 1, baseY + 1 + bob1, 2, 1);
    ctx.fillRect(baseX + 1, baseY + 3 + bob1, 2, 1);

    // Doc icon 2 — slightly offset
    ctx.fillStyle = hexToRgba(agent.color, 0.2);
    ctx.fillRect(baseX + 7, baseY + 2 + bob2, 4, 5);
    ctx.fillStyle = hexToRgba(agent.color, 0.1);
    ctx.fillRect(baseX + 8, baseY + 3 + bob2, 2, 1);
    ctx.fillRect(baseX + 8, baseY + 5 + bob2, 2, 1);
  }
}

/** Draw animated squiggle lines on the whiteboard when agents are meeting */
function drawWhiteboardScribbles(ctx: CanvasRenderingContext2D, agents: CanvasAgent[], tick: number): void {
  const meetingAgents = agents.filter(a =>
    a.x >= 16 && a.x <= 25 && a.y >= 12 && a.y <= 19 &&
    !a.isDormant,
  );
  if (meetingAgents.length < 2) return;

  const wbX = 19 * CELL;
  const wbY = 13 * CELL;
  ctx.save();
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.12)';
  ctx.lineWidth = 1;

  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const y = wbY + 6 + i * 7;
    ctx.moveTo(wbX + 2, y);
    for (let x = 0; x < 24; x += 4) {
      ctx.lineTo(wbX + 2 + x, y + Math.sin((tick + x + i * 12) * 0.15) * 2);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw all environmental overlays */
function drawEnvironmentalOverlays(ctx: CanvasRenderingContext2D, agents: CanvasAgent[], tick: number): void {
  drawDeskDocuments(ctx, agents, tick);
  drawWhiteboardScribbles(ctx, agents, tick);
}

// ---------------------------------------------------------------------------
// renderFrame — main entry, called every render tick
// Optional showDebug parameter draws the collision grid overlay.
// ---------------------------------------------------------------------------

/**
 * Main render entry point — composites a complete office frame in draw order:
 * 1. Background pixel-art image (or solid fallback)
 * 2. Particle beams between agents
 * 3. Ambient effects (screen flickers, steam, LED indicators)
 * 4. Meeting-room collaboration glow
 * 5. Each agent sprite + state indicator + speech bubble (sorted by Y for depth)
 * 6. Foreground pixel-art layer (occludes agents behind desks/walls)
 * 7. Time-of-day tint overlay
 * 8. Zoom/spotlight cinematic effects (CanvasEffectState)
 * 9. Debug overlay (optional, dev-only)
 *
 * Called every ~33ms (~30 fps) by the OfficeStage tick loop.
 *
 * @param ctx - The 2D rendering context of the office canvas.
 * @param state - Snapshot of all agents, beams, tick counter, and selection state.
 * @param showDebug - When true, renders the collision/zone debug overlay.
 * @param collisionMap - Collision grid passed through to `drawDebugOverlay`.
 * @param effectState - Zoom and spotlight state from `CanvasEffects`; skipped if omitted.
 * @param theme - `'day'` or `'night'`; affects ambient and agent glow intensity.
 */

// ---------------------------------------------------------------------------
// drawSpeechBubble — canvas-rendered speech bubble with word-wrap
// ---------------------------------------------------------------------------

const BUBBLE_MAX_W = 140;
const BUBBLE_FONT = '9px monospace';
const BUBBLE_LINE_H = 12;
const BUBBLE_PAD_X = 6;
const BUBBLE_PAD_Y = 4;
const BUBBLE_REVEAL_MS = 500;

/**
 * Draw a speech bubble on the canvas above an agent.
 * Supports typewriter reveal animation for non-interactive bubbles.
 */
export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  bubble: SpeechBubble,
  agent: CanvasAgent,
  now: number,
): void {
  const elapsed = now - bubble.createdAt;
  const remaining = bubble.expiresAt - now;
  if (remaining <= 0) return;

  // Fade-in (150ms) and fade-out (300ms)
  let alpha = 1;
  if (elapsed < 150) alpha = elapsed / 150;
  if (remaining < 300) alpha = Math.min(alpha, remaining / 300);

  const cx = agent.renderX;
  const spriteTop = agent.renderY - 64 + 16;
  const baseY = spriteTop - 10;

  ctx.save();
  ctx.font = BUBBLE_FONT;
  const textMaxW = BUBBLE_MAX_W - BUBBLE_PAD_X * 2 - 16; // 16px for dot + spacing

  // Word-wrap using canvas measureText
  const words = bubble.text.split(/(\s+)/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > textMaxW && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word.trimStart();
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Typewriter: limit visible characters
  let visibleLines = lines;
  if (bubble.typewriter && elapsed < BUBBLE_REVEAL_MS) {
    const totalChars = lines.reduce((sum, l) => sum + l.length, 0);
    const revealCount = Math.floor(totalChars * (elapsed / BUBBLE_REVEAL_MS));
    let charsSoFar = 0;
    visibleLines = [];
    for (const line of lines) {
      if (charsSoFar >= revealCount) break;
      if (charsSoFar + line.length <= revealCount) {
        visibleLines.push(line);
        charsSoFar += line.length;
      } else {
        visibleLines.push(line.slice(0, revealCount - charsSoFar));
        charsSoFar = revealCount;
      }
    }
  }

  const lineCount = visibleLines.length || 1;
  const bubbleW = BUBBLE_MAX_W;
  const bubbleH = lineCount * BUBBLE_LINE_H + BUBBLE_PAD_Y * 2;
  const bubbleX = cx - bubbleW / 2;
  const bubbleY = baseY - bubbleH;

  ctx.globalAlpha = alpha;

  // Background pill
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 5);
  ctx.fill();

  // Border glow
  ctx.strokeStyle = hexToRgba(bubble.color, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 5);
  ctx.stroke();

  // Agent color dot
  ctx.fillStyle = bubble.color;
  ctx.beginPath();
  ctx.arc(bubbleX + 8, bubbleY + BUBBLE_PAD_Y + 5, 3, 0, Math.PI * 2);
  ctx.fill();

  // Text lines
  ctx.fillStyle = '#F4F6FF';
  ctx.textAlign = 'left';
  const textStartX = bubbleX + 16;
  for (let i = 0; i < visibleLines.length; i++) {
    ctx.fillText(visibleLines[i], textStartX, bubbleY + BUBBLE_PAD_Y + (i + 1) * BUBBLE_LINE_H - 2);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

export function renderFrame(ctx: CanvasRenderingContext2D, state: RenderState, showDebug?: boolean, collisionMap?: boolean[][], effectState?: CanvasEffectState, theme?: 'day' | 'night'): void {
  const { agents, beams, canvasBubbles, tick, selectedAgentId } = state;
  const activeTheme = theme ?? 'night';

  // 1. Background (pixel art image or solid fallback)
  drawBackground(ctx);

  // 2. Ambient floating particles (behind everything else)
  drawAmbientParticles(ctx, tick, activeTheme);

  // 2b. Trail particles from walking agents
  drawTrailParticles(ctx);

  // 2c. Particle beams (behind agents)
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
    // Also count agents physically present in meeting area (group-meeting behavior)
    const gatheringAgents = agents.filter(a =>
      a.x >= 16 && a.x <= 25 && a.y >= 12 && a.y <= 19
    );
    const meetingCount = Math.max(meetingAgents.length, gatheringAgents.length);
    if (meetingCount > 0) {
      ctx.save();
      const gradient = ctx.createRadialGradient(
        21 * CELL, 16 * CELL, 0,
        21 * CELL, 16 * CELL, 5 * CELL,
      );
      const glowColor = meetingCount >= 2 ? '0, 240, 255' : '139, 92, 246';
      // Stronger glow with more agents (0.08 base → up to 0.25 with 4+ agents)
      const glowIntensity = Math.min(0.08 + meetingCount * 0.04, 0.25);
      gradient.addColorStop(0, `rgba(${glowColor}, ${glowIntensity})`);
      gradient.addColorStop(1, `rgba(${glowColor}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(16 * CELL, 12 * CELL, 10 * CELL, 8 * CELL);

      // Pulsing energy ring around meeting table when 3+ agents gathered
      if (meetingCount >= 3) {
        const ringPhase = (Date.now() % 2000) / 2000;
        const ringRadius = 3 * CELL + ringPhase * 2 * CELL;
        const ringAlpha = (1 - ringPhase) * 0.15;
        ctx.strokeStyle = `rgba(${glowColor}, ${ringAlpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(21 * CELL, 16 * CELL, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
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

  // 6b. Canvas speech bubbles (above agents, below foreground)
  if (canvasBubbles.length > 0) {
    const now = Date.now();
    for (const bubble of canvasBubbles) {
      const agent = agents.find(a => a.id === bubble.agentId);
      if (agent) drawSpeechBubble(ctx, bubble, agent, now);
    }
  }

  // 7. Foreground layer disabled — was causing agent head/body clipping
  // when walking through desk areas. Re-enable once depth masking is refined.
  // if (isBgLoaded()) { drawForeground(ctx); }

  // 7b. Environmental storytelling overlays (desk docs, whiteboard scribbles)
  drawEnvironmentalOverlays(ctx, agents, tick);

  // 8. Draw ambient particles (from CanvasEffects) — dimmer in day mode
  if (effectState) {
    const particleAlphaMultiplier = activeTheme === 'day' ? 0.5 : 1.0;
    for (const p of effectState.particles) {
      ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha * particleAlphaMultiplier})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 9. Theme-based overlay — replaces raw time-of-day overlay
  if (activeTheme === 'day') {
    // Warm overlay for day mode
    ctx.fillStyle = 'rgba(255, 248, 220, 0.08)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else {
    // Night mode: deeper blue tint for immersive nighttime feel
    ctx.fillStyle = 'rgba(8, 8, 40, 0.35)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Warm window glow rectangles to simulate interior lights at night
    ctx.fillStyle = 'rgba(255, 200, 100, 0.03)';
    // Workspace area window glow
    ctx.fillRect(1 * CELL, 14 * CELL, 6 * CELL, 3 * CELL);
    // Meeting room window glow
    ctx.fillRect(17 * CELL, 13 * CELL, 8 * CELL, 4 * CELL);
  }

  // 10. Debug overlay — collision grid visualization (only when enabled)
  if (showDebug && collisionMap) {
    drawDebugOverlay(ctx, collisionMap);
  }
}
