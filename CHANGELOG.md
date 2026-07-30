# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog
(https://keepachangelog.com) and the project uses Semantic Versioning (https://semver.org).
Every change bumps the version and adds an entry below.

## [0.5.0] - 2026-07-30

### Added
- **Transition glitches**: gameplay transitions (swapping bodies, meeting the
  dog, throwing/catching/delivering the ball, finding the inflatables) flash
  a brief burst of horizontal band-slips and stray magenta/blue noise blocks
  over the frame — deterministic per burst, decaying over ~0.2-0.5s. Force
  one for a demo with `?glitch=<seconds>`.

### Changed
- **Angular, dramatic stars**: the twinkling motes are now sharp 4-point
  stars — long axis spikes that lengthen at peak glow (flashing moonlight
  white) with a diagonal glint, in three sizes derived from existing sparkle
  fields (world generation unchanged).

## [0.4.0] - 2026-07-28

### Added
- **Dancing inflatables**: rare clearings (~1 in 40 chunks) where wacky waving
  tube-dancers sway in magenta/violet/blue/pink — pure time-driven geometry
  animated at the 15 fps cadence, y-sorted with the world. Finding them plays
  a one-shot caption: "THE INFLATABLES DANCE. NO ONE KNOWS WHY".

### Changed
- **Angular trees**: canopies are now stacked jagged tiers (angular pine
  silhouettes with crisp rims) and bushes are jagged diamonds, replacing the
  soft elliptical scatter. Existing seeds keep their tree layout.
- **A drastically better human stride**: 6-frame walk cycle — wide contact
  split, a recoil frame with a 1px body bob, and a tall passing pose with a
  lifted knee, with counter-swinging arms; B-frames are exact mirrors so the
  stride stays symmetric.

## [0.3.0] - 2026-07-28

### Added
- **Tap / click to move**: tap anywhere and the active character walks there
  (pointer events — mouse, touch, and pen). A marching-dot marker shows the
  destination; keys override and cancel it; the walk reuses the detour
  steering so a tapped spot behind a tree is reached around it, and a tap on
  a trunk is abandoned after a couple of seconds instead of wedging.
- **Mobile support**: pixel SWAP and BALL touch buttons (bottom corners, shown
  on coarse pointers or with `?touch=1`), `touch-action: none` and tap-highlight
  suppression, web-app metas, and the existing DPR-aware integer scaling.

## [0.2.0] - 2026-07-28

### Added
- **Story, Act 0-2** (`docs/STORY.md` + `src/core/game.js`): the game now opens at the
  beginning of the universe with only the person, alone in the lonely dark woods.
  Whimper hints point toward a friendly lost dog waiting in a clearing; finding it
  brings hearts, "TOGETHER WE WILL FIND HOME", and unlocks swapping and fetch.
- **The leash**: a sagging dotted line of marching magenta/violet/blue dots ties the
  pair together (slips off during fetch), straight from the reference footage.
- Ambient story captions while walking together.

### Changed
- **Neo-noir re-theme**: smokey darks and purples — violet-black void, smoke-and-plum
  dithered trees with magenta ember flecks, moonlit silver figures
  (chrisportka.com-inspired palette in `src/gfx/palette.js`).
- **Sprites redrawn from the reference**: taller, thinner person (9x18) with a
  4-frame arm-swinging stride; detailed dog (13x9) with raised head, snout, ear,
  and trotting legs.
- **Cadence corrected**: presentation now runs at the reference's chunky ~15 fps
  (simulation stays at 60 Hz) and the walk cycle advances at ~7.5 fps.
- **Text improved**: new bold variable-width 8px pixel font (2px stems, narrow I)
  copied from the reference; captions word-wrap and anchor above the active
  character, clamped to the screen.
- Trees now dither in 2x1 blocks like the reference footage.

## [0.1.0] - 2026-07-26

### Added
- Game scaffolding and graphics system: a person and their dog walking a procedurally
  generated magical forest, styled after the reference recording (black void, dithered
  ember/green trees, white pixel figures, retro captions).
- Deterministic chunked world generation from a single seed (`src/core/world.js`),
  seeded PRNG + coordinate hashing (`src/core/rng.js`).
- Characters with per-axis trunk collision and follow AI with hysteresis
  (`src/core/entities.js`); control either the person or the dog (Tab/C).
- Fetch: throw the pink ball (Space/E), the dog chases and returns it —
  "FETCH IS OUR FAVORITE GAME!", "GOOD DOG", and a heart (`src/core/game.js`).
  The chase AI detours around trunks that stall it, the ball can't fly into a
  trunk, and a hopeless fetch times out instead of soft-locking.
- Robustness (from an adversarial multi-agent review): bounded chunk and
  tree-sprite caches (lossless distance/staleness eviction), sprite cache keyed
  by full tree identity, devicePixelRatio-aware integer upscaling, dt-corrected
  camera smoothing, and tap latching so key presses survive frame hitches.
- Graphics: reference-derived palette, sprite maps with walk cycles, 5x7 pixel
  caption font, procedural dithered tree geometry, y-sorted canvas renderer with
  cached tree rasters and a smoothed camera (`src/gfx/`), 320x200 integer-upscaled
  canvas page (`index.html`, `src/main.js`).
- Test suite under `node --test` covering RNG/world determinism, collision, follow AI,
  the fetch cycle, sprite/font data integrity, and a renderer smoke pass.
- Initial scaffold via repo-bootstrap (Portka standard): branch-per-change workflow, an enforced
  SemVer version sync, a basic test suite, and CI.
