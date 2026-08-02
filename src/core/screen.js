// The logical viewport, in world pixels.
//
// v0.15 halved the size of a game pixel: 624x360... no — 624x540 logical at
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
