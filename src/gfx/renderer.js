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
} from './structures.js';
import { MAX_HP } from '../core/game.js';
import { isWater, onBridge, regionAt } from '../core/terrain.js';
import { textPixels, measureText, wrapText, GLYPH_H, LINE_GAP } from './font.js';

export const SCREEN_W = 320;
export const SCREEN_H = 200;
export const RENDER_FPS = 15; // presentation cadence, matched to the reference

const CAPTION_MAX_W = 280; // wrap captions to at most this many px
const BUTTON_PAD = 3; // px of padding inside a touch button

/**
 * Geometry for the open choice menu (pure — the renderer draws it, main.js
 * hit-tests taps against its rows). Null when no menu is open.
 */
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** The character sheet's body lines (shown inside the sheet menu). */
export function sheetLines(game) {
  const s = game.stats;
  const wis = game.drunk > 0 ? `${s.wis} (+2)` : `${s.wis}`;
  const lines = [
    `STR ${s.str}  DEX ${s.dex}`,
    `INT ${s.int}  CON ${s.con}`,
    `WIS ${wis}  CHA ${s.cha}`,
    `HP ${game.hp} OF ${MAX_HP}`,
    `WEIGHT ${game.carriedWeight()} OF ${game.carryCapacity()} LBS`,
  ];
  if (game.drunk > 0) lines.push(`DRUNK ${mmss(game.drunk)}`);
  if (game.hasBone) lines.push(game.boneMeat ? 'BONE (MEATY)' : 'BONE (A GOOD CLUB)');
  return lines;
}

export function choicePanel(game) {
  if (!game.choice) return null;
  const opts = game.choice.options;
  const rowHM = GLYPH_H + 4;
  if (game.choice.kind === 'map') {
    // The map screen fills the frame; its cells are drawn by the renderer.
    const x = 6;
    const y = 4;
    const w = SCREEN_W - 12;
    const h = SCREEN_H - 12;
    const rows = opts.map((o, i) => ({
      index: i,
      id: o.id,
      label: o.label,
      x: x + 4,
      y: y + h - rowHM * (opts.length - i) - 4,
      w: w - 8,
      h: rowHM,
    }));
    return { x, y, w, h, title: game.choice.title, body: [], rows };
  }
  const body = game.choice.kind === 'sheet' ? sheetLines(game) : [];
  const rowH = GLYPH_H + 4;
  const bodyH = body.length * (GLYPH_H + LINE_GAP);
  const contentW = Math.max(
    measureText(game.choice.title),
    ...opts.map((o) => measureText(o.label) + 10),
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
      this.drawText(line, cx, top + i * lineH, color);
    });
  }

  /** Draw one frame of the game. dt is the real time since the last frame. */
  render(game, dt = 1 / RENDER_FPS) {
    const ctx = this.ctx;
    this.frame++;
    const cam = this.updateCamera(game, dt);
    const viewX = cam.x - SCREEN_W / 2;
    const viewY = cam.y - SCREEN_H / 2;
    this.lastViewX = viewX;
    this.lastViewY = viewY;

    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Terrain ground pass: water (rivers and lakes) with a slow shimmer,
    // bridge planks, and grass tufts. Sampled in 4px blocks — cheap, chunky.
    const seed = game.world.seed;
    const B = 4;
    for (let sy = 0; sy < SCREEN_H; sy += B) {
      for (let sx = 0; sx < SCREEN_W; sx += B) {
        const wx = viewX + sx + B / 2;
        const wy = viewY + sy + B / 2;
        if (isWater(seed, wx, wy)) {
          ctx.fillStyle = PALETTE.fog;
          ctx.fillRect(sx, sy, B, B);
          if ((((sx + sy * 3) >> 2) + Math.floor(game.time * 2)) % 11 === 0) {
            ctx.fillStyle = PALETTE.blue;
            ctx.fillRect(sx + 1, sy + 2, 2, 1);
          }
        } else if (onBridge(seed, wx, wy)) {
          ctx.fillStyle = PALETTE.plumDeep;
          ctx.fillRect(sx, sy, B, B);
          ctx.fillStyle = PALETTE.smokeDeep;
          ctx.fillRect(sx, sy + 1, B, 1);
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
        draw: () =>
          this.drawSpriteMap(map, Math.round(ch.x - viewX - w / 2), Math.round(ch.y - viewY - h), ch.facing < 0),
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

    // HP, top-left, dim smoke — flushing magenta when you're hurting.
    const hpText = `HP ${game.hp}`;
    this.drawText(hpText, 4 + measureText(hpText) / 2, 3, game.hp <= 3 ? PALETTE.magenta : PALETTE.smoke);
    if (game.drunk > 0) {
      const dText = `DRUNK ${mmss(game.drunk)}`;
      this.drawText(dText, 4 + measureText(dText) / 2, 13, PALETTE.magenta);
    }

    // The HUD minimap — what the person remembers of the nearby regions.
    // Hidden while any menu is up (the map screen replaces it wholesale).
    if (!game.choice) this.drawHud(game);

    // The open choice menu, front and center.
    const panel = choicePanel(game);
    if (panel) {
      ctx.fillStyle = PALETTE.fog;
      ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
      ctx.fillStyle = PALETTE.smokeDeep;
      ctx.fillRect(panel.x, panel.y, panel.w, 1);
      ctx.fillRect(panel.x, panel.y + panel.h - 1, panel.w, 1);
      ctx.fillRect(panel.x, panel.y, 1, panel.h);
      ctx.fillRect(panel.x + panel.w - 1, panel.y, 1, panel.h);
      this.drawText(panel.title, SCREEN_W / 2, panel.y + 5, PALETTE.moonlight);
      if (game.choice.kind === 'map') this.drawMemoryMap(game, panel);
      panel.body.forEach((line, i) => {
        this.drawText(line, SCREEN_W / 2, panel.y + 6 + (GLYPH_H + 4) + i * (GLYPH_H + LINE_GAP), PALETTE.smoke);
      });
      for (const row of panel.rows) {
        const selected = row.index === game.choiceIndex;
        const label = selected ? `- ${row.label} -` : row.label;
        this.drawText(label, SCREEN_W / 2, row.y, selected ? PALETTE.moonlight : PALETTE.smoke);
      }
    }

    // Touch buttons (coarse pointers only), above everything.
    if (this.showTouchUI) {
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
    if (entry.cave) {
      ctx.fillStyle = PALETTE.void;
      ctx.fillRect(px + mid - 1, py + mid - 1, 2, 2);
      ctx.fillStyle = PALETTE.moonlight;
      ctx.fillRect(px + mid - 1, py + mid - 2, 2, 1);
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
    const { rx: prx, ry: pry } = regionAt(game.person.x, game.person.y);
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
