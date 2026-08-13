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

// The marker's neon set: electric blue and violet trade places around the
// ring, a magenta ghost trails it, and the core burns hot rose under a
// moonlit ping. (Through the heaven remap these land periwinkle and blush —
// still the loudest thing on the cream.)
export const MARKER_NEON = {
  ring: [PALETTE.blue, PALETTE.violet],
  trail: PALETTE.magenta,
  core: PALETTE.hotRose,
  ping: PALETTE.moonlight,
};

/**
 * The tap-to-move destination marker (v0.18): a neon ring on the ground.
 * A ground-perspective ellipse collapses onto the tap point — blue and
 * violet shimmering around the rim, a sparse magenta ghost ring trailing a
 * step behind — over a hot-rose core that flashes a moonlit ping each time
 * the ring snaps back out. Deterministic per time; returns [{x, y, c}]
 * offsets from the target.
 */
export function targetMarkerPixels(time) {
  const phase = (time * 1.6) % 1; // one collapse ~0.6s
  const shimmer = Math.floor(time * 12); // the rim's two neons trade places
  const rx = sround(10 - phase * 7); // 10 → 3, then snaps out again
  const ry = Math.max(2, sround(rx * 0.55)); // squashed: it lies on the ground
  const seen = new Set();
  const out = [];
  const put = (x, y, c) => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x, y, c });
  };
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    put(sround(Math.cos(a) * rx), sround(Math.sin(a) * ry), MARKER_NEON.ring[(i + shimmer) % 2]);
  }
  // The ghost ring: every other point, one step out, already fading.
  for (let i = 0; i < 16; i += 2) {
    const a = (i * Math.PI) / 8;
    put(sround(Math.cos(a) * (rx + 3)), sround(Math.sin(a) * (ry + 2)), MARKER_NEON.trail);
  }
  // The core, and the ping that greets each fresh ring.
  put(0, 0, MARKER_NEON.core);
  if (phase < 0.3) {
    put(1, 0, MARKER_NEON.ping);
    put(-1, 0, MARKER_NEON.ping);
    put(0, 1, MARKER_NEON.ping);
    put(0, -1, MARKER_NEON.ping);
  }
  return out;
}
