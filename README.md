# pixel-rpg

A pixelated RPG: a person and their dog wander a procedurally generated magical
forest — dithered ember-red and green trees scattered in a black void, twinkling
motes between them, and a pink ball for playing fetch.

**Version:** 0.1.0

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
| Arrows / WASD | Walk |
| Tab or C | Swap control between the person and the dog |
| Space or E | Throw the ball (as the person) — the dog fetches |

Whichever character you aren't controlling follows along on its own.

## Architecture

No dependencies, no build step — plain ES modules and a 320x200 canvas
integer-upscaled with `image-rendering: pixelated`.

- `src/core/` — pure simulation, no DOM (fully covered by `node --test`):
  - `rng.js` — seeded PRNG + coordinate hashing; one world seed derives everything.
  - `world.js` — infinite chunked forest; each chunk (trees, bushes, sparkles) is
    a pure function of `(seed, cx, cy)`, generated lazily and cached.
  - `entities.js` — characters, per-axis collision against tree trunks
    (feet-box, so you can walk behind canopies), follow AI with hysteresis.
  - `game.js` — control swapping, captions, and the fetch state machine.
- `src/gfx/` — rendering:
  - `palette.js` — the palette, lifted from the style-reference recording.
  - `sprites.js` — person/dog/ball/heart pixel maps with walk cycles.
  - `font.js` — 5x7 pixel font for captions (pure data + geometry).
  - `trees.js` — procedural dithered trees as pure pixel-cloud geometry.
  - `renderer.js` — y-sorted painter with per-seed cached tree rasters and a
    smoothed camera.
- `src/main.js` — browser bootstrap: input, fixed-step loop, integer scaling.

## Development

```
npm test           # bash tests/run-tests.sh — version sync + node --test
```

CI (`.github/workflows/validate.yml`) runs the same script on every push/PR.
The workflow standard for this repo lives in `.claude/CLAUDE.md`.
