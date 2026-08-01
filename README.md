# pixel-rpg

A pixelated neo-noir RPG. At the beginning of the universe there is only the
dark and one small person, wandering the lonely woods — angular smoke-and-plum
trees in a violet-black void, twinkling motes between them, and stranger
things dancing where the woods grow deep. Somewhere out there
waits a friendly lost dog, a marching purple leash, a pink ball for fetch, and,
eventually, home. The story lives in `docs/STORY.md`.

**Version:** 0.14.0

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
| Double-click your character (or I) | Pause: the action & inventory screen |
| Click the HUD minimap (or P) | Pause: the map — everything you remember |
| M | Mute / unmute the 8-bit sound (`?mute=1` starts muted) |

On touch devices, pixel SWAP and BALL buttons appear in the bottom corners
(force them with `?touch=1`); double-tap your character for the inventory.
You start alone; follow the whimpers to find the
dog. After that, whichever character you aren't controlling follows along on
its own. Rare encounters (a burning dumpster, a psychedelic cat, a genie lamp,
a suspicious pipe, a zombie who does not want friends) open a
choice menu: arrows/tap to pick, Space/E or tap to confirm. The simplified
D&D ruleset — 10 HP, six abilities (STR/INT/WIS/DEX/CON/CHA) that all start
at a humbling 2, levels every 10 XP granting two +1s (find the dog for 4 XP,
drop zombies for 1 each), d20 + modifier checks, STR-scaled damage, carry
weight (STR×10 + CON×20 lbs), an icon-based inventory whose icons open
little explanation windows, a meaty bone that doubles as a club, ten-minute
pipe inebriation, and collapse-and-rescue — lives in `docs/RULES.md`. The
viewport is 416×360 world pixels (3× upscale = 1248×1080) at the same art
scale, and on portrait phones the game locks itself horizontal.

The look is 16-bit now — Secret-of-Mana-era shading discipline kept minimal
and noir: characters and trees carry a moonshadow side and moonlit rims,
the void floor gains a barely-there biome speckle, water runs deep with a
lighter shelf at the shore, everything that walks casts a soft shadow, and
menus wear FF-style window chrome with moonlit corner pips. Somewhere out
in the woods stands a **mansion** — gabled, brass-lit, its attic window
sometimes glowing when it shouldn't — and its front door is not locked:
walk in for a Maniac-Mansion-style interior (library, grand hall, parlor,
a portrait whose eyes follow you, a grandfather clock keeping honest time,
and a staircase somebody locked).

The forest is no longer all forest: a lazy terrain layer deals every region
(640px square) a biome — grasslands, sparse oak woods, dense redwood stands,
lakes, and rocky mountains with cave mouths — threaded by meandering rivers
you cross on plank bridges, with the occasional mysterious cabin whose window
is lit and whose door has never been seen open. Everything is generated on
approach from the seed alone and remembered by the game once it exists. The
person remembers it too, imperfectly: a HUD minimap (top-right) shows the
nearby regions as you last saw them, sharp for a minute or two, dithering
away over minutes until only the barest outline remains — Zelda-overworld
style, but sparser. The full remembered map is the map pause screen. Everything makes a soft 8-bit sound: footsteps pace with the
stride, captions blip like retro dialog, dice rattle, the genie gets an
arpeggio (audio starts on your first tap or keypress, per browser rules).

## Architecture

No dependencies, no build step — plain ES modules and a 416x360 canvas
integer-upscaled with `image-rendering: pixelated`.

- `src/core/` — pure simulation, no DOM (fully covered by `node --test`):
  - `rng.js` — seeded PRNG + coordinate hashing; one world seed derives everything.
  - `terrain.js` — the biome layer: regions, rivers, lakes, bridges, and
    landmark placement, all pure functions of the seed (water is analytic —
    no storage).
  - `world.js` — infinite chunked forest; each chunk (trees, bushes, sparkles) is
    a pure function of `(seed, cx, cy)`, generated lazily and cached, with
    densities set by its region's biome.
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
