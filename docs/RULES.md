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
| Laying a ghost to rest | **1** |
| The minotaur — beaten, or better, directed | **5** |
| Finding God (the signs all pointed here) | **3** |
| Shooing the frogs off God (once) | **1** |

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
meaty bone). The bone weighs 5 lbs; the meat on it another 2. The v0.20
gear weighs in too: each plank of **wood 1 lb**, the **axe 6**, the
**rope 2**, the boat **manual 1**. The forest travels light, for now — but
the rule is watching, and a boat's worth of planks is 24 lbs of watching.

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
| Swing the axe | STR | 11 | **⌊STR / 4⌋ + 2 damage** | They answer |
| Throw dirt in its eyes | DEX | 10 | **Their answer goes wide** for a round | The night throws it back |
| Offer the minotaur directions | WIS | 13 | The fight ends kindly — **5 XP**, he wanders on | The words come out as walls |
| Chop a tree (axe in hand) | STR | 8 | **1 plank** (2 on 11+, 3 on 14+) | Bark 1, axe 0 |

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

## The foes

Everything that answers on its turn, v0.20 edition:

| Foe | HP | Damage | XP | Coins | The catch |
| --- | --- | --- | --- | --- | --- |
| **The zombie** | 4 | 2 | 1 | 1 | Does not want friends |
| **The hostile ghost** | 2 | 1 | 1 | 2 | Passes through you and **steals a coin** with every hit |
| **The red minotaur** | 8 | 3 | 5 | 5 | Fights like a wall looking for a door |

Your action menu in a fight:

- **TRY TO BEFRIEND IT** — round one only. It answers with its teeth
  (or its horns, or its static).
- **ATTACK WITH FISTS** — STR vs DC 12, ⌊STR / 4⌋ damage. Needs it in reach.
- **SWING THE BONE** — STR vs DC 9, ⌊STR / 4⌋ + 1 damage (only with the bone).
- **SWING THE AXE** — STR vs DC 11, ⌊STR / 4⌋ + 2 damage (only with the axe).
- **SHOUT SOMETHING BRAVE** — the woods swallow it whole. It moves you,
  slightly. Costs the turn.
- **THROW DIRT IN ITS EYES** — DEX vs DC 10. Land it and **their answer
  goes wide for a round** — the first DEX check in the game, at last.
- **STUDY IT** — learn something true and useless. Costs the turn.
- **OFFER DIRECTIONS** — minotaur only. WIS vs DC 13: you cannot lead him
  out of the maze, but you can point him somewhere kinder. If it lands the
  fight **ends** — full XP, no blood, the kindest resolution the game has.
- **CAST A SPELL** — if you know one and have the focus.
- **HOLD YOUR GROUND** — spend the turn doing nothing. Sometimes correct.

You can also start a swing from the inventory screen if a foe is in reach.
They answer on their turn no matter what you did on yours — a miss, a
bounced punch, and a friendly overture all end the same way. If a hit drops
you to 0, the zombie samples your brain and the maze goes dark a moment:
**−1 INT** (never below 1), and you come back at 5 HP. Walking away is
always available: none of them are fast, and 200px is 200px.

The minotaur is rare (heaven, roughly one region in fifty-three) and paces
a slow endless loop around his den — about 90px of maze in every direction.
He is the only red thing in heaven. That is on purpose.

## Damage

- **Fire** (failed dumpster search): −1 HP.
- **Cat scratch** (doing anything but talking to the psychedelic cat): −1 HP.
- **Zombie bite** (its turn, whatever you did on yours): −2 HP, unless a
  WARD is up.
- **Ghost pass-through** — −1 HP, and it takes **a coin** with it.
- **Minotaur horns** — −3 HP. The wall found its door and it was you.

The pipe is not on this list. It never was supposed to be.

## Coins and planks

v0.20 gives the soul pocket change. **Coins** ride with you everywhere —
through the television, both directions. Where they come from:

- A successful dumpster search: **+2 coins**, fire-warm, under the bone.
- Loot — the zombie drops **1**, a ghost **2**, the minotaur **5**.
- Tipping the detective something true: **+3 coins**, once.
- Selling to Pirts (see below).

**Planks** come off trees. With the axe in hand and a tree in reach,
**CHOP A TREE** — STR vs DC 8: **1 plank**, **2** on an 11+, **3** on a
14+. Each plank weighs 1 lb, and a boat wants **24 of them**.

### Pirts, merchant (deceased)

The ghost town's one open business. He buys, he sells, he has jokes.

| He sells | Price |
| --- | --- |
| Heal draught (+3 HP) | **3c** |
| Axe | **8c** |
| Rope | **2c** |
| HOW TO BUILD A BOAT (ghost-press edition) | **12c** |

| He buys | Pays |
| --- | --- |
| The meat | **2c** |
| The bone | **4c** |
| A plank | **1c** |
| Your story | **1c** — once; he's heard it after that |

### The boat

**24 planks + the rope + the manual + a shoreline** and BUILD THE BOAT
appears. Building spends the planks and the rope (its fifty-first use).
The boat sails wherever you swim, at **1.25×** walking speed — swimming
without it is **0.45×**. She floats. Somehow, she floats.

## Healing

- **GOOD DOG** — every completed game of fetch: +1 HP.
- **The meaty bone** — gnaw the meat off the dumpster bone: +2 HP, once.
- **MOONLIGHT** — 2 focus, +3 HP, as often as the pool allows.
- **Heal draught** — 3 coins at Pirts': +3 HP in a bottle. Tastes like
  starlight and cough syrup.
- **Light a candle** — 1 coin at the cathedral altar: +1 HP.
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
- **Heaven has weather in its bones now (v0.20).** Beyond the grass, oaks,
  redwoods, lakes, and mountains, heaven deals **deserts**, **beaches**,
  and **glaciers** — and, far off the beaten path, **an island**.
- **The water is warm and passable.** Walk in and you swim, at **0.45×**
  walking speed. Build the boat (see above) and you sail at **1.25×**.
  Night water still says no.
- **Hand-painted signs point toward God.** About one region in five holds
  one: READ IT, FOLLOW WHERE IT POINTS (your feet agree before you do),
  LEAN ON IT, or WALK ON.
- **God is a cricket** by a lake in a redwood grove, occasionally menaced
  by frogs on lilypads. Finding God is **+3 XP**. You can ASK THE BIG
  QUESTION (chirp; somehow that covers it), CONFESS (you are not forgiven —
  you are something better, heard), **SIT WITH GOD A WHILE** (your focus
  returns, all of it), SHOO THE FROGS (**+1 XP**, once; God did not need
  the help and appreciates it anyway), or LEAVE QUIETLY.
- **The zombies are angels.** Nothing *native* is hostile; turn-based mode
  almost never engages. **TRY TO BEFRIEND IT works** (it was always going
  to). BASK IN ITS LIGHT is **+1 HP**; ASK THE WAY HOME points you at the
  Styx.
- **Except the minotaur.** Rare and red and endlessly pacing the maze of
  this life, he is heaven's one fight (see The foes). WIS gets you past him
  kindest.
- **The island shrine.** Swim or sail to the island and its shrine takes
  offerings: **1 coin** buys **THE ISLANDER'S CALM — +2 max focus,
  always**. Once; the calm is already yours after that.
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

## The ghost town

Rare — about one dry grass or oak region in forty-five — the night holds a
**deserted ghost town**: a handful of ruins, a leaning sign, and the ghosts
themselves, datamoshing through their old routines. Each ghost is dealt a
temperament at generation:

- **Drifting** and **sullen** ghosts are encounters: ASK WHAT HAPPENED
  HERE, OFFER A COIN, KEEP IT COMPANY, or BACK AWAY SLOWLY.
- **Hostile** ghosts belong to the battle system: 2 HP, 1 damage — and
  every hit **passes through you and steals a coin**.

In the middle of it, **Pirts** — the merchant ghost, open for business (see
Coins and planks). On the outskirts, a **bail-bonds office** where a
hard-boiled detective works the one case that matters: **where in the
devil is the Devil**. Ask about the case, ask for work, ask about the town
— or OFFER A TIP: something true pays **3 coins**, once. His corkboard is
red string all the way down; one string leads to a mirror. You decide not
to ask.

## The mansion, and the other rooms

Rarer than the cabins, somewhere in the forest or the grass, stands a
two-story mansion with brass-lit windows and an attic light that comes on
when nobody is home. **The front door is not locked.** Walk into the
doorway and you're inside: a library, a grand hall, a parlor, a portrait
whose eyes follow you (look closer — once), a grandfather clock you can
hear from across the room, and a staircase somebody locked. The door mat
at the entrance leads back out to the night, exactly where you left it.
Fetch is declined indoors. The parlor's television is the way up (see
above).

**v0.20 opened the doors.** The staircase's lock finally rusted through,
and every roofed place is a room now:

- **The mansion upstairs** — a bedroom (a bed nobody died in, probably),
  a study, **another portrait with the same eyes**, and a brass
  **telescope**. Aim it where you like; it is already aimed **at the
  island**.
- **The cathedral nave** (heaven) — walk into a cathedral of melted gold:
  an **altar** (PRAY refills your focus; LIGHT A CANDLE is 1 coin, +1 HP),
  the **pile of god** indoors at last, and **singers** along the west wall
  handing each other the melody forever (LISTEN refills your focus; ask
  the melody's name — it is yours, sung slowly).
- **The cabin's one room** — a stove with one warm coal, a cot, a lantern,
  and **an axe on the wall pegs, free to take**. Exactly the kind of thing
  a person building a boat in another world entirely might want.
- **The bail-bonds office** — the detective, his desk, the corkboard.

## Encounters

Walking up to an encounter opens a choice menu — arrows/tap to pick,
Space/E or tap to confirm. **Every encounter now offers at least four
options** (the v0.20 audit): warm your hands at the burning dumpster,
stare back at the cat, polish the lamp on your sleeve, sniff the pipe,
shamble alongside the zombie, JUST BREATHE in the spell menu (+1 focus —
the cheapest spell, and still nobody casts it), and so on. Walking away is
always one of the choices, and leaving re-arms the encounter unless it
resolved for good. The psychedelic cat resolves for good no matter what
you pick. He was never really there.
