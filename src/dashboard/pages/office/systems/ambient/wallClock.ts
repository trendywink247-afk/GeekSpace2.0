/**
 * wallClock.ts
 * Draws a canvas-native HH:MM wall clock at a fixed position inside the office.
 * Rendered directly onto the 2D canvas (not as a DOM overlay) so it is part
 * of the world and respects the camera/zoom transform.
 *
 * Position: tile { x: 25, y: 2 } — top-right corner, inside office bounds.
 * Aesthetic: matches landing page mono style — small, muted, uppercase, tracking.
 */

/**
 * Draw the wall-clock HUD at the canonical top-right tile position.
 *
 * @param ctx      - 2D rendering context of the office canvas.
 * @param cellSize - Current cell size in pixels (pass CELL constant normally).
 */
export function drawWallClock(
	ctx: CanvasRenderingContext2D,
	cellSize: number,
): void {
	const now = new Date();
	const hh = String(now.getHours()).padStart(2, "0");
	const mm = String(now.getMinutes()).padStart(2, "0");
	const timeStr = `${hh}:${mm}`;

	// Anchor at tile { x: 25, y: 2 }
	const tileX = 25;
	const tileY = 2;
	const px = tileX * cellSize + cellSize / 2;
	const py = tileY * cellSize + cellSize / 2;

	ctx.save();

	// Font matching "font-mono text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]/60"
	ctx.font = '700 11px "JetBrains Mono", "Courier New", monospace';
	ctx.letterSpacing = "0.15em";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	// Measure for background pill
	const metrics = ctx.measureText(timeStr);
	const textW = metrics.width + 8; // 4px padding each side
	const textH = 16;

	// Dark pill background
	ctx.fillStyle = "rgba(6,6,26,0.65)";
	ctx.beginPath();
	ctx.roundRect(px - textW / 2, py - textH / 2, textW, textH, 4);
	ctx.fill();

	// Subtle border
	ctx.strokeStyle = "rgba(148,163,184,0.15)";
	ctx.lineWidth = 0.5;
	ctx.stroke();

	// Clock text — #94A3B8 at 60% opacity
	ctx.fillStyle = "rgba(148,163,184,0.60)";
	ctx.fillText(timeStr, px, py);

	ctx.restore();
}
