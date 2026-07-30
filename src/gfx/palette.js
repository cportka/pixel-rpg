// Neo-noir palette: smokey darks and purples (chrisportka.com-inspired).
// A near-black violet void, smoke-and-plum trees with magenta ember flecks,
// moonlit silver figures, and the marching magenta/violet/blue leash from the
// owner's reference recording.

export const PALETTE = {
  void: '#08060d', // the dark between the trees
  moonlight: '#f2eefc', // characters + captions
  fog: '#1a1326', // deepest smoke, ground shadow
  smokeDeep: '#4a3566', // dusky purple smoke
  smoke: '#7d7391', // pale smoky lavender-grey
  plumDeep: '#3f1d4e', // deep wine-plum bark
  purple: '#6d3fa8', // core purple
  violet: '#9a5bff', // electric violet highlight
  magenta: '#e33fd0', // neon magenta ember
  blue: '#5561ff', // cold electric blue
  pink: '#ff4fc8', // the fetch ball
  leaf: '#6fae52', // the one green in the forest: the pipe's half-burnt leaf
};

// Sprite maps use single characters; '.' is transparent.
export const SPRITE_COLORS = {
  W: PALETTE.moonlight,
  P: PALETTE.pink,
  R: PALETTE.magenta,
};

// Sparkle tints for the magical motes (indexed by sparkle.tint).
export const SPARKLE_TINTS = [PALETTE.moonlight, PALETTE.violet, PALETTE.blue];

// The dotted leash cycles through these as its dots march.
export const LEASH_COLORS = [PALETTE.magenta, PALETTE.violet, PALETTE.blue];
