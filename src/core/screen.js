// The logical viewport, in world pixels.
//
// v0.16 halved the size of a game pixel: 624x360... no — 624x540 logical at
// the common 2x integer upscale is 1248x1080 device pixels, the same physical
// picture v0.14 drew as 416x360 at 3x. Every game pixel is now 2x2 device
// pixels instead of 3x3, so lines are a third as thick and there is half
// again as much room for detail in both axes. World art grew ~1.5x to match;
// the 8px UI font deliberately did NOT, which is what un-cramps the menus.
//
// Lives in core (not gfx) because the simulation needs it too: the lost dog
// must spawn outside the opening view, whatever size the view is.

export const SCREEN_W = 624;
export const SCREEN_H = 540;

// Below this coverage, crisp-but-small loses to filling the screen: if the
// integer scale would use less than 85% of what the window could hold, take
// the fractional scale instead. Phones (raw ~1.9 → floored to a postage
// stamp) and maximized desktops (raw ~2.7 → stuck at 2x with huge borders)
// are exactly the cases this rescues; a window that already sits near an
// integer keeps perfectly uniform pixels.
export const FIT_COVERAGE = 0.85;

/**
 * The upscale factor for a window of availW x availH device pixels (v0.18).
 * Integer when an integer covers enough of the window (uniform game pixels),
 * fractional when flooring would waste real estate, and always fractional
 * below 1x so tiny embeds shrink instead of cropping.
 */
export function fitScale(availW, availH, screenW = SCREEN_W, screenH = SCREEN_H) {
  const raw = Math.min(availW / screenW, availH / screenH);
  if (raw <= 0) return 0.01; // a zero-sized window measures mid-layout; keep sane
  if (raw < 1) return raw;
  const whole = Math.floor(raw);
  return whole / raw >= FIT_COVERAGE ? whole : raw;
}
