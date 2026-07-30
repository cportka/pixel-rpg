// The logical viewport, in world pixels. Art stays at its usual scale — a
// bigger viewport just shows more forest. 416x360 is chosen so the common 3x
// integer upscale lands at 1248x1080 device pixels (>= the 1240x1080 ask),
// and the ratio matches it almost exactly. Lives in core (not gfx) because
// the simulation also needs it: the lost dog must spawn outside the opening
// view, whatever size the view is.

export const SCREEN_W = 416;
export const SCREEN_H = 360;
