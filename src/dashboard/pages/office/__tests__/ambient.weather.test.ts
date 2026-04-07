/**
 * @fileoverview Unit tests for weather system — particle init and tick
 */

import { describe, expect, it } from "vitest";
import { initWeather, tickWeather } from "../systems/ambient/weather";

describe("weather — initWeather", () => {
	it("clear mode produces no particles", () => {
		const state = initWeather("clear");
		expect(state.mode).toBe("clear");
		expect(state.particles).toHaveLength(0);
		expect(state.intensity).toBe(0);
	});

	it("rain mode produces 200 particles", () => {
		const state = initWeather("rain");
		expect(state.mode).toBe("rain");
		expect(state.particles).toHaveLength(200);
		expect(state.intensity).toBe(1);
	});

	it("snow mode produces 100 particles", () => {
		const state = initWeather("snow");
		expect(state.mode).toBe("snow");
		expect(state.particles).toHaveLength(100);
		expect(state.intensity).toBe(1);
	});

	it("rain particles have positive vy (falling down)", () => {
		const state = initWeather("rain");
		for (const p of state.particles) {
			expect(p.vy).toBeGreaterThan(0);
		}
	});

	it("snow particles have positive vy (falling down)", () => {
		const state = initWeather("snow");
		for (const p of state.particles) {
			expect(p.vy).toBeGreaterThan(0);
		}
	});

	it("rain vy is in the correct range (~400px/sec → ~0.3-0.5 px/ms)", () => {
		const state = initWeather("rain");
		for (const p of state.particles) {
			expect(p.vy).toBeGreaterThanOrEqual(0.29);
			expect(p.vy).toBeLessThanOrEqual(0.51);
		}
	});

	it("snow vy is slower than rain", () => {
		const rain = initWeather("rain");
		const snow = initWeather("snow");
		const avgRainVy =
			rain.particles.reduce((s, p) => s + p.vy, 0) / rain.particles.length;
		const avgSnowVy =
			snow.particles.reduce((s, p) => s + p.vy, 0) / snow.particles.length;
		expect(avgSnowVy).toBeLessThan(avgRainVy);
	});

	it("particles have valid alpha values [0,1]", () => {
		for (const mode of ["rain", "snow"] as const) {
			const state = initWeather(mode);
			for (const p of state.particles) {
				expect(p.alpha).toBeGreaterThan(0);
				expect(p.alpha).toBeLessThanOrEqual(1);
			}
		}
	});
});

describe("weather — tickWeather", () => {
	it("clear mode is a no-op", () => {
		const state = initWeather("clear");
		const before = JSON.stringify(state);
		const after = tickWeather(state, 16);
		expect(JSON.stringify(after)).toBe(before);
	});

	it("rain particles move down after tick", () => {
		const state = initWeather("rain");
		const prevY = state.particles.map((p) => p.y);
		tickWeather(state, 16);
		const movedDown = state.particles.filter((p, i) => p.y > prevY[i]).length;
		// Most particles should have moved — some may have wrapped
		expect(movedDown).toBeGreaterThan(state.particles.length * 0.8);
	});

	it("snow particles move down after tick", () => {
		const state = initWeather("snow");
		const prevY = state.particles.map((p) => p.y);
		tickWeather(state, 16);
		const movedDown = state.particles.filter((p, i) => p.y > prevY[i]).length;
		expect(movedDown).toBeGreaterThan(state.particles.length * 0.8);
	});

	it("particle count stays constant after many ticks (wrap, not remove)", () => {
		const state = initWeather("rain");
		const initialCount = state.particles.length;
		for (let i = 0; i < 1000; i++) {
			tickWeather(state, 16);
		}
		expect(state.particles).toHaveLength(initialCount);
	});

	it("snow particle count stays constant after many ticks", () => {
		const state = initWeather("snow");
		const initialCount = state.particles.length;
		for (let i = 0; i < 1000; i++) {
			tickWeather(state, 16);
		}
		expect(state.particles).toHaveLength(initialCount);
	});

	it("returns the same state object (in-place mutation)", () => {
		const state = initWeather("rain");
		const returned = tickWeather(state, 16);
		expect(returned).toBe(state);
	});
});
