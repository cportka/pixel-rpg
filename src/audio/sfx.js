// The 8-bit sound set — pure data, no Web Audio here.
//
// Every sound is an array of segments played relative to one start time:
//   { type: 'tone', wave, f0, f1?, d, v, t? }  — an oscillator sweep
//   { type: 'noise', f0, f1?, d, v, t? }       — bandpass-filtered noise
// f in Hz, d = duration seconds, v = gain (pre-master), t = start offset.
// Volumes are deliberately soft; the forest is a quiet place.

export const SOUNDS = {
  // Movement — barely-there ticks at stride cadence.
  'step-person': [{ type: 'noise', f0: 750, f1: 420, d: 0.045, v: 0.05 }],
  'step-dog': [{ type: 'noise', f0: 1400, f1: 900, d: 0.03, v: 0.035 }],

  // Talking — a two-note dialog blip; the whimper droops like a real one.
  caption: [
    { type: 'tone', wave: 'square', f0: 660, d: 0.04, v: 0.05 },
    { type: 'tone', wave: 'square', f0: 880, d: 0.055, v: 0.05, t: 0.05 },
  ],
  whimper: [
    { type: 'tone', wave: 'triangle', f0: 1150, f1: 920, d: 0.12, v: 0.07 },
    { type: 'tone', wave: 'triangle', f0: 1000, f1: 700, d: 0.18, v: 0.06, t: 0.16 },
  ],

  // Menus.
  'menu-open': [
    { type: 'tone', wave: 'triangle', f0: 440, d: 0.06, v: 0.09 },
    { type: 'tone', wave: 'triangle', f0: 554, d: 0.06, v: 0.09, t: 0.06 },
    { type: 'tone', wave: 'triangle', f0: 659, d: 0.09, v: 0.09, t: 0.12 },
  ],
  'menu-move': [{ type: 'tone', wave: 'square', f0: 880, d: 0.03, v: 0.05 }],
  'menu-confirm': [
    { type: 'tone', wave: 'square', f0: 660, d: 0.05, v: 0.08 },
    { type: 'tone', wave: 'square', f0: 990, d: 0.07, v: 0.08, t: 0.055 },
  ],

  // The dice — a rattle and a landing ping.
  roll: [
    { type: 'noise', f0: 2600, f1: 2200, d: 0.03, v: 0.06 },
    { type: 'noise', f0: 2200, f1: 1800, d: 0.03, v: 0.06, t: 0.05 },
    { type: 'noise', f0: 1800, f1: 1500, d: 0.03, v: 0.06, t: 0.1 },
    { type: 'tone', wave: 'square', f0: 1320, d: 0.08, v: 0.07, t: 0.16 },
  ],

  // Hurting and mending.
  damage: [{ type: 'tone', wave: 'square', f0: 220, f1: 96, d: 0.2, v: 0.11 }],
  heal: [
    { type: 'tone', wave: 'triangle', f0: 523, d: 0.07, v: 0.09 },
    { type: 'tone', wave: 'triangle', f0: 659, d: 0.07, v: 0.09, t: 0.07 },
    { type: 'tone', wave: 'triangle', f0: 784, d: 0.11, v: 0.09, t: 0.14 },
  ],
  collapse: [
    { type: 'tone', wave: 'sawtooth', f0: 440, f1: 52, d: 0.65, v: 0.13 },
    { type: 'noise', f0: 900, f1: 150, d: 0.5, v: 0.06, t: 0.12 },
  ],

  // Being two creatures.
  swap: [
    { type: 'tone', wave: 'square', f0: 440, f1: 233, d: 0.07, v: 0.08 },
    { type: 'tone', wave: 'square', f0: 233, f1: 466, d: 0.09, v: 0.08, t: 0.08 },
  ],

  // Fetch.
  throw: [{ type: 'noise', f0: 400, f1: 1900, d: 0.18, v: 0.08 }],
  pickup: [{ type: 'tone', wave: 'square', f0: 988, f1: 1175, d: 0.06, v: 0.08 }],
  deliver: [
    { type: 'tone', wave: 'square', f0: 523, d: 0.06, v: 0.09 },
    { type: 'tone', wave: 'square', f0: 659, d: 0.06, v: 0.09, t: 0.06 },
    { type: 'tone', wave: 'square', f0: 784, d: 0.06, v: 0.09, t: 0.12 },
    { type: 'tone', wave: 'square', f0: 1047, d: 0.1, v: 0.09, t: 0.18 },
  ],

  // Story beats.
  meet: [
    { type: 'tone', wave: 'triangle', f0: 392, d: 0.11, v: 0.13 },
    { type: 'tone', wave: 'triangle', f0: 523, d: 0.11, v: 0.13, t: 0.11 },
    { type: 'tone', wave: 'triangle', f0: 659, d: 0.11, v: 0.13, t: 0.22 },
    { type: 'tone', wave: 'triangle', f0: 784, d: 0.2, v: 0.13, t: 0.33 },
  ],
  inflatables: [
    { type: 'tone', wave: 'triangle', f0: 330, f1: 415, d: 0.12, v: 0.09 },
    { type: 'tone', wave: 'triangle', f0: 415, f1: 330, d: 0.12, v: 0.09, t: 0.12 },
    { type: 'tone', wave: 'triangle', f0: 330, f1: 494, d: 0.16, v: 0.09, t: 0.24 },
  ],
  genie: [
    { type: 'tone', wave: 'triangle', f0: 330, d: 0.09, v: 0.1 },
    { type: 'tone', wave: 'triangle', f0: 415, d: 0.09, v: 0.1, t: 0.09 },
    { type: 'tone', wave: 'triangle', f0: 494, d: 0.09, v: 0.1, t: 0.18 },
    { type: 'tone', wave: 'triangle', f0: 659, f1: 880, d: 0.22, v: 0.1, t: 0.27 },
  ],
  vision: [
    { type: 'tone', wave: 'triangle', f0: 523, f1: 554, d: 0.25, v: 0.08 },
    { type: 'tone', wave: 'triangle', f0: 622, f1: 659, d: 0.25, v: 0.08, t: 0.22 },
    { type: 'tone', wave: 'triangle', f0: 740, f1: 784, d: 0.35, v: 0.08, t: 0.44 },
  ],
  vanish: [
    { type: 'tone', wave: 'square', f0: 1200, f1: 2400, d: 0.07, v: 0.07 },
    { type: 'tone', wave: 'square', f0: 800, f1: 1600, d: 0.07, v: 0.06, t: 0.05 },
  ],

  // The undead and the equipment for dealing with them.
  zombie: [
    { type: 'tone', wave: 'sawtooth', f0: 95, f1: 62, d: 0.45, v: 0.1 },
    { type: 'noise', f0: 300, f1: 180, d: 0.3, v: 0.04, t: 0.1 },
  ],
  bonk: [
    { type: 'noise', f0: 320, f1: 130, d: 0.09, v: 0.12 },
    { type: 'tone', wave: 'triangle', f0: 150, f1: 110, d: 0.08, v: 0.1, t: 0.02 },
  ],
  eat: [
    { type: 'noise', f0: 700, f1: 400, d: 0.06, v: 0.08 },
    { type: 'noise', f0: 600, f1: 350, d: 0.07, v: 0.08, t: 0.12 },
    { type: 'tone', wave: 'triangle', f0: 523, f1: 659, d: 0.09, v: 0.07, t: 0.24 },
  ],
  drunk: [
    { type: 'tone', wave: 'triangle', f0: 440, f1: 392, d: 0.2, v: 0.09 },
    { type: 'tone', wave: 'triangle', f0: 392, f1: 466, d: 0.3, v: 0.09, t: 0.2 },
    { type: 'tone', wave: 'triangle', f0: 466, f1: 415, d: 0.35, v: 0.08, t: 0.5 },
  ],
};

/** Every event name the game can emit. main.js plays these 1:1. */
export const EVENT_NAMES = Object.keys(SOUNDS);
