// Browser entry point: canvas setup, integer upscaling, input, and the loop.

import { Game } from './core/game.js';
import { Renderer, SCREEN_W, SCREEN_H, RENDER_FPS } from './gfx/renderer.js';

const canvas = document.getElementById('screen');
canvas.width = SCREEN_W;
canvas.height = SCREEN_H;

const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : (Date.now() & 0xffffffff) >>> 0;

// ?story=0 skips the opening and starts with the dog found and leashed.
const game = new Game(seed, { story: params.get('story') !== '0' });
const renderer = new Renderer(canvas);

// Integer upscale to the largest multiple that fits the window — computed in
// DEVICE pixels so fractional devicePixelRatio (125%/150% displays) still gets
// uniform game pixels under image-rendering: pixelated.
function fit() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.max(
    1,
    Math.floor(Math.min((innerWidth * dpr) / SCREEN_W, (innerHeight * dpr) / SCREEN_H)),
  );
  canvas.style.width = `${(SCREEN_W * scale) / dpr}px`;
  canvas.style.height = `${(SCREEN_H * scale) / dpr}px`;
}
addEventListener('resize', fit);
fit();

const keys = new Set();
const pressed = new Set(); // taps latched between simulation steps
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Tab: 'swap', KeyC: 'swap',
  Space: 'action', KeyE: 'action',
};
addEventListener('keydown', (e) => {
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

function inputState() {
  return {
    up: keys.has('up'),
    down: keys.has('down'),
    left: keys.has('left'),
    right: keys.has('right'),
    swap: keys.has('swap') || pressed.has('swap'),
    action: keys.has('action') || pressed.has('action'),
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
