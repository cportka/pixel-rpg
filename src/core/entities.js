// Characters: the person and their dog.
//
// Positions are world-space floats at the character's feet (bottom-center).
// Collision uses a small feet box so characters can walk behind canopies and
// only trunks block them. Whichever character isn't player-controlled follows
// the other with a simple come-along AI.

export const PERSON = {
  kind: 'person',
  speed: 69, // px/s (v0.16: the world grew 1.5x with the art)
  feetW: 9,
  feetH: 5,
};

export const DOG = {
  kind: 'dog',
  speed: 87, // dogs are quicker
  feetW: 14,
  feetH: 5,
};

export const FOLLOW_START = 60; // follower starts moving beyond this distance
export const FOLLOW_STOP = 36; // ...and settles once back within this

export function makeCharacter(spec, x, y) {
  return {
    kind: spec.kind,
    x,
    y,
    speed: spec.speed,
    feetW: spec.feetW,
    feetH: spec.feetH,
    facing: 1, // +1 right, -1 left (sprites flip)
    walking: false,
    animTime: 0,
    following: false, // AI hysteresis state
  };
}

/** The character's feet collision box (top-left + size). */
export function feetBox(ch, x = ch.x, y = ch.y) {
  return { x: x - ch.feetW / 2, y: y - ch.feetH, w: ch.feetW, h: ch.feetH };
}

/**
 * Move a character by a unit-ish direction vector for dt seconds, resolving
 * collisions per axis so sliding along a trunk works. Returns true if it moved.
 */
export function moveCharacter(ch, dirX, dirY, dt, world) {
  const len = Math.hypot(dirX, dirY);
  if (len < 1e-6) {
    ch.walking = false;
    return false;
  }
  const nx = dirX / len;
  const ny = dirY / len;
  const stepX = nx * ch.speed * dt;
  const stepY = ny * ch.speed * dt;
  let moved = false;

  const tryAxis = (dx, dy) => {
    const b = feetBox(ch, ch.x + dx, ch.y + dy);
    if (!world.collides(b.x, b.y, b.w, b.h)) {
      ch.x += dx;
      ch.y += dy;
      moved = true;
    }
  };
  tryAxis(stepX, 0);
  tryAxis(0, stepY);

  if (Math.abs(nx) > 0.05) ch.facing = nx > 0 ? 1 : -1;
  ch.walking = moved;
  if (moved) ch.animTime += dt;
  return moved;
}

/**
 * Come-along AI: walk toward the leader when too far, stop when close.
 * Hysteresis (start/stop radii) prevents jittering at the boundary.
 */
export function updateFollower(follower, leader, dt, world) {
  const dx = leader.x - follower.x;
  const dy = leader.y - follower.y;
  const dist = Math.hypot(dx, dy);
  if (follower.following) {
    if (dist <= FOLLOW_STOP) follower.following = false;
  } else if (dist >= FOLLOW_START) {
    follower.following = true;
  }
  if (follower.following && dist > 1) {
    moveCharacter(follower, dx, dy, dt, world);
  } else {
    follower.walking = false;
  }
}
