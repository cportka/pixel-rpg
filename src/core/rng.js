// Deterministic randomness for procedural generation.
//
// The whole forest derives from one world seed: each chunk hashes (seed, cx, cy)
// into its own RNG stream, so any chunk can be regenerated identically in any
// order — the property the world tests pin down.

/** mulberry32 — tiny fast PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix a seed with two integer coordinates into a well-scrambled 32-bit seed. */
export function hashCoords(seed, x, y) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = (h << 13) | (h >>> 19);
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return h >>> 0;
}

/** RNG stream for a chunk (or any coordinate-addressed feature). */
export function coordRng(seed, x, y) {
  return mulberry32(hashCoords(seed, x, y));
}

/** Pick one element of a non-empty array using rng. */
export function pick(rng, arr) {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
}
