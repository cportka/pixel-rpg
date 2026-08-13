// The neo-noir palette — v0.16's 16-bit rebuild.
//
// Art direction: minimal neo-noir in purple, pink, golden rose, dirt, and
// dark nature. Where v0.14 had a dozen flat colors, this is a set of short
// RAMPS — each 3-4 steps of one hue — so anything can be shaded a step down
// toward night or a step up toward moonlight without inventing a color.
// Restraint lives in how few ramps there are, not in how few pixels use them.
//
//   NIGHT    the violet-black the world sits in
//   DIRT     warm earth: the forest floor is soil, not void
//   NATURE   deep desaturated greens, barely lit
//   PLUM     the signature purple → violet → orchid climb
//   ROSE     pink, and the hot rose that only embers and eyes get
//   GOLD     amber → brass → golden rose: the one warm light
//   MOON     the near-white the person and the dog are cut from

export const PALETTE = {
  // NIGHT
  void: '#0a0712', // the dark between the trees
  night: '#120c1c', // one step up: distant ground
  umbra: '#170f22', // soft shadow, floor speckle
  fog: '#1d1429', // deepest smoke
  dusk: '#271a38', // where night meets the trees

  // DIRT — the ground the whole game stands on
  soil: '#1b1319', // darkest earth
  dirt: '#2a1d21', // the forest floor
  clay: '#3b2926', // trodden paths, bare patches
  loam: '#54393a', // dirt catching a little moon

  // DARK NATURE
  pine: '#15211c', // needle-black
  moss: '#23362b', // undergrowth
  fern: '#3a5741', // the lit face of a leaf
  leaf: '#6d9c5c', // the one bright green: the pipe's half-burnt leaf

  // PLUM → VIOLET
  plumDeep: '#2c1435', // deep wine bark
  plum: '#48214f', // mid-plum
  purple: '#6a3080', // core purple
  violet: '#9558cc', // violet highlight
  orchid: '#bd86dd', // the palest violet, for rims

  // ROSE
  magenta: '#d64a9e', // neon ember
  pink: '#f06ab0', // the fetch ball
  hotRose: '#ff8fc4', // the hottest point of a flame

  // GOLD — lamplight, brass, the warm accent the noir turns on
  amber: '#6f4630', // dark warm shadow
  brass: '#b8834a', // lit brass
  gold: '#e0ab63', // lamplight
  goldRose: '#f4c8a6', // golden rose: the warmest highlight in the game

  // MOON — characters, captions, rims
  moonlight: '#f4eefb',
  moonshadow: '#b3a9c6',
  smoke: '#7d7391', // pale smoky lavender-grey
  smokeDeep: '#463253', // dusky purple smoke

  // WATER
  waterDeep: '#0e1430',
  waterEdge: '#27365e',
  blue: '#5a68e0', // cold electric blue

  // Interiors
  parquet: '#2a1b26',
};

// Sprite maps use single characters; '.' is transparent. The character
// ramp runs W (moonlit) → s (turned away) → d (deep shadow), with r for the
// rose-gold rim light that catches a shoulder or a muzzle.
export const SPRITE_COLORS = {
  W: PALETTE.moonlight,
  s: PALETTE.moonshadow,
  d: PALETTE.smoke,
  r: PALETTE.goldRose,
  P: PALETTE.pink,
  R: PALETTE.magenta,
};

// Sparkle tints for the magical motes (indexed by sparkle.tint) — moonlight,
// violet, and one warm gold, so the dark has a little gold dust in it.
export const SPARKLE_TINTS = [PALETTE.moonlight, PALETTE.violet, PALETTE.gold];

// The dotted leash cycles through these as its dots march.
export const LEASH_COLORS = [PALETTE.magenta, PALETTE.violet, PALETTE.orchid];

// --- HEAVEN (v0.17) ---------------------------------------------------------
//
// The higher level behind the television glass: the same world, inverted into
// warm light. Every night color has a heaven counterpart under the SAME key,
// and the renderer remaps colors at draw time — so heaven costs the art
// modules nothing. Design rules of the inversion:
//
//   - the void becomes warm cream: the world is bright now, not dark
//   - MOON inverts to ink-rosewood: figures are dark strokes on the light,
//     the way the night drew them light on the dark
//   - GOLD stays gold (only warmer) — the one constant across both planes
//   - the plum/violet canopies turn dusty rose and blush pink
//   - water goes pale silver: the Styx is the coldest thing in heaven
//   - umbra lands DARKER than the ground, so shadows still ground things
export const HEAVEN = {
  // NIGHT → warm cream
  void: '#f6e8da',
  night: '#f2e1d0',
  umbra: '#e3cbb9', // the shadow tone: darker than the ground it falls on
  fog: '#f3e2d1', // panel fill: a lighter cream so chrome still lifts
  dusk: '#ecd5c5',

  // DIRT → sun-warmed sand, a whisper above the cream
  soil: '#f0dfc7',
  dirt: '#ecd7ba',
  clay: '#e3c6a1',
  loam: '#d6b183',

  // NATURE → golden grass
  pine: '#e7d5ae',
  moss: '#ecdcb8',
  fern: '#f1e3c2',
  leaf: '#c9a84c',

  // PLUM → dusty rose, blush
  plumDeep: '#d69a86',
  plum: '#eba9a2',
  purple: '#f5b3b8',
  violet: '#fbc9cd',
  orchid: '#ffdfe0',

  // ROSE — still hot; embers stay embers
  magenta: '#e26a95',
  pink: '#f27ba6',
  hotRose: '#ff9cc0',

  // GOLD — warmer than ever; heaven runs on it
  amber: '#c08a3e',
  brass: '#d9a83f',
  gold: '#f2c14e',
  goldRose: '#ffe2a0',

  // MOON → ink: figures and words are dark up here
  moonlight: '#432437',
  moonshadow: '#7a4a55',
  smoke: '#b0877b',
  smokeDeep: '#a1746b',

  // WATER → the pale silver Styx
  waterDeep: '#cfd9e8',
  waterEdge: '#e0e6ef',
  blue: '#93a6d9',

  // Interiors
  parquet: '#eadbc8',
};

// The draw-time remap: night hex → heaven hex. Unknown colors pass through.
const NIGHT_TO_HEAVEN = new Map(Object.keys(PALETTE).map((k) => [PALETTE[k], HEAVEN[k]]));

/** The heaven counterpart of a night color (identity for unmapped colors). */
export function heavenColor(c) {
  return NIGHT_TO_HEAVEN.get(c) ?? c;
}

// Sparkles get their own heaven tints rather than the remap: moonlight maps
// to ink up there, and heaven's motes should be gold dust, not soot.
export const HEAVEN_SPARKLES = [HEAVEN.gold, HEAVEN.hotRose, HEAVEN.goldRose];
