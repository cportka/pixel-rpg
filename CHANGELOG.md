# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog
(https://keepachangelog.com) and the project uses Semantic Versioning (https://semver.org).
Every change bumps the version and adds an entry below.

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
