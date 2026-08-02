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
