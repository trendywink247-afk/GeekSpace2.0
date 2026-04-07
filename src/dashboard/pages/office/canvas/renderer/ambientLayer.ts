/**
 * ambientLayer.ts
 * Composites all ambient sub-systems into a single render entry point.
 *
 * Draw order (important — last draw wins):
 *   1. Weather particles    (world layer — behind UI)
 *   2. Wall clock HUD       (world UI element)
 *   3. Day/night tint       (LAST — full-screen tint on top of everything)
 *
 * Called by OfficeCanvasRenderer.renderFrame() after the theme overlay
 * and before the debug overlay.
 *
 * AmbientState lifecycle is managed by OfficeStage.tsx (Lane 2 coordination).
 * See PR body for the exact integration snippet.
 */

import { CELL } from "../../constants";
import { getCurrentLighting } from "../../systems/ambient/dayNightCycle";
import type { AmbientState } from "../../systems/ambient/state";
import { drawWallClock } from "../../systems/ambient/wallClock";
import { drawWeather } from "../../systems/ambient/weather";

/**
 * Render the complete ambient layer onto the canvas.
 *
 * @param ctx      - 2D rendering context of the office canvas.
 * @param state    - Current ambient state (weather particles, etc.).
 * @param canvasW  - Canvas width in pixels.
 * @param canvasH  - Canvas height in pixels.
 * @param cellSize - Cell size in pixels (defaults to CELL constant if not provided).
 */
export function drawAmbientLayer(
	ctx: CanvasRenderingContext2D,
	state: AmbientState,
	canvasW: number,
	canvasH: number,
	cellSize: number = CELL,
): void {
	// 1. Draw weather particles (behind clock and lighting tint)
	drawWeather(ctx, state.weather, canvasW, canvasH);

	// 2. Draw wall clock HUD (world-space UI)
	drawWallClock(ctx, cellSize);

	// 3. Overlay lighting tint LAST — full-screen colour wash on top of everything
	const lighting = getCurrentLighting();
	if (lighting.tintAlpha > 0) {
		ctx.fillStyle = lighting.tintColor;
		ctx.globalAlpha = lighting.tintAlpha;
		ctx.fillRect(0, 0, canvasW, canvasH);
		ctx.globalAlpha = 1.0;
	}
}
