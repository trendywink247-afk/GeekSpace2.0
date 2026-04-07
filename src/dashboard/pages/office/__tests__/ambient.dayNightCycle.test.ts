/**
 * @fileoverview Unit tests for dayNightCycle — boundary conditions
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { PeriodName } from "../systems/ambient/dayNightCycle";
import {
	getCurrentLighting,
	getLightingForHour,
} from "../systems/ambient/dayNightCycle";

describe("dayNightCycle — getLightingForHour", () => {
	// ── Period mapping ───────────────────────────────────────────────────────
	const cases: Array<[number, PeriodName]> = [
		[0, "deepNight"],
		[1, "deepNight"],
		[3, "deepNight"],
		[3.9, "deepNight"],
		[4, "night"], // gap hour — 04:00–05:00
		[5, "dawn"],
		[6, "dawn"],
		[6.9, "dawn"],
		[7, "morning"],
		[9, "morning"],
		[9.9, "morning"],
		[10, "midday"],
		[12, "midday"],
		[14, "midday"],
		[14.9, "midday"],
		[15, "afternoon"],
		[17, "afternoon"],
		[17.9, "afternoon"],
		[18, "dusk"],
		[19, "dusk"],
		[19.9, "dusk"],
		[20, "evening"],
		[21, "evening"],
		[21.9, "evening"],
		[22, "night"],
		[23, "night"],
	];

	it.each(cases)("hour %d → %s", (hour, expectedPeriod) => {
		const state = getLightingForHour(hour);
		expect(state.periodName).toBe(expectedPeriod);
		expect(state.hour).toBe(Math.floor(hour) % 24);
	});

	// ── Midday has zero tint ─────────────────────────────────────────────────
	it("midday tintAlpha is exactly 0", () => {
		const state = getLightingForHour(12);
		expect(state.tintAlpha).toBe(0);
	});

	// ── DeepNight has the highest tint ──────────────────────────────────────
	it("deepNight tintAlpha is highest", () => {
		const deepNight = getLightingForHour(2);
		const night = getLightingForHour(22);
		expect(deepNight.tintAlpha).toBeGreaterThan(night.tintAlpha);
	});

	// ── tintAlpha always in [0, 1] ───────────────────────────────────────────
	for (let h = 0; h < 24; h++) {
		it(`tintAlpha for hour ${h} is between 0 and 1`, () => {
			const { tintAlpha } = getLightingForHour(h);
			expect(tintAlpha).toBeGreaterThanOrEqual(0);
			expect(tintAlpha).toBeLessThanOrEqual(1);
		});
	}

	// ── ambientLightLevel always in [0, 1] ───────────────────────────────────
	for (let h = 0; h < 24; h++) {
		it(`ambientLightLevel for hour ${h} is between 0 and 1`, () => {
			const { ambientLightLevel } = getLightingForHour(h);
			expect(ambientLightLevel).toBeGreaterThanOrEqual(0);
			expect(ambientLightLevel).toBeLessThanOrEqual(1);
		});
	}

	// ── sunAngle always in [0, 360] ───────────────────────────────────────────
	for (let h = 0; h < 24; h++) {
		it(`sunAngle for hour ${h} is in [0, 360]`, () => {
			const { sunAngle } = getLightingForHour(h);
			expect(sunAngle).toBeGreaterThanOrEqual(0);
			expect(sunAngle).toBeLessThanOrEqual(360);
		});
	}

	// ── tintColor is always a valid rgba() string ───────────────────────────
	for (let h = 0; h < 24; h++) {
		it(`tintColor for hour ${h} starts with rgba(`, () => {
			const { tintColor } = getLightingForHour(h);
			expect(tintColor).toMatch(/^rgba\(/);
		});
	}
});

describe("dayNightCycle — getCurrentLighting", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns a valid LightingState based on real time", () => {
		const state = getCurrentLighting();
		expect(state).toHaveProperty("hour");
		expect(state).toHaveProperty("periodName");
		expect(state).toHaveProperty("tintColor");
		expect(state).toHaveProperty("tintAlpha");
		expect(state).toHaveProperty("sunAngle");
		expect(state).toHaveProperty("ambientLightLevel");
	});

	it("hour matches current local hour", () => {
		const mockHour = 14;
		vi.spyOn(global, "Date").mockImplementation(
			() => ({ getHours: () => mockHour }) as unknown as Date,
		);
		const state = getCurrentLighting();
		expect(state.hour).toBe(mockHour);
		expect(state.periodName).toBe("midday");
	});
});
