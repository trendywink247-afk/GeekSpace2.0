// src/dashboard/pages/office/collisionLoader.ts
// Parse office_collision.webp alpha channel for walkable/blocked tiles.
// Alpha > 128 = blocked, Alpha <= 128 = walkable.
// Non-blocking spike — falls back to COLLISION_MAP in constants.ts on failure.

import { CELL, COLS, ROWS } from '../../constants';

let parsedMap: boolean[][] | null = null;
let loaded = false;

/**
 * Returns whether the authored collision image has been successfully parsed.
 * @returns True if the map was loaded from the image; false otherwise.
 */
export function isAuthoredMapLoaded(): boolean {
  return loaded;
}

/**
 * Returns the parsed collision grid, or null if it has not been loaded yet.
 * @returns A 2-D boolean grid where true means blocked, or null before loading.
 */
export function getAuthoredMap(): boolean[][] | null {
  return parsedMap;
}

/**
 * Loads `/office/office_collision.webp` and converts its alpha channel into a
 * per-tile blocked/walkable grid. Alpha > 128 is treated as blocked.
 * Falls back gracefully — returns null on any error so the caller can use
 * the hardcoded COLLISION_MAP constant instead.
 * @returns A 2-D boolean grid (true = blocked) on success, or null on failure.
 */
export async function loadCollisionFromImage(): Promise<boolean[][] | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error('Failed to load collision image'));
      img.src = '/office/office_collision.webp';
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const scaleX = img.naturalWidth / (COLS * CELL);
    const scaleY = img.naturalHeight / (ROWS * CELL);

    const grid: boolean[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < COLS; c++) {
        // Sample center of tile
        const px = Math.floor((c * CELL + CELL / 2) * scaleX);
        const py = Math.floor((r * CELL + CELL / 2) * scaleY);
        const idx = (py * img.naturalWidth + px) * 4;
        const alpha = data[idx + 3]; // alpha channel
        row.push(alpha > 128); // alpha > 128 = blocked
      }
      grid.push(row);
    }

    parsedMap = grid;
    loaded = true;
    console.log(
      '[CollisionLoader] Parsed authored collision map from office_collision.webp',
    );
    return grid;
  } catch (err) {
    console.warn(
      '[CollisionLoader] Failed to parse authored map, using COLLISION_MAP fallback',
      err,
    );
    return null;
  }
}
