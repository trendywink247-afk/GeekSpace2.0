/**
 * dayNightCycle.ts
 * Computes real-time lighting state based on the user's local clock.
 * Used by ambientLayer to overlay a tint on the office canvas.
 */

export type PeriodName =
	| "dawn"
	| "morning"
	| "midday"
	| "afternoon"
	| "dusk"
	| "evening"
	| "night"
	| "deepNight";

export interface LightingState {
	/** 0-23 local hour */
	hour: number;
	/** Human-readable period name */
	periodName: PeriodName;
	/** rgba() tint colour to overlay on the canvas */
	tintColor: string;
	/** 0.0 (midday, no tint) to ~0.5 (deep night) */
	tintAlpha: number;
	/** 0-360 degrees, for shadow direction */
	sunAngle: number;
	/** 0.0 (dark) to 1.0 (full brightness) */
	ambientLightLevel: number;
}

/**
 * Map an hour (0-23) to a LightingState.
 * Period boundaries follow the task spec exactly.
 */
export function getLightingForHour(hour: number): LightingState {
	const h = Math.floor(hour) % 24;

	// deepNight 00:00–04:00 (checked BEFORE night so it wins on 00-04)
	if (h >= 0 && h < 4) {
		return {
			hour: h,
			periodName: "deepNight",
			tintColor: "rgba(10,15,50,1)",
			tintAlpha: 0.45,
			sunAngle: 270,
			ambientLightLevel: 0.05,
		};
	}
	// dawn 05:00–07:00
	if (h >= 5 && h < 7) {
		return {
			hour: h,
			periodName: "dawn",
			tintColor: "rgba(255,150,80,1)",
			tintAlpha: 0.1,
			sunAngle: 60,
			ambientLightLevel: 0.45,
		};
	}
	// morning 07:00–10:00
	if (h >= 7 && h < 10) {
		return {
			hour: h,
			periodName: "morning",
			tintColor: "rgba(255,220,150,1)",
			tintAlpha: 0.04,
			sunAngle: 100,
			ambientLightLevel: 0.85,
		};
	}
	// midday 10:00–15:00
	if (h >= 10 && h < 15) {
		return {
			hour: h,
			periodName: "midday",
			tintColor: "rgba(255,255,255,1)",
			tintAlpha: 0.0,
			sunAngle: 180,
			ambientLightLevel: 1.0,
		};
	}
	// afternoon 15:00–18:00
	if (h >= 15 && h < 18) {
		return {
			hour: h,
			periodName: "afternoon",
			tintColor: "rgba(255,200,100,1)",
			tintAlpha: 0.08,
			sunAngle: 220,
			ambientLightLevel: 0.8,
		};
	}
	// dusk 18:00–20:00
	if (h >= 18 && h < 20) {
		return {
			hour: h,
			periodName: "dusk",
			tintColor: "rgba(220,100,80,1)",
			tintAlpha: 0.18,
			sunAngle: 260,
			ambientLightLevel: 0.4,
		};
	}
	// evening 20:00–22:00
	if (h >= 20 && h < 22) {
		return {
			hour: h,
			periodName: "evening",
			tintColor: "rgba(60,80,150,1)",
			tintAlpha: 0.22,
			sunAngle: 270,
			ambientLightLevel: 0.25,
		};
	}
	// night 22:00–00:00 (also catches hour 4 — the gap between deepNight and dawn)
	// Night 22–24 AND hour 4 (04:00–05:00 gap)
	return {
		hour: h,
		periodName: "night",
		tintColor: "rgba(20,30,80,1)",
		tintAlpha: 0.35,
		sunAngle: 270,
		ambientLightLevel: 0.1,
	};
}

/**
 * Returns the current lighting state based on the user's local time.
 */
export function getCurrentLighting(): LightingState {
	const hour = new Date().getHours();
	return getLightingForHour(hour);
}
