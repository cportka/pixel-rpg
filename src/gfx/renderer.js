// Canvas renderer: draws the game state onto a low-res screen (320x200) that
// the page upscales with image-rendering: pixelated. World objects are
// y-sorted by their baseline so characters walk in front of and behind trees.
//
// Presentation runs at RENDER_FPS (the reference footage's chunky ~15Hz
// cadence) — main.js calls render() at that rate while the simulation stays
// at 60Hz. Trees are rasterized once per identity onto small offscreen
// canvases and cached; generation is deterministic, so eviction is lossless.

import { PALETTE, SPRITE_COLORS, SPARKLE_TINTS, LEASH_COLORS } from './palette.js';
import { PERSON_FRAMES, DOG_FRAMES, BALL_SPRITE, HEART_SPRITE, walkFrame, spriteSize } from './sprites.js';
import { treePixels, BLOCK_W, BLOCK_H } from './trees.js';
import { inflatablePixels } from './inflatables.js';
import { glitchFrame, starPixels, starSize, targetMarkerPixels } from './effects.js';
import {
  DUMPSTER_SPRITE, DUMPSTER_COLORS, CAT_SPRITE, firePixels, catRowColor,
  LAMP_SPRITE, LAMP_COLORS, PIPE_SPRITE, PIPE_COLORS, lampGlintPixels, pipeSmokePixels,
  ZOMBIE_SPRITE, ZOMBIE_COLORS, zombieSway,
} from './encounters.js';
import {
  CABIN_SPRITE, CABIN_COLORS, cabinWindowLit, CAVE_SPRITE, CAVE_COLORS, caveGlint,
  rockPixels, TUFT_PIXELS,
  MANSION_SPRITE, MANSION_COLORS, mansionAtticLit,
  CLOCK_SPRITE, PORTRAIT_SPRITE, SHELF_SPRITE, TABLE_SPRITE, CHAIR_SPRITE,
  CANDELABRA_SPRITE, CHANDELIER_SPRITE, FURNISH_COLORS, flameColor,
} from './structures.js';
import {
  TILE, MANSION_MAP, INTERIOR_W, INTERIOR_H, FURNISH,
} from '../core/mansion.js';
import { ICONS } from './icons.js';
import { MAX_HP, XP_PER_LEVEL } from '../core/game.js';
import { isWater, onBridge, regionAt, biomeAt, REGION } from '../core/terrain.js';
import { hashCoords } from '../core/rng.js';
import { SCREEN_W, SCREEN_H } from '../core/screen.js';

export { SCREEN_W, SCREEN_H };
import { textPixels, measureText, wrapText, GLYPH_H, LINE_GAP } from './font.js';

export const RENDER_FPS = 15; // presentation cadence, matched to the reference

export const CAPTION_MAX_W = SCREEN_W - 40; // wrap captions to the screen, minus margins
const BUTTON_PAD = 3; // px of padding inside a touch button

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
export function hudRect() {
  return { x: SCREEN_W - 42, y: 3, w: 39, h: 39 };
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
   * Rasterize (and cache) a tree's block cloud onto its own canvas.
   * The key includes every field treePixels() reads — detailSeed alone
   * collides across distinct trees (independent 32-bit draws).
   */
  treeSprite(tree) {
    const key = `${tree.kind}:${tree.variant}:${tree.size}:${tree.detailSeed}`;
    let entry = this.treeCache.get(key);
    if (!entry) {
      const geo = treePixels(tree);
      const w = geo.maxX - geo.minX + 1;
      const h = geo.maxY - geo.minY + 1;
      const c = this.createCanvas(w, h);
      const g = c.getContext('2d');
      for (const p of geo.pixels) {
        g.fillStyle = p.c;
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
    const x1 = p.x + (d.x >= p.x ? 3 : -3);
    const y1 = p.y - 8;
    const x2 = d.x - d.facing * 5;
    const y2 = d.y - 5;
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
    let top = Math.round(anchorScreenY) - 22 - lines.length * lineH;
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
          // The forest floor: a dark speck in ~1 of 4 cells, the odd
          // brighter plum fleck — deterministic per world cell.
          const cellX = Math.floor(wx / B);
          const cellY = Math.floor(wy / B);
          const h = hashCoords(seed ^ 0x5011f100, cellX, cellY);
          if ((h & 7) < 2) {
            const bright = ((h >> 7) & 63) === 0;
            ctx.fillStyle = bright
              ? PALETTE.plum
              : ((h >> 6) & 1) === 0 ? PALETTE.fog : PALETTE.umbra;
            ctx.fillRect(sx + ((h >> 3) & 3), sy + ((h >> 5) & 3), bright ? 1 : 2, 1);
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
      ctx.fillStyle = glow >= 0.9 ? PALETTE.moonlight : SPARKLE_TINTS[s.tint % SPARKLE_TINTS.length];
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
          const bx = Math.round(d.x - viewX) - 8;
          const by = Math.round(d.y - viewY) - DUMPSTER_SPRITE.length;
          DUMPSTER_SPRITE.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
              const ch = row[rx];
              if (ch === '.') continue;
              ctx.fillStyle = DUMPSTER_COLORS[ch];
              ctx.fillRect(bx + rx, by + ry, 1, 1);
            }
          });
          if (!game.dumpstersOut.has(key)) {
            const cxp = Math.round(d.x - viewX);
            const cyp = Math.round(d.y - viewY);
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
          const bx = Math.round(c.x - viewX) - 5;
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
          drawSpriteWithColors(LAMP_SPRITE, LAMP_COLORS, lx - 5, ly - LAMP_SPRITE.length);
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
          drawSpriteWithColors(PIPE_SPRITE, PIPE_COLORS, px - 5, py - PIPE_SPRITE.length);
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
          const zx = Math.round(z.x - viewX) - 4 + zombieSway(game.time, z.phase);
          const zy = Math.round(z.y - viewY) - ZOMBIE_SPRITE.length;
          this.drawShadow(z.x - viewX, Math.round(z.y - viewY), 8);
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
      const frames = ch.kind === 'person' ? PERSON_FRAMES : DOG_FRAMES;
      const map = walkFrame(frames, ch.walking, ch.animTime);
      const { w, h } = spriteSize(map);
      drawables.push({
        y: ch.y,
        draw: () => {
          this.drawShadow(ch.x - viewX, Math.round(ch.y - viewY), ch.kind === 'person' ? 8 : 10);
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
      const map = walkFrame(frames, chr.walking, chr.animTime);
      const { w, h } = spriteSize(map);
      drawables.push({
        y: chr.y,
        draw: () => {
          this.drawShadow(chr.x - viewX, Math.round(chr.y - viewY), chr.kind === 'person' ? 8 : 10);
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
    };
    const sprite = SPRITES[f.kind];
    if (!sprite) return;
    const bx = Math.round(f.x - viewX - sprite[0].length / 2);
    const by = Math.round(f.y - viewY - sprite.length);
    sprite.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const ch = row[rx];
        if (ch === '.') continue;
        ctx.fillStyle = FURNISH_COLORS[ch] ?? PALETTE.smoke;
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
    }
  }

  /** HUD text, minimap, the open menu, and touch buttons — every scene. */
  drawUi(game) {
    const ctx = this.ctx;
    // HP and level, top-left, dim smoke — HP flushes magenta when hurting.
    // Hidden under full-frame pause screens (which carry the numbers
    // themselves; a 1px sliver of HUD peeking over the panel reads as a bug).
    if (!game.menuPaused()) {
      const hpText = `HP ${game.hp}`;
      this.drawShadowedText(hpText, 4 + measureText(hpText) / 2, 3, game.hp <= 3 ? PALETTE.magenta : PALETTE.smoke);
      const lvlText = `LVL ${game.level}  XP ${game.xp}/${XP_PER_LEVEL}`;
      this.drawShadowedText(lvlText, 4 + measureText(lvlText) / 2, 13, PALETTE.smoke);
      if (game.drunk > 0) {
        const dText = `DRUNK ${mmss(game.drunk)}`;
        this.drawShadowedText(dText, 4 + measureText(dText) / 2, 23, PALETTE.magenta);
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
      grass: PALETTE.leaf,
      oak: PALETTE.purple,
      redwood: PALETTE.plumDeep,
      lake: PALETTE.blue,
      mountain: PALETTE.smoke,
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
    const mid = Math.floor(size / 2);
    if (entry.water && entry.biome !== 'lake') {
      ctx.fillStyle = PALETTE.blue;
      ctx.fillRect(px + mid - 1, py, 2, size); // the river runs through it
    }
    if (entry.bridge) {
      ctx.fillStyle = PALETTE.smoke;
      ctx.fillRect(px + mid - 2, py + mid, 4, 1);
    }
    if (entry.cabin) {
      ctx.fillStyle = PALETTE.magenta;
      ctx.fillRect(px + mid - 1, py + mid - 1, 2, 2);
    }
    if (entry.mansion) {
      ctx.fillStyle = PALETTE.brass; // the one warm dot on the map
      ctx.fillRect(px + mid - 1, py + mid - 1, 2, 2);
      ctx.fillRect(px + mid, py + mid - 2, 1, 1);
    }
    if (entry.cave) {
      ctx.fillStyle = PALETTE.void;
      ctx.fillRect(px + mid - 1, py + mid - 1, 2, 2);
      ctx.fillStyle = PALETTE.moonlight;
      ctx.fillRect(px + mid - 1, py + mid - 2, 2, 1);
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
    ctx.fillStyle = PALETTE.fog;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = PALETTE.smokeDeep;
    ctx.fillRect(r.x, r.y, r.w, 1);
    ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    ctx.fillRect(r.x, r.y, 1, r.h);
    ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    const cell = 7;
    const { rx: crx, ry: cry } = regionAt(game.activeChar.x, game.activeChar.y);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const entry = game.memory.get(`${crx + dx},${cry + dy}`);
        if (!entry) continue;
        this.drawMemoryCell(r.x + 2 + (dx + 2) * cell, r.y + 2 + (dy + 2) * cell, cell, entry, game.memoryLevel(entry));
      }
    }
    ctx.fillStyle = PALETTE.moonlight;
    ctx.fillRect(r.x + 2 + 2 * cell + 2, r.y + 2 + 2 * cell + 2, 2, 2); // you
  }

  /** The full map screen: every remembered region, centered on the person. */
  drawMemoryMap(game, panel) {
    const ctx = this.ctx;
    const cell = 6;
    const top = panel.y + 16;
    const bottom = panel.rows.length ? panel.rows[0].y - 4 : panel.y + panel.h - 4;
    const cols = Math.floor((panel.w - 8) / cell);
    const rowsN = Math.floor((bottom - top) / cell);
    // Indoors the person's coordinates are interior-space; the map centers
    // on the mansion's spot in the world instead.
    const anchor =
      game.location === 'mansion' && game.mansionReturn
        ? { x: game.mansionReturn.px, y: game.mansionReturn.py }
        : game.person;
    const { rx: prx, ry: pry } = regionAt(anchor.x, anchor.y);
    const rx0 = prx - Math.floor(cols / 2);
    const ry0 = pry - Math.floor(rowsN / 2);
    for (const entry of game.memory.values()) {
      if (entry.rx < rx0 || entry.rx >= rx0 + cols || entry.ry < ry0 || entry.ry >= ry0 + rowsN) continue;
      this.drawMemoryCell(
        panel.x + 4 + (entry.rx - rx0) * cell,
        top + (entry.ry - ry0) * cell,
        cell,
        entry,
        game.memoryLevel(entry),
      );
    }
    ctx.fillStyle = PALETTE.moonlight;
    ctx.fillRect(panel.x + 4 + (prx - rx0) * cell + 2, top + (pry - ry0) * cell + 2, 2, 2);
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
