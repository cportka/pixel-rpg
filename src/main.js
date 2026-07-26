// Browser entry point: canvas setup, integer upscaling, input, and the loop.

import { Game } from './core/game.js';
import { Renderer, SCREEN_W, SCREEN_H } from './gfx/renderer.js';

const canvas = document.getElementById('screen');
canvas.width = SCREEN_W;
canvas.height = SCREEN_H;

const params = new URLSearchParams(location.search);
const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : (Date.now() & 0xffffffff) >>> 0;

const game = new Game(seed);
const renderer = new Renderer(canvas);

// Integer upscale to the largest multiple that fits the window.
function fit() {
  const scale = Math.max(1, Math.floor(Math.min(innerWidth / SCREEN_W, innerHeight / SCREEN_H)));
  canvas.style.width = `${SCREEN_W * scale}px`;
  canvas.style.height = `${SCREEN_H * scale}px`;
}
addEventListener('resize', fit);
fit();

const keys = new Set();
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
    swap: keys.has('swap'),
    action: keys.has('action'),
  };
}

// Fixed-step simulation, rendered every animation frame.
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    game.update(STEP, inputState());
    acc -= STEP;
  }
  renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at the world from devtools.
window.game = game;
