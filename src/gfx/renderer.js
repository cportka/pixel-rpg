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
  CABIN_SPRITE, CABIN_COLORS, cabinWindowLit, CAVE_SPRITE, CAVE_COLORS, caveGlint,
  rockPixels, TUFT_PIXELS,
  MANSION_SPRITE, MANSION_COLORS, mansionAtticLit,
  CLOCK_SPRITE, PORTRAIT_SPRITE, SHELF_SPRITE, TABLE_SPRITE, CHAIR_SPRITE,
  CANDELABRA_SPRITE, CHANDELIER_SPRITE, FURNISH_COLORS, flameColor,
  TELEVISION_SPRITE, TELEVISION_COLORS, tvGlowPixels,
} from './structures.js';
import {
  TILE, MANSION_MAP, INTERIOR_W, INTERIOR_H, FURNISH,
} from '../core/mansion.js';
import { ICONS } from './icons.js';
import { MAX_HP, XP_PER_LEVEL, BATTLE_MOVE, SPELLS } from '../core/game.js';
import { isWater, onBridge, regionAt, biomeAt, REGION } from '../core/terrain.js';
import { hashCoords } from '../core/rng.js';
import { SCREEN_W, SCREEN_H } from '../core/screen.js';

export { SCREEN_W, SCREEN_H };
import { textPixels, measureText, wrapText, GLYPH_H, LINE_GAP } from './font.js';

export const RENDER_FPS = 15; // presentation cadence, matched to the reference

export const CAPTION_MAX_W = SCREEN_W - 40; // wrap captions to the screen, minus margins
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
  ];
  if (game.spells.length) {
    lines.push(`FOCUS ${game.focus} OF ${game.maxFocus()}`);
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
  if (entry.water && entry.biome !== 'lake') {
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
   */
  treeSprite(tree) {
    const key = `${this.plane}:${tree.kind}:${tree.variant}:${tree.size}:${tree.detailSeed}`;
    let entry = this.treeCache.get(key);
    if (!entry) {
      const geo = treePixels(tree);
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
    const lines = wrapText(text, CAPTION_MAX_W);
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
    if (game.location === 'mansion') {
      this.renderMansionScene(game);
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
            const grassy = biomeAt(seed, Math.floor(wx / REGION), Math.floor(wy / REGION)) === 'grass';
            ctx.fillStyle = (h >> 9) & 1 ? (grassy ? PALETTE.moss : PALETTE.clay) : PALETTE.umbra;
            ctx.fillRect(sx + ((h >> 4) & 3), sy + ((h >> 6) & 3), 1, 1);
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

    // Tap-to-move marker: three arrowheads pulsing in toward the target.
    if (game.moveTarget) {
      const mx = Math.round(game.moveTarget.x - viewX);
      const my = Math.round(game.moveTarget.y - viewY);
      for (const p of targetMarkerPixels(game.time)) {
        ctx.fillStyle = p.apex ? PALETTE.moonlight : LEASH_COLORS[p.tri % LEASH_COLORS.length];
        ctx.fillRect(mx + p.x, my + p.y, 1, 1);
      }
    }

    // The leash runs under the characters but over the ground.
    if (game.leashActive()) this.drawLeash(game, viewX, viewY);

    // Y-sorted world: trees, characters, ball — all by baseline.
    const drawables = [];
    for (const tree of game.world.treesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: tree.y,
        draw: () => {
          const s = this.treeSprite(tree);
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
    const drawSpriteWithColors = (sprite, colors, bx, by) => {
      sprite.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const ch = row[rx];
          if (ch === '.') continue;
          ctx.fillStyle = colors[ch];
          ctx.fillRect(bx + rx, by + ry, 1, 1);
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
      const spent = game.encounterDone.has(`p:${pi.x},${pi.y}`);
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
    for (const z of game.world.zombiesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      if (game.encounterDone.has(`z:${z.x},${z.y}`)) continue; // crumbled
      drawables.push({
        y: z.y,
        draw: () => {
          if (this.plane === 'heaven') {
            // The zombie's spot holds an angel up here: it hovers a slow
            // pixel instead of lurching, and casts no shadow at all.
            const ax = Math.round(z.x - viewX) - Math.floor(ANGEL_SPRITE[0].length / 2);
            const ay = Math.round(z.y - viewY) - ANGEL_SPRITE.length + angelBob(game.time, z.phase);
            drawSpriteWithColors(ANGEL_SPRITE, ANGEL_COLORS, ax, ay);
            return;
          }
          const zx = Math.round(z.x - viewX) - Math.floor(ZOMBIE_SPRITE[0].length / 2) + zombieSway(game.time, z.phase);
          const zy = Math.round(z.y - viewY) - ZOMBIE_SPRITE.length;
          this.drawShadow(z.x - viewX, Math.round(z.y - viewY), 12);
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
    for (const c of game.world.cabinsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: c.y,
        draw: () => {
          const bx = Math.round(c.x - viewX) - CABIN_SPRITE[0].length / 2;
          const by = Math.round(c.y - viewY) - CABIN_SPRITE.length;
          const lit = cabinWindowLit(game.time);
          CABIN_SPRITE.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
              const ch = row[rx];
              if (ch === '.') continue;
              ctx.fillStyle = ch === 'W' && !lit ? PALETTE.fog : CABIN_COLORS[ch];
              ctx.fillRect(bx + rx, by + ry, 1, 1);
            }
          });
        },
      });
    }
    for (const m of game.world.mansionsInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      drawables.push({
        y: m.y,
        draw: () => {
          const bx = Math.round(m.x - viewX) - MANSION_SPRITE[0].length / 2;
          const by = Math.round(m.y - viewY) - MANSION_SPRITE.length;
          const atticLit = mansionAtticLit(game.time);
          MANSION_SPRITE.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
              const ch = row[rx];
              if (ch === '.') continue;
              ctx.fillStyle = ch === 'A' && atticLit ? PALETTE.brass : MANSION_COLORS[ch];
              ctx.fillRect(bx + rx, by + ry, 1, 1);
            }
          });
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
    for (const ch of [game.person, game.dog]) {
      const frames =
        ch.kind === 'person' ? PERSON_FRAMES : this.plane === 'heaven' ? CERBERUS_FRAMES : DOG_FRAMES;
      const map = walkFrame(frames, ch.walking, ch.animTime, game.time);
      const { w, h } = spriteSize(map);
      drawables.push({
        y: ch.y,
        draw: () => {
          this.drawShadow(ch.x - viewX, Math.round(ch.y - viewY), ch.kind === 'person' ? 12 : 15);
          this.drawSpriteMap(map, Math.round(ch.x - viewX - w / 2), Math.round(ch.y - viewY - h), ch.facing < 0);
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
    const viewX = -Math.round((SCREEN_W - INTERIOR_W) / 2);
    const viewY = -Math.round((SCREEN_H - INTERIOR_H) / 2);
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
        const fText = `FOCUS ${game.focus}/${game.maxFocus()}`;
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

    this.sweepCache();
  }

  /**
   * One remembered region as a map cell. Freshness decides how much is left:
   * fresh — dense dither in the biome's color plus landmark marks; faded —
   * sparse dither, landmarks forgotten; outline — four corner pips, nothing
   * more. (Dithering, not alpha: memory fades the pixel-art way.)
   */
  drawMemoryCell(px, py, size, entry, level) {
    const ctx = this.ctx;
    const TINT = {
      grass: PALETTE.moss,
      oak: PALETTE.plum,
      redwood: PALETTE.plumDeep,
      lake: PALETTE.waterEdge,
      mountain: PALETTE.smokeDeep,
    };
    if (level === 'outline') {
      ctx.fillStyle = PALETTE.smokeDeep;
      ctx.fillRect(px, py, 1, 1);
      ctx.fillRect(px + size - 1, py, 1, 1);
      ctx.fillRect(px, py + size - 1, 1, 1);
      ctx.fillRect(px + size - 1, py + size - 1, 1, 1);
      return;
    }
    const step = level === 'fresh' ? 2 : 3;
    ctx.fillStyle = TINT[entry.biome] ?? PALETTE.smokeDeep;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = dy % step; dx < size; dx += step) {
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

  /** A moonlit ring: you, on either map. */
  drawYouRing(x, y, rad = 3) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.moonlight;
    ctx.fillRect(x - 1, y - rad, 3, 1);
    ctx.fillRect(x - 1, y + rad, 3, 1);
    ctx.fillRect(x - rad, y - 1, 1, 3);
    ctx.fillRect(x + rad, y - 1, 1, 3);
    ctx.fillRect(x, y, 1, 1);
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
