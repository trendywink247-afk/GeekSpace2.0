/**
 * state.ts
 * Mutable ambient state container.
 *
 * Lifecycle:
 *   initAmbientState()  — called ONCE in OfficeStage (Lane 2 coordination — see PR body)
 *   tickAmbientState()  — called every RAF frame before renderFrame()
 *
 * The lighting tint is NOT stored here — it is recomputed per-frame inside
 * drawAmbientLayer() via getCurrentLighting() to stay in sync with real time.
 */

import type { WeatherMode } from "./weather";
import { initWeather, tickWeather, type WeatherState } from "./weather";

export interface AmbientState {
	weather: WeatherState;
	/** Timestamp of last periodic housekeeping (ms). */
	lastLightingCheck: number;
}

/**
 * Create the initial ambient state.
 * Weather mode is read from localStorage key `office_weather`; defaults to 'clear'.
 */
export function initAmbientState(): AmbientState {
	const raw =
		typeof localStorage !== "undefined"
			? (localStorage.getItem("office_weather") ?? "clear")
			: "clear";

	const weatherMode: WeatherMode =
		raw === "rain" || raw === "snow" ? raw : "clear";

	return {
		weather: initWeather(weatherMode),
		lastLightingCheck: Date.now(),
	};
}

/**
 * Advance all ambient sub-systems by `dtMs` milliseconds.
 * Mutates `state` in-place for performance (no allocations on the hot path).
 */
export function tickAmbientState(state: AmbientState, dtMs: number): void {
	state.weather = tickWeather(state.weather, dtMs);
	// Lighting is recomputed per-frame in drawAmbientLayer — nothing to tick here.
	state.lastLightingCheck = Date.now();
}
