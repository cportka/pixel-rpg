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

// v0.19: the viewport is DYNAMIC. These are live bindings — main.js sets
// them from the real window via setScreenSize(), and every module that
// imports them reads the current value at call time (ESM live bindings).
// 624x540 stays the default: it is the reference view the art was tuned
// against, the size headless tests run at, and what any non-browser
// consumer sees.
export let SCREEN_W = 624;
export let SCREEN_H = 540;

/** Resize the logical viewport (main.js calls this from fit()). */
export function setScreenSize(w, h) {
  SCREEN_W = Math.max(1, Math.round(w));
  SCREEN_H = Math.max(1, Math.round(h));
}

// The view's sanity rails. MIN is the smallest screen the HUD, menus, and
// map legend were ever designed against (416x360 was once the whole game,
// minus a little grace); MAX caps the draw cost so a 4K monitor zooms out
// to see more world without quadrupling the per-frame work.
export const VIEW_MIN_W = 416;
export const VIEW_MIN_H = 360;
export const VIEW_MAX_W = 1440;
export const VIEW_MAX_H = 1080;

/**
 * Choose the upscale AND the logical size for a window (v0.19: no fixed
 * aspect — the canvas fills the window edge to edge, and what changes with
 * the window's shape is how much world you see).
 *
 * The scale starts from "a game pixel should be about 1.5 CSS pixels"
 * (2 device pixels on a plain desktop — the v0.16 art thesis), then bends:
 * up if the view would exceed VIEW_MAX (big monitors see more world, not
 * infinitely more), down if it would fall below VIEW_MIN (small windows
 * zoom in rather than crush the UI). Scales of 2+ snap to integers for
 * uniform pixels; below that they stay fractional so tiny embeds shrink
 * smoothly instead of cropping.
 *
 * Returns { w, h, scale } — logical size in game pixels, scale in device
 * pixels per game pixel.
 */
export function viewFor(availW, availH, dpr = 1) {
  if (!(availW > 0) || !(availH > 0)) return { w: SCREEN_W, h: SCREEN_H, scale: 1 };
  let scale = Math.max(2, Math.floor(1.5 * dpr + 0.01));
  scale = Math.max(scale, availW / VIEW_MAX_W, availH / VIEW_MAX_H);
  scale = Math.min(scale, availW / VIEW_MIN_W, availH / VIEW_MIN_H);
  if (scale >= 2) {
    // Snap to an integer for uniform pixels — unless snapping up would
    // squeeze the view meaningfully below the minimums.
    const snapped = Math.round(scale);
    const ok = availW / snapped >= VIEW_MIN_W - 40 && availH / snapped >= VIEW_MIN_H - 40;
    scale = ok ? snapped : Math.round(scale * 2) / 2;
  }
  scale = Math.max(scale, 0.25);
  return {
    w: Math.max(1, Math.round(availW / scale)),
    h: Math.max(1, Math.round(availH / scale)),
    scale,
  };
}
