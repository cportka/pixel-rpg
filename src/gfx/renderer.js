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
import { glitchFrame, starPixels, starSize } from './effects.js';
import { textPixels, measureText, wrapText, GLYPH_H, LINE_GAP } from './font.js';

export const SCREEN_W = 320;
export const SCREEN_H = 200;
export const RENDER_FPS = 15; // presentation cadence, matched to the reference

const CAPTION_MAX_W = 280; // wrap captions to at most this many px
const BUTTON_PAD = 3; // px of padding inside a touch button

/**
 * Touch-UI buttons for the current game state (pure geometry — the renderer
 * draws them, main.js hit-tests them). Empty until the pair are together,
 * since swap and fetch are locked while alone.
 */
export function uiButtons(game) {
  if (!game.together) return [];
  const h = GLYPH_H + BUTTON_PAD * 2;
  const y = SCREEN_H - h - 4;
  const swapW = measureText('SWAP') + BUTTON_PAD * 2;
  const ballW = measureText('BALL') + BUTTON_PAD * 2;
  return [
    { id: 'swap', label: 'SWAP', x: 4, y, w: swapW, h },
    { id: 'action', label: 'BALL', x: SCREEN_W - ballW - 4, y, w: ballW, h },
  ];
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
  drawCaption(text, anchorScreenX, anchorScreenY) {
    const lines = wrapText(text, CAPTION_MAX_W);
    const lineH = GLYPH_H + LINE_GAP;
    let top = Math.round(anchorScreenY) - 22 - lines.length * lineH;
    top = Math.max(4, Math.min(top, SCREEN_H - lines.length * lineH - 4));
    lines.forEach((line, i) => {
      const w = measureText(line);
      let cx = Math.round(anchorScreenX);
      cx = Math.max(2 + w / 2, Math.min(cx, SCREEN_W - 2 - w / 2));
      this.drawText(line, cx, top + i * lineH);
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

    // Angular stars twinkling in the dark — sharp 4-point spikes at the peak.
    for (const s of game.world.sparklesInRect(viewX, viewY, SCREEN_W, SCREEN_H)) {
      const glow = Math.sin(game.time * s.rate * 2 + s.phase);
      const pts = starPixels(glow, starSize(s));
      if (pts.length === 0) continue;
      const x = Math.round(s.x - viewX);
      const y = Math.round(s.y - viewY);
      ctx.fillStyle = glow >= 0.9 ? PALETTE.moonlight : SPARKLE_TINTS[s.tint % SPARKLE_TINTS.length];
      for (const p of pts) ctx.fillRect(x + p.x, y + p.y, 1, 1);
    }

    // Tap-to-move marker: a small marching cross where the walk will end.
    if (game.moveTarget) {
      const mx = Math.round(game.moveTarget.x - viewX);
      const my = Math.round(game.moveTarget.y - viewY);
      ctx.fillStyle = LEASH_COLORS[this.frame % LEASH_COLORS.length];
      ctx.fillRect(mx - 2, my, 1, 1);
      ctx.fillRect(mx + 2, my, 1, 1);
      ctx.fillRect(mx, my - 2, 1, 1);
      ctx.fillRect(mx, my + 2, 1, 1);
      ctx.fillStyle = PALETTE.moonlight;
      ctx.fillRect(mx, my, 1, 1);
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
      this.drawCaption(game.caption.text, a.x - viewX, a.y - viewY);
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
    // scatter a few noise blocks — the signal skips for a beat.
    if (game.glitch && game.glitch.t > 0) {
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

    this.sweepCache();
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
