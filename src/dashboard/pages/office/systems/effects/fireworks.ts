/**
 * fireworks.ts — Streak-milestone fireworks effect for the office canvas.
 */
const FIREWORKS_COLORS = ['#8B5CF6','#A78BFA','#EC4899','#F59E0B','#FFFFFF','#3B82F6','#10B981','#EF4444'];
const ROCKET_COUNT = 4, ROCKET_DELAY_MS = 400, BURST_PARTICLE_COUNT = 60;
const ROCKET_SPEED = -340, SPARK_SPEED_BASE = 120, TRAIL_LENGTH = 8;

interface TrailPoint { x: number; y: number; alpha: number; }
interface Rocket { x: number; y: number; vy: number; color: string; trail: TrailPoint[]; exploded: boolean; explodeY: number; }
interface Spark { x: number; y: number; vx: number; vy: number; color: string; alpha: number; gravityFactor: number; }

export interface FireworksState {
  rockets: Rocket[]; sparks: Spark[];
  active: boolean;
  pendingRockets: Array<{ delayMs: number; x: number }>;
  elapsed: number;
}

export function createFireworksState(): FireworksState {
  return { rockets: [], sparks: [], active: false, pendingRockets: [], elapsed: 0 };
}

function _launch(x: number, canvasH: number): Rocket {
  return { x, y: canvasH - 20, vy: ROCKET_SPEED * (0.85 + Math.random() * 0.3),
    color: FIREWORKS_COLORS[Math.floor(Math.random() * FIREWORKS_COLORS.length)],
    trail: [], exploded: false, explodeY: canvasH * 0.1 + Math.random() * canvasH * 0.25 };
}

function _launchPending(s: FireworksState, canvasH: number): void {
  for (const r of s.pendingRockets.filter((r) => r.delayMs <= 0)) s.rockets.push(_launch(r.x, canvasH));
  s.pendingRockets = s.pendingRockets.filter((r) => r.delayMs > 0);
}

function _explode(rocket: Rocket, sparks: Spark[]): void {
  for (let i = 0; i < BURST_PARTICLE_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / BURST_PARTICLE_COUNT + Math.random() * 0.3;
    const speed = SPARK_SPEED_BASE * (0.5 + Math.random());
    const color = Math.random() < 0.6 ? rocket.color : FIREWORKS_COLORS[Math.floor(Math.random() * FIREWORKS_COLORS.length)];
    sparks.push({ x: rocket.x, y: rocket.y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, color, alpha: 0.95, gravityFactor: 0.5 + Math.random() });
  }
}

export function triggerFireworks(state: FireworksState, canvasW = 864, canvasH = 800): void {
  state.active = true; state.elapsed = 0; state.sparks = []; state.rockets = [];
  state.pendingRockets = Array.from({ length: ROCKET_COUNT }, (_, i) => ({
    delayMs: i * ROCKET_DELAY_MS,
    x: canvasW * 0.2 + (canvasW * 0.6 * i) / Math.max(1, ROCKET_COUNT - 1),
  }));
  _launchPending(state, canvasH);
}

export function tickFireworks(state: FireworksState, dt: number, canvasH = 800): void {
  if (!state.active) return;
  const dtS = dt / 1000;
  state.elapsed += dt;
  for (const r of state.pendingRockets) r.delayMs -= dt;
  _launchPending(state, canvasH);
  for (const rocket of state.rockets) {
    if (rocket.exploded) continue;
    rocket.trail.push({ x: rocket.x, y: rocket.y, alpha: 0.6 });
    if (rocket.trail.length > TRAIL_LENGTH) rocket.trail.shift();
    for (const t of rocket.trail) t.alpha *= 0.85;
    rocket.y += rocket.vy * dtS; rocket.vy += 20 * dtS;
    if (rocket.y <= rocket.explodeY) { rocket.exploded = true; _explode(rocket, state.sparks); }
  }
  for (const spark of state.sparks) {
    spark.x += spark.vx * dtS; spark.y += spark.vy * dtS;
    spark.vy += 200 * spark.gravityFactor * dtS; spark.vx *= 1 - 0.4 * dtS;
    spark.alpha *= 1 - 0.6 * dtS;
  }
  state.sparks = state.sparks.filter((s) => s.alpha > 0.02);
  if (state.rockets.length > 0 && state.rockets.every((r) => r.exploded) && state.pendingRockets.length === 0 && state.sparks.length === 0) {
    state.active = false; state.rockets = []; state.sparks = [];
  }
}

export function drawFireworks(ctx: CanvasRenderingContext2D, state: FireworksState): void {
  if (!state.active) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const rocket of state.rockets) {
    if (rocket.exploded) continue;
    for (let i = 0; i < rocket.trail.length; i++) {
      const t = rocket.trail[i]; const radius = 2 + (i / rocket.trail.length) * 3;
      ctx.globalAlpha = t.alpha * (i / rocket.trail.length); ctx.fillStyle = rocket.color;
      ctx.beginPath(); ctx.arc(t.x, t.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.9; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(rocket.x, rocket.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const spark of state.sparks) {
    ctx.globalAlpha = spark.alpha; ctx.fillStyle = spark.color;
    ctx.beginPath(); ctx.arc(spark.x, spark.y, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
