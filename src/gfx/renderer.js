// Canvas renderer: draws the game state onto a low-res screen (320x200) that
// the page upscales with image-rendering: pixelated. World objects are
// y-sorted by their baseline so characters walk in front of and behind trees.
//
// Presentation runs at RENDER_FPS (the reference footage's chunky ~15Hz
// cadence) — main.js calls render() at that rate while the simulation stays
// at 60Hz. Trees are rasterized once per identity onto small offscreen
// canvases and cached; generation is deterministic, so eviction is lossless.

import {
  PALETTE, SPRITE_COLORS, SPARKLE_TINTS, LEASH_COLORS, heavenColor, HEAVEN_SPARKLES,
} from './palette.js';
import {
  PERSON_FRAMES, DOG_FRAMES, CERBERUS_FRAMES, BALL_SPRITE, HEART_SPRITE, walkFrame, spriteSize,
} from './sprites.js';
import { treePixels, BLOCK_W, BLOCK_H } from './trees.js';
import { inflatablePixels } from './inflatables.js';
import { glitchFrame, starPixels, starSize, targetMarkerPixels } from './effects.js';
import {
  DUMPSTER_SPRITE, DUMPSTER_COLORS, CAT_SPRITE, firePixels, catRowColor,
  LAMP_SPRITE, LAMP_COLORS, PIPE_SPRITE, PIPE_COLORS, lampGlintPixels, pipeSmokePixels,
  ZOMBIE_SPRITE, ZOMBIE_COLORS, zombieSway,
  ANGEL_SPRITE, ANGEL_COLORS, angelBob,
  CATHEDRAL_SPRITE, CATHEDRAL_COLORS, templeGrowthPixels, ragaPixels,
} from './encounters.js';
import {
  cabinWindowLit, CAVE_SPRITE, CAVE_COLORS, caveGlint,
  rockPixels, TUFT_PIXELS,
  mansionAtticLit,
  CLOCK_SPRITE, PORTRAIT_SPRITE, SHELF_SPRITE, TABLE_SPRITE, CHAIR_SPRITE,
  CANDELABRA_SPRITE, CHANDELIER_SPRITE, FURNISH_COLORS, flameColor,
  TELEVISION_SPRITE, TELEVISION_COLORS, tvGlowPixels,
  BED_SPRITE, NIGHTSTAND_SPRITE, TELESCOPE_SPRITE, DESK2_SPRITE, PORTRAIT2_SPRITE,
  BIG_CABIN_SPRITE, BIG_CABIN_COLORS, BIG_MANSION_SPRITE, BIG_MANSION_COLORS,
  BIG_RUIN_SPRITES, BIG_OFFICE_SPRITE, BIG_OFFICE_COLORS,
} from './structures.js';
import {
  GHOST_SPRITES, ghostMosh, moshTint, PIRTS_SPRITE, PIRTS_COLORS,
  DETECTIVE_SPRITE, DETECTIVE_COLORS, TOWN_SIGN_SPRITE, TOWN_SIGN_COLORS,
  OFFICE_FURNISH as OFFICE_FURNISH_ART, CABIN_FURNISH as CABIN_FURNISH_ART,
} from './town.js';
import {
  WIZARD_SPRITES, wizardGrump, CORTIE_SPRITE, CORTIE_COLORS,
  QUEEBEE_SPRITE, QUEEBEE_COLORS, TOWER_SPRITE, TOWER_COLORS,
  SHOP_CORTIE_SPRITE, SHOP_QUEEBEE_SPRITE, QTOWN_SIGN_SPRITE, QTOWN_SIGN_COLORS,
  SHOP_FURNISH,
} from './qtown.js';
import {
  MINOTAUR_FRAMES, MINOTAUR_COLORS, CRICKET_SPRITE, CRICKET_COLORS, cricketChirp,
  FROG_SPRITE, FROG_COLORS, LILYPAD_SPRITE, LILYPAD_COLORS, frogMenace,
  SIGNPOST_SPRITE, SIGNPOST_COLORS, signArrowPixels, BOAT_SPRITE, BOAT_COLORS,
  SHRINE_SPRITE, SHRINE_COLORS,
  CATHEDRAL_FURNISH as CATHEDRAL_FURNISH_ART, pileGrowthPixels,
} from './creatures.js';
import {
  TILE, MANSION_MAP, INTERIOR_W, INTERIOR_H, FURNISH,
} from '../core/mansion.js';
import { INTERIORS } from '../core/interiors.js';
import { ICONS } from './icons.js';
import {
  MAX_HP, XP_PER_LEVEL, BATTLE_MOVE, SPELLS, minotaurPos, ghostPos, ZOMBIE_LEASH,
} from '../core/game.js';
import {
  isWater, onBridge, regionAt, biomeAt, REGION, godSpot, lilypadsAt,
} from '../core/terrain.js';
import { hashCoords } from '../core/rng.js';
import { SCREEN_W, SCREEN_H } from '../core/screen.js';

export { SCREEN_W, SCREEN_H };
import { textPixels, measureText, wrapText, GLYPH_H, LINE_GAP } from './font.js';

export const RENDER_FPS = 15; // presentation cadence, matched to the reference

/** Caption wrap width — live, since the screen resizes (v0.19). */
export function captionMaxW() {
  return SCREEN_W - 40;
}
const BUTTON_PAD = 3; // px of padding inside a touch button

/**
 * Smooth value noise on a lattice `step` cells across: bilinear between the
 * four corner hashes, smoothstepped. Straight per-block hashing tiles the
 * forest floor into visible squares; this fades one patch into the next, so
 * the dirt shows through the dark in drifts instead of on a grid.
 */
export function groundNoise(seed, cx, cy, step) {
  const gx = Math.floor(cx / step);
  const gy = Math.floor(cy / step);
  const fx = (cx - gx * step) / step;
  const fy = (cy - gy * step) / step;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (x, y) => hashCoords(seed, x, y) / 0x100000000;
  const a = h(gx, gy);
  const b = h(gx + 1, gy);
  const top = a + (b - a) * sx;
  const c = h(gx, gy + 1);
  const d = h(gx + 1, gy + 1);
  const bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

/**
 * Geometry for the open choice menu (pure — the renderer draws it, main.js
 * hit-tests taps against its rows). Null when no menu is open.
 */
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** The character sheet's header lines (stats live in the icon grid now). */
export function sheetLines(game) {
  const lines = [
    `LVL ${game.level}  XP ${game.xp} OF ${XP_PER_LEVEL}`,
    `HP ${game.hp} OF ${MAX_HP}`,
    `WEIGHT ${game.carriedWeight()} OF ${game.carryCapacity()} LBS`,
    `COINS ${game.coins}  WOOD ${game.wood}`,
  ];
  if (game.spells.length) {
    lines.push(`SLOTS L1 ${game.slots[1]}/${game.maxSlots(1)}  L2 ${game.slots[2]}/${game.maxSlots(2)}  L3 ${game.slots[3]}/${game.maxSlots(3)}`);
    lines.push(
      `SPELLS: ${SPELLS.filter((s) => game.spells.includes(s.id)).map((s) => s.name).join(', ')}`,
    );
  }
  if (game.drunk > 0) lines.push(`DRUNK ${mmss(game.drunk)} (WIS +2)`);
  return lines;
}

export function choicePanel(game) {
  if (!game.choice) return null;
  const opts = game.choice.options;
  const rowHM = GLYPH_H + 4;
  if (game.choice.kind === 'map' || game.choice.kind === 'sheet') {
    // Full-frame pause screens. The map's cells — and the sheet's icon grid —
    // are drawn by the renderer; taps hit-test rows and icon cells.
    const x = 6;
    const y = 4;
    const w = SCREEN_W - 12;
    const h = SCREEN_H - 12;
    const body = game.choice.kind === 'sheet' ? sheetLines(game) : [];
    const bodyH = body.length * (GLYPH_H + LINE_GAP);
    const iconOpts = opts.filter((o) => o.icon);
    const cellW = 30;
    const cellH = 30;
    const gapX = 8;
    const rowGap = 10;
    const perRow = 6;
    const iconTop = y + 6 + rowHM + bodyH + 10;
    const icons = iconOpts.map((o, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, iconOpts.length - row * perRow);
      const rowW = rowCount * cellW + (rowCount - 1) * gapX;
      return {
        index: opts.indexOf(o),
        id: o.id,
        icon: o.icon,
        label: o.label,
        x: Math.round((SCREEN_W - rowW) / 2) + col * (cellW + gapX),
        y: iconTop + row * (cellH + rowGap),
        w: cellW,
        h: cellH,
      };
    });
    const rows = opts
      .filter((o) => !o.icon)
      .map((o, i, plain) => ({
        index: opts.indexOf(o),
        id: o.id,
        label: o.label,
        x: x + 4,
        y: y + h - rowHM * (plain.length - i) - 4,
        w: w - 8,
        h: rowHM,
      }));
    return { x, y, w, h, title: game.choice.title, body, rows, icons };
  }
  const body = game.choice.body ?? [];
  const rowH = GLYPH_H + 4;
  const bodyH = body.length * (GLYPH_H + LINE_GAP);
  const contentW = Math.max(
    measureText(game.choice.title),
    // The selected row is drawn as `- LABEL -`, so size for the decoration.
    ...opts.map((o) => measureText(`- ${o.label} -`)),
    ...body.map((b) => measureText(b)),
  );
  const w = Math.min(SCREEN_W - 8, contentW + 12);
  const h = rowH * (opts.length + 1) + bodyH + 10;
  const x = Math.round((SCREEN_W - w) / 2);
  const y = SCREEN_H - h - 22;
  const rows = opts.map((o, i) => ({
    index: i,
    id: o.id,
    label: o.label,
    x: x + 4,
    y: y + 6 + bodyH + rowH * (i + 1),
    w: w - 8,
    h: rowH,
  }));
  return { x, y, w, h, title: game.choice.title, body, rows };
}

/**
 * Touch-UI buttons for the current game state (pure geometry — the renderer
 * draws them, main.js hit-tests them). Empty until the pair are together,
 * since swap and fetch are locked while alone.
 */
/** The HUD minimap's screen rect (top-right). main.js hit-tests taps on it. */
export const HUD_CELL = 15; // px per remembered region on the HUD map
export const HUD_SPAN = 5; // a 5x5 of regions around you
// The map screen zooms its cells to fit whatever you remember, between these.
export const MAP_CELL_MIN = 15;
export const MAP_CELL_MAX = 60;
export function hudRect() {
  const size = HUD_CELL * HUD_SPAN + 6;
  return { x: SCREEN_W - size - 4, y: 4, w: size, h: size };
}

/**
 * The little pictograms that make a remembered region legible at a glance —
 * a river runs, a bridge crosses it, a cabin is a gabled hut, a mansion is a
 * taller one with a gold-lit window, a cave is a black mouth under a rock.
 * Pure geometry so tests can read them without a canvas; the same list draws
 * on the HUD and on the full map, and the map screen prints a legend beside
 * them.
 */
export function memoryGlyphs(entry, size) {
  const out = [];
  const mid = Math.floor(size / 2);
  if (entry.water && entry.biome !== 'lake' && !entry.island) {
    // A river: a wandering channel rather than a straight bar.
    for (let y = 0; y < size; y++) {
      const bend = Math.round(Math.sin(y * 0.9) * (size > 9 ? 2 : 1));
      out.push({ x: mid - 1 + bend, y, w: 2, h: 1, c: PALETTE.blue });
    }
  }
  if (entry.bridge) {
    out.push({ x: mid - 3, y: mid - 1, w: 7, h: 1, c: PALETTE.smoke });
    out.push({ x: mid - 3, y: mid + 1, w: 7, h: 1, c: PALETTE.smoke });
  }
  if (entry.cabin) {
    // A gabled hut: roof ridge over a small box.
    out.push({ x: mid - 2, y: mid - 3, w: 5, h: 1, c: PALETTE.smoke });
    out.push({ x: mid - 3, y: mid - 2, w: 7, h: 1, c: PALETTE.smoke });
    out.push({ x: mid - 2, y: mid - 1, w: 5, h: 4, c: PALETTE.clay });
    out.push({ x: mid, y: mid, w: 1, h: 1, c: PALETTE.gold }); // its lit window
  }
  if (entry.mansion) {
    // Taller, wider, two lit windows and a chimney.
    out.push({ x: mid - 1, y: mid - 5, w: 1, h: 2, c: PALETTE.smokeDeep });
    out.push({ x: mid - 3, y: mid - 3, w: 7, h: 1, c: PALETTE.smoke });
    out.push({ x: mid - 4, y: mid - 2, w: 9, h: 1, c: PALETTE.smoke });
    out.push({ x: mid - 3, y: mid - 1, w: 7, h: 5, c: PALETTE.dirt });
    out.push({ x: mid - 2, y: mid, w: 1, h: 1, c: PALETTE.gold });
    out.push({ x: mid + 2, y: mid, w: 1, h: 1, c: PALETTE.gold });
    out.push({ x: mid, y: mid + 2, w: 1, h: 2, c: PALETTE.goldRose }); // the open door
  }
  if (entry.cave) {
    // A black mouth under a rock brow.
    out.push({ x: mid - 3, y: mid - 2, w: 7, h: 1, c: PALETTE.smoke });
    out.push({ x: mid - 4, y: mid - 1, w: 9, h: 1, c: PALETTE.smokeDeep });
    out.push({ x: mid - 3, y: mid, w: 7, h: 4, c: PALETTE.void });
    out.push({ x: mid, y: mid + 1, w: 1, h: 1, c: PALETTE.violet }); // the glint
  }
  if (entry.town) {
    // The ghost town: two leaning facades, dark windows, an empty street.
    out.push({ x: mid - 4, y: mid - 2, w: 4, h: 4, c: PALETTE.dusk });
    out.push({ x: mid + 1, y: mid - 3, w: 4, h: 5, c: PALETTE.plumDeep });
    out.push({ x: mid - 3, y: mid - 1, w: 1, h: 1, c: PALETTE.void });
    out.push({ x: mid + 2, y: mid - 2, w: 1, h: 1, c: PALETTE.void });
    out.push({ x: mid - 5, y: mid + 2, w: 11, h: 1, c: PALETTE.soil }); // main street
  }
  if (entry.island) {
    // Land in the ring of sea, with the shrine's stone on it.
    out.push({ x: mid - 4, y: mid - 2, w: 9, h: 1, c: PALETTE.waterEdge });
    out.push({ x: mid - 4, y: mid + 2, w: 9, h: 1, c: PALETTE.waterEdge });
    out.push({ x: mid - 3, y: mid - 1, w: 7, h: 3, c: PALETTE.loam });
    out.push({ x: mid, y: mid, w: 1, h: 1, c: PALETTE.smoke }); // the shrine
  }
  if (entry.qtown) {
    // Queue Town (v0.21): a crooked tower silhouette — magenta finial,
    // leaning cone, one lit arcane window — and the sign's glyph-dot.
    out.push({ x: mid + 1, y: mid - 6, w: 1, h: 1, c: PALETTE.magenta }); // the finial
    out.push({ x: mid, y: mid - 5, w: 3, h: 2, c: PALETTE.plum }); // the cone
    out.push({ x: mid - 1, y: mid - 3, w: 5, h: 1, c: PALETTE.plumDeep }); // its eaves
    out.push({ x: mid, y: mid - 2, w: 3, h: 6, c: PALETTE.dusk }); // the stone body
    out.push({ x: mid + 1, y: mid, w: 1, h: 1, c: PALETTE.violet }); // a window hums
    out.push({ x: mid - 3, y: mid + 3, w: 1, h: 1, c: PALETTE.violet }); // the sign dot
  }
  if (entry.god) {
    // God is here: a small gold cross of light on the lake shore.
    out.push({ x: mid + 2, y: mid - 1, w: 1, h: 3, c: PALETTE.gold });
    out.push({ x: mid + 1, y: mid, w: 3, h: 1, c: PALETTE.gold });
    out.push({ x: mid + 2, y: mid, w: 1, h: 1, c: PALETTE.goldRose });
  }
  return out;
}

export function uiButtons(game) {
  const h = GLYPH_H + BUTTON_PAD * 2;
  const y = SCREEN_H - h - 4;
  const buttons = [];
  if (game.together) {
    const swapW = measureText('SWAP') + BUTTON_PAD * 2;
    const ballW = measureText('BALL') + BUTTON_PAD * 2;
    buttons.push(
      { id: 'swap', label: 'SWAP', x: 4, y, w: swapW, h },
      { id: 'action', label: 'BALL', x: SCREEN_W - ballW - 4, y, w: ballW, h },
    );
  }
  return buttons;
}

// One lookup for every generic-interior furnishing: mansion2's pieces are
// authored in structures.js against the mansion FURNISH_COLORS ramp; the
// cathedral's live in creatures.js; the cabin's and office's in town.js;
// the shop kinds (counter, weaponrack, wandcase, bookshelf, scrollrack,
// inkdesk) ship from qtown.js already shaped { map, colors } (v0.21).
// ('rug' is absent on purpose — it reuses the mansion's dithered-oval code.)
const INTERIOR_FURNISH_ART = {
  bed: { map: BED_SPRITE, colors: FURNISH_COLORS },
  nightstand: { map: NIGHTSTAND_SPRITE, colors: FURNISH_COLORS },
  telescope: { map: TELESCOPE_SPRITE, colors: FURNISH_COLORS },
  desk2: { map: DESK2_SPRITE, colors: FURNISH_COLORS },
  portrait2: { map: PORTRAIT2_SPRITE, colors: FURNISH_COLORS },
  ...CATHEDRAL_FURNISH_ART,
  ...CABIN_FURNISH_ART,
  ...OFFICE_FURNISH_ART,
  ...SHOP_FURNISH,
};

/**
 * Anchored (base-center, negative y up) offsets of a big facade's chars —
 * the small overlay sets the animated touches repaint over the cached base.
 */
function anchoredPixels(map, chars) {
  const w = map[0].length;
  const h = map.length;
  const out = [];
  map.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      if (chars.includes(row[x])) out.push({ x: x - Math.floor(w / 2), y: y - h, ch: row[x] });
    }
  });
  return out;
}

// The big cabin's window glass ('W') and its amber spill ('a') — the base
// canvas bakes them lit (their usual state); the dark beat overlays fog
// glass and puts the log wall back where the glow fell.
const BIG_CABIN_WINDOW_PX = anchoredPixels(BIG_CABIN_SPRITE, 'Wa');
// The big mansion's attic pane ('A') — void in the base, brass when
// mansionAtticLit decides somebody who isn't there turns the light on.
const BIG_MANSION_ATTIC_PX = anchoredPixels(BIG_MANSION_SPRITE, 'A');

// Per-style interior dressing (night PALETTE keys only — the cathedral sits
// in heaven, where the standard draw-time remap brightens these to gold).
const INTERIOR_STYLES = {
  mansion: {
    floor: PALETTE.parquet, seam: PALETTE.umbra,
    wallFace: PALETTE.plumDeep, wallTrim: PALETTE.smokeDeep, wallCap: PALETTE.umbra,
    stud: PALETTE.umbra, mat: PALETTE.plumDeep, matTrim: PALETTE.brass,
  },
  cathedral: {
    floor: PALETTE.amber, seam: PALETTE.brass,
    wallFace: PALETTE.brass, wallTrim: PALETTE.gold, wallCap: PALETTE.amber,
    stud: PALETTE.amber, mat: PALETTE.gold, matTrim: PALETTE.goldRose,
  },
  cabin: {
    floor: PALETTE.dirt, seam: PALETTE.soil,
    wallFace: PALETTE.clay, wallTrim: PALETTE.loam, wallCap: PALETTE.soil,
    stud: PALETTE.soil, mat: PALETTE.soil, matTrim: PALETTE.brass,
  },
  office: {
    floor: PALETTE.dusk, seam: PALETTE.umbra,
    wallFace: PALETTE.plumDeep, wallTrim: PALETTE.smokeDeep, wallCap: PALETTE.umbra,
    stud: PALETTE.umbra, mat: PALETTE.soil, matTrim: PALETTE.brass,
  },
  // v0.21: Queue Town's two shops — warm timber under candlelight. Soil/clay
  // planks, an amber wash on the door mat, brass trim where a candle finds it.
  shop: {
    floor: PALETTE.clay, seam: PALETTE.soil,
    wallFace: PALETTE.dirt, wallTrim: PALETTE.loam, wallCap: PALETTE.soil,
    stud: PALETTE.soil, mat: PALETTE.amber, matTrim: PALETTE.brass,
  },
};

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas 320x200 target canvas
   * @param {(w: number, h: number) => HTMLCanvasElement} createCanvas
   *   factory for offscreen cache canvases (defaults to document.createElement)
   */
  constructor(canvas, createCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.baseCtx = this.ctx; // the raw context; this.ctx swaps per plane
    this.heavenCtx = null; // built lazily on first ascent
    this.plane = 'night';
    this.createCanvas =
      createCanvas ??
      ((w, h) => {
        const c = canvas.ownerDocument.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
      });
    this.treeCache = new Map();
    this.frame = 0;
    this.camX = 0;
    this.camY = 0;
    this.camInit = false;
    this.showTouchUI = false; // main.js flips this on for coarse pointers
    this.lastViewX = null; // view origin of the most recent frame
    this.lastViewY = null;
    this.lastLocation = 'world'; // which scene the last frame belonged to
  }

  /** Map a point on the 320x200 screen to world coordinates. */
  /**
   * The neon outline for whatever the pointer rests on (soft pulse) or the
   * person is walking over to talk to (hot pulse). Drawn on the ground
   * layer so the sprite sits on its own glow.
   */
  drawInteractGlow(game, viewX, viewY) {
    const ctx = this.ctx;
    const targets = [];
    if (game.pendingInteract) targets.push({ t: game.pendingInteract, hot: true });
    if (
      game.hover &&
      !game.choice &&
      game.hover.key !== game.pendingInteract?.key
    ) {
      targets.push({ t: game.hover, hot: false });
    }
    for (const { t, hot } of targets) {
      const gx = t.x - viewX;
      const gy = t.y - viewY;
      if (gx < -40 || gy < -40 || gx > SCREEN_W + 40 || gy > SCREEN_H + 40) continue;
      const pulse = 0.5 + 0.5 * Math.sin(game.time * (hot ? 7 : 4.5));
      const r = (t.r ?? 14) + 2 + pulse * 3;
      const steps = Math.max(26, Math.round(r * 2.4));
      ctx.fillStyle = hot ? PALETTE.hotRose : PALETTE.magenta;
      for (let i = 0; i < steps; i++) {
        if (!hot && pulse < 0.55 && i % 2 === 1) continue; // the dim phase dithers
        const a = (i / steps) * Math.PI * 2;
        ctx.fillRect(Math.round(gx + Math.cos(a) * r), Math.round(gy + Math.sin(a) * r * 0.55), 1, 1);
      }
      if (pulse > 0.8) {
        ctx.fillStyle = PALETTE.orchid; // a crest shimmer above the ring
        ctx.fillRect(Math.round(gx), Math.round(gy - Math.round(r * 0.55) - 3), 1, 1);
      }
    }
  }

  screenToWorld(sx, sy) {
    const viewX = this.lastViewX ?? this.camX - SCREEN_W / 2;
    const viewY = this.lastViewY ?? this.camY - SCREEN_H / 2;
    return { x: viewX + sx, y: viewY + sy };
  }

  /**
   * Heaven, at the draw layer (v0.17): a proxy over the 2d context that
   * remaps every fillStyle through the night→heaven palette table as it is
   * assigned. One indirection re-themes the whole game — ground, trees,
   * panels, text, sprites — without any art module knowing heaven exists.
   * Methods are bound (and cached) so native contexts don't see an illegal
   * receiver.
   */
  wrapHeaven(ctx) {
    const bound = new Map();
    return new Proxy(ctx, {
      get(target, prop) {
        const v = target[prop];
        if (typeof v === 'function') {
          let b = bound.get(prop);
          if (!b) {
            b = v.bind(target);
            bound.set(prop, b);
          }
          return b;
        }
        return v;
      },
      set(target, prop, value) {
        target[prop] = prop === 'fillStyle' ? heavenColor(value) : value;
        return true;
      },
    });
  }

  /** Point this.ctx at the right plane's context for this frame. */
  setPlane(plane) {
    this.plane = plane;
    if (plane === 'heaven') {
      this.heavenCtx ??= this.wrapHeaven(this.baseCtx);
      this.ctx = this.heavenCtx;
    } else {
      this.ctx = this.baseCtx;
    }
  }

  /**
   * Rasterize (and cache) a tree's block cloud onto its own canvas.
   * The key includes every field treePixels() reads — detailSeed alone
   * collides across distinct trees (independent 32-bit draws).
   *
   * v0.21, the garland twinkle: treePixels(tree, time) animates only the
   * light pixels, so `time` joins the cache key QUANTIZED to 0.25s buckets.
   * Chosen over the uncached-overlay alternative (re-running treePixels
   * every frame and diffing against the time-0 set) because a bucketed
   * re-rasterize touches each visible tree only once per bucket (a handful
   * per 15fps frame, well inside the budget), keeps the draw itself a
   * single blit, and can never strand a stale flare-halo pixel on the base
   * canvas the way a positional diff would. finishFrame sweeps dead buckets
   * aggressively so the cache stays capped.
   */
  treeSprite(tree, time = 0) {
    // 0.25s twinkle buckets — but only conifers wear garlands; bushes are
    // time-invariant, so they key at bucket 0 and never churn the cache.
    const bucket = tree.kind === 'tree' ? Math.floor(time * 4) : 0;
    const key = `${this.plane}:${tree.kind}:${tree.variant}:${tree.size}:${tree.detailSeed}:${bucket}`;
    let entry = this.treeCache.get(key);
    if (!entry) {
      const geo = treePixels(tree, bucket / 4);
      const w = geo.maxX - geo.minX + 1;
      const h = geo.maxY - geo.minY + 1;
      const c = this.createCanvas(w, h);
      const g = c.getContext('2d');
      for (const p of geo.pixels) {
        g.fillStyle = this.plane === 'heaven' ? heavenColor(p.c) : p.c;
        g.fillRect(p.x - geo.minX, p.y - geo.minY, BLOCK_W, BLOCK_H);
      }
      entry = { canvas: c, offX: geo.minX, offY: geo.minY, lastUsed: 0 };
      this.treeCache.set(key, entry);
    }
    entry.lastUsed = this.frame;
    return entry;
  }

  /**
   * Drop sprites not drawn recently, so an endless wander doesn't accumulate
   * offscreen canvases forever. Regeneration is deterministic, so this is
   * lossless — a revisited tree re-rasterizes identically.
   */
  sweepCache(maxSize = 400, staleFrames = 120) {
    if (this.treeCache.size <= maxSize) return;
    for (const [key, entry] of this.treeCache) {
      if (this.frame - entry.lastUsed > staleFrames) this.treeCache.delete(key);
    }
  }

  /**
   * Rasterize (and cache) a static structure facade, anchored bottom-center.
   * The v0.21 big facades run to 230x170 — repainting ~39k fillRects per
   * building per frame is the wrong trade at 15fps, so like trees they
   * rasterize once per (plane, key) and blit. Animated touches (the cabin
   * window, the mansion attic) repaint as small overlays on the blit.
   */
  structureSprite(key, map, colors) {
    const cacheKey = `st:${this.plane}:${key}`;
    let entry = this.treeCache.get(cacheKey);
    if (!entry) {
      const w = map[0].length;
      const h = map.length;
      const c = this.createCanvas(w, h);
      const g = c.getContext('2d');
      for (let y = 0; y < h; y++) {
        const row = map[y];
        for (let x = 0; x < w; x++) {
          const ch = row[x];
          if (ch === '.') continue;
          const col = colors[ch] ?? PALETTE.smoke;
          g.fillStyle = this.plane === 'heaven' ? heavenColor(col) : col;
          g.fillRect(x, y, 1, 1);
        }
      }
      entry = { canvas: c, offX: -Math.floor(w / 2), offY: -h, lastUsed: 0 };
      this.treeCache.set(cacheKey, entry);
    }
    entry.lastUsed = this.frame;
    return entry;
  }

  /**
   * 16-bit window chrome: fog fill, a violet outer line, a dusky inner
   * inset, and moonlit corner pips — the FF window, gone noir.
   */
  drawPanelChrome(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.fog;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PALETTE.purple;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = PALETTE.smokeDeep;
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
    ctx.fillRect(x + 2, y + h - 3, w - 4, 1);
    ctx.fillRect(x + 2, y + 2, 1, h - 4);
    ctx.fillRect(x + w - 3, y + 2, 1, h - 4);
    ctx.fillStyle = PALETTE.moonlight;
    for (const [px, py] of [
      [x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2],
    ]) {
      ctx.fillRect(px, py, 2, 2);
    }
  }

  /** A soft two-row ground shadow under a creature — 16-bit grounding. */
  drawShadow(cx, cy, w) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.umbra;
    ctx.fillRect(Math.round(cx - w / 2), cy, w, 1);
    ctx.fillRect(Math.round(cx - w / 2) + 1, cy + 1, Math.max(1, w - 2), 1);
  }

  drawSpriteMap(map, x, y, flip = false) {
    const { w } = spriteSize(map);
    const ctx = this.ctx;
    for (let row = 0; row < map.length; row++) {
      const line = map[row];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === '.') continue;
        ctx.fillStyle = SPRITE_COLORS[ch] ?? PALETTE.moonlight;
        const px = flip ? x + (w - 1 - col) : x + col;
        ctx.fillRect(px, y + row, 1, 1);
      }
    }
  }

  drawText(text, centerX, topY, color = PALETTE.moonlight) {
    const ctx = this.ctx;
    const x0 = Math.round(centerX - measureText(text) / 2);
    ctx.fillStyle = color;
    for (const p of textPixels(text)) ctx.fillRect(x0 + p.x, topY + p.y, 1, 1);
  }

  /**
   * The dotted leash: a slightly sagging run of marching dots between the
   * person's hand and the dog's neck, cycling magenta/violet/blue.
   */
  drawLeash(game, viewX, viewY) {
    const p = game.person;
    const d = game.dog;
    const x1 = p.x + (d.x >= p.x ? 5 : -5);
    const y1 = p.y - 17; // the lanky person's hand rides higher (v0.17)
    const x2 = d.x - d.facing * 8;
    const y2 = d.y - 8;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 4) return;
    const sag = Math.min(6, dist * 0.12);
    const steps = Math.max(2, Math.round(dist / 4));
    const ctx = this.ctx;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Quadratic bezier through a sagging midpoint.
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 + sag;
      const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2;
      const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
      ctx.fillStyle = LEASH_COLORS[(i + this.frame) % LEASH_COLORS.length];
      ctx.fillRect(Math.round(bx - viewX), Math.round(by - viewY), 1, 1);
    }
  }

  /**
   * Text with a 1px void drop shadow (+1,+1) — the canonical SNES trick
   * that keeps HUD lines and captions legible over busy dither.
   */
  drawShadowedText(text, cx, y, color) {
    this.drawText(text, cx + 1, y + 1, PALETTE.void);
    this.drawText(text, cx, y, color);
  }

  /** Wrapped caption anchored above a character, clamped to the screen. */
  drawCaption(text, anchorScreenX, anchorScreenY, color = PALETTE.moonlight) {
    const lines = wrapText(text, captionMaxW());
    const lineH = GLYPH_H + LINE_GAP;
    let top = Math.round(anchorScreenY) - 39 - lines.length * lineH;
    top = Math.max(4, Math.min(top, SCREEN_H - lines.length * lineH - 4));
    lines.forEach((line, i) => {
      const w = measureText(line);
      let cx = Math.round(anchorScreenX);
      cx = Math.max(2 + w / 2, Math.min(cx, SCREEN_W - 2 - w / 2));
      this.drawShadowedText(line, cx, top + i * lineH, color);
    });
  }

  /** Draw one frame of the game. dt is the real time since the last frame. */
  render(game, dt = 1 / RENDER_FPS) {
    this.setPlane(game.plane ?? 'night');
    const ctx = this.ctx;
    this.frame++;
    if (game.location !== 'world') {
      // Any roofed place. The ground-floor mansion keeps its bespoke scene
      // (byte-identical to before v0.20); every other interior renders from
      // its INTERIORS spec.
      if (game.location === 'mansion') this.renderMansionScene(game);
      else this.renderInteriorScene(game);
      this.drawUi(game);
      this.finishFrame(game);
      return;
    }
    const cam = this.updateCamera(game, dt);
    const viewX = cam.x - SCREEN_W / 2;
    const viewY = cam.y - SCREEN_H / 2;
    this.lastViewX = viewX;
    this.lastViewY = viewY;
    this.lastLocation = 'world';

    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Terrain ground pass, 16-bit edition: deep still water with a lighter
    // shelf where it meets the shore, bridge planks, a sparse deterministic
    // floor speckle per biome (the void gains a texture without losing its
    // dark), and grass tufts. Sampled in 4px blocks — cheap, chunky.
    const seed = game.world.seed;
    const B = 4;
    for (let sy = 0; sy < SCREEN_H; sy += B) {
      for (let sx = 0; sx < SCREEN_W; sx += B) {
        const wx = viewX + sx + B / 2;
        const wy = viewY + sy + B / 2;
        if (isWater(seed, wx, wy)) {
          const shore =
            !isWater(seed, wx - B, wy) || !isWater(seed, wx + B, wy) ||
            !isWater(seed, wx, wy - B) || !isWater(seed, wx, wy + B);
          ctx.fillStyle = shore ? PALETTE.waterEdge : PALETTE.waterDeep;
          ctx.fillRect(sx, sy, B, B);
          if (!shore) {
            // Moonlight on still water: world-anchored and hash-jittered so
            // the glints ride the water instead of sticking to the glass.
            const wc = hashCoords(seed ^ 0x77a7e412, Math.floor(wx / B), Math.floor(wy / B));
            if (((wc >> 4) % 9) === (Math.floor(game.time * 2) % 9)) {
              ctx.fillStyle = PALETTE.blue;
              ctx.fillRect(sx + (wc & 1), sy + ((wc >> 1) & 3), 2, 1);
            }
          }
        } else if (onBridge(seed, wx, wy)) {
          ctx.fillStyle = PALETTE.plumDeep;
          ctx.fillRect(sx, sy, B, B);
          ctx.fillStyle = PALETTE.smokeDeep;
          ctx.fillRect(sx, sy + 1, B, 1);
        } else {
          // The forest floor: mostly void — the dark is the point, and the
          // owner likes it — with dirt surfacing only in drifts, the way
          // bare earth shows through leaf litter at night. Three octaves:
          // two smoothed (so patches fade into each other instead of tiling
          // the screen into squares) plus a per-cell grain. Seven cells in
          // ten stay pure void, and most of what's left is only a shade off
          // it: the world reads as a violet-black emptiness that happens to
          // have ground in it, not as ground with some dark on top.
          const cellX = Math.floor(wx / B);
          const cellY = Math.floor(wy / B);
          const biome = biomeAt(seed, Math.floor(wx / REGION), Math.floor(wy / REGION));
          if (biome === 'desert' || biome === 'beach' || biome === 'glacier' || biome === 'island') {
            // Heaven's sun-struck grounds (v0.20) get their own treatment;
            // the heaven remap does the brightening. Night biomes never
            // reach this branch, so their floors stay byte-identical.
            this.drawHeavenGround(biome, seed, sx, sy, cellX, cellY, B);
          } else {
            const coarse = groundNoise(seed ^ 0x50113100, cellX, cellY, 9);
            const mid = groundNoise(seed ^ 0x5011a300, cellX, cellY, 3);
            const fine = hashCoords(seed ^ 0x5011f100, cellX, cellY) / 0x100000000;
            const v = coarse * 0.5 + mid * 0.28 + fine * 0.22;
            if (v >= 0.58) {
              ctx.fillStyle = v < 0.66 ? PALETTE.night : v < 0.72 ? PALETTE.soil : PALETTE.dirt;
              ctx.fillRect(sx, sy, B, B);
            }
            const h = hashCoords(seed ^ 0x6a1120dd, cellX, cellY);
            if ((h & 15) === 0) {
              // Grit: a trodden clay speck, or a fleck of dark growth.
              const grassy = biome === 'grass';
              ctx.fillStyle = (h >> 9) & 1 ? (grassy ? PALETTE.moss : PALETTE.clay) : PALETTE.umbra;
              ctx.fillRect(sx + ((h >> 4) & 3), sy + ((h >> 6) & 3), 1, 1);
            }
          }
        }
      }
    }
    ctx.fillStyle = PALETTE.leaf;
    for (const t of game.world.tuftsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      const tx = Math.round(t.x - viewX);
      const ty = Math.round(t.y - viewY);
      for (const p of TUFT_PIXELS) ctx.fillRect(tx + p.x, ty + p.y, 1, 1);
    }

    // Angular stars twinkling in the dark — sharp 4-point spikes at the peak.
    for (const s of game.world.sparklesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      let glow = Math.sin(game.time * s.rate * 2 + s.phase);
      if (game.drunk > 0) glow = Math.max(glow, 0.7); // every star leans closer
      const pts = starPixels(glow, starSize(s));
      if (pts.length === 0) continue;
      const x = Math.round(s.x - viewX);
      const y = Math.round(s.y - viewY);
      const tints = this.plane === 'heaven' ? HEAVEN_SPARKLES : SPARKLE_TINTS;
      ctx.fillStyle = glow >= 0.9 ? (this.plane === 'heaven' ? PALETTE.goldRose : PALETTE.moonlight) : tints[s.tint % tints.length];
      for (const p of pts) ctx.fillRect(x + p.x, y + p.y, 1, 1);
    }

    // Tap-to-move marker: a neon ring collapsing onto the target.
    if (game.moveTarget) {
      const mx = Math.round(game.moveTarget.x - viewX);
      const my = Math.round(game.moveTarget.y - viewY);
      for (const p of targetMarkerPixels(game.time)) {
        ctx.fillStyle = p.c;
        ctx.fillRect(mx + p.x, my + p.y, 1, 1);
      }
    }

    // v0.21: interactables glow and pulse under the pointer / while walked to.
    this.drawInteractGlow(game, viewX, viewY);

    // The leash runs under the characters but over the ground.
    if (game.leashActive()) this.drawLeash(game, viewX, viewY);

    // Y-sorted world: trees, characters, ball — all by baseline.
    const drawables = [];
    for (const tree of game.world.treesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: tree.y,
        draw: () => {
          // game.time animates the garland twinkle (bucketed in the cache key).
          const s = this.treeSprite(tree, game.time);
          ctx.drawImage(s.canvas, Math.round(tree.x - viewX) + s.offX, Math.round(tree.y - viewY) + s.offY);
        },
      });
    }
    for (const d of game.world.dumpstersInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      const key = `d:${d.x},${d.y}`;
      drawables.push({
        y: d.y,
        draw: () => {
          const cxp = Math.round(d.x - viewX);
          const cyp = Math.round(d.y - viewY);
          if (this.plane === 'heaven') {
            // The same spot, the other side of the glass: a cathedral of
            // melted gold, its spire one course taller per donation, raga
            // light rising off the roof.
            const bx = cxp - Math.floor(CATHEDRAL_SPRITE[0].length / 2);
            const by = cyp - CATHEDRAL_SPRITE.length;
            CATHEDRAL_SPRITE.forEach((row, ry) => {
              for (let rx = 0; rx < row.length; rx++) {
                const ch = row[rx];
                if (ch === '.') continue;
                ctx.fillStyle = CATHEDRAL_COLORS[ch];
                ctx.fillRect(bx + rx, by + ry, 1, 1);
              }
            });
            for (const p of [...templeGrowthPixels(game.goldGiven), ...ragaPixels(game.time)]) {
              ctx.fillStyle = p.c;
              ctx.fillRect(cxp + p.x, cyp + p.y, 1, 1);
            }
            return;
          }
          const bx = cxp - Math.floor(DUMPSTER_SPRITE[0].length / 2);
          const by = cyp - DUMPSTER_SPRITE.length;
          DUMPSTER_SPRITE.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
              const ch = row[rx];
              if (ch === '.') continue;
              ctx.fillStyle = DUMPSTER_COLORS[ch];
              ctx.fillRect(bx + rx, by + ry, 1, 1);
            }
          });
          if (!game.dumpstersOut.has(key)) {
            for (const p of firePixels(game.time)) {
              ctx.fillStyle = p.c;
              ctx.fillRect(cxp + p.x, cyp + p.y, BLOCK_W, BLOCK_H);
            }
          }
        },
      });
    }
    for (const c of game.world.catsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      if (game.encounterDone.has(`c:${c.x},${c.y}`)) continue; // the cat is gone
      drawables.push({
        y: c.y,
        draw: () => {
          const bx = Math.round(c.x - viewX) - Math.floor(CAT_SPRITE[0].length / 2);
          const by = Math.round(c.y - viewY) - CAT_SPRITE.length;
          CAT_SPRITE.forEach((row, ry) => {
            ctx.fillStyle = catRowColor(ry, this.frame);
            for (let rx = 0; rx < row.length; rx++) {
              if (row[rx] !== '.') ctx.fillRect(bx + rx, by + ry, 1, 1);
            }
          });
        },
      });
    }
    const drawSpriteWithColors = (sprite, colors, bx, by, flip = false) => {
      const sw = sprite[0].length;
      sprite.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === '.') continue;
          ctx.fillStyle = colors[ch];
          ctx.fillRect(bx + (flip ? sw - 1 - rx : rx), by + ry, 1, 1);
        }
      });
    };
    for (const l of game.world.lampsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      if (game.encounterDone.has(`l:${l.x},${l.y}`)) continue; // wished away
      drawables.push({
        y: l.y,
        draw: () => {
          const lx = Math.round(l.x - viewX);
          const ly = Math.round(l.y - viewY);
          drawSpriteWithColors(LAMP_SPRITE, LAMP_COLORS, lx - Math.floor(LAMP_SPRITE[0].length / 2), ly - LAMP_SPRITE.length);
          for (const p of lampGlintPixels(game.time)) {
            ctx.fillStyle = p.c;
            ctx.fillRect(lx + p.x, ly + p.y, 1, 1);
          }
        },
      });
    }
    for (const pi of game.world.pipesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      if (game.encounterDone.has(`p:${pi.x},${pi.y}:taken`)) continue; // pocketed — gone
      const spent = game.encounterDone.has(`p:${pi.x},${pi.y}`); // smoked in place: lies there, smokeless
      drawables.push({
        y: pi.y,
        draw: () => {
          const px = Math.round(pi.x - viewX);
          const py = Math.round(pi.y - viewY);
          drawSpriteWithColors(PIPE_SPRITE, PIPE_COLORS, px - Math.floor(PIPE_SPRITE[0].length / 2), py - PIPE_SPRITE.length);
          if (!spent) {
            for (const p of pipeSmokePixels(game.time)) {
              ctx.fillStyle = p.c;
              ctx.fillRect(px + p.x, py + p.y, 1, 1);
            }
          }
        },
      });
    }
    // v0.21: zombies lock on and shamble — game.zombiePos carries the chase
    // offset, and the query rect pads by the leash so a zombie whose POST
    // slid offscreen still draws where it actually stands.
    for (const z of game.world.zombiesInRect(
      viewX - ZOMBIE_LEASH, viewY - ZOMBIE_LEASH,
      SCREEN_W + ZOMBIE_LEASH * 2, SCREEN_H + ZOMBIE_LEASH * 2,
    )) {
      if (game.encounterDone.has(`z:${z.x},${z.y}`)) continue; // crumbled
      const zpos = game.zombiePos(z);
      drawables.push({
        y: zpos.y,
        draw: () => {
          if (this.plane === 'heaven') {
            // The zombie's spot holds an angel up here: it hovers a slow
            // pixel instead of lurching, and casts no shadow at all.
            const ax = Math.round(zpos.x - viewX) - Math.floor(ANGEL_SPRITE[0].length / 2);
            const ay = Math.round(zpos.y - viewY) - ANGEL_SPRITE.length + angelBob(game.time, z.phase);
            drawSpriteWithColors(ANGEL_SPRITE, ANGEL_COLORS, ax, ay);
            return;
          }
          const zx = Math.round(zpos.x - viewX) - Math.floor(ZOMBIE_SPRITE[0].length / 2) + zombieSway(game.time, z.phase);
          const zy = Math.round(zpos.y - viewY) - ZOMBIE_SPRITE.length;
          this.drawShadow(zpos.x - viewX, Math.round(zpos.y - viewY), 12);
          drawSpriteWithColors(ZOMBIE_SPRITE, ZOMBIE_COLORS, zx, zy);
        },
      });
    }
    for (const f of game.world.inflatablesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: f.y,
        draw: () => {
          const geo = inflatablePixels(f, game.time);
          const bx = Math.round(f.x - viewX);
          const by = Math.round(f.y - viewY);
          for (const p of geo.pixels) {
            ctx.fillStyle = p.c;
            ctx.fillRect(bx + p.x, by + p.y, BLOCK_W, BLOCK_H);
          }
        },
      });
    }
    for (const r of game.world.rocksInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: r.y,
        draw: () => {
          const bx = Math.round(r.x - viewX);
          const by = Math.round(r.y - viewY);
          for (const p of rockPixels(r.size, r.detailSeed)) {
            ctx.fillStyle = p.c;
            ctx.fillRect(bx + p.x, by + p.y, 1, 1);
          }
        },
      });
    }
    // v0.21 big facades. The accessors' pads predate the big sprites, so the
    // query RECT grows here (per world.js's contract — never the pad there):
    // enough that an anchor just past the old pad still paints its facade.
    for (const c of game.world.cabinsInRect(viewX - 30, viewY, SCREEN_W + 60, SCREEN_H + 30)) {
      drawables.push({
        y: c.y,
        draw: () => {
          const bx = Math.round(c.x - viewX);
          const by = Math.round(c.y - viewY);
          const s = this.structureSprite('big-cabin', BIG_CABIN_SPRITE, BIG_CABIN_COLORS);
          ctx.drawImage(s.canvas, bx + s.offX, by + s.offY);
          if (!cabinWindowLit(game.time)) {
            // The dark beat: fog glass, and the log wall back under the glow.
            for (const p of BIG_CABIN_WINDOW_PX) {
              ctx.fillStyle = p.ch === 'W' ? PALETTE.fog : PALETTE.dirt;
              ctx.fillRect(bx + p.x, by + p.y, 1, 1);
            }
          }
        },
      });
    }
    // The mansion is 230x170 — the tallest thing in the woods, so the widest
    // query bump of the lot.
    for (const m of game.world.mansionsInRect(viewX - 32, viewY, SCREEN_W + 64, SCREEN_H + 32)) {
      drawables.push({
        y: m.y,
        draw: () => {
          const bx = Math.round(m.x - viewX);
          const by = Math.round(m.y - viewY);
          const s = this.structureSprite('big-mansion', BIG_MANSION_SPRITE, BIG_MANSION_COLORS);
          ctx.drawImage(s.canvas, bx + s.offX, by + s.offY);
          if (mansionAtticLit(game.time)) {
            // Nobody is up there. The light disagrees.
            ctx.fillStyle = PALETTE.brass;
            for (const p of BIG_MANSION_ATTIC_PX) ctx.fillRect(bx + p.x, by + p.y, 1, 1);
          }
        },
      });
    }
    for (const c of game.world.cavesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: c.y,
        draw: () => {
          const bx = Math.round(c.x - viewX) - CAVE_SPRITE[0].length / 2;
          const by = Math.round(c.y - viewY) - CAVE_SPRITE.length;
          drawSpriteWithColors(CAVE_SPRITE, CAVE_COLORS, bx, by);
          if (caveGlint(game.time)) {
            ctx.fillStyle = PALETTE.violet;
            ctx.fillRect(Math.round(c.x - viewX), Math.round(c.y - viewY) - 3, 1, 1);
          }
        },
      });
    }

    // --- The ghost town (night, v0.20; big facades v0.21). Every accessor
    // is empty on heaven seeds, so none of this needs a plane check. The
    // ruins run to 150x110, past the accessor's pad — the query rect grows.
    for (const ru of game.world.ruinsInRect(viewX - 40, viewY, SCREEN_W + 80, SCREEN_H + 40)) {
      const variant = ru.variant % BIG_RUIN_SPRITES.length;
      const art = BIG_RUIN_SPRITES[variant];
      drawables.push({
        y: ru.y,
        draw: () => {
          const s = this.structureSprite(`big-ruin:${variant}`, art.map, art.colors);
          ctx.drawImage(s.canvas, Math.round(ru.x - viewX) + s.offX, Math.round(ru.y - viewY) + s.offY);
        },
      });
    }
    for (const ts of game.world.townsignsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: ts.y,
        draw: () => drawSpriteWithColors(
          TOWN_SIGN_SPRITE, TOWN_SIGN_COLORS,
          Math.round(ts.x - viewX) - Math.floor(TOWN_SIGN_SPRITE[0].length / 2),
          Math.round(ts.y - viewY) - TOWN_SIGN_SPRITE.length,
        ),
      });
    }
    for (const p of game.world.pirtsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: p.y,
        draw: () => {
          // Pirts bobs, slow and deterministic — dead, but open for business.
          const bob = Math.sin(game.time * 0.9 + p.x * 0.05) > 0 ? 0 : 1;
          drawSpriteWithColors(
            PIRTS_SPRITE, PIRTS_COLORS,
            Math.round(p.x - viewX) - Math.floor(PIRTS_SPRITE[0].length / 2),
            Math.round(p.y - viewY) - PIRTS_SPRITE.length + bob,
          );
        },
      });
    }
    for (const gh of game.world.ghostsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      if (game.encounterDone.has(`gh:${gh.x},${gh.y}`)) continue; // the signal dropped for good
      const pos = ghostPos(gh, game.time);
      drawables.push({
        y: pos.y,
        draw: () => this.drawGhost(game, gh, pos, viewX, viewY),
      });
    }
    for (const o of game.world.officesInRect(viewX - 24, viewY, SCREEN_W + 48, SCREEN_H + 24)) {
      drawables.push({
        y: o.y,
        draw: () => {
          // The bail-bonds office, at town scale (v0.21): brick under a
          // moonlit cornice, the amber BB window and lit transom baked into
          // the sprite, its open doorway aligned with world.collides's gap.
          const s = this.structureSprite('big-office', BIG_OFFICE_SPRITE, BIG_OFFICE_COLORS);
          ctx.drawImage(s.canvas, Math.round(o.x - viewX) + s.offX, Math.round(o.y - viewY) + s.offY);
        },
      });
    }

    // --- Queue Town (night, v0.21): towers, the two shops, the sign, and
    // the wizards sulking between them. Accessors are empty off-qtown.
    for (const t of game.world.towersInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: t.y,
        draw: () => {
          const s = this.structureSprite('tower', TOWER_SPRITE, TOWER_COLORS);
          ctx.drawImage(s.canvas, Math.round(t.x - viewX) + s.offX, Math.round(t.y - viewY) + s.offY);
        },
      });
    }
    for (const [field, key, art] of [
      ['cortiesInRect', 'shop-cortie', SHOP_CORTIE_SPRITE],
      ['queebeesInRect', 'shop-queebee', SHOP_QUEEBEE_SPRITE],
    ]) {
      for (const sh of game.world[field](viewX, viewY, SCREEN_W, SCREEN_H)) {
        drawables.push({
          y: sh.y,
          draw: () => {
            const s = this.structureSprite(key, art.map, art.colors);
            ctx.drawImage(s.canvas, Math.round(sh.x - viewX) + s.offX, Math.round(sh.y - viewY) + s.offY);
          },
        });
      }
    }
    for (const qs of game.world.qtownsignsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: qs.y,
        draw: () => drawSpriteWithColors(
          QTOWN_SIGN_SPRITE, QTOWN_SIGN_COLORS,
          Math.round(qs.x - viewX) - Math.floor(QTOWN_SIGN_SPRITE[0].length / 2),
          Math.round(qs.y - viewY) - QTOWN_SIGN_SPRITE.length,
        ),
      });
    }
    for (const w of game.world.wizardsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: w.y,
        draw: () => {
          const art = WIZARD_SPRITES[w.variant % WIZARD_SPRITES.length];
          const grump = wizardGrump(game.time, w.phase);
          // dy slumps the whole figure a pixel; dx shakes only the head rows
          // (everything above the first robe row — the body stays planted);
          // 'tap' lifts the staff pixels a pixel for the beat.
          const wx = Math.round(w.x - viewX) - Math.floor(art.map[0].length / 2);
          const wy = Math.round(w.y - viewY) - art.map.length + grump.dy;
          this.drawShadow(w.x - viewX, Math.round(w.y - viewY), 12);
          const shoulders = art.map.findIndex((row) => row.includes('r'));
          art.map.forEach((row, ry) => {
            const rowDx = ry < shoulders ? grump.dx : 0;
            for (let rx = 0; rx < row.length; rx++) {
              const ch = row[rx];
              if (ch === '.') continue;
              const lift = grump.frame === 'tap' && (ch === 's' || ch === 'S') ? -1 : 0;
              ctx.fillStyle = art.colors[ch];
              ctx.fillRect(wx + rx + rowDx, wy + ry + lift, 1, 1);
            }
          });
        },
      });
    }

    // --- Heaven's residents (v0.20): signposts to God, God, the frogs who
    // menace Him, the minotaur pacing his maze, the island shrine.
    const god = this.plane === 'heaven' ? godSpot(seed) : null;
    for (const s of game.world.signsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: s.y,
        draw: () => {
          const sx = Math.round(s.x - viewX);
          const sy = Math.round(s.y - viewY);
          drawSpriteWithColors(
            SIGNPOST_SPRITE, SIGNPOST_COLORS,
            sx - Math.floor(SIGNPOST_SPRITE[0].length / 2), sy - SIGNPOST_SPRITE.length,
          );
          if (god) {
            for (const px of signArrowPixels(Math.atan2(god.y - s.y, god.x - s.x))) {
              ctx.fillStyle = px.c;
              ctx.fillRect(sx + px.x, sy + px.y, 1, 1);
            }
          }
        },
      });
    }
    const inView = (p, pad = 24) =>
      p.x >= viewX - pad && p.x <= viewX + SCREEN_W + pad &&
      p.y >= viewY - pad && p.y <= viewY + SCREEN_H + pad;
    if (god && inView(god)) {
      drawables.push({
        y: god.y,
        draw: () => {
          const gx = Math.round(god.x - viewX);
          const gy = Math.round(god.y - viewY);
          drawSpriteWithColors(
            CRICKET_SPRITE, CRICKET_COLORS,
            gx - Math.floor(CRICKET_SPRITE[0].length / 2), gy - CRICKET_SPRITE.length,
          );
          for (const n of cricketChirp(game.time)) {
            ctx.fillStyle = n.c;
            ctx.fillRect(gx + n.x, gy + n.y, 1, 1);
          }
        },
      });
    }
    if (god) {
      for (const pad of lilypadsAt(seed)) {
        if (!inView(pad)) continue;
        drawables.push({
          y: pad.y,
          draw: () => {
            const lx = Math.round(pad.x - viewX);
            const ly = Math.round(pad.y - viewY);
            drawSpriteWithColors(
              LILYPAD_SPRITE, LILYPAD_COLORS,
              lx - Math.floor(LILYPAD_SPRITE[0].length / 2), ly - LILYPAD_SPRITE.length,
            );
            // The frog rides its pad, facing God (authored facing left).
            const fy = ly - 3;
            drawSpriteWithColors(
              FROG_SPRITE, FROG_COLORS,
              lx - Math.floor(FROG_SPRITE[0].length / 2), fy - FROG_SPRITE.length,
            );
            for (const t of frogMenace(game.time, pad.phase).tongue) {
              ctx.fillStyle = t.c;
              ctx.fillRect(lx + t.x, fy + t.y, 1, 1);
            }
          },
        });
      }
    }
    for (const m of game.world.minotaursInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      if (game.encounterDone.has(`mi:${m.x},${m.y}`)) continue; // the maze, at last, had an exit
      const pos = minotaurPos(m, game.time);
      drawables.push({
        y: pos.y,
        draw: () => {
          // The walk cycle follows the lissajous: when its velocity dies at
          // a turning point, he stands; otherwise the hooves alternate.
          const ahead = minotaurPos(m, game.time + 0.1);
          const speed = Math.hypot(ahead.x - pos.x, ahead.y - pos.y) / 0.1;
          const frame =
            speed < 4 ? 'stand' : Math.floor(game.time * 6) % 2 === 0 ? 'walkA' : 'walkB';
          const map = MINOTAUR_FRAMES[frame];
          this.drawShadow(pos.x - viewX, Math.round(pos.y - viewY), 16);
          drawSpriteWithColors(
            map, MINOTAUR_COLORS,
            Math.round(pos.x - viewX) - Math.floor(map[0].length / 2),
            Math.round(pos.y - viewY) - map.length,
            pos.facing < 0,
          );
        },
      });
    }
    for (const sh of game.world.shrinesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: sh.y,
        draw: () => drawSpriteWithColors(
          SHRINE_SPRITE, SHRINE_COLORS,
          Math.round(sh.x - viewX) - Math.floor(SHRINE_SPRITE[0].length / 2),
          Math.round(sh.y - viewY) - SHRINE_SPRITE.length,
        ),
      });
    }
    for (const ch of [game.person, game.dog]) {
      const frames =
        ch.kind === 'person' ? PERSON_FRAMES : this.plane === 'heaven' ? CERBERUS_FRAMES : DOG_FRAMES;
      const map = walkFrame(frames, ch.walking, ch.animTime, game.time);
      const { w, h } = spriteSize(map);
      // Only the person ever takes to the water; the dog never swims.
      const afloat = game.swimming && ch.kind === 'person';
      drawables.push({
        y: ch.y,
        draw: () => {
          const cxp = Math.round(ch.x - viewX);
          const cyp = Math.round(ch.y - viewY);
          if (afloat && game.hasBoat) {
            // The boat rides under them: no submersion, just passage.
            drawSpriteWithColors(
              BOAT_SPRITE, BOAT_COLORS,
              cxp - Math.floor(BOAT_SPRITE[0].length / 2), cyp - BOAT_SPRITE.length + 2,
              ch.facing < 0,
            );
            this.drawSpriteMap(map, Math.round(ch.x - viewX - w / 2), cyp - h - 3, ch.facing < 0);
            return;
          }
          if (afloat) {
            // Swimming: half the figure below the waterline, and slow
            // deterministic ripple rings spreading from it.
            const half = Math.ceil(h / 2);
            this.drawSpriteMap(
              map.slice(0, half),
              Math.round(ch.x - viewX - w / 2), cyp - half, ch.facing < 0,
            );
            for (const [lead, tint] of [[0, PALETTE.waterEdge], [0.5, PALETTE.blue]]) {
              const ph = (game.time * 1.2 + lead) % 1;
              const rad = 4 + Math.round(ph * 5);
              const ry = Math.max(1, Math.round(rad / 2));
              ctx.fillStyle = tint;
              ctx.fillRect(cxp - rad, cyp, 1, 1);
              ctx.fillRect(cxp + rad, cyp, 1, 1);
              ctx.fillRect(cxp - 1, cyp - ry, 2, 1);
              ctx.fillRect(cxp - 1, cyp + ry, 2, 1);
            }
            return;
          }
          this.drawShadow(ch.x - viewX, cyp, ch.kind === 'person' ? 12 : 15);
          this.drawSpriteMap(map, Math.round(ch.x - viewX - w / 2), cyp - h, ch.facing < 0);
        },
      });
    }
    if (game.ball) {
      const b = game.ball;
      drawables.push({
        y: b.y + 2,
        draw: () => this.drawSpriteMap(BALL_SPRITE, Math.round(b.x - viewX - 1), Math.round(b.y - viewY - 1)),
      });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // Hearts float above everything.
    for (const h of game.hearts) {
      const rise = Math.round((1.6 - h.t) * 6);
      this.drawSpriteMap(HEART_SPRITE, Math.round(h.x - viewX - 3), Math.round(h.y - viewY - rise));
    }

    // Caption above whoever you're playing, like the reference footage.
    if (game.caption) {
      const a = game.activeChar;
      this.drawCaption(
        game.caption.text,
        a.x - viewX,
        a.y - viewY,
        game.drunk > 0 ? PALETTE.magenta : PALETTE.moonlight,
      );
    }

    this.drawUi(game);
    this.finishFrame(game);
  }

  /**
   * The mansion interior — a single fixed screen, Maniac Mansion style:
   * parquet floors, paneled walls, a locked staircase, furnishings whose
   * details move (the pendulum, the flames, the portrait's eyes), and the
   * pair, y-sorted among them. The chandelier hangs above everything.
   */
  renderMansionScene(game) {
    const ctx = this.ctx;
    // Centered while the interior fits on screen; when the view is narrower
    // (portrait phones), the camera follows the person along that axis,
    // clamped to the interior's edges.
    const follow = (screen, interior, focus) =>
      screen >= interior
        ? -Math.round((screen - interior) / 2)
        : Math.round(Math.min(Math.max(focus - screen / 2, 0), interior - screen));
    const viewX = follow(SCREEN_W, INTERIOR_W, game.person.x);
    const viewY = follow(SCREEN_H, INTERIOR_H, game.person.y);
    this.lastViewX = viewX;
    this.lastViewY = viewY;
    this.lastLocation = 'mansion';
    this.camInit = false; // snap the outdoor camera when we step back out

    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    for (let cy = 0; cy < MANSION_MAP.length; cy++) {
      for (let cx = 0; cx < MANSION_MAP[0].length; cx++) {
        const ch = MANSION_MAP[cy][cx];
        const sx = cx * TILE - viewX;
        const sy = cy * TILE - viewY;
        if (ch === '.' || ch === 'D') {
          // Parquet: long horizontal planks — a course line every 8px and a
          // half-tile-staggered end seam per course, so it reads as floor,
          // not brickwork.
          ctx.fillStyle = PALETTE.parquet;
          ctx.fillRect(sx, sy, TILE, TILE);
          ctx.fillStyle = PALETTE.umbra;
          for (let py = 0; py < TILE; py += 8) {
            ctx.fillRect(sx, sy + py, TILE, 1);
            const seam = ((cy * TILE + py) / 8) % 2 === 0 ? 0 : 8;
            ctx.fillRect(sx + seam, sy + py, 1, 8);
          }
          if (ch === 'D') {
            ctx.fillStyle = PALETTE.plumDeep;
            ctx.fillRect(sx + 1, sy + 2, TILE - 2, TILE - 2); // the door mat
            ctx.fillStyle = PALETTE.brass;
            ctx.fillRect(sx + 1, sy + 2, TILE - 2, 1);
            // A knob on each leaf's inner edge, so it reads as a double door.
            ctx.fillRect(cx === 12 ? sx + TILE - 3 : sx + 2, sy + 8, 1, 2);
          }
        } else if (ch === 'L') {
          // The locked staircase: treads climbing brighter toward the top,
          // barred only across the lower half — stairs first, gate second.
          const TREADS = [PALETTE.smokeDeep, PALETTE.plum, PALETTE.smoke, PALETTE.moonshadow];
          for (let step = 0; step < 4; step++) {
            ctx.fillStyle = TREADS[step];
            ctx.fillRect(sx, sy + TILE - (step + 1) * 4, TILE, 4);
            ctx.fillStyle = PALETTE.umbra;
            ctx.fillRect(sx, sy + TILE - (step + 1) * 4 + 3, TILE, 1);
          }
          ctx.fillStyle = PALETTE.fog;
          for (let gx = 1; gx < TILE; gx += 5) ctx.fillRect(sx + gx, sy + TILE / 2, 1, TILE / 2);
          ctx.fillStyle = PALETTE.brass;
          ctx.fillRect(sx + TILE - 3, sy + 10, 1, 2); // the lock catches the light
        } else {
          // Wall: paneled face where it fronts the room, dark cap elsewhere.
          const below = cy + 1 < MANSION_MAP.length ? MANSION_MAP[cy + 1][cx] : '#';
          if (below === '.' || below === 'D' || below === 'L') {
            ctx.fillStyle = PALETTE.plumDeep;
            ctx.fillRect(sx, sy, TILE, TILE);
            ctx.fillStyle = PALETTE.smokeDeep;
            ctx.fillRect(sx, sy, TILE, 2);
            ctx.fillRect(sx, sy + TILE - 3, TILE, 1);
            ctx.fillStyle = PALETTE.umbra;
            ctx.fillRect(sx + (cx % 2 ? 4 : 10), sy + 4, 1, TILE - 8);
          } else {
            ctx.fillStyle = PALETTE.umbra;
            ctx.fillRect(sx, sy, TILE, TILE);
          }
        }
      }
    }

    // Tap-to-move works indoors too — show its marker on the parquet.
    if (game.moveTarget) {
      const mx = Math.round(game.moveTarget.x - viewX);
      const my = Math.round(game.moveTarget.y - viewY);
      for (const p of targetMarkerPixels(game.time)) {
        ctx.fillStyle = p.apex ? PALETTE.moonlight : LEASH_COLORS[p.tri % LEASH_COLORS.length];
        ctx.fillRect(mx + p.x, my + p.y, 1, 1);
      }
    }

    // The leash runs under the characters here too.
    if (game.leashActive() && game.together) this.drawLeash(game, viewX, viewY);

    // Furnishings and the pair, y-sorted; the chandelier floats above all.
    const drawables = [];
    for (const f of FURNISH) {
      drawables.push({
        y: f.kind === 'chandelier' ? 9999 : f.y,
        draw: () => this.drawFurnish(game, f, viewX, viewY),
      });
    }
    const cast = game.together ? [game.person, game.dog] : [game.person];
    for (const chr of cast) {
      const frames = chr.kind === 'person' ? PERSON_FRAMES : DOG_FRAMES;
      const map = walkFrame(frames, chr.walking, chr.animTime, game.time);
      const { w, h } = spriteSize(map);
      drawables.push({
        y: chr.y,
        draw: () => {
          this.drawShadow(chr.x - viewX, Math.round(chr.y - viewY), chr.kind === 'person' ? 12 : 15);
          this.drawSpriteMap(map, Math.round(chr.x - viewX - w / 2), Math.round(chr.y - viewY - h), chr.facing < 0);
        },
      });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    // The chandelier's light falls ON whatever is under it — rug included —
    // so the pool paints after the furnishings, dithered warm-plum.
    const chand = FURNISH.find((f) => f.kind === 'chandelier');
    if (chand) {
      ctx.fillStyle = PALETTE.plum;
      const px = chand.x - viewX;
      const py = 150 - viewY;
      for (let ry = -8; ry <= 8; ry += 2) {
        const half = Math.round(Math.sqrt(Math.max(0, 1 - (ry / 10) ** 2)) * 26);
        for (let rx = -half; rx <= half; rx += 4) {
          ctx.fillRect(px + rx + (ry % 4 === 0 ? 0 : 2), py + ry, 2, 1);
        }
      }
    }

    this.drawInteractGlow(game, viewX, viewY); // the portrait / television pulse

    if (game.caption) {
      const a = game.activeChar;
      this.drawCaption(
        game.caption.text,
        a.x - viewX,
        a.y - viewY,
        game.drunk > 0 ? PALETTE.magenta : PALETTE.moonlight,
      );
    }
  }

  /** One interior furnishing, with its moving parts. */
  drawFurnish(game, f, viewX, viewY) {
    const ctx = this.ctx;
    if (f.kind === 'rug') {
      // A worn oval rug: plum field, magenta border, dithered.
      const cx = f.x - viewX;
      const cy = f.y - viewY;
      for (let ry = -10; ry <= 10; ry++) {
        const half = Math.round(Math.sqrt(Math.max(0, 1 - (ry / 11) ** 2)) * 30);
        if (half < 2) continue;
        for (let rx = -half; rx <= half; rx++) {
          const rim = Math.abs(rx) > half - 2 || Math.abs(ry) > 8;
          if ((rx + ry) % 2 === 0) {
            // A plum border with the rare worn ember fleck — the brass
            // chandelier stays the room's one loud thing.
            const ember = rim && (rx * 7 + ry * 13) % 23 === 0;
            ctx.fillStyle = ember ? PALETTE.magenta : rim ? PALETTE.plum : PALETTE.plumDeep;
            ctx.fillRect(cx + rx, cy + ry, 1, 1);
          }
        }
      }
      return;
    }
    const SPRITES = {
      clock: CLOCK_SPRITE,
      portrait: PORTRAIT_SPRITE,
      shelf: SHELF_SPRITE,
      table: TABLE_SPRITE,
      chair: CHAIR_SPRITE,
      candelabra: CANDELABRA_SPRITE,
      chandelier: CHANDELIER_SPRITE,
      television: TELEVISION_SPRITE,
    };
    const sprite = SPRITES[f.kind];
    if (!sprite) return;
    const colors = f.kind === 'television' ? TELEVISION_COLORS : FURNISH_COLORS;
    const bx = Math.round(f.x - viewX - sprite[0].length / 2);
    const by = Math.round(f.y - viewY - sprite.length);
    sprite.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === '.') continue;
        ctx.fillStyle = colors[ch] ?? PALETTE.smoke;
        ctx.fillRect(bx + rx, by + ry, 1, 1);
      }
    });
    if (f.kind === 'portrait') {
      // The eyes follow whoever is in the room. Of course they do.
      const off = Math.max(-1, Math.min(1, Math.sign(game.person.x - f.x)));
      ctx.fillStyle = PALETTE.moonlight;
      ctx.fillRect(bx + 3 + off, by + 3, 1, 1);
      ctx.fillRect(bx + 8 + off, by + 3, 1, 1);
    } else if (f.kind === 'candelabra') {
      for (const fx of [0, 3, 6]) {
        ctx.fillStyle = flameColor(game.time, f.x + fx);
        ctx.fillRect(bx + fx, by, 1, 1);
      }
    } else if (f.kind === 'chandelier') {
      // The chain climbs to the ceiling so the fixture reads as hanging.
      ctx.fillStyle = PALETTE.brass;
      for (let y = by - 2; y > 18 - viewY; y -= 3) {
        ctx.fillRect(bx + 7, y, 1, 1);
      }
      for (const fx of [0, 15]) {
        ctx.fillStyle = flameColor(game.time, f.x + fx);
        ctx.fillRect(bx + fx, by + 2, 1, 1);
      }
    } else if (f.kind === 'clock') {
      // The pendulum keeps the only honest time in here.
      ctx.fillStyle = PALETTE.brass;
      ctx.fillRect(bx + 3 + (Math.sin(game.time * 2.2) > 0 ? 1 : 0), by + 10, 1, 2);
    } else if (f.kind === 'television') {
      // The one rose-lit thing in the house, always on, never broadcasting.
      const cx = Math.round(f.x - viewX);
      const cy = Math.round(f.y - viewY);
      for (const g of tvGlowPixels(game.time)) {
        ctx.fillStyle = g.c;
        ctx.fillRect(cx + g.x, cy + g.y, 1, 1);
      }
    }
  }

  /**
   * Any generic interior (v0.20): mansion2, the cathedral nave, the cabin,
   * the bail-bonds office — one renderer driven by INTERIORS[kind]. Tiles:
   * '#' wall, '.' floor, 'D' the way out, 'S' the stairwell, 'W' window
   * tiles that spill moonlight bands. Per-style dressing comes from
   * INTERIOR_STYLES; the cathedral draws in night gold and lets the heaven
   * remap brighten it.
   */
  renderInteriorScene(game) {
    const ctx = this.ctx;
    const kind = game.location;
    const spec = INTERIORS[kind];
    const T = spec.tile;
    const iw = spec.map[0].length * T;
    const ih = spec.map.length * T;
    const style = INTERIOR_STYLES[spec.style] ?? INTERIOR_STYLES.mansion;
    // Same camera policy as the mansion: centered while the interior fits,
    // following (clamped) when the view is narrower.
    const follow = (screen, interior, focus) =>
      screen >= interior
        ? -Math.round((screen - interior) / 2)
        : Math.round(Math.min(Math.max(focus - screen / 2, 0), interior - screen));
    const viewX = follow(SCREEN_W, iw, game.person.x);
    const viewY = follow(SCREEN_H, ih, game.person.y);
    this.lastViewX = viewX;
    this.lastViewY = viewY;
    this.lastLocation = kind;
    this.camInit = false; // snap the outdoor camera when we step back out

    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    const cellAt = (cx, cy) =>
      cy >= 0 && cy < spec.map.length && cx >= 0 && cx < spec.map[0].length
        ? spec.map[cy][cx]
        : '#';
    for (let cy = 0; cy < spec.map.length; cy++) {
      for (let cx = 0; cx < spec.map[0].length; cx++) {
        const ch = spec.map[cy][cx];
        const sx = cx * T - viewX;
        const sy = cy * T - viewY;
        if (ch === '.' || ch === 'D' || ch === 'W') {
          // The floor: long planks — a course line every 8px with a
          // half-staggered end seam, in the style's wood.
          ctx.fillStyle = style.floor;
          ctx.fillRect(sx, sy, T, T);
          ctx.fillStyle = style.seam;
          for (let py = 0; py < T; py += 8) {
            ctx.fillRect(sx, sy + py, T, 1);
            const seam = ((cy * T + py) / 8) % 2 === 0 ? 0 : 8;
            ctx.fillRect(sx + seam, sy + py, 1, 8);
          }
          if (ch === 'D') {
            ctx.fillStyle = style.mat;
            ctx.fillRect(sx + 1, sy + 2, T - 2, T - 2); // the door mat
            ctx.fillStyle = style.matTrim;
            ctx.fillRect(sx + 1, sy + 2, T - 2, 1);
          }
          if (ch === 'W') {
            // Moonlight through the window above, banded across the boards.
            for (let py = 1; py < T; py += 3) {
              ctx.fillStyle = py % 2 === 1 ? PALETTE.moonshadow : PALETTE.smoke;
              ctx.fillRect(sx + 3 + (py % 3), sy + py, T - 8, 1);
            }
          }
        } else if (ch === 'S') {
          // The stairwell: treads climbing brighter toward the top — the
          // mansion's stairs, minus the bars (the lock rusted through).
          const TREADS = [PALETTE.smokeDeep, PALETTE.plum, PALETTE.smoke, PALETTE.moonshadow];
          for (let step = 0; step < 4; step++) {
            ctx.fillStyle = TREADS[step];
            ctx.fillRect(sx, sy + T - (step + 1) * (T / 4), T, T / 4);
            ctx.fillStyle = PALETTE.umbra;
            ctx.fillRect(sx, sy + T - (step + 1) * (T / 4) + T / 4 - 1, T, 1);
          }
        } else {
          // Wall: paneled face where it fronts the room, dark cap elsewhere.
          const below = cellAt(cx, cy + 1);
          if (below !== '#') {
            ctx.fillStyle = style.wallFace;
            ctx.fillRect(sx, sy, T, T);
            ctx.fillStyle = style.wallTrim;
            ctx.fillRect(sx, sy, T, 2);
            ctx.fillRect(sx, sy + T - 3, T, 1);
            ctx.fillStyle = style.stud;
            ctx.fillRect(sx + (cx % 2 ? 4 : Math.floor(T * 0.6)), sy + 4, 1, T - 8);
            if (below === 'W') {
              // The window itself, set into the wall over its moonlit tile.
              ctx.fillStyle = PALETTE.smokeDeep;
              ctx.fillRect(sx + 4, sy + 4, T - 8, T - 8);
              ctx.fillStyle = PALETTE.moonshadow;
              ctx.fillRect(sx + 5, sy + 5, T - 10, T - 10);
              ctx.fillStyle = PALETTE.smokeDeep;
              ctx.fillRect(sx + Math.floor(T / 2), sy + 5, 1, T - 10); // the mullion
            }
          } else {
            ctx.fillStyle = style.wallCap;
            ctx.fillRect(sx, sy, T, T);
          }
        }
      }
    }

    // Tap-to-move works indoors too — show its marker on the boards.
    if (game.moveTarget) {
      const mx = Math.round(game.moveTarget.x - viewX);
      const my = Math.round(game.moveTarget.y - viewY);
      for (const p of targetMarkerPixels(game.time)) {
        ctx.fillStyle = p.apex ? PALETTE.moonlight : LEASH_COLORS[p.tri % LEASH_COLORS.length];
        ctx.fillRect(mx + p.x, my + p.y, 1, 1);
      }
    }
    if (game.leashActive() && game.together) this.drawLeash(game, viewX, viewY);

    // Furnishings and the pair, y-sorted.
    const drawables = [];
    for (const f of spec.furnish) {
      drawables.push({
        y: f.y,
        draw: () => this.drawInteriorFurnish(game, f, viewX, viewY),
      });
    }
    if (kind === 'office') {
      // The detective stands at his desk — scenery with a case, not an
      // entity. Drawn just behind the desk so its edge overlaps his coat.
      drawables.push({
        y: 119,
        draw: () => {
          const dx = 206 - viewX;
          const dy = 119 - viewY;
          this.drawShadow(dx, dy, 10);
          DETECTIVE_SPRITE.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
              const c = row[rx];
              if (c === '.') continue;
              ctx.fillStyle = DETECTIVE_COLORS[c];
              ctx.fillRect(dx - Math.floor(DETECTIVE_SPRITE[0].length / 2) + rx, dy - DETECTIVE_SPRITE.length + ry, 1, 1);
            }
          });
        },
      });
    }
    if (kind === 'cortie' || kind === 'queebee') {
      // The merchant holds the counter — scenery with a price list, the
      // detective idiom: drawn a step behind it so the countertop overlaps
      // the robe.
      const art = kind === 'cortie'
        ? { map: CORTIE_SPRITE, colors: CORTIE_COLORS }
        : { map: QUEEBEE_SPRITE, colors: QUEEBEE_COLORS };
      const counter = spec.furnish.find((f) => f.kind === 'counter');
      const mx = counter?.x ?? 144;
      const my = (counter?.y ?? 72) - 6;
      drawables.push({
        y: my,
        draw: () => {
          const dx = mx - viewX;
          const dy = my - viewY;
          this.drawShadow(dx, dy, 10);
          art.map.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
              const c = row[rx];
              if (c === '.') continue;
              ctx.fillStyle = art.colors[c];
              ctx.fillRect(dx - Math.floor(art.map[0].length / 2) + rx, dy - art.map.length + ry, 1, 1);
            }
          });
        },
      });
    }
    const cast = game.together ? [game.person, game.dog] : [game.person];
    for (const chr of cast) {
      const frames =
        chr.kind === 'person' ? PERSON_FRAMES : this.plane === 'heaven' ? CERBERUS_FRAMES : DOG_FRAMES;
      const map = walkFrame(frames, chr.walking, chr.animTime, game.time);
      const { w, h } = spriteSize(map);
      drawables.push({
        y: chr.y,
        draw: () => {
          this.drawShadow(chr.x - viewX, Math.round(chr.y - viewY), chr.kind === 'person' ? 12 : 15);
          this.drawSpriteMap(map, Math.round(chr.x - viewX - w / 2), Math.round(chr.y - viewY - h), chr.facing < 0);
        },
      });
    }
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();

    this.drawInteractGlow(game, viewX, viewY); // named spots pulse when hovered

    if (game.caption) {
      const a = game.activeChar;
      this.drawCaption(
        game.caption.text,
        a.x - viewX,
        a.y - viewY,
        game.drunk > 0 ? PALETTE.magenta : PALETTE.moonlight,
      );
    }
  }

  /** One generic-interior furnishing, with its moving parts. */
  drawInteriorFurnish(game, f, viewX, viewY) {
    const ctx = this.ctx;
    if (f.kind === 'rug') {
      // The upstairs rug is the downstairs rug: same worn oval.
      this.drawFurnish(game, f, viewX, viewY);
      return;
    }
    const art = INTERIOR_FURNISH_ART[f.kind];
    if (!art) return;
    const bx = Math.round(f.x - viewX - art.map[0].length / 2);
    const by = Math.round(f.y - viewY - art.map.length);
    art.map.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === '.') continue;
        ctx.fillStyle = art.colors[ch] ?? PALETTE.smoke;
        ctx.fillRect(bx + rx, by + ry, 1, 1);
      }
    });
    if (f.kind === 'pile') {
      // The pile of god grows with every donation, freshest coins brightest.
      const px = Math.round(f.x - viewX);
      const py = Math.round(f.y - viewY);
      for (const p of pileGrowthPixels(game.goldGiven)) {
        ctx.fillStyle = p.c;
        ctx.fillRect(px + p.x, py + p.y, 1, 1);
      }
    } else if (f.kind === 'portrait2') {
      // The eyes follow up here too. Of course they do.
      const off = Math.max(-1, Math.min(1, Math.sign(game.person.x - f.x)));
      ctx.fillStyle = PALETTE.moonlight;
      ctx.fillRect(bx + 6 + off, by + 4, 1, 1);
      ctx.fillRect(bx + 11 + off, by + 4, 1, 1);
    } else if (f.kind === 'nightstand') {
      // The candle on it keeps the flame idiom of the house below.
      ctx.fillStyle = flameColor(game.time, f.x);
      ctx.fillRect(bx + 4, by, 2, 1);
    } else if (f.kind === 'brazier') {
      // The brazier's crown flickers gold-to-rose like every flame here.
      ctx.fillStyle = flameColor(game.time, f.x);
      ctx.fillRect(bx + 4, by, 2, 1);
    } else if (f.kind === 'singer') {
      // The note that never stops leaving: it climbs and resets, forever.
      const lift = Math.floor((game.time * 2 + f.y) % 4);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(bx + art.map[0].length - 1, by + 1 - lift, 1, 1);
    }
  }

  /**
   * One ghost, datamoshed: ghostMosh() drops the signal for beats (nobody
   * there) and tears the body into displaced row-bands; moshTint() flickers
   * the smoke to static-blue or still-alive magenta. Hostile tempers keep
   * magenta eyes whatever their variant says.
   */
  drawGhost(game, gh, pos, viewX, viewY) {
    const ctx = this.ctx;
    const mosh = ghostMosh(game.time, gh.phase);
    if (!mosh.visible) return; // the stream died for this beat
    const art = GHOST_SPRITES[gh.variant % GHOST_SPRITES.length];
    const tint = moshTint(game.time, gh.phase);
    const bx = Math.round(pos.x - viewX) - Math.floor(art.map[0].length / 2);
    const by = Math.round(pos.y - viewY) - art.map.length;
    for (let ry = 0; ry < art.map.length; ry++) {
      let dx = 0;
      for (const b of mosh.bands) {
        if (ry >= b.y0 && ry < b.y1) dx += b.dx;
      }
      const row = art.map[ry];
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === '.') continue;
        ctx.fillStyle =
          ch === 'e'
            ? gh.temper === 'hostile' ? PALETTE.magenta : art.colors.e
            : ch === 's' ? tint : art.colors[ch];
        ctx.fillRect(bx + rx + dx, by + ry, 1, 1);
      }
    }
  }

  /**
   * Heaven's sun-struck grounds (v0.20), one 4px cell at a time. Drawn in
   * night keys — clay/loam for sand, the water ramp for ice, the nature
   * greens for the island — and brightened by the standard heaven remap.
   */
  drawHeavenGround(biome, seed, sx, sy, cellX, cellY, B) {
    const ctx = this.ctx;
    const coarse = groundNoise(seed ^ 0x50113100, cellX, cellY, 9);
    const fine = hashCoords(seed ^ 0x5011f100, cellX, cellY) / 0x100000000;
    const v = coarse * 0.65 + fine * 0.35;
    if (biome === 'desert' || biome === 'beach') {
      // Dunes: clay and loam drifts (heaven turns them to golden sand).
      if (v >= 0.42) {
        ctx.fillStyle = v < 0.55 ? PALETTE.dirt : v < 0.7 ? PALETTE.clay : PALETTE.loam;
        ctx.fillRect(sx, sy, B, B);
      }
      const h = hashCoords(seed ^ (biome === 'beach' ? 0x6b3a11e5 : 0x6d357a2b), cellX, cellY);
      if ((h & 15) === 0) {
        // A shell fleck on the beach; a sun-bleached grain in the desert.
        ctx.fillStyle = (h >> 9) & 1 ? PALETTE.loam : biome === 'beach' ? PALETTE.waterEdge : PALETTE.clay;
        ctx.fillRect(sx + ((h >> 4) & 3), sy + ((h >> 6) & 3), 1, 1);
      }
    } else if (biome === 'glacier') {
      // Ice sheets off the water ramp: pale silver once remapped.
      if (v >= 0.48) {
        ctx.fillStyle = v < 0.62 ? PALETTE.waterDeep : PALETTE.waterEdge;
        ctx.fillRect(sx, sy, B, B);
      }
      const h = hashCoords(seed ^ 0x61ac1e50, cellX, cellY);
      if ((h & 15) === 0) {
        ctx.fillStyle = PALETTE.blue; // a crevasse glint
        ctx.fillRect(sx + ((h >> 4) & 3), sy + ((h >> 6) & 3), 1, 1);
      }
    } else {
      // The island: a dense green paradise (golden grass, once remapped).
      if (v >= 0.4) {
        ctx.fillStyle = v < 0.58 ? PALETTE.moss : PALETTE.fern;
        ctx.fillRect(sx, sy, B, B);
      }
      const h = hashCoords(seed ^ 0x151a4dd1, cellX, cellY);
      if ((h & 15) === 0) {
        ctx.fillStyle = (h >> 9) & 1 ? PALETTE.leaf : PALETTE.pine;
        ctx.fillRect(sx + ((h >> 4) & 3), sy + ((h >> 6) & 3), 1, 1);
      }
    }
  }

  /**
   * The world's gear, made unmissable. FREE mode is unadorned — the woods,
   * and you in them. TURN-BASED locks a rose-gold frame around the screen
   * with corner brackets, names itself in a banner, and prints whose move it
   * is plus how many steps you have left. You should never have to wonder
   * which one you are in.
   */
  drawModeFrame(game) {
    const ctx = this.ctx;
    if (game.mode !== 'turn') return;
    const yours = game.turn === 'you';
    const edge = yours ? PALETTE.goldRose : PALETTE.magenta;
    const deep = yours ? PALETTE.amber : PALETTE.plum;
    // A double frame: warm outer line, dark inner line, so it reads against
    // both the dark forest and a lit interior.
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, SCREEN_W, 3);
    ctx.fillRect(0, SCREEN_H - 3, SCREEN_W, 3);
    ctx.fillRect(0, 0, 3, SCREEN_H);
    ctx.fillRect(SCREEN_W - 3, 0, 3, SCREEN_H);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, SCREEN_W, 1);
    ctx.fillRect(0, SCREEN_H - 1, SCREEN_W, 1);
    ctx.fillRect(0, 0, 1, SCREEN_H);
    ctx.fillRect(SCREEN_W - 1, 0, 1, SCREEN_H);
    // Corner brackets — the tell that a fight has the screen.
    const B = 18;
    for (const [cx, cy, sx, sy] of [
      [0, 0, 1, 1], [SCREEN_W - 1, 0, -1, 1], [0, SCREEN_H - 1, 1, -1], [SCREEN_W - 1, SCREEN_H - 1, -1, -1],
    ]) {
      for (let i = 0; i < B; i++) {
        ctx.fillRect(cx + sx * i, cy + sy * 1, 1, 2);
        ctx.fillRect(cx + sx * 1, cy + sy * i, 2, 1);
      }
    }
    // The banner.
    const label = yours ? `TURN-BASED - YOUR MOVE` : 'TURN-BASED - THEIR MOVE';
    const w = measureText(label) + 16;
    const bx = Math.round((SCREEN_W - w) / 2);
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(bx, 4, w, 15);
    ctx.fillStyle = edge;
    ctx.fillRect(bx, 4, w, 1);
    ctx.fillRect(bx, 18, w, 1);
    ctx.fillRect(bx, 4, 1, 15);
    ctx.fillRect(bx + w - 1, 4, 1, 15);
    this.drawText(label, SCREEN_W / 2, 8, edge);
    // Steps left, as a little bar under the banner.
    if (yours) {
      const frac = Math.max(0, Math.min(1, game.moveLeft / BATTLE_MOVE));
      const barW = w - 8;
      ctx.fillStyle = PALETTE.amber;
      ctx.fillRect(bx + 4, 21, barW, 3);
      ctx.fillStyle = PALETTE.goldRose;
      ctx.fillRect(bx + 4, 21, Math.round(barW * frac), 3);
    }
  }

  /** HUD text, minimap, the open menu, and touch buttons — every scene. */
  drawUi(game) {
    const ctx = this.ctx;
    this.drawModeFrame(game);
    // HP and level, top-left, dim smoke — HP flushes magenta when hurting.
    // Hidden under full-frame pause screens (which carry the numbers
    // themselves; a 1px sliver of HUD peeking over the panel reads as a bug).
    if (!game.menuPaused()) {
      const top = game.mode === 'turn' ? 28 : 4;
      const hpText = `HP ${game.hp}`;
      this.drawShadowedText(hpText, 6 + measureText(hpText) / 2, top, game.hp <= 3 ? PALETTE.magenta : PALETTE.smoke);
      const lvlText = `LVL ${game.level}  XP ${game.xp}/${XP_PER_LEVEL}`;
      this.drawShadowedText(lvlText, 6 + measureText(lvlText) / 2, top + 10, PALETTE.smoke);
      let line = top + 20;
      if (game.spells.length) {
        const fText = `SLOTS ${game.slots[1]}/${game.slots[2]}/${game.slots[3]}`;
        this.drawShadowedText(fText, 6 + measureText(fText) / 2, line, PALETTE.gold);
        line += 10;
      }
      if (game.drunk > 0) {
        const dText = `DRUNK ${mmss(game.drunk)}`;
        this.drawShadowedText(dText, 6 + measureText(dText) / 2, line, PALETTE.magenta);
      }
    }

    // The HUD minimap — what the person remembers of the nearby regions.
    // Hidden while any menu is up, and indoors (no sky to navigate by).
    if (!game.choice && game.location === 'world') this.drawHud(game);

    // The open choice menu, front and center. Full-frame pause screens get
    // a clean void behind them — live world pixels peeking past the border
    // read as glitched columns, not scenery.
    const panel = choicePanel(game);
    if (panel) {
      if (game.choice.kind === 'sheet' || game.choice.kind === 'map') {
        ctx.fillStyle = PALETTE.void;
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      }
      this.drawPanelChrome(panel.x, panel.y, panel.w, panel.h);
      this.drawText(panel.title, SCREEN_W / 2, panel.y + 5, PALETTE.moonlight);
      if (game.choice.kind === 'map') this.drawMemoryMap(game, panel);
      if (panel.icons) this.drawSheetIcons(game, panel);
      panel.body.forEach((line, i) => {
        this.drawText(line, SCREEN_W / 2, panel.y + 6 + (GLYPH_H + 4) + i * (GLYPH_H + LINE_GAP), PALETTE.smoke);
      });
      for (const row of panel.rows) {
        const selected = row.index === game.choiceIndex;
        const label = selected ? `- ${row.label} -` : row.label;
        this.drawText(label, SCREEN_W / 2, row.y, selected ? PALETTE.moonlight : PALETTE.smoke);
      }
    }

    // Touch buttons (coarse pointers only), above everything — but not over
    // an open menu: panels capture every tap, so live-looking buttons there
    // would either do nothing or fall through into the CLOSE row.
    if (this.showTouchUI && !game.choice) {
      for (const b of uiButtons(game)) {
        ctx.fillStyle = PALETTE.fog;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = PALETTE.smokeDeep;
        ctx.fillRect(b.x, b.y, b.w, 1);
        ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1);
        ctx.fillRect(b.x, b.y, 1, b.h);
        ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);
        this.drawText(b.label, b.x + b.w / 2, b.y + BUTTON_PAD, PALETTE.smoke);
      }
    }
  }

  /** Post effects (transition glitch, drunk shear) and the cache sweep. */
  finishFrame(game) {
    const ctx = this.ctx;
    // Transition glitch: slip horizontal bands of the finished frame and
    // scatter a few noise blocks — the signal skips for a beat. Suppressed
    // while a pause screen is up: the pause freezes glitch.t, which would
    // otherwise scramble the sheet forever — instead the leftover burst
    // plays as the resume transition when the screen closes.
    if (game.glitch && game.glitch.t > 0 && !game.menuPaused()) {
      const intensity = Math.min(1, game.glitch.t / game.glitch.dur);
      const fx = glitchFrame(game.glitch.seed, this.frame, intensity, SCREEN_W, SCREEN_H);
      for (const b of fx.bands) {
        ctx.drawImage(this.canvas, 0, b.y, SCREEN_W, b.h, b.dx, b.y, SCREEN_W, b.h);
      }
      for (const n of fx.noise) {
        ctx.fillStyle = n.c;
        ctx.fillRect(n.x, n.y, n.w, n.h);
      }
    }

    // Inebriation: the whole frame breathes sideways, slow and rhythmic.
    // Also stilled during pause screens — frozen time would hold the shear
    // at a fixed offset and smear the text.
    if (game.drunk > 0 && !game.menuPaused()) {
      for (let i = 0; i < 3; i++) {
        const by = Math.floor(((Math.sin(game.time * 0.7 + i * 2.1) + 1) / 2) * (SCREEN_H - 8));
        const dx = Math.round(Math.sin(game.time * 1.3 + i * 1.7) * 3);
        if (dx !== 0) ctx.drawImage(this.canvas, 0, by, SCREEN_W, 6, dx, by, SCREEN_W, 6);
      }
    }

    // Bucketed tree sprites (the garland twinkle) retire fast: once the
    // cache fills, anything not blitted for ~half a second is a dead
    // bucket — sweep it, keeping the footprint near the visible set.
    this.sweepCache(400, 8);
  }

  /**
   * One remembered region as a map cell. Freshness decides how much is left:
   * fresh — dense dither in the biome's colors plus landmark marks; faded —
   * sparse dither, landmarks forgotten; outline — four corner pips, nothing
   * more. (Dithering, not alpha: memory fades the pixel-art way.)
   *
   * v0.21 detail rides UNDER that fade, never through it: the biome duotone
   * and the lake's rounded pool only recolor pixels the fade lattice was
   * already going to paint — the step-2/step-3/outline degradation is
   * byte-identical in which pixels exist. Tints keep to the low-contrast
   * dusk/moss/clay family (the map stays a whisper); heaven remaps them at
   * fillStyle time like everything else.
   */
  drawMemoryCell(px, py, size, entry, level) {
    const ctx = this.ctx;
    const TINT = {
      grass: [PALETTE.moss, PALETTE.dusk],
      oak: [PALETTE.plum, PALETTE.dusk],
      redwood: [PALETTE.plumDeep, PALETTE.dusk],
      lake: [PALETTE.moss, PALETTE.dusk], // the dry ring; the pool draws itself
      mountain: [PALETTE.smokeDeep, PALETTE.dusk],
      desert: [PALETTE.clay, PALETTE.dusk],
      beach: [PALETTE.clay, PALETTE.dusk],
      glacier: [PALETTE.waterEdge, PALETTE.smokeDeep],
      island: [PALETTE.moss, PALETTE.waterEdge],
    };
    if (level === 'outline') {
      ctx.fillStyle = PALETTE.smokeDeep;
      ctx.fillRect(px, py, 1, 1);
      ctx.fillRect(px + size - 1, py, 1, 1);
      ctx.fillRect(px, py + size - 1, 1, 1);
      ctx.fillRect(px + size - 1, py + size - 1, 1, 1);
      return;
    }
    const step = level === 'fresh' ? 2 : 3; // the sacred fade densities
    const duo = TINT[entry.biome] ?? [PALETTE.smokeDeep, PALETTE.dusk];
    const mid = (size - 1) / 2;
    const pool = entry.biome === 'lake';
    for (let dy = 0; dy < size; dy++) {
      for (let dx = dy % step; dx < size; dx += step) {
        let c;
        if (pool) {
          // A rounded pool in the cell instead of a flat sheet: deep water
          // at heart, a brighter edge ring, dry shore in the corners.
          const nx = (dx - mid) / (mid + 0.001);
          const ny = (dy - mid) / (mid + 0.001);
          const d = nx * nx * 1.15 + ny * ny * 1.5;
          c = d > 1 ? duo[(dx + dy) % 4 === 0 ? 1 : 0]
            : d > 0.62 ? PALETTE.waterEdge : PALETTE.waterDeep;
        } else {
          // The duotone: mostly the biome tone, a scatter of dusk so the
          // cell reads as ground, not paint. Deterministic in (dx, dy).
          c = duo[(dx * 5 + dy * 3) % 7 < 2 ? 1 : 0];
        }
        ctx.fillStyle = c;
        ctx.fillRect(px + dx, py + dy, 1, 1);
      }
    }
    if (level !== 'fresh') return;
    for (const g of memoryGlyphs(entry, size)) {
      ctx.fillStyle = g.c;
      ctx.fillRect(px + g.x, py + g.y, g.w, g.h);
    }
  }

  /** The sheet's icon grid: bordered cells, doubled 9x9 pictographs, values. */
  drawSheetIcons(game, panel) {
    const ctx = this.ctx;
    for (const cell of panel.icons) {
      const focused = cell.index === game.choiceIndex;
      ctx.fillStyle = focused ? PALETTE.moonlight : PALETTE.smokeDeep;
      ctx.fillRect(cell.x, cell.y, cell.w, 1);
      ctx.fillRect(cell.x, cell.y + cell.h - 1, cell.w, 1);
      ctx.fillRect(cell.x, cell.y, 1, cell.h);
      ctx.fillRect(cell.x + cell.w - 1, cell.y, 1, cell.h);
      const art = ICONS[cell.icon];
      if (art) {
        const iw = art.sprite[0].length * 2;
        const ix = Math.round(cell.x + (cell.w - iw) / 2);
        const iy = cell.y + 2;
        art.sprite.forEach((row, ry) => {
          for (let rx = 0; rx < row.length; rx++) {
            const ch = row[rx];
            if (ch === '.') continue;
            ctx.fillStyle = art.colors[ch];
            ctx.fillRect(ix + rx * 2, iy + ry * 2, 2, 2);
          }
        });
      }
      // Stats print their score under the pictograph; items speak for themselves.
      if (game.stats[cell.id] !== undefined) {
        this.drawText(
          String(game.stats[cell.id]),
          cell.x + cell.w / 2,
          cell.y + cell.h - 9,
          focused ? PALETTE.moonlight : PALETTE.smoke,
        );
      }
    }
  }

  /** The corner minimap: 5x5 remembered regions around the active character. */
  drawHud(game) {
    const ctx = this.ctx;
    const r = hudRect();
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = PALETTE.purple;
    ctx.fillRect(r.x, r.y, r.w, 1);
    ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    ctx.fillRect(r.x, r.y, 1, r.h);
    ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    ctx.fillStyle = PALETTE.smokeDeep;
    ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, 1);
    ctx.fillRect(r.x + 2, r.y + r.h - 3, r.w - 4, 1);
    ctx.fillRect(r.x + 2, r.y + 2, 1, r.h - 4);
    ctx.fillRect(r.x + r.w - 3, r.y + 2, 1, r.h - 4);
    const cell = HUD_CELL;
    const reach = Math.floor(HUD_SPAN / 2);
    const { rx: crx, ry: cry } = regionAt(game.activeChar.x, game.activeChar.y);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const entry = game.memory.get(`${crx + dx},${cry + dy}`);
        if (!entry) continue;
        this.drawMemoryCell(
          r.x + 3 + (dx + reach) * cell,
          r.y + 3 + (dy + reach) * cell,
          cell,
          entry,
          game.memoryLevel(entry),
        );
      }
    }
    // You: the same moonlit ring the map screen draws.
    this.drawYouRing(
      r.x + 3 + reach * cell + Math.floor(cell / 2),
      r.y + 3 + reach * cell + Math.floor(cell / 2),
    );
  }

  /** A moonlit ring: you, on either map. The map screen's version pulses. */
  drawYouRing(x, y, rad = 3, pulse = false) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.moonlight;
    ctx.fillRect(x - 1, y - rad, 3, 1);
    ctx.fillRect(x - 1, y + rad, 3, 1);
    ctx.fillRect(x - rad, y - 1, 1, 3);
    ctx.fillRect(x + rad, y - 1, 1, 3);
    ctx.fillRect(x, y, 1, 1);
    if (!pulse) return;
    // The you-are-here breath: a diamond that swells and warms on the
    // RENDER clock (this.frame — game.time freezes while the map pauses,
    // and a pulse that doesn't pulse is just a smudge).
    const ph = Math.floor(this.frame / 3) % 3;
    if (ph === 0) return;
    const r2 = rad + 1 + ph;
    ctx.fillStyle = ph === 2 ? PALETTE.magenta : PALETTE.orchid;
    ctx.fillRect(x - r2, y, 1, 1);
    ctx.fillRect(x + r2, y, 1, 1);
    ctx.fillRect(x, y - r2, 1, 1);
    ctx.fillRect(x, y + r2, 1, 1);
  }

  /**
   * The full map screen. It is exactly as big as your memory: the remembered
   * extent is fitted to the panel and the cells zoom up to fill it, so a
   * short walk is a handful of large, legible tiles rather than a speck in an
   * empty room, and a long one zooms back out as the world outgrows the page.
   */
  drawMemoryMap(game, panel) {
    const top = panel.y + 22;
    const bottom = panel.rows.length ? panel.rows[0].y - 26 : panel.y + panel.h - 26;
    const availW = panel.w - 8;
    const availH = bottom - top;
    // Indoors the person's coordinates are interior-space; the map centers
    // on the mansion's spot in the world instead.
    const anchor =
      game.location === 'mansion' && game.mansionReturn
        ? { x: game.mansionReturn.px, y: game.mansionReturn.py }
        : game.person;
    const { rx: prx, ry: pry } = regionAt(anchor.x, anchor.y);
    let minX = prx;
    let maxX = prx;
    let minY = pry;
    let maxY = pry;
    for (const e of game.memory.values()) {
      if (e.rx < minX) minX = e.rx;
      if (e.rx > maxX) maxX = e.rx;
      if (e.ry < minY) minY = e.ry;
      if (e.ry > maxY) maxY = e.ry;
    }
    const fit = Math.floor(Math.min(availW / (maxX - minX + 1), availH / (maxY - minY + 1)));
    const cell = Math.max(MAP_CELL_MIN, Math.min(MAP_CELL_MAX, fit));
    const cols = Math.floor(availW / cell);
    const rowsN = Math.floor(availH / cell);
    // Centered on the middle of what you remember, so the map doesn't drift
    // off the page when you walk to one edge of it.
    const rx0 = Math.round((minX + maxX) / 2) - Math.floor(cols / 2);
    const ry0 = Math.round((minY + maxY) / 2) - Math.floor(rowsN / 2);
    const gx = panel.x + 4 + Math.floor((availW - cols * cell) / 2);
    const gy = top + Math.floor((availH - rowsN * cell) / 2);
    for (const entry of game.memory.values()) {
      if (entry.rx < rx0 || entry.rx >= rx0 + cols || entry.ry < ry0 || entry.ry >= ry0 + rowsN) continue;
      this.drawMemoryCell(
        gx + (entry.rx - rx0) * cell,
        gy + (entry.ry - ry0) * cell,
        cell,
        entry,
        game.memoryLevel(entry),
      );
    }
    this.drawYouRing(
      gx + (prx - rx0) * cell + Math.floor(cell / 2),
      gy + (pry - ry0) * cell + Math.floor(cell / 2),
      Math.max(3, Math.floor(cell / 5)),
      true, // the map screen's marker pulses (v0.21)
    );

    // A legend, so the pictograms mean something the first time you look.
    // Drawn at a fixed size whatever the map is zoomed to.
    const LC = 15;
    const legend = [
      { key: { water: true, biome: 'oak' }, label: 'RIVER' },
      { key: { bridge: true, biome: 'oak' }, label: 'BRIDGE' },
      { key: { cabin: true, biome: 'oak' }, label: 'CABIN' },
      { key: { mansion: true, biome: 'oak' }, label: 'MANSION' },
      { key: { cave: true, biome: 'mountain' }, label: 'CAVE' },
      { key: { qtown: true, biome: 'redwood' }, label: 'QTOWN' },
    ];
    const ly = bottom + 10;
    let lx = panel.x + 12;
    for (const item of legend) {
      for (const g of memoryGlyphs(item.key, LC)) {
        this.ctx.fillStyle = g.c;
        this.ctx.fillRect(lx + g.x - Math.floor(LC / 2), ly + g.y - Math.floor(LC / 2), g.w, g.h);
      }
      this.drawText(item.label, lx + 10 + measureText(item.label) / 2, ly - 4, PALETTE.smoke);
      lx += 30 + measureText(item.label);
    }
  }

  updateCamera(game, dt = 1 / 60) {
    const target = game.activeChar;
    const ty = target.y - 6;
    if (!this.camInit) {
      this.camX = target.x;
      this.camY = ty;
      this.camInit = true;
    } else {
      // Smooth follow; dt-corrected so convergence speed is refresh-rate
      // independent (k = 0.12 per 60Hz frame, compounded for the real dt).
      const k = 1 - Math.pow(1 - 0.12, dt * 60);
      this.camX += (target.x - this.camX) * k;
      this.camY += (ty - this.camY) * k;
    }
    return { x: Math.round(this.camX), y: Math.round(this.camY) };
  }
}
