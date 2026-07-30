# pixel-rpg

A pixelated neo-noir RPG. At the beginning of the universe there is only the
dark and one small person, wandering the lonely woods — angular smoke-and-plum
trees in a violet-black void, twinkling motes between them, and stranger
things dancing where the woods grow deep. Somewhere out there
waits a friendly lost dog, a marching purple leash, a pink ball for fetch, and,
eventually, home. The story lives in `docs/STORY.md`.

**Version:** 0.4.0

## Play

**Live (GitHub Pages, deployed from `main`):** <https://cportka.github.io/pixel-rpg/>

Locally, serve the repo root over HTTP (ES modules won't load from `file://`):

```
npm start          # python3 -m http.server 8000
```

then open <http://localhost:8000>. Append `?seed=123` for a reproducible forest.

### Controls

| Key | Action |
| --- | --- |
| Tap / click | Walk to that spot (works on mobile and desktop) |
| Arrows / WASD | Walk (keys override a tap target) |
| Tab or C | Swap control between the person and the dog (once you've found them) |
| Space or E | Throw the ball (as the person) — the dog fetches |

On touch devices, pixel SWAP and BALL buttons appear in the bottom corners
(force them with `?touch=1`). You start alone; follow the whimpers to find the
dog. After that, whichever character you aren't controlling follows along on
its own.

## Architecture

No dependencies, no build step — plain ES modules and a 320x200 canvas
integer-upscaled with `image-rendering: pixelated`.

- `src/core/` — pure simulation, no DOM (fully covered by `node --test`):
  - `rng.js` — seeded PRNG + coordinate hashing; one world seed derives everything.
  - `world.js` — infinite chunked forest; each chunk (trees, bushes, sparkles) is
    a pure function of `(seed, cx, cy)`, generated lazily and cached.
  - `entities.js` — characters, per-axis collision against tree trunks
    (feet-box, so you can walk behind canopies), follow AI with hysteresis.
  - `game.js` — the story (alone → a friend → home), control swapping,
    captions, and the fetch state machine.
- `src/gfx/` — rendering:
  - `palette.js` — the neo-noir smokey-darks-and-purples palette.
  - `sprites.js` — person/dog/ball/heart pixel maps with reference-cadence
    walk cycles.
  - `font.js` — bold variable-width 8px caption font (pure data + geometry),
    with word-wrap.
  - `trees.js` — procedural dithered trees as pure 2x1-block geometry.
  - `renderer.js` — y-sorted painter with cached tree rasters, the dotted
    leash, character-anchored captions, and a smoothed camera; presentation
    runs at the reference's chunky ~15 fps while the simulation stays 60 Hz.
- `src/main.js` — browser bootstrap: input, fixed-step loop, integer scaling.

## Development

```
npm test           # bash tests/run-tests.sh — version sync + node --test
```

CI (`.github/workflows/validate.yml`) runs the same script on every push/PR.
The workflow standard for this repo lives in `.claude/CLAUDE.md`.
