// Dancing inflatables — the wacky waving tube-dancers the pair eventually
// stumbles upon, deep in the woods. Pure time-dependent geometry: the same
// (inflatable, time) always yields the same pixels, so the wave animates
// deterministically at the 15fps render cadence. Rendered as 2x1 blocks
// like the trees; the renderer draws them fresh each frame (no cache — a
// dancer never holds still).

import { PALETTE } from './palette.js';
import { BLOCK_W } from './trees.js';

export const INFLATABLE_TINTS = [PALETTE.magenta, PALETTE.violet, PALETTE.blue, PALETTE.pink];

const snap = (x) => 2 * Math.round(x / 2);

/**
 * Pixels for one tube-dancer at a moment in time, relative to its base
 * anchor at (0, 0); negative y is up. Returns { pixels, minX, minY, maxX,
 * maxY } in the same shape treePixels uses.
 */
export function inflatablePixels(inf, time) {
  const pixels = [];
  const tint = INFLATABLE_TINTS[inf.tint % INFLATABLE_TINTS.length];
  const wob = inf.phase + time * inf.speed;

  // The tube: a serpentine column whose sway grows toward the top.
  const sway = (i) => snap(Math.sin(wob + i * 0.35) * (1 + (i / inf.h) * 4));
  for (let i = 0; i < inf.h; i++) {
    pixels.push({ x: sway(i), y: -i, c: tint });
  }

  // A moonlit head block on top.
  pixels.push({ x: sway(inf.h), y: -inf.h, c: PALETTE.moonlight });

  // Flailing arms at ~70% height, flipping with the wave.
  const armI = Math.round(inf.h * 0.7);
  const ax = sway(armI);
  const ay = -armI;
  const flip = Math.sin(wob * 1.7) > 0 ? -1 : 1;
  for (let s = 1; s <= 3; s++) {
    pixels.push({ x: ax - s * BLOCK_W, y: ay - s * flip, c: tint });
    pixels.push({ x: ax + s * BLOCK_W, y: ay + s * flip, c: tint });
  }

  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const p of pixels) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x + BLOCK_W - 1 > maxX) maxX = p.x + BLOCK_W - 1;
    if (p.y > maxY) maxY = p.y;
  }
  return { pixels, minX, minY, maxX, maxY };
}
