// Inventory & stat icons for the character sheet — 9x9 pictographs in the
// neo-noir palette, drawn doubled (18x18) inside their cells. Pure data.

import { PALETTE } from './palette.js';

// Shared color letters: W moonlight, s smoke, v violet, m magenta, b blue,
// p pink, g leaf.
const C = {
  W: PALETTE.moonlight,
  s: PALETTE.smoke,
  v: PALETTE.violet,
  m: PALETTE.magenta,
  b: PALETTE.blue,
  p: PALETTE.pink,
  g: PALETTE.leaf,
};

export const ICONS = {
  // STR — a fist.
  str: {
    sprite: [
      '.........',
      '.WW.WW.W.',
      '.WWWWWWW.',
      '.WWWWWWW.',
      '..WWWWW..',
      '..WWWWW..',
      '...WWW...',
      '.........',
      '.........',
    ],
    colors: C,
  },
  // INT — a lit bulb.
  int: {
    sprite: [
      '...vvv...',
      '..v...v..',
      '.v..m..v.',
      '.v.mmm.v.',
      '.v..m..v.',
      '..v.m.v..',
      '...vvv...',
      '....v....',
      '...vvv...',
    ],
    colors: C,
  },
  // WIS — an open eye.
  wis: {
    sprite: [
      '.........',
      '..WWWWW..',
      '.W.....W.',
      'W...m...W',
      '.W.....W.',
      '..WWWWW..',
      '.........',
      '.........',
      '.........',
    ],
    colors: C,
  },
  // DEX — a lightning bolt.
  dex: {
    sprite: [
      '....bb...',
      '...bb....',
      '..bb.....',
      '.bbbbb...',
      '...bb....',
      '..bb.....',
      '.bb......',
      '.........',
      '.........',
    ],
    colors: C,
  },
  // CON — a heart.
  con: {
    sprite: [
      '.........',
      '..mm.mm..',
      '.mmmmmmm.',
      '.mmmmmmm.',
      '..mmmmm..',
      '...mmm...',
      '....m....',
      '.........',
      '.........',
    ],
    colors: C,
  },
  // CHA — a star.
  cha: {
    sprite: [
      '....p....',
      '....p....',
      '.ppppppp.',
      '..ppppp..',
      '...ppp...',
      '..pp.pp..',
      '.p.....p.',
      '.........',
      '.........',
    ],
    colors: C,
  },
  // The bone — a good club.
  bone: {
    sprite: [
      '.........',
      '.WW...WW.',
      '.WWWWWWW.',
      '..WWWWW..',
      '.WWWWWWW.',
      '.WW...WW.',
      '.........',
      '.........',
      '.........',
    ],
    colors: C,
  },
  // The meat still on it.
  meat: {
    sprite: [
      '.........',
      '.WW...WW.',
      '.WWmmmWW.',
      '..mmmmm..',
      '.WWmmmWW.',
      '.WW...WW.',
      '.........',
      '.........',
      '.........',
    ],
    colors: C,
  },
  // Spells — a rose-gold star of focus.
  spells: {
    sprite: [
      '....W....',
      '...WgW...',
      '..WggkW..',
      '.WggkggW.',
      'WgkkkkkgW',
      '.WggkggW.',
      '..WggW...',
      '.W..g..W.',
      'W.......W',
    ],
    colors: { ...C, g: PALETTE.gold, k: PALETTE.goldRose },
  },
  // The pink ball.
  ball: {
    sprite: [
      '.........',
      '...ppp...',
      '..ppppp..',
      '..ppWpp..',
      '..ppppp..',
      '...ppp...',
      '.........',
      '.........',
      '.........',
    ],
    colors: C,
  },
};
