// The game's palette, lifted from the style-reference recording
// (video-bug-analyzer --palette): black void, white figures, ember reds,
// forest greens, bark browns, and the pink fetch ball.

export const PALETTE = {
  black: '#000000',
  white: '#fdfdfd',
  redDeep: '#6c0e07',
  red: '#b82a10',
  redBright: '#ea370f',
  greenDeep: '#53761b',
  green: '#64a82f',
  brown: '#865c22',
  barkDark: '#3c331d',
  soilDark: '#1f0d05',
  pink: '#e39c83',
};

// Sprite maps use single characters; '.' is transparent.
export const SPRITE_COLORS = {
  W: PALETTE.white,
  P: PALETTE.pink,
  R: PALETTE.redBright,
  r: PALETTE.red,
};

// Sparkle tints for the magical motes (indexed by sparkle.tint).
export const SPARKLE_TINTS = [PALETTE.white, PALETTE.pink, PALETTE.green];
