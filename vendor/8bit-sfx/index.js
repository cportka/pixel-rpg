// A slim, browser-servable entry over the vendored 8bit-sfx 1.0.0 engine.
//
// The game is a no-build static site, so it cannot import from node_modules
// at runtime; `dsp.js`, `ported.js` and `generators/rpg.js` are copied here
// verbatim from the pinned package (tests/sfx-package.test.mjs asserts they
// are byte-identical, so this vendor can never drift from the dependency).
// Only the `rpg` category is carried — the game's 28 ported sounds plus the
// 202 procedural RPG effects — which is 56 kB instead of the library's full
// 940 kB of generators.
//
// The upstream dispatch is mirrored exactly: ported sounds keep full 8-bit
// resolution, procedural ones take the 16-level chip crush that gives the
// library its voice.

import { Rng, quantize, pcmToFloat, QUANT_LEVELS, SR } from './dsp.js';
import { renderPorted, PORTED_NAMES } from './ported.js';
import { gen as genRpg } from './generators/rpg.js';

export { SR, PORTED_NAMES };

/** Zero-padded effect index, upstream's padIndex. */
const padIndex = (i) => String(i).padStart(3, '0');

/** Every rpg effect name this vendor can synthesize. */
export function rpgNames() {
  return [
    ...PORTED_NAMES.map((l) => `rpg_${l}`),
    ...Array.from({ length: 202 }, (_, i) => `rpg_${padIndex(i)}`),
  ];
}

/**
 * Synthesize an `rpg_*` effect to floats in [-1, 1) — post gain and 8-bit
 * quantization, so it sounds exactly like the library's exported WAV.
 * @param {string} name e.g. "rpg_levelup", "rpg_042"
 * @returns {Float32Array}
 */
export function render(name) {
  if (!name.startsWith('rpg_')) throw new Error(`8bit-sfx (vendored): only rpg_* effects, got "${name}"`);
  const tail = name.slice(4);
  if (PORTED_NAMES.includes(tail)) {
    const { samples } = renderPorted(tail);
    return pcmToFloat(quantize(samples, 0)); // ported: full 8-bit, no crush
  }
  if (!/^\d{3}$/.test(tail)) throw new Error(`8bit-sfx (vendored): unknown effect "${name}"`);
  const rng = new Rng(`rpg_${tail}`);
  return pcmToFloat(quantize(genRpg(rng), QUANT_LEVELS));
}
