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

## Heaven, wider (v0.20)

Heaven turned out to be bigger than the first visit let on. Past the
Styx the light keeps going: golden deserts, warm beaches, glaciers that
glow like held breath, and water you can simply walk into — heaven's
water is warm, and it does not mind. Far out past all of it, an island,
for the swimmers and the boat-builders and nobody else.

Hand-painted signs stand here and there in the grass, gold paint, steady
hand, all pointing the same way.

> GOD, IT SAYS. THEN AN ARROW

Follow enough of them and you come to a lake ringed by redwoods, and on
its east shore, God. God is a cricket. God has always been a cricket —
not hiding, not testing you, just existing, the way everything in heaven
exists: thoroughly. Frogs watch from their lilypads, menacing in the way
of frogs, which is to say patiently. You can ask the big question. You
can confess. You can shoo the frogs, which God did not need and
appreciates anyway. Mostly you can sit, and the sitting is the answer.

> YOU SIT. GOD EXISTS. YOU EXIST
>
> CHIRP.
>
> SOMEHOW THAT COVERS IT

And somewhere in all that light, rare as an honest lead, paces the one
red thing in heaven: **the minotaur**. He is not guarding anything. There
is no maze — that is the problem. The maze is consciousness with no
exit, and he walks it forever, checking every gap twice, like a man who
lost his keys, always searching, always wondering what to do next.

> WHAT DO I DO NEXT, HE ASKS THE AIR
>
> EVERY DOOR I FIND IS ANOTHER ROOM OF ME

He fights like a wall looking for a door. But he can be given
directions — not out, there is no out — just somewhere kinder. Point at
nothing, confidently. It is the truest thing anyone has told him.

> A MAZE IS JUST A PATH THAT LOVES YOU TOO MUCH TO END
>
> HE WANDERS ON. LIGHTER. STILL LOST. LESS ALONE

## The ghost town (v0.20)

Down in the night, some regions hold their breath. A ghost town: ruins
leaning into each other, a sign nobody straightens, and the ghosts still
running their old routines in four glitching frames apiece — buffering
their grief, datamoshing through doorways that stopped being doorways.
Some drift. Some sulk. Some have decided the living owe them, one coin
at a time.

Only one business stayed open. **Pirts, merchant (deceased)** — spirit
spelled sideways, mostly — buys bones and planks and stories, sells
draughts and rope and a ghost-press book about boats, and has jokes,
because somebody in this town has to. Says a lot about Pirts.

On the outskirts, a light still burns in the **bail-bonds office**. The
detective works the case of where in the devil the Devil is. The Devil
skipped bail; big surprise. Every lead burns — that is usually the lead.
His corkboard is red string chasing a suspect who is extremely the
Devil; one note just says CHECK HEAVEN? in shaky pen, and one string
leads to a mirror. You decide not to ask. Bring him something true — the
mansion, the attic light, nobody home — and he writes it down slow, like
it hurts.

> GOOD TIP, HE SAYS. THE DEVIL ALWAYS LIKED A VIEW

## Queue Town (v0.21)

Deep in the redwoods, where the trees wear their ridiculous garlands of
light, the night keeps a town that never died because it never hurried:
QUEUE TOWN, the wizard town, named for the waiting. Wizards queue for
everything. Power, mostly. The queue is the discipline; the grumpiness is
the uniform. None of them will hurt you. All of them will disapprove of
you, gently, forever — unless you compliment the hat. The hat preens. It
is a very good hat and it knows it.

Two shops stay lit. CORTIE — broad as a door, leather apron over robes,
a whetstone that never stops — sells honest steel and crooked little
lightning rods. A blade wants strength, he says. A wand wants brains.
Both, ideally. QUEEBEE — tall as a shelf, spectacles like two gold
coins, one sleeve forever ink-stained — sells rolled thunder tied in
violet ribbon. Paper remembers what minds forget, she says. Cast a
scroll and it burns telling you its one secret. Inscribe it — a page, or
the blank book, and letter by burning letter — and the secret is yours
for good. Her ledger lists every name that ever learned. Yours is not in
it. Yet, says the handwriting.

Magic itself turns out to be a kind of waiting too: the mind holds only
so many castings between rests — the head's shelves, filled by
intelligence, wisdom, charm — and sleep, warm stoves, ragas, prayer, and
God refill them. The wizards knew this all along. That is what the queue
was for.

## Epilogue (future)

After home is found, the forest stays open. The pair can keep walking —
fetch, sparkles, weather — with home always somewhere behind them, window
still lit.

## Voice rules

- All caps, present tense, no punctuation except `!`, `?`, `.` and `,`.
- One thought per caption; two lines max on screen.
- The narrator never explains mechanics; hints are diegetic (whimpers, sparks,
  warmth) rather than tutorial text.
