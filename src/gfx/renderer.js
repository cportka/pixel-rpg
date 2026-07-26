// Canvas renderer: draws the game state onto a low-res screen (320x200) that
// the page upscales with image-rendering: pixelated. World objects are
// y-sorted by their baseline so characters walk in front of and behind trees.
//
// Trees are rasterized once per detailSeed onto small offscreen canvases and
// cached — generation is deterministic, so the cache never goes stale.

import { PALETTE, SPRITE_COLORS, SPARKLE_TINTS } from './palette.js';
import { PERSON_FRAMES, DOG_FRAMES, BALL_SPRITE, HEART_SPRITE, walkFrame, spriteSize } from './sprites.js';
import { treePixels } from './trees.js';
import { textPixels, measureText, GLYPH_H } from './font.js';

export const SCREEN_W = 320;
export const SCREEN_H = 200;

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
    this.camX = 0;
    this.camY = 0;
    this.camInit = false;
  }

  /** Rasterize (and cache) a tree's pixel cloud onto its own canvas. */
  treeSprite(tree) {
    let entry = this.treeCache.get(tree.detailSeed);
    if (!entry) {
      const geo = treePixels(tree);
      const w = geo.maxX - geo.minX + 1;
      const h = geo.maxY - geo.minY + 1;
      const c = this.createCanvas(w, h);
      const g = c.getContext('2d');
      for (const p of geo.pixels) {
        g.fillStyle = p.c;
        g.fillRect(p.x - geo.minX, p.y - geo.minY, 1, 1);
      }
      entry = { canvas: c, offX: geo.minX, offY: geo.minY };
      this.treeCache.set(tree.detailSeed, entry);
    }
    return entry;
  }

  drawSpriteMap(map, x, y, flip = false) {
    const { w } = spriteSize(map);
    const ctx = this.ctx;
    for (let row = 0; row < map.length; row++) {
      const line = map[row];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === '.') continue;
        ctx.fillStyle = SPRITE_COLORS[ch] ?? PALETTE.white;
        const px = flip ? x + (w - 1 - col) : x + col;
        ctx.fillRect(px, y + row, 1, 1);
      }
    }
  }

  drawText(text, centerX, topY, color = PALETTE.white) {
    const ctx = this.ctx;
    const x0 = Math.round(centerX - measureText(text) / 2);
    ctx.fillStyle = color;
    for (const p of textPixels(text)) ctx.fillRect(x0 + p.x, topY + p.y, 1, 1);
  }

  /** Draw one frame of the game. */
  render(game) {
    const ctx = this.ctx;
    const cam = this.updateCamera(game);
    const viewX = cam.x - SCREEN_W / 2;
    const viewY = cam.y - SCREEN_H / 2;

    ctx.fillStyle = PALETTE.black;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

    // Magical motes twinkling in the dark.
    for (const s of game.world.sparklesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      const glow = Math.sin(game.time * s.rate * 2 + s.phase);
      if (glow < 0.1) continue;
      const x = Math.round(s.x - viewX);
      const y = Math.round(s.y - viewY);
      ctx.fillStyle = SPARKLE_TINTS[s.tint % SPARKLE_TINTS.length];
      ctx.fillRect(x, y, 1, 1);
      if (glow > 0.9) {
        ctx.fillRect(x - 1, y, 1, 1);
        ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y - 1, 1, 1);
        ctx.fillRect(x, y + 1, 1, 1);
      }
    }

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

    // Caption, centered in the upper third like the reference.
    if (game.caption) {
      this.drawText(game.caption.text, SCREEN_W / 2, Math.round(SCREEN_H * 0.24) - GLYPH_H);
    }
  }

  updateCamera(game) {
    const target = game.activeChar;
    const ty = target.y - 6;
    if (!this.camInit) {
      this.camX = target.x;
      this.camY = ty;
      this.camInit = true;
    } else {
      // Smooth follow; snaps tight enough that pixels don't swim.
      const k = 0.12;
      this.camX += (target.x - this.camX) * k;
      this.camY += (ty - this.camY) * k;
    }
    return { x: Math.round(this.camX), y: Math.round(this.camY) };
  }
}
