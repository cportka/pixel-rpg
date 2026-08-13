# RULES — simplified D&D

The forest runs on the smallest possible tabletop ruleset. One die, six
stats, one sheet (**double-click/double-tap your character**, or press **I**).

## The six stats

At the beginning of the universe the person has **2** in each of
**STR, INT, WIS, DEX, CON, CHA**. Two. In everything. Scores map to
modifiers the classic way — `mod = floor((score − 10) / 2)` — so you start
at **−4 across the board**, punching for 0 damage and carrying 60 lbs.
The forest does not care. Levels are how you make it care.

Plus **HP**: the person starts with **10 HP** (the maximum). Current HP
shows top-left; everything else is on the character sheet.

The dog has no stats. The dog is fine. The dog is always fine.

## Levels and experience

You start at **level 1** with 0 XP. Every **10 XP** is a level, and every
level hands you **2 stat points** — +1s you place anywhere, together on one
stat or split across two, chosen one at a time on the level-up screen (it
pauses the world; there is no walking away from self-improvement).

| Deed | XP |
| --- | --- |
| Finding the friendly lost dog | **4** |
| Putting a zombie back down | **1** |

Current level and XP show top-left under your HP, and on the sheet.

## The action & inventory screen

Double-click (or double-tap) your character — or press **I** — to **pause
the game** and open the sheet. It is **icon-based**: six stat pictographs
(score printed under each) plus an icon for everything you carry — the
bone, the meat on it, the pink ball. Click an icon (arrows + Space work
too) and a little window opens with the explanation: the score, the
modifier and what it does to your d20s, what answers to that stat, or the
item's numbers — along with its actions (PUNCH SOMETHING, SWING THE BONE,
GNAW OFF THE MEAT, THROW THE BALL). Attacks reach any zombie nearby; with
nothing in range you strike only the dark, which does not mind. Time is
frozen while any of it is open — the drunk countdown included.

## Weight

You can carry **STR × 10 + CON × 20 lbs** — a starting body manages
**60 lbs** (the sheet reads `WEIGHT 7 OF 60 LBS` once you're hauling the
meaty bone). The bone weighs 5 lbs; the meat on it another 2. The forest
travels light, for now — but the rule is watching, and levels raise it.

## The one die: d20

Risky choices roll a d20 **plus the relevant ability modifier** against a
DC. The roll is always shown in the caption, tabletop style — `D20: 14+2 - ...`
(the modifier appears only when it's nonzero).

| Check | Ability | DC | Success | Failure |
| --- | --- | --- | --- | --- |
| Search the burning dumpster | INT | 10 | **A meaty bone** (see below), hearts | The fire bites: **−1 HP** |
| Put out the fire (how?) | STR | 15 | Somehow you smother it — the fire goes out for good | "WITH WHAT?" — nothing happens; you can try again |
| Rub the old lamp | CHA | 12 | A genie billows out and offers **one wish** | Only dust; try again |
| Smoke the pipe | WIS | 15+ | A vision, and **ten minutes of inebriation** (see below) | — |
| Smoke the pipe | WIS | 8–14 | Nothing. Probably oak leaf | — |
| Smoke the pipe | WIS | ≤7 | A coughing fit: **−1 HP** | — |
| Punch the zombie | STR | 12 | **⌊STR / 4⌋ damage** | It bites: **−2 HP** |
| Swing the bone | STR | 9 | **⌊STR / 4⌋ + 1 damage**, BONK | It bites: **−2 HP** |

Damage scales with raw strength: fists deal `floor(STR / 4)` (a STR-16
brawler one-punches a zombie; a STR-3 waif's landed hits bounce off
harmlessly — though at least that earns no bite). The bone always adds +1,
so it always does *something*.

## The meaty bone

A successful dumpster search pulls out a bone with meat still on it:

- **Gnaw off the meat** (right away, or later from the character sheet):
  **+2 HP**. One serving.
- The stripped bone remains **a good club** — it unlocks SWING THE BONE
  against zombies (easier to land and harder-hitting than fists).

## The pipe, and where magic comes from

The half-burnt green leaf **never costs you a hit point**. It is a teacher,
not a wound. Smoking it is one WIS check:

- **15 or better** — a vision. It teaches you the next spell in the book,
  fills your focus pool, and leaves the colors leaned in for ten minutes.
- **7 or worse** — `THE SMOKE GOES NOWHERE`. No vision, no damage, and the
  bowl is spent anyway.
- **Anything between** — probably oak leaf.

One bowl per pipe, so each one you find is one chance at one spell.

## Spells and focus

**Focus** is your spell pool: **3 + WIS modifier**, never below 1. Casting
spends it; standing under the open sky puts a point back every **20
seconds**. Both show on the character sheet (and in the HUD while a fight
is on) once you know a spell.

The book, in the order the leaf teaches it:

| Spell | Focus | Effect |
| --- | --- | --- |
| **EMBER** | 1 | A rose-gold flame: **3 damage** to the nearest hostile. |
| **WARD** | 1 | The next bite finds nothing. |
| **MOONLIGHT** | 2 | Drink the moon: **+3 HP**. |

Casting with an empty pool scatters the words — and in a fight it still
costs you the turn. Spells are cast from the SPELLS icon on the inventory
screen, or as your action in a turn-based fight.

Because the pipe's ten minutes lend you **+2 WIS**, the vision that teaches
you a spell also *widens* your pool while it lasts, and fills it. When the
world settles back down it takes the borrowed points back with it.

## Inebriation

Rolling 15+ on the pipe grants a vision and **10:00 of drunkenness**
(a countdown shows top-left and on the sheet). While it lasts:

- Colors lean closer — the stars glow, the screen breathes.
- Sounds play louder.
- **WIS checks get +2** — wisdom flows easier, oddly.
- **Your focus pool grows with it** (it is `3 + WIS`), and shrinks back
  when you sober up.

When it runs out: `THE WORLD SETTLES BACK DOWN`.

## Free mode and turn-based mode

The world has two gears, and you can always tell which one you are in.

**Free mode** is the default: walk where you like, throw the ball, open
menus, let the woods happen to you.

**Turn-based mode** takes over the moment a hostile comes within **120px**.
A rose-gold double frame with corner brackets locks the screen, a banner
names the mode and whose move it is, and a bar underneath counts down your
step budget. Each of your turns is:

1. **Move** — up to **60px**. The bar drains as you walk.
2. **Act** — one action. The menu opens by itself when the budget runs out,
   or press **Space/E** to act early.
3. **They answer** — every hostile in reach bites once, then it's your move
   again and the budget refills.

Put **200px** between you and the last hostile and the woods let go:
`THE WOODS LET GO. YOU MOVE FREELY AGAIN`. Stepping through the mansion
door ends it too — `THE DOOR SHUTS THE FIGHT OUTSIDE`. Nothing hostile
gets in.

## The zombie

A rare encounter. It shambles in place and it does not want friends. Your
action menu in a fight:

- **TRY TO BEFRIEND IT** — round one only. It bites you (**−2 HP**).
- **ATTACK WITH FISTS** — STR vs DC 12, ⌊STR / 4⌋ damage. Needs it in reach.
- **SWING THE BONE** — STR vs DC 9, ⌊STR / 4⌋ + 1 damage (only with the bone).
- **CAST A SPELL** — if you know one and have the focus.
- **HOLD YOUR GROUND** — spend the turn doing nothing. Sometimes correct.

You can also start a swing from the inventory screen if a zombie is in
reach. The zombie has **4 HP**. It answers on its turn no matter what you
did on yours — a miss, a bounced punch, and a friendly overture all end the
same way. If a bite drops you to 0, it also samples your brain: **−1 INT**
(never below 1), and you come back at 5 HP. Walking away is always
available: it is not fast, and 200px is 200px.

## Damage

- **Fire** (failed dumpster search): −1 HP.
- **Cat scratch** (doing anything but talking to the psychedelic cat): −1 HP.
- **Zombie bite** (its turn, whatever you did on yours): −2 HP, unless a
  WARD is up.

The pipe is not on this list. It never was supposed to be.

## Healing

- **GOOD DOG** — every completed game of fetch: +1 HP.
- **The meaty bone** — gnaw the meat off the dumpster bone: +2 HP, once.
- **MOONLIGHT** — 2 focus, +3 HP, as often as the pool allows.
- **WISH FOR HEALTH** — the genie restores you to full. One wish. Choose well;
  WISH FOR MORE WISHES has been tried, and the genie has seen it all before.
  WISH FOR HOME buys the one thing money can't: directions.

## Collapse

At 0 HP you don't die — this is not that kind of forest. You collapse, the
world glitches hard, and you come back at **5 HP**:

> YOU COLLAPSE. THE DOG WATCHES OVER YOU

(If you somehow manage it before finding the dog: `THE DARK IS PATIENT`.)

## What you remember

There is no minimap of the world — only of your memory of it. Regions you
walk through are remembered sharply for a minute or two, then the details
dither away, and after about five minutes only the barest outline remains.
Each landmark is drawn as its own little pictogram, so a glance is enough:

| Glyph | Landmark |
| --- | --- |
| A bending blue channel | a river |
| Two planks across it | a bridge |
| A gabled hut, one lit window | a cabin |
| A taller, wider house — two lit windows, a chimney, an open door | the mansion |
| A black mouth under a rock brow, with a glint | a cave |

The HUD shows the nearby **5×5** of regions; clicking it (or pressing
**P**) pauses the game on the full remembered map, same glyphs, with a
legend.
Nothing is ever forgotten completely. Nothing is ever remembered completely
either.

## The television, and heaven

The mansion's parlor holds an old television, warm with rose light, every
channel the same. **STEP INSIDE** and you ascend: the same universe at a
higher level, everything rose and gold and lovely warm pastels. The rules
up there:

- **You arrive alone**, west of the **river Styx** — pale, silver, slow.
- **The zombies are angels.** Nothing is hostile; turn-based mode never
  engages. **TRY TO BEFRIEND IT works** (it was always going to). BASK IN
  ITS LIGHT is **+1 HP**; ASK THE WAY HOME points you at the Styx.
- **The dumpsters are cathedrals of melted gold.** LISTEN TO THE RAGAS
  restores your **focus** (all of it). ADD TO THE PILE OF GOD melts your
  offering in, and the spire climbs **one course higher each time** —
  the temple visibly grows.
- **The dog is Cerberus** — three heads, all of them glad to see you —
  waiting on the far bank of the Styx, level with a bridge. His
  three-throated howl points the way. **Reaching him carries you back
  down**, and the night resumes exactly where it paused.
- Your stats, HP, spells, focus, XP, and inventory travel with you; the
  night world waits unchanged. Heaven remembers you between visits.
- Heaven has mansions too. Their televisions show the night below. Yes.

## The mansion

Rarer than the cabins, somewhere in the forest or the grass, stands a
two-story mansion with brass-lit windows and an attic light that comes on
when nobody is home. **The front door is not locked.** Walk into the
doorway and you're inside: a library, a grand hall, a parlor, a portrait
whose eyes follow you (look closer — once), a grandfather clock you can
hear from across the room, and a locked staircase. Nothing in the mansion
rolls dice at you. Yet. The door mat at the entrance leads back out to the
night, exactly where you left it. Fetch is declined indoors. The parlor's
television is the way up (see above).

## Encounters

Walking up to an encounter opens a choice menu — arrows/tap to pick,
Space/E or tap to confirm. Walking away is always one of the choices, and
leaving re-arms the encounter unless it resolved for good. The psychedelic
cat resolves for good no matter what you pick. He was never really there.
