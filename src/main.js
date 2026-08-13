// Browser entry point: canvas setup, integer upscaling, input, and the loop.

import { Game } from './core/game.js';
import { Renderer, SCREEN_W, SCREEN_H, RENDER_FPS, uiButtons, choicePanel, hudRect } from './gfx/renderer.js';
import { fitScale } from './core/screen.js';
import { AudioPlayer } from './audio/engine.js';

const canvas = document.getElementById('screen');
canvas.width = SCREEN_W;
canvas.height = SCREEN_H;

const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : (Date.now() & 0xffffffff) >>> 0;

// ?story=0 skips the opening and starts with the dog found and leashed.
const game = new Game(seed, { story: params.get('story') !== '0' });
const renderer = new Renderer(canvas);

// Touch UI shows on coarse pointers (phones/tablets), on first touch, or
// forced with ?touch=1 for demos and screenshots.
renderer.showTouchUI =
  params.get('touch') === '1' ||
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);

// ?glitch=<seconds> forces a transition glitch at load (demos/screenshots).
if (params.has('glitch')) game.triggerGlitch(Number(params.get('glitch')) || 3);

// ?enc=dumpster|cat|lamp|pipe|zombie plants that encounter beside the spawn and
// opens its menu right away (demos/testing).
const enc = params.get('enc');
if (enc === 'dumpster' || enc === 'cat' || enc === 'lamp' || enc === 'pipe' || enc === 'zombie') {
  const field = { dumpster: 'dumpsters', cat: 'cats', lamp: 'lamps', pipe: 'pipes', zombie: 'zombies' }[enc];
  game.world.chunkAt(0, 0)[field].push({ x: 22, y: 4, phase: 0 });
  game.checkEncounters();
}

// Upscale to fit the window — computed in DEVICE pixels so fractional
// devicePixelRatio (125%/150% displays) still gets uniform game pixels under
// image-rendering: pixelated. The scale policy lives in fitScale(): integer
// when an integer fills enough of the window, fractional when flooring would
// waste it (phones, maximized desktops), fractional below 1x so tiny embeds
// shrink instead of cropping.
//
// v0.18 retired the forced-landscape rotation: the game now simply fills
// whatever orientation the device is in. Portrait gets the full width;
// nothing is rotated, locked, or remapped.
function fit() {
  const dpr = window.devicePixelRatio || 1;
  // visualViewport tracks the space the page REALLY has on mobile (URL bar
  // sliding in and out, pinch state); innerWidth/Height is the fallback.
  const vw = window.visualViewport?.width ?? innerWidth;
  const vh = window.visualViewport?.height ?? innerHeight;
  const scale = fitScale(vw * dpr, vh * dpr);
  canvas.style.width = `${(SCREEN_W * scale) / dpr}px`;
  canvas.style.height = `${(SCREEN_H * scale) / dpr}px`;
}
// Every way the available space can change: window resize/maximize,
// fullscreen toggles, device rotation, the mobile URL bar, and the window
// moving to a monitor with a different devicePixelRatio.
addEventListener('resize', fit);
addEventListener('orientationchange', fit);
document.addEventListener('fullscreenchange', fit);
window.visualViewport?.addEventListener('resize', fit);
matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener?.('change', fit);
fit();

// 8-bit sound: the context wakes on the first input (browser autoplay
// rules); M toggles mute, ?mute=1 starts muted.
const audio = new AudioPlayer();
audio.muted = params.get('mute') === '1';
addEventListener('pointerdown', () => audio.resume());
addEventListener('keydown', () => audio.resume());

const keys = new Set();
const pressed = new Set(); // taps latched between simulation steps
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Tab: 'swap', KeyC: 'swap',
  Space: 'action', KeyE: 'action',
  KeyI: 'sheet',
  KeyP: 'map',
};
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) audio.muted = !audio.muted;
  const action = KEYMAP[e.code];
  if (action) {
    keys.add(action);
    if (!e.repeat) pressed.add(action); // survive a tap released mid-hitch
    e.preventDefault();
  }
});
addEventListener('keyup', (e) => {
  const action = KEYMAP[e.code];
  if (action) keys.delete(action);
});
addEventListener('blur', () => keys.clear());

// Tap / click to move: hit-test the touch buttons first, otherwise walk to
// the tapped world position. pointerdown covers mouse, touch, and pen.
// A double-click/double-tap on your own character pauses the game and opens
// the action & inventory screen.
const DOUBLE_TAP_MS = 400;
let lastSelfTap = 0;
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (e.pointerType !== 'mouse') renderer.showTouchUI = true;
  const rect = canvas.getBoundingClientRect();
  const sx = ((e.clientX - rect.left) / rect.width) * SCREEN_W;
  const sy = ((e.clientY - rect.top) / rect.height) * SCREEN_H;
  // An open choice menu captures every tap: pick the row or icon you touched.
  const panel = choicePanel(game);
  if (panel) {
    if (panel.icons) {
      for (const cell of panel.icons) {
        if (sx >= cell.x && sx < cell.x + cell.w && sy >= cell.y && sy < cell.y + cell.h) {
          game.choiceIndex = cell.index;
          game.resolveChoice(cell.id);
          return;
        }
      }
    }
    for (const row of panel.rows) {
      if (sx >= row.x && sx < row.x + row.w && sy >= row.y - 2 && sy < row.y + row.h) {
        game.choiceIndex = row.index;
        game.resolveChoice(row.id);
        return;
      }
    }
    return; // taps outside the panel do nothing while it's open
  }
  if (renderer.showTouchUI) {
    for (const b of uiButtons(game)) {
      if (sx >= b.x && sx < b.x + b.w && sy >= b.y && sy < b.y + b.h) {
        pressed.add(b.id); // same latch path as a key tap
        return;
      }
    }
  }
  // A tap on the HUD minimap opens the full map screen — only where the
  // minimap is actually drawn (it hides indoors).
  const hud = hudRect();
  if (
    game.location === 'world' &&
    sx >= hud.x && sx < hud.x + hud.w && sy >= hud.y && sy < hud.y + hud.h
  ) {
    game.openMap();
    return;
  }
  // Scene transitions outpace the 15fps render: if the last drawn frame
  // belongs to the other location, its view transform (and everything the
  // player is aiming at) is stale — swallow the tap.
  if (renderer.lastLocation !== game.location) return;
  const w = renderer.screenToWorld(sx, sy);
  // Did the tap land on the character you're controlling? (Anchored at the
  // feet; the sprite body rises ~16px above them.)
  const a = game.activeChar;
  if (Math.abs(w.x - a.x) <= 8 && w.y >= a.y - 18 && w.y <= a.y + 6) {
    const now = performance.now();
    if (now - lastSelfTap < DOUBLE_TAP_MS) {
      lastSelfTap = 0;
      game.openSheet();
      return;
    }
    lastSelfTap = now;
  } else {
    lastSelfTap = 0;
  }
  game.setMoveTarget(w.x, w.y);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function inputState() {
  return {
    up: keys.has('up'),
    down: keys.has('down'),
    left: keys.has('left'),
    right: keys.has('right'),
    swap: keys.has('swap') || pressed.has('swap'),
    action: keys.has('action') || pressed.has('action'),
    sheet: keys.has('sheet') || pressed.has('sheet'),
    map: keys.has('map') || pressed.has('map'),
  };
}

// Fixed-step simulation at 60Hz; presentation quantized to RENDER_FPS so the
// picture updates with the reference footage's chunky cadence.
const STEP = 1 / 60;
const RENDER_STEP = 1 / RENDER_FPS;
let last = performance.now();
let acc = 0;
let renderAcc = RENDER_STEP; // render the very first frame immediately
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  acc += dt;
  renderAcc += dt;
  last = now;
  let stepped = false;
  while (acc >= STEP) {
    game.update(STEP, inputState());
    acc -= STEP;
    stepped = true;
  }
  // Latched taps are cleared only once a step has actually consumed them.
  if (stepped) pressed.clear();
  // Play whatever the simulation heard this frame — louder while drunk.
  audio.intensity = game.drunk > 0 ? 1.7 : 1;
  for (const name of game.events) audio.play(name);
  game.events.length = 0;
  if (renderAcc >= RENDER_STEP) {
    renderer.render(game, renderAcc);
    // Carry the overshoot so cadence averages a true RENDER_FPS (zeroing it
    // ran ~13-14 fps with an irregular limp); clamp to one step so a long
    // hitch can't queue a catch-up burst.
    renderAcc = Math.min(renderAcc - RENDER_STEP, RENDER_STEP);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at the world from devtools.
window.game = game;
