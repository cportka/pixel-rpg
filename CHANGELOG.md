# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog
(https://keepachangelog.com) and the project uses Semantic Versioning (https://semver.org).
Every change bumps the version and adds an entry below.

## [0.15.0] - 2026-08-02

### Added
- **Two gears, and you always know which one you are in.** A hostile
  within 120px pulls the world out of free movement into **turn-based**:
  a rose-gold double frame with corner brackets locks the screen, a
  banner names the mode and whose move it is, and a bar under it counts
  down your 60px step budget. Spend the budget (or hit Space/E) and the
  action menu opens — befriend it (round one only), fists, the bone if
  you carry one, a spell if you know one, or hold your ground. Then the
  dead answer. Walking 200px clear lets the woods go again. New sounds
  for the mode change and each turn.
- **Magic, taught by the pipe.** Smoking no longer costs a hit point —
  the leaf is a teacher, not a wound. A vision (WIS check, DC 15) hands
  over the next spell in the book: **EMBER** (1 focus, 3 damage),
  **WARD** (1 focus, the next bite finds nothing), **MOONLIGHT** (2
  focus, +3 HP). Focus is `3 + WIS` and seeps back a point every 20
  seconds under the open sky. The sheet grows a FOCUS line and a SPELLS
  icon; the HUD shows the pool while a fight is on.
- **A minimap you can actually read.** The HUD map goes from a cramped
  grid to a 5×5 of 15px cells (81×81), and every landmark gets its own
  pictogram instead of a colored dot: a river bends down its channel, a
  bridge lays two planks across it, a cabin is a gabled hut with one lit
  window, a mansion stands taller and wider with two lit windows, a
  chimney, and an open door, and a cave is a black mouth under a rock
  brow with a violet glint. The map pause screen draws the same glyphs
  at the same size, with a legend.

### Changed
- **The art direction, properly this time.** The logical screen is
  624×540 at a 2× upscale (was 416×360 at 3×), so a game pixel is 2×2
  device pixels instead of 3×3 — finer detail, thinner lines. Tree
  dithering drops from 2×1 double-wide blocks to single pixels (a 6×
  improvement in horizontal detail), and the whole world scales 1.5× so
  the framing and the feel are unchanged while everything is drawn
  finer. The palette is rebuilt as structured ramps — night/void, dirt
  and clay, dark nature greens, plum→violet, rose→magenta, and a warm
  gold→gold-rose — and the sprites are redrawn 1.5× larger with a
  four-tone shading pass lit from a fixed top-right moon, including a
  gold-rose rim on the crown. The 8px UI font is deliberately *not*
  scaled, which is what un-cramps the menus. **The void is still the
  void:** seven ground cells in ten stay pure violet-black, and the
  floor's noise is smoothed over two octaves so the earth that does show
  drifts in soft patches instead of tiling the screen into squares.
- **The sound is the library now.** `8bit-sfx` moves from `0.3.0` to
  **`1.0.0`**, and the game plays it directly: `vendor/8bit-sfx/`
  carries a byte-identical slice of the library's synthesis engine (the
  static site cannot import from `node_modules`), and the audio engine
  renders each cue on demand into a cached `AudioBuffer` rather than
  shipping hand-rolled oscillator code. All 28 of the game's sounds are
  the library's ported originals; new cues (battle start/end, turn,
  learn/cast/fail a spell, ward) come from its procedural `rpg` bank.
  Tests pin the vendored copy to the installed package byte-for-byte and
  compare rendered samples, so the game's sounds and the library's
  cannot become two different things. Closes the upstream port request
  for the XP, level-up, door, and clock cues, which 1.0.0 ships.

## [0.14.0] - 2026-07-30

### Added
- **The 16-bit generation**: a substantial style upgrade in the SNES
  action-RPG spirit (Secret of Mana / FF), kept minimal and neo-noir. The
  palette gains a small set of shade tones (moonshadow, mid-plum, umbra,
  deep/edge water, warm brass, parquet); the person and dog get a
  moonlight-from-top-right shading pass (`shadeFrames` — silhouettes and
  the sacred cadence untouched); trees shade their moon-away flank and
  tier undersides with occasional moonlit crown glints; the void floor
  carries a deterministic biome speckle; water is deep with a lighter
  shelf where it meets land; every creature casts a soft two-row shadow;
  and panels wear FF-style chrome (violet border, inset, moonlit corner
  pips).
- **The mansion** — a rare landmark in forest and grass regions (same rng
  draws as cabins, so older worlds keep their cabins where they were): a
  56×42 two-story facade with brass-lit windows, a chimney, and an attic
  window that lights up when nobody is home. **The front door is not
  locked.** Inside is a one-screen Maniac-Mansion-style interior — parquet
  floors, paneled walls, a library, grand hall, and parlor, a chandelier
  pooling light on a magenta-rimmed rug, candelabra flames, a grandfather
  clock that ticks when you stand near it, a portrait whose eyes follow
  you (with a one-shot LOOK CLOSER menu), and a locked staircase (WHO
  LOCKS STAIRS?). Walking onto the door mat leads back out; the world
  waits where you left it. Fetch is declined indoors; encounters and the
  memory map stay outside. New chip sounds: the door creak and the clock
  tick (added to the 8bit-sfx `PENDING_PORT` list).

## [0.13.0] - 2026-07-30

### Added
- **Levels and experience**: you start at **level 1** with **2 in every
  stat** (a humbling −4 everywhere — fists deal 0, capacity is 60 lbs).
  Every **10 XP** is a level and grants **2 stat points**, spent one +1 at
  a time on the pausing level-up screen (same stat twice is allowed).
  Finding the dog is worth **4 XP**; each zombie put down is **1 XP**.
  Level and XP show in the HUD under HP and on the sheet, with a chime for
  XP and a fanfare for levels.
- **Icon-based inventory**: the character sheet is now a grid of 9×9
  pictographs — six stat icons (fist, bulb, eye, bolt, heart, star) with
  scores printed beneath, plus item icons for the bone, its meat, and the
  pink ball. Clicking one (or arrows + Space) opens a little detail window
  explaining the score, the modifier and its effect on your d20s, what
  answers to that stat, or the item's numbers — plus its actions (PUNCH
  SOMETHING, SWING THE BONE, GNAW OFF THE MEAT, THROW THE BALL, BACK).
- Font gains `>`, `=`, and `/` glyphs for the new UI text.

### Changed
- **The viewport grew**: 320×200 → **416×360** world pixels at the same art
  scale — the common 3× upscale is 1248×1080 device pixels (≥ the asked
  1240×1080). The lost dog's spawn ring moved out (240–320px) so it stays
  off the bigger opening screen.
- **Mobile is horizontally locked**: on portrait touch devices the canvas
  rotates 90° (CSS transform with pointer input mapped back through it),
  and the Screen Orientation API is asked for a landscape lock where
  permitted.
- Stat rolls (3d6) are gone; growth now comes from leveling.
- Caption wrap width follows the screen (was a stale 280px from the 320
  era), and tiny windows downscale fractionally instead of silently
  cropping the HUD.

### Fixed (adversarial review)
- A level-up menu opened by meeting the dog could be clobbered by a
  same-tick encounter check, stranding the stat points; encounter sweeps
  now never overwrite an open menu.
- A lethal zombie bite delivered through a sheet-launched attack left the
  re-arm cooldown on the detail window, so the fight force-reopened over
  your unconscious body; the bite now stamps the zombie itself.
- Closing any pause screen (sheet/detail/map/level-up) overwrote the single
  encounter-cooldown slot, un-fleeing a fled zombie; pause screens no
  longer claim the slot.
- Touch SWAP/BALL buttons were drawn over full-frame pause screens, where
  their upper halves fell through into the CLOSE row; they hide while any
  menu is open.
- The selected menu row's `- LABEL -` decoration could overflow the panel;
  panels now size for it. The HUD no longer peeks a 1px sliver over
  full-frame pause screens.

### Notes
- The new `xp` and `levelup` chip sounds are not yet in the published
  `8bit-sfx` set; `tests/sfx-package.test.mjs` carries them in an explicit
  `PENDING_PORT` list (parity stays exact for everything else) and fails
  the moment the pinned package ships them, prompting the list's removal.

## [0.12.0] - 2026-07-30

### Added
- The game's sound set now ships in the [`8bit-sfx`](https://github.com/cportka/8bit-sfx)
  npm package as its `pixelrpg` category — 24 WAVs rendered from this repo's `SOUNDS`
  table by an exact port of the Web Audio engine semantics, each manifest entry carrying
  the game's intended relative `gain`. `8bit-sfx` is now a dev dependency (pinned by
  commit), and `tests/sfx-package.test.mjs` asserts the package and `EVENT_NAMES` stay in
  exact parity — the test skips with a note when the package isn't installed. CI installs
  dev dependencies before the suite. The in-game audio engine is unchanged: it keeps
  live-synthesizing (which the wav files can't replicate fully — e.g. the `intensity`
  modulation while the pipe's colors lean closer).

## [0.11.0] - 2026-07-30

### Added
- **Terrains** (`src/core/terrain.js`): a lazy biome layer above the chunk
  grid. Every 640px region is dealt one of five biomes from the seed —
  **grasslands** (open, tufted), **oak woods** (the classic sparse forest),
  **dense redwood stands** (taller, packed trees), **lakes** (elliptical,
  impassable water), and **mountains** (rock mounds, and a **cave mouth**
  per region, something glinting inside). **Rivers** meander down every
  fifth region column, crossed by plank **bridges** at least once per
  region; **mysterious cabins** stand in some forest and grass regions,
  window lit magenta, door never seen open. Water and rock block movement;
  nothing generates in the water; everything is generated lazily on
  approach and identical on every return. The 2x2 regions around the origin
  are always the home oak woods — dry, walkable, and (because oak keeps the
  exact pre-terrain generation sequence) laid out just as older seeds
  remember them.
- **The memory HUD**: a top-right minimap of the nearby regions *as the
  person remembers them* — sharp (dense dither + landmark marks: river,
  bridge, cabin, cave) for ~90 seconds, thinning to biome-tint dither over
  five minutes, then only four corner pips: the barest outline, never fully
  forgotten. Clicking the HUD (or pressing **P**) pauses the game on the
  **map screen** — everything ever remembered, faded by age, you at the
  center.

### Changed
- Chunks outside oak regions generate with biome-specific densities, so
  non-home terrain rerolls relative to v0.10 worlds (the home woods are
  unchanged).
- `World.collides` now also blocks on water (bridges exempt), rocks,
  cabins, and cave rock faces.

## [0.10.0] - 2026-07-30

### Added
- **The action & inventory screen**: double-click (or double-tap) your own
  character — or press I — to open the sheet, which now **pauses the game
  outright** (no time, no timers, no drunk countdown). Beyond stats it
  offers actions with what you carry: ATTACK WITH FISTS, SWING THE BONE,
  THROW THE BALL, and GNAW THE BONE MEAT. Attacks reach any zombie nearby
  and join the regular fight; with nothing in range you strike only the
  dark, which does not mind.
- **STR-scaled damage**: fists now deal `floor(STR / 4)` (a STR-16 brawler
  one-punches a zombie; a landed STR-3 hit bounces off harmlessly — but
  earns no counter-bite). The bone is +1 damage on top, so it always does
  something.
- **Carry weight**: capacity is **STR × 10 + CON × 20 lbs**, shown on the
  sheet (`WEIGHT 7 OF 300 LBS`). The bone weighs 5 lbs, its meat 2.

### Removed
- The **ME** touch button — the inventory now opens by double-tapping your
  character on every input device (I still works on keyboards).

## [0.9.0] - 2026-07-30

### Added
- **Six abilities**: STR, INT, WIS, DEX, CON, CHA — each rolled 3d6 from the
  seeded gameplay dice at the beginning of the universe (same seed, same
  person). Checks are now `d20 + modifier` (`floor((score − 10) / 2)`) with
  the modifier shown in the roll caption (`D20: 14+2 - ...`), and every
  encounter check is ability-tagged: dumpster search INT, fire-smothering
  STR, lamp-rubbing CHA, the pipe WIS, zombie-punching STR.
- **The character sheet**: press **I** (or the new ME touch button) for stats,
  HP, the drunk countdown, and the bone — and to gnaw the saved meat.
- **Pipe inebriation**: rolling the vision now also grants 10 minutes of
  drunkenness — colors intensify (glowing stars, breathing screen bands,
  magenta captions), sounds play louder, and WIS checks get +2. A countdown
  shows top-left; the world settles back down when it runs out.
- **The zombie** (rare): shambles in place with one magenta eye. Befriending
  it earns a bite (−2 HP); fists are STR vs DC 12 for 2 damage; the bone is
  STR vs DC 9 for 3 (BONK); running away is free. It has 4 HP. A bite that
  drops you to 0 also samples your brain: −1 INT, never below 1.
- **The meaty bone**: a successful dumpster search now pulls out a bone with
  meat on it — gnaw it right away or save it (the sheet offers it later) for
  **+2 HP**, and the stripped bone remains a club for zombie fights.
- New chip sounds: the zombie groan, the bone BONK, gnawing, and a woozy
  drunk sting; the audio engine gained an intensity control (clamped) that
  main.js drives while drunk.

### Changed
- The dumpster search success replaces the old flat "+1 HP warm bone" with
  the meaty-bone chain above.
- `docs/RULES.md` rewritten around abilities, the bone, inebriation, and the
  zombie; README controls table gains the I key and ME button.

## [0.8.0] - 2026-07-30

### Added
- **8-bit sound effects for every interaction** (`src/audio/`): a Web Audio
  chip-synth (square/triangle/saw tones + deterministic filtered noise, no
  assets, no dependencies) plays a 20-sound table — soft distance-paced
  footsteps for person and dog, dialog blips for captions and a drooping
  whimper for the hints, menu open/move/confirm, the d20 rattle-and-ping,
  damage/heal/collapse, swap, the full fetch trio (throw whoosh, pickup pop,
  GOOD DOG arpeggio), the meeting fanfare, the inflatables' wobble, the
  genie's rise, the pipe vision, and the cat's static vanish. The pure game
  core emits named events; the frontend drains and plays them, so
  `node --test` covers both the sound table and the emission points.
- **M** toggles mute; `?mute=1` starts muted. Audio wakes on the first
  tap/keypress per browser autoplay rules.

## [0.7.0] - 2026-07-30

### Added
- **The genie lamp** (rare): RUB THE LAMP rolls d20 vs DC 12 — success billows
  a genie out in violet smoke and chains straight into a wish menu: WISH FOR
  HEALTH (full HP), WISH FOR HOME (the genie points toward the seed-fixed home
  direction — Act 3 groundwork now stored on every game), or WISH FOR MORE
  WISHES (the genie rolls his eyes and vanishes). One wish, then lamp and
  genie are gone. The lamp glints periodically so it catches the eye.
- **The pipe of half-burnt green leaf** (rare): SMOKE IT rolls three bands —
  15+ a psychedelic vision (the longest glitch in the game, plus lore), 8-14
  probably oak leaf, 7 or under a coughing fit (-1 HP). One bowl only. SNIFF
  IT is free and tells you what you already suspected. The leaf introduces the
  palette's single green accent, and the bowl trails animated smoke wisps
  until spent.

## [0.6.0] - 2026-07-30

### Added
- **Rare encounters with choice menus**: a burning dumpster (search it — d20
  DC 10 for a warm bone (+1 HP) or a burn (-1 HP) — or try to put out the
  fire, DC 15, with what exactly?) and a psychedelic cat who dissolves into
  static if you talk to him and scratches you (-1 HP) before vanishing if you
  try anything else. Menus: arrows + Space/E, or tap a row; walking away
  re-arms an unresolved encounter once you leave.
- **Simplified D&D rules** (`docs/RULES.md`): 10 HP, visible d20 rolls,
  fetch heals +1, collapse at 0 HP brings you back at 5 under the dog's
  watch. HP shows top-left, flushing magenta when low.
- **BG3-style move marker**: the tap destination now pulses three arrowheads
  converging on the target instead of a static cross.
- `?enc=dumpster|cat` plants an encounter at spawn for demos.

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
