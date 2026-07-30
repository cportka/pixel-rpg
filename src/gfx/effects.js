// Transition glitches and angular stars — pure geometry, no canvas.
//
// Glitch: game moments (swapping bodies, meeting the dog, a throw, a catch)
// flash a brief burst of horizontal band-slips and stray noise blocks over
// the frame, like the signal skipping. Bands are deterministic per
// (seed, frame) so the effect is testable and replays identically.
//
// Stars: the sparkle motes render as sharp 4-point stars — long axis spikes
// with a small diagonal glint — instead of soft dots.

import { mulberry32, hashCoords } from '../core/rng.js';
import { PALETTE } from './palette.js';

export const GLITCH_TIME = 0.35; // seconds a transition glitch lasts

// Noise blocks pull from the loud end of the palette.
export const GLITCH_TINTS = [PALETTE.magenta, PALETTE.blue, PALETTE.violet, PALETTE.moonlight];

/**
 * The band-slips and noise blocks for one glitched frame.
 * intensity runs 1 → 0 over the glitch's life; screenW/H bound the output.
 * Returns { bands: [{y, h, dx}], noise: [{x, y, w, h, c}] }.
 */
export function glitchFrame(seed, frame, intensity, screenW, screenH) {
  const rng = mulberry32(hashCoords(seed >>> 0, frame | 0, 0));
  const bands = [];
  const nBands = 1 + Math.floor(rng() * 2 + intensity * 3);
  for (let i = 0; i < nBands; i++) {
    const h = 2 + Math.floor(rng() * 7);
    const y = Math.floor(rng() * (screenH - h));
    const mag = 2 + Math.round(rng() * 8 * intensity);
    bands.push({ y, h, dx: rng() < 0.5 ? -mag : mag });
  }
  const noise = [];
  const nNoise = 2 + Math.floor(rng() * 5 * intensity);
  for (let i = 0; i < nNoise; i++) {
    noise.push({
      x: Math.floor(rng() * (screenW - 6)),
      y: Math.floor(rng() * (screenH - 2)),
      w: 2 + Math.floor(rng() * 5),
      h: 1 + Math.floor(rng() * 2),
      c: GLITCH_TINTS[Math.floor(rng() * GLITCH_TINTS.length)],
    });
  }
  return { bands, noise };
}

/**
 * Lit offsets for one star at a given twinkle glow (0..1) and size (1..3):
 * a sharp 4-point star — axis spikes that lengthen as the glow peaks, plus
 * a diagonal glint. Empty when the star is dark. Symmetric by construction.
 */
export function starPixels(glow, size = 1) {
  if (glow < 0.1) return [];
  const out = [{ x: 0, y: 0 }];
  if (glow < 0.35) return out;
  // Axis arms, lengthening with glow and size.
  let len = 1 + size;
  if (glow >= 0.9) len += 2;
  const reach = glow >= 0.6 ? len : 1;
  for (let s = 1; s <= reach; s++) {
    out.push({ x: s, y: 0 }, { x: -s, y: 0 }, { x: 0, y: s }, { x: 0, y: -s });
  }
  // Diagonal glint at the peak.
  if (glow >= 0.6) {
    out.push({ x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 });
  }
  return out;
}

/** A star's size (1..3), derived from fields sparkles already carry. */
export function starSize(sparkle) {
  return 1 + ((sparkle.tint + Math.floor(sparkle.phase * 2)) % 3);
}

// Symmetric rounding (Math.round biases toward +Infinity for -.5).
const sround = (v) => (v < 0 ? -Math.round(-v) : Math.round(v));

/**
 * The tap-to-move destination marker: three small arrowheads spaced 120°
 * apart, apexes pointing at the target, marching inward on a loop — a pixel
 * take on the BG3 pulse. Returns [{x, y, tri, apex}] offsets from the
 * target; tri (0..2) picks a color, apex marks each arrowhead's tip.
 */
export function targetMarkerPixels(time) {
  const r = 7 - Math.floor((time * 10) % 5); // 7 → 3, then snaps out again
  const dirs = [
    [0, -1],
    [-0.866, 0.5],
    [0.866, 0.5],
  ];
  const out = [];
  dirs.forEach(([dx, dy], tri) => {
    const ax = sround(dx * r);
    const ay = sround(dy * r);
    const bx = sround(dx * (r + 2));
    const by = sround(dy * (r + 2));
    const px = sround(-dy);
    const py = sround(dx);
    out.push(
      { x: ax, y: ay, tri, apex: true },
      { x: bx, y: by, tri, apex: false },
      { x: bx + px, y: by + py, tri, apex: false },
      { x: bx - px, y: by - py, tri, apex: false },
    );
  });
  return out;
}
