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

## Inebriation

Rolling 15+ on the pipe grants a vision and **10:00 of drunkenness**
(a countdown shows top-left and on the sheet). While it lasts:

- Colors lean closer — the stars glow, the screen breathes.
- Sounds play louder.
- **WIS checks get +2** — wisdom flows easier, oddly.

When it runs out: `THE WORLD SETTLES BACK DOWN`.

## The zombie

A rare encounter. It shambles in place and it does not want friends:

- **TRY TO BEFRIEND IT** — it bites you (**−2 HP**) and the menu reopens.
- **ATTACK WITH FISTS** — STR vs DC 12, ⌊STR / 4⌋ damage.
- **SWING THE BONE** — STR vs DC 9, ⌊STR / 4⌋ + 1 damage (only with the bone).
- **RUN AWAY** — free. It is not fast.

You can also start (or rejoin) the fight from the inventory screen if a
zombie is in reach. The zombie has **4 HP**. Any miss (or friendship attempt) earns a bite for
**−2 HP**. If a bite drops you to 0, it also samples your brain: **−1 INT**
(never below 1), and the fight ends while you're dragged clear.

## Damage

- **Fire** (failed dumpster search): −1 HP.
- **Cat scratch** (doing anything but talking to the psychedelic cat): −1 HP.
- **The pipe** (rolling ≤7): −1 HP and a full minute of coughing.
- **Zombie bite** (missed attack or attempted friendship): −2 HP.

## Healing

- **GOOD DOG** — every completed game of fetch: +1 HP.
- **The meaty bone** — gnaw the meat off the dumpster bone: +2 HP, once.
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
walk through are remembered sharply (biome, rivers, bridges, cabins, caves)
for a minute or two, then the details dither away, and after about five
minutes only the barest outline remains. The HUD shows the nearby regions;
clicking it (or pressing **P**) pauses the game on the full remembered map.
Nothing is ever forgotten completely. Nothing is ever remembered completely
either.

## Encounters

Walking up to an encounter opens a choice menu — arrows/tap to pick,
Space/E or tap to confirm. Walking away is always one of the choices, and
leaving re-arms the encounter unless it resolved for good. The psychedelic
cat resolves for good no matter what you pick. He was never really there.
