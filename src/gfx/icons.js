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
  // COIN — one small bright disc (v0.20).
  coin: {
    sprite: [
      '.........',
      '..ggggg..',
      '.gkkggga.',
      '.gkgggga.',
      '.gggggga.',
      '.gggggga.',
      '..gggaa..',
      '.........',
      '.........',
    ],
    colors: { g: PALETTE.gold, k: PALETTE.goldRose, a: PALETTE.amber },
  },
  // WOOD — planks, stacked the way they immediately stop being.
  wood: {
    sprite: [
      '.........',
      '..llllll.',
      '..cccccc.',
      '.llllll..',
      '.cccccc..',
      '..llllll.',
      '..cccccc.',
      '.........',
      '.........',
    ],
    colors: { l: PALETTE.loam, c: PALETTE.clay },
  },
  // AXE — brass head, clay haft.
  axe: {
    sprite: [
      '.bbb.....',
      'bbbbb....',
      'bbkbb....',
      '.bbbh....',
      '....hh...',
      '.....hh..',
      '......hh.',
      '.......h.',
      '.........',
    ],
    colors: { b: PALETTE.brass, k: PALETTE.gold, h: PALETTE.clay },
  },
  // ROPE — the honest tool, coiled properly.
  rope: {
    sprite: [
      '.........',
      '..aaaaa..',
      '.aa...aa.',
      '.a.....a.',
      '.a.....a.',
      '.aa...aa.',
      '..aaaaa..',
      '....aa...',
      '.........',
    ],
    colors: { a: PALETTE.amber },
  },
  // MANUAL — HOW TO BUILD A BOAT, ghost-press edition.
  manual: {
    sprite: [
      '.........',
      '.uuuuuuu.',
      '.uWWWWWu.',
      '.uWsssWu.',
      '.uWWWWWu.',
      '.uWsssWu.',
      '.uWWWWWu.',
      '.uuuuuuu.',
      '.........',
    ],
    colors: { u: PALETTE.purple, W: PALETTE.moonlight, s: PALETTE.smoke },
  },
  // SWORD — Cortie's honest steel (v0.21).
  sword: {
    sprite: [
      '.......W.',
      '......WW.',
      '.....WW..',
      '....WW...',
      '.b.WW....',
      '..bW.....',
      '..cb.....',
      '.c..b....',
      '.........',
    ],
    colors: { W: PALETTE.moonlight, b: PALETTE.brass, c: PALETTE.clay },
  },
  // WAND — the crooked little lightning rod.
  wand: {
    sprite: [
      '.......m.',
      '......mv.',
      '.....cv..',
      '.....c...',
      '....c....',
      '...c.....',
      '..c......',
      '.c.......',
      '.........',
    ],
    colors: { c: PALETTE.clay, v: PALETTE.violet, m: PALETTE.magenta },
  },
  // SCROLL — rolled thunder, tied in violet.
  scroll: {
    sprite: [
      '.........',
      '.WWWWWW..',
      'W......W.',
      '.WWWWWWW.',
      '..W...W..',
      '..WvvvW..',
      '..W...W..',
      '..WWWWW..',
      '.........',
    ],
    colors: { W: PALETTE.moonlight, v: PALETTE.violet },
  },
  // LAMP — something in there sleeps lightly.
  lamp: {
    sprite: [
      '....g....',
      '.........',
      '..bbbb...',
      '.bbbbbba.',
      'bbbbbbba.',
      '.bbbbba..',
      '..bbba...',
      '.b....a..',
      '.........',
    ],
    colors: { b: PALETTE.brass, g: PALETTE.gold, a: PALETTE.amber },
  },
  // PIPE — one bowl of the green leaf.
  pipe: {
    sprite: [
      '.....s...',
      '....s....',
      '.....s...',
      '.........',
      'gg.......',
      'ggcccccc.',
      '.ggc...c.',
      '..cc..cc.',
      '.........',
    ],
    colors: { c: PALETTE.clay, g: PALETTE.leaf, s: PALETTE.smoke },
  },
  // BOAT — she floats. somehow, she floats.
  boat: {
    sprite: [
      '....c....',
      '....cWW..',
      '....cWWW.',
      '....cWW..',
      '....c....',
      '.bbbbbbb.',
      '..ccccc..',
      '...aaa...',
      '.........',
    ],
    colors: { c: PALETTE.clay, W: PALETTE.moonlight, b: PALETTE.brass, a: PALETTE.amber },
  },
};
