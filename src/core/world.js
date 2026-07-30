// Procedurally generated magical forest.
//
// The world is an infinite plane divided into square chunks. Each chunk's
// contents (trees, bushes, sparkles) are derived purely from the world seed and
// the chunk coordinates, so the same seed always yields the same forest and
// chunks can be generated lazily in any order. Chunks are cached in a Map.

import { coordRng, pick } from './rng.js';

export const CHUNK = 160; // px per chunk side

// Canopy moods for the neo-noir forest — the reference footage's mix,
// re-themed: most trees burn violet/plum with magenta flecks ('ember') and a
// few are smoke-crowned ('leafy').
export const TREE_VARIANTS = ['ember', 'ember', 'ember', 'leafy', 'leafy'];

const MIN_TREE_GAP = 34; // px between tree anchors within a chunk

const PRUNE_KEEP_RADIUS = 6; // chunks kept around the player when pruning
const PRUNE_THRESHOLD = 220; // cache size that triggers a prune sweep

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.chunks = new Map();
  }

  /**
   * Drop cached chunks far from chunk-coordinates (ccx, ccy). Generation is
   * deterministic, so eviction is lossless — revisited chunks regenerate
   * identically. Keeps memory bounded on an endless wander.
   */
  prune(ccx, ccy, radius = PRUNE_KEEP_RADIUS) {
    if (this.chunks.size <= PRUNE_THRESHOLD) return;
    for (const [key, chunk] of this.chunks) {
      if (Math.abs(chunk.cx - ccx) > radius || Math.abs(chunk.cy - ccy) > radius) {
        this.chunks.delete(key);
      }
    }
  }

  /** The chunk at chunk-coordinates (cx, cy), generating it on first access. */
  chunkAt(cx, cy) {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = generateChunk(this.seed, cx, cy);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  /** All chunks overlapping the world-space rect (x, y, w, h). */
  chunksInRect(x, y, w, h) {
    const out = [];
    const cx0 = Math.floor(x / CHUNK);
    const cy0 = Math.floor(y / CHUNK);
    const cx1 = Math.floor((x + w) / CHUNK);
    const cy1 = Math.floor((y + h) / CHUNK);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) out.push(this.chunkAt(cx, cy));
    }
    return out;
  }

  /** Trees (and bushes) whose anchor lies within the world-space rect. */
  treesInRect(x, y, w, h) {
    const out = [];
    // Trees can be tall/wide; pad the query so off-rect anchors still draw.
    for (const chunk of this.chunksInRect(x - CHUNK, y - CHUNK, w + 2 * CHUNK, h + 2 * CHUNK)) {
      for (const t of chunk.trees) {
        if (t.x >= x - 64 && t.x <= x + w + 64 && t.y >= y - 16 && t.y <= y + h + 80) out.push(t);
      }
    }
    return out;
  }

  /** Sparkles within the world-space rect. */
  sparklesInRect(x, y, w, h) {
    const out = [];
    for (const chunk of this.chunksInRect(x, y, w, h)) {
      for (const s of chunk.sparkles) {
        if (s.x >= x && s.x <= x + w && s.y >= y && s.y <= y + h) out.push(s);
      }
    }
    return out;
  }

  /** Dancing inflatables near the world-space rect (padded — they're tall). */
  inflatablesInRect(x, y, w, h) {
    const out = [];
    for (const chunk of this.chunksInRect(x - CHUNK, y - CHUNK, w + 2 * CHUNK, h + 2 * CHUNK)) {
      for (const f of chunk.inflatables) {
        if (f.x >= x - 24 && f.x <= x + w + 24 && f.y >= y - 8 && f.y <= y + h + 48) out.push(f);
      }
    }
    return out;
  }

  /** Burning dumpsters near the world-space rect. */
  dumpstersInRect(x, y, w, h) {
    const out = [];
    for (const chunk of this.chunksInRect(x - CHUNK, y - CHUNK, w + 2 * CHUNK, h + 2 * CHUNK)) {
      for (const d of chunk.dumpsters) {
        if (d.x >= x - 16 && d.x <= x + w + 16 && d.y >= y - 8 && d.y <= y + h + 24) out.push(d);
      }
    }
    return out;
  }

  /** Psychedelic cats near the world-space rect. */
  catsInRect(x, y, w, h) {
    const out = [];
    for (const chunk of this.chunksInRect(x - CHUNK, y - CHUNK, w + 2 * CHUNK, h + 2 * CHUNK)) {
      for (const c of chunk.cats) {
        if (c.x >= x - 12 && c.x <= x + w + 12 && c.y >= y - 8 && c.y <= y + h + 12) out.push(c);
      }
    }
    return out;
  }

  /**
   * Does a feet-box (x, y, w, h — top-left corner, world px) collide with any
   * tree trunk? Bushes and canopies never block; walking behind trees is the point.
   */
  collides(x, y, w, h) {
    for (const chunk of this.chunksInRect(x - CHUNK, y - CHUNK, w + 2 * CHUNK, h + 2 * CHUNK)) {
      for (const t of chunk.trees) {
        if (t.kind !== 'tree') continue;
        const b = trunkBox(t);
        if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return true;
      }
      for (const d of chunk.dumpsters) {
        // A dumpster is solid at its base (16 wide, like the sprite).
        if (x < d.x + 8 && x + w > d.x - 8 && y < d.y + 1 && y + h > d.y - 3) return true;
      }
    }
    return false;
  }
}

/** Solid collision box at a tree's base (world-space, top-left + size). */
export function trunkBox(tree) {
  const half = Math.max(2, Math.round(tree.size * 0.09));
  return { x: tree.x - half, y: tree.y - 3, w: half * 2, h: 4 };
}

/** Pure chunk generator — same (seed, cx, cy) always returns identical content. */
export function generateChunk(seed, cx, cy) {
  const rng = coordRng(seed, cx, cy);
  const baseX = cx * CHUNK;
  const baseY = cy * CHUNK;

  const trees = [];
  const nTrees = 1 + Math.floor(rng() * 3); // sparse like the reference
  for (let i = 0; i < nTrees; i++) {
    let x = 0;
    let y = 0;
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      x = baseX + Math.floor(rng() * CHUNK);
      y = baseY + Math.floor(rng() * CHUNK);
      ok = trees.every((t) => Math.hypot(t.x - x, t.y - y) >= MIN_TREE_GAP);
    }
    if (!ok) continue;
    trees.push({
      kind: 'tree',
      x,
      y, // anchor = trunk base center
      size: 32 + Math.floor(rng() * 20), // overall height in px
      variant: pick(rng, TREE_VARIANTS),
      detailSeed: Math.floor(rng() * 0xffffffff) >>> 0,
    });
  }

  const nBushes = Math.floor(rng() * 3);
  for (let i = 0; i < nBushes; i++) {
    trees.push({
      kind: 'bush',
      x: baseX + Math.floor(rng() * CHUNK),
      y: baseY + Math.floor(rng() * CHUNK),
      size: 8 + Math.floor(rng() * 6),
      variant: pick(rng, TREE_VARIANTS),
      detailSeed: Math.floor(rng() * 0xffffffff) >>> 0,
    });
  }

  // Magical drifting motes that twinkle in the dark between the trees.
  const sparkles = [];
  const nSparkles = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < nSparkles; i++) {
    sparkles.push({
      x: baseX + Math.floor(rng() * CHUNK),
      y: baseY + Math.floor(rng() * CHUNK),
      phase: rng() * Math.PI * 2,
      rate: 0.6 + rng() * 1.2,
      tint: Math.floor(rng() * 3), // index into the renderer's sparkle tints
    });
  }

  // Rarely, a clearing of dancing inflatables — nobody knows why they're
  // here. (These rng draws come LAST so earlier chunk content is unchanged
  // for seeds generated by older versions.)
  const inflatables = [];
  if (rng() < 0.025) {
    const gx = baseX + 30 + Math.floor(rng() * (CHUNK - 60));
    const gy = baseY + 30 + Math.floor(rng() * (CHUNK - 60));
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      inflatables.push({
        x: gx + Math.floor((rng() - 0.5) * 56),
        y: gy + Math.floor((rng() - 0.5) * 32),
        h: 22 + Math.floor(rng() * 10), // tube height in px
        tint: Math.floor(rng() * 4), // index into INFLATABLE_TINTS
        phase: rng() * Math.PI * 2,
        speed: 3 + rng() * 2, // wave speed
      });
    }
  }

  // Rare encounters. (Order matters: these rng draws come after everything
  // above so earlier chunk content is unchanged for existing seeds.)
  const dumpsters = [];
  if (rng() < 0.02) {
    dumpsters.push({
      x: baseX + 20 + Math.floor(rng() * (CHUNK - 40)),
      y: baseY + 20 + Math.floor(rng() * (CHUNK - 40)),
    });
  }
  const cats = [];
  if (rng() < 0.02) {
    cats.push({
      x: baseX + 20 + Math.floor(rng() * (CHUNK - 40)),
      y: baseY + 20 + Math.floor(rng() * (CHUNK - 40)),
      phase: rng() * Math.PI * 2,
    });
  }

  return { cx, cy, trees, sparkles, inflatables, dumpsters, cats };
}
