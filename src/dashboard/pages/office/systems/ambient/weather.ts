/**
 * weather.ts
 * Particle-based weather overlay for the office canvas.
 *
 * Modes: 'clear' | 'rain' | 'snow'
 * User-controlled via localStorage key `office_weather`.
 * No external API; purely decorative.
 *
 * Rain:  200 vertical blue lines falling at ~400px/sec with slight wind angle.
 * Snow:  100 white dots falling at ~60px/sec with sine-wave lateral drift.
 * Clear: no particles.
 */

export type WeatherMode = "clear" | "rain" | "snow";

export interface WeatherParticle {
	x: number;
	y: number;
	/** Horizontal velocity (px/ms) */
	vx: number;
	/** Vertical velocity (px/ms) */
	vy: number;
	/** 0-1, used for snow drift phase */
	phase: number;
	/** Particle length in px (rain) or radius in px (snow) */
	size: number;
	/** Opacity 0-1 */
	alpha: number;
}

export interface WeatherState {
	mode: WeatherMode;
	intensity: number;
	particles: WeatherParticle[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomBetween(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

function makeRainParticle(canvasW: number, canvasH: number): WeatherParticle {
	return {
		x: randomBetween(0, canvasW),
		y: randomBetween(-canvasH, 0), // start above canvas
		vx: randomBetween(0.05, 0.12), // gentle right-wind (px/ms)
		vy: randomBetween(0.3, 0.5), // ~400px/sec at 60fps → ~6.6px/frame → /16ms ≈ 0.4
		phase: 0,
		size: randomBetween(8, 18),
		alpha: randomBetween(0.25, 0.55),
	};
}

function makeSnowParticle(canvasW: number, canvasH: number): WeatherParticle {
	return {
		x: randomBetween(0, canvasW),
		y: randomBetween(-canvasH, 0),
		vx: 0,
		vy: randomBetween(0.04, 0.08), // ~60px/sec
		phase: randomBetween(0, Math.PI * 2),
		size: randomBetween(1.5, 3.5),
		alpha: randomBetween(0.4, 0.85),
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const CANVAS_W_DEFAULT = 864;
const CANVAS_H_DEFAULT = 800;

const RAIN_COUNT = 200;
const SNOW_COUNT = 100;

/**
 * Create initial WeatherState for the given mode.
 */
export function initWeather(mode: WeatherMode): WeatherState {
	const particles: WeatherParticle[] = [];

	if (mode === "rain") {
		for (let i = 0; i < RAIN_COUNT; i++) {
			particles.push(makeRainParticle(CANVAS_W_DEFAULT, CANVAS_H_DEFAULT));
		}
	} else if (mode === "snow") {
		for (let i = 0; i < SNOW_COUNT; i++) {
			particles.push(makeSnowParticle(CANVAS_W_DEFAULT, CANVAS_H_DEFAULT));
		}
	}

	return { mode, intensity: mode === "clear" ? 0 : 1, particles };
}

/**
 * Advance weather simulation by `dtMs` milliseconds.
 * Returns the mutated state (in-place update for performance).
 */
export function tickWeather(state: WeatherState, dtMs: number): WeatherState {
	if (state.mode === "clear") return state;

	const w = CANVAS_W_DEFAULT;
	const h = CANVAS_H_DEFAULT;

	for (const p of state.particles) {
		if (state.mode === "rain") {
			p.x += p.vx * dtMs;
			p.y += p.vy * dtMs;
			// Wrap around
			if (p.y > h) {
				const fresh = makeRainParticle(w, h);
				p.x = fresh.x;
				p.y = fresh.y;
				p.vx = fresh.vx;
				p.vy = fresh.vy;
				p.size = fresh.size;
				p.alpha = fresh.alpha;
			}
			if (p.x > w + 20) p.x -= w + 40;
		} else if (state.mode === "snow") {
			p.phase += dtMs * 0.001; // drift frequency
			p.x += Math.sin(p.phase) * 0.4; // sine drift ±0.4px/tick
			p.y += p.vy * dtMs;
			// Wrap around
			if (p.y > h) {
				const fresh = makeSnowParticle(w, h);
				p.x = fresh.x;
				p.y = fresh.y;
				p.vy = fresh.vy;
				p.phase = fresh.phase;
				p.size = fresh.size;
				p.alpha = fresh.alpha;
			}
		}
	}

	return state;
}

/**
 * Render all weather particles onto the canvas.
 */
export function drawWeather(
	ctx: CanvasRenderingContext2D,
	state: WeatherState,
	_w: number,
	_h: number,
): void {
	if (state.mode === "clear" || state.particles.length === 0) return;

	ctx.save();

	if (state.mode === "rain") {
		ctx.strokeStyle = "rgba(174,214,241,0.55)";
		ctx.lineWidth = 1;
		for (const p of state.particles) {
			ctx.globalAlpha = p.alpha;
			ctx.beginPath();
			ctx.moveTo(p.x, p.y);
			// Line drawn at slight wind angle (vx/vy ratio)
			ctx.lineTo(p.x + p.vx * p.size, p.y + p.vy * p.size);
			ctx.stroke();
		}
	} else if (state.mode === "snow") {
		ctx.fillStyle = "rgba(255,255,255,0.9)";
		for (const p of state.particles) {
			ctx.globalAlpha = p.alpha;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	ctx.globalAlpha = 1;
	ctx.restore();
}
