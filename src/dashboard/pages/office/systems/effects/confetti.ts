/**
 * confetti.ts — Celebration confetti particle system for the office canvas.
 * Triggered by goal completion events.
 */
const CONFETTI_COLORS = [
  '#8B5CF6','#A78BFA','#EC4899','#F59E0B','#10B981',
  '#3B82F6','#F97316','#EF4444','#06B6D4','#84CC16','#FFFFFF',
];
const BROKEN_COLORS = ['#6B7280','#9CA3AF','#D1D5DB','#374151','#4B5563'];
const CONFETTI_DURATION_MS = 4000;
const CONFETTI_COUNT = 160;

export interface ConfettiParticle {
  x: number; y: number; vx: number; vy: number;
  rotation: number; rotationSpeed: number;
  width: number; height: number;
  color: string; alpha: number; phase: number;
}

export interface ConfettiState {
  particles: ConfettiParticle[];
  active: boolean;
  elapsed: number;
  mode: 'celebration' | 'broken';
}

export function createConfettiState(): ConfettiState {
  return { particles: [], active: false, elapsed: 0, mode: 'celebration' };
}

export function triggerConfetti(state: ConfettiState, canvasW = 864, mode: 'celebration' | 'broken' = 'celebration'): void {
  const pal = mode === 'broken' ? BROKEN_COLORS : CONFETTI_COLORS;
  state.particles = Array.from({ length: CONFETTI_COUNT }, () => {
    const w = 6 + Math.random() * 10, h = 4 + Math.random() * 6;
    return {
      x: Math.random() * canvasW, y: -20 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 180, vy: 60 + Math.random() * 120,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 8,
      width: w, height: h, color: pal[Math.floor(Math.random() * pal.length)],
      alpha: 0.9 + Math.random() * 0.1, phase: Math.random() * Math.PI * 2,
    };
  });
  state.active = true; state.elapsed = 0; state.mode = mode;
}

export function tickConfetti(state: ConfettiState, dt: number, canvasW = 864, canvasH = 800): void {
  if (!state.active) return;
  const dtS = dt / 1000;
  state.elapsed += dt;
  const progress = state.elapsed / CONFETTI_DURATION_MS;
  const wind = Math.sin(state.elapsed * 0.0015) * 60;
  for (const p of state.particles) {
    p.x += (p.vx + wind) * dtS; p.y += p.vy * dtS;
    p.vy += 80 * dtS;
    p.x += Math.sin(state.elapsed * 0.003 + p.phase) * 15 * dtS;
    p.rotation += p.rotationSpeed * dtS; p.vx *= 1 - 0.5 * dtS;
    if (progress > 0.6) p.alpha = Math.max(0, 0.9 * (1 - (progress - 0.6) / 0.4));
  }
  state.particles = state.particles.filter((p) => p.y < canvasH + 40 && p.x > -canvasW && p.x < canvasW * 2);
  if (state.elapsed >= CONFETTI_DURATION_MS || state.particles.length === 0) {
    state.active = false; state.particles = [];
  }
}

export function drawConfetti(ctx: CanvasRenderingContext2D, state: ConfettiState): void {
  if (!state.active || state.particles.length === 0) return;
  ctx.save();
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    ctx.restore();
  }
  ctx.restore();
}
