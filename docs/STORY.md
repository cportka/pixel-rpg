# STORY — The Long Walk Home

A story script for pixel-rpg. Captions are the game's whole voice: short,
all-caps, retro lines that appear above the character (see `src/gfx/font.js`).
Acts 0-2 are implemented in `src/core/game.js`; Act 3 and the epilogue are the roadmap.

## Logline

At the beginning of the universe there is only the dark, and one small person
walking through it. In the lonely woods they find a friend — a friendly lost
dog. Together, they will find home.

## Act 0 — The First Light (implemented: opening captions)

Black void. Smoke-purple trees. One person, alone.

> IN THE BEGINNING THERE WAS ONLY THE DARK
>
> ONE SMALL PERSON, ALL ALONE IN THE WOODS

Mechanics: the player controls the person. There is no one else to swap to;
Tab does nothing yet. Fetch does not exist yet. The sparkles — the only other
light — twinkle indifferently.

## Act 1 — The Lonely Woods (implemented)

The person wanders. The woods are deep, identical in every direction, and
utterly quiet. Somewhere out there, something small is waiting.

Every so often, a hint (direction computed toward the waiting dog):

> A SOFT WHIMPER DRIFTS FROM THE NORTH

The dog waits in a clearing a couple of hundred pixels away — sitting still,
a little white shape in the dark.

## Act 2 — A Friend (implemented: the meeting)

The person walks close enough (`MEET_RADIUS`) and the dog is found:

> A FRIENDLY LOST DOG!
>
> TOGETHER WE WILL FIND HOME

Hearts. The dotted leash — magenta, violet, blue, marching — ties them
together. From here on:

- Tab/C swaps control between person and dog.
- Space/E plays fetch (the leash slips off while the dog runs, and returns
  when the ball does).
- The one you don't control follows along.

Ambient lines while walking together:

> FETCH IS OUR FAVORITE GAME!
>
> THE WOODS FEEL WARMER NOW
>
> HOME IS OUT THERE SOMEWHERE

## Act 3 — The Long Walk Home (future)

Home exists somewhere in the infinite forest — a warm-lit clearing seeded far
from the origin. Ideas, in intended order:

1. **The Dancing Inflatables** *(implemented in v0.4.0)* — somewhere deep in
   the woods, a clearing where tube-dancers wave forever in magenta and
   violet. They mean nothing. They explain nothing. The captions say so:
   "THE INFLATABLES DANCE. NO ONE KNOWS WHY". The pair can stay as long as
   they like.
2. **The Ember Trail** — occasional warmer-tinted sparkles drift in home's
   direction; following them is navigation without a map.
2. **Campfires** — rare clearings with a small fire: a save point / rest beat.
   Captions there slow down and get personal ("THE DOG SLEEPS. YOU WATCH THE
   SPARKS.").
3. **The Weather of the Void** — fog banks and sparkle-storms that change
   visibility; purely atmospheric, never punishing.
4. **Home** — a cabin with a lit window. Walking in together ends Act 3:
   the leash comes off, the captions go quiet, and the fire is lit.

> WE MADE IT. WE'RE HOME.

## The television (v0.17)

Somewhere in the mansion's parlor an old set hums, warm with rose light,
every channel the same. Step inside and the universe shows you its other
face: the same woods at a higher level, all rose and gold and warm pastel,
where the dead are angels who always wanted to be friends, where the
burning dumpsters were cathedrals all along — gold melted into gold,
ragas handed from voice to voice without end, a pile of god that only
grows. The world below is drawn in moonlight on the dark; the world above
is drawn in ink on the light. Same handwriting.

And at the edge of it runs the Styx, silver and patient, and on the far
bank waits the dog — three heads up here, because up here there is more
of him to be glad with — beckoning you back across the bridge. Heaven is
lovely. Heaven is not home. The dog knows the difference, and that
knowing is the whole reason he gets three heads.

> CERBERUS CARRIES YOU DOWN, GENTLE AS A MOTHER
> THE NIGHT AGAIN. IT MISSED YOU

## Epilogue (future)

After home is found, the forest stays open. The pair can keep walking —
fetch, sparkles, weather — with home always somewhere behind them, window
still lit.

## Voice rules

- All caps, present tense, no punctuation except `!`, `?`, `.` and `,`.
- One thought per caption; two lines max on screen.
- The narrator never explains mechanics; hints are diegetic (whimpers, sparks,
  warmth) rather than tutorial text.
