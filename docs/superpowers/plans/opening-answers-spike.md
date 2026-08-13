# Spike: engine-check every opening move that becomes a taught answer

**Date:** 2026-08-11
**Task:** Task 1 of the `lesson-quiz-loop` plan (`.superpowers/sdd/2026-08-11-lesson-quiz-loop/`)
**Purpose:** Before any move currently only *narrated* in `italian-game`,
`london-system`, or `black-vs-e4` is turned into a move the player is quizzed
on and told is "the answer," verify with the real engine that it actually is
a good move. `validateLessonChess` proves legality only; this spike is the
"prove it's good" step `Lessons.md` §1 requires.

## Method

1. **Positions.** A scratch script (not committed) imported the three lesson
   files' `segments[].moves[].san` lists and replayed them through chess.js,
   recording `chess.fen()` immediately before every move made by the
   lesson's own side (`side: 'white'` for `italian-game`/`london-system`,
   `side: 'black'` for `black-vs-e4`). No FEN was hand-written. The resulting
   player-move list matched the brief's table exactly — see the task report.
2. **Engine.** A copy of the vendored `public/engine/stockfish.js` build
   (Stockfish 18 Lite, single-threaded WASM) was driven directly from Node
   over its UCI stdin/stdout CLI mode — the same file, only renamed `.cjs` so
   Node's ESM-by-default resolution (this repo's `package.json` has
   `"type": "module"`) doesn't misparse it. Nothing under `src/engine/` or
   `public/engine/` was read as an import or modified.
3. **Search.** For every position: `setoption name MultiPV value 3`,
   `position fen <fen>`, `go depth 18`. When the taught move wasn't among the
   top 3 lines, a second search restricted to it alone
   (`go depth 18 searchmoves <move>`) supplied its score rather than leaving
   it unmeasured.
4. **Score convention.** All `cp` values below are **side-to-move-relative**,
   exactly as UCI reports them (no White-relative normalization). This is
   deliberate: the only comparison that matters here is the taught move
   against the engine's best move *in the same position*, which needs no
   sign flip as long as both numbers come from the same side to move — see
   the delta column.

## Results

All centipawn (cp) values are from the mover's perspective. Delta =
engine-best cp − taught-move cp (positive means the taught move scores
worse; a rare negative means the taught move, searched on its own, actually
scored *better* than the reported multipv-1 line — see the note below the
table).

### `italian-game` (side: white)

| Ply | SAN taught | Engine best | Taught score | Best score | Delta | Verdict |
|---|---|---|---|---|---|---|
| 1 | e4 | d4 | 33 | 33 | 0 | CLEAR |
| 3 | Nf3 | Nf3 | 33 | 33 | 0 | CLEAR |
| 5 | Bc4 | d4 | 27 | 39 | 12 | CLEAR |
| 7 | c3 | d3 | 26 | 31 | 5 | CLEAR |
| 9 | d3 | d3 | 29 | 29 | 0 | CLEAR |
| 11 | O-O | b4 | 24 | 27 | 3 | CLEAR |
| 13 | Re1 | Nbd2 | 36* | 25 | −11 | CLEAR |
| 15 | Bb3 | Bb3 | 24 | 24 | 0 | CLEAR |
| 17 | Nbd2 | h3 | 12* | 31 | 19 | CLEAR |

### `london-system` (side: white)

| Ply | SAN taught | Engine best | Taught score | Best score | Delta | Verdict |
|---|---|---|---|---|---|---|
| 1 | d4 | d4 | 33 | 33 | 0 | CLEAR |
| 3 | Bf4 | c4 | 25 | 27 | 2 | CLEAR |
| 5 | e3 | e3 | 21 | 21 | 0 | CLEAR |
| 7 | Nf3 | Nf3 | 22 | 22 | 0 | CLEAR |
| 9 | Bg3 | Bd3 | 16* | 22 | 6 | CLEAR |
| 11 | Bd3 | Nbd2 | 10* | 14 | 4 | CLEAR |
| 13 | c3 | dxc5 | 1 | 5 | 4 | CLEAR |
| 15 | Nbd2 | Nbd2 | 21 | 21 | 0 | CLEAR |
| 17 | O-O | Ne5 | 12 | 14 | 2 | CLEAR |

### `black-vs-e4` (side: black)

| Ply | SAN taught | Engine best | Taught score | Best score | Delta | Verdict |
|---|---|---|---|---|---|---|
| 2 | e5 | e6 | −40 | −35 | 5 | CLEAR |
| 4 | Nc6 | Nc6 | −38 | −38 | 0 | CLEAR |
| 6 | Bc5 | Bc5 | −22 | −22 | 0 | CLEAR |
| 8 | Nf6 | Nf6 | −24 | −24 | 0 | CLEAR |
| 10 | d6 | O-O | −25 | −23 | 2 | CLEAR |
| 12 | O-O | a6 | −24 | −20 | 4 | CLEAR |

`*` — taught move wasn't in the reported top 3; its score came from a
`searchmoves`-restricted search rather than the shared MultiPV search (see
the note below).

## Verdict summary

**24 of 24 measured moves are CLEAR.** 0 ACCEPTABLE, 0 QUESTIONABLE. Nothing
is blocked — Tasks 7-9 may author prompts for any of the moves this spike
measured, once the plan selects which sixteen of these become the taught
answers.

## Note on the one anomaly (`Re1`, italian-game ply 13)

`Re1`'s `searchmoves`-restricted score (36cp) came out *higher* than the
reported multipv-1 "best" (`Nbd2`, 25cp) from the shared 3-way search. This
was verified to be a genuine, small, well-known artifact of fixed-depth
engine search — not a scoring bug — by rerunning `Nbd2` itself through the
same `searchmoves`-restricted search: its score also shifted, from the
shared search's 25cp to a standalone 30cp at the same depth. Restricting the
root move set changes move ordering and pruning, which shifts a fixed-depth
score by single-digit-to-low-teens centipawns even for the *same* move. The
shift here (5-11cp) is far smaller than the 30cp CLEAR threshold and does
not change any verdict.

## What this does not cover

- Only the sixteen-move plan's candidate pool (all 24 player-side moves
  across the three lessons, per the brief's own table) was measured — not
  every move in every lesson (e.g., the opponent's moves, or moves in
  lessons outside this plan).
- Depth 18 / MultiPV 3 is a fixed budget chosen by the brief, not a proof of
  perfect play; it is far more than enough to catch a trap-losing move (the
  standard this project failed once before), which is what this spike exists
  to guard against.

---

# Browser verification — the lesson quiz loop, 2026-08-13

Run against `npm run dev` in real Chrome on `feat/lesson-quiz-loop`.
**Environment caveat:** the automation tab is backgrounded
(`document.visibilityState === "hidden"`), which throttles timers to ~1s and
zeroes the viewport. That does not affect any result below except auto-play's
timing, noted explicitly.

## The restructure

**PASS.** The base page is the explorer: header carries a **Lessons** menu, the
lesson list is hidden until opened, the left rail shows saved lines, and the
candidate rail shows `e4 +0.39`, `d4 +0.27`, `Nf3 +0.23` with a compare button.

Opening the menu lists the lessons; picking one starts it and **closes the
menu**. During a lesson:

| | |
|---|---|
| Left rail | "The Italian Game / Move 0 of 17 / [intro]" — the explanation |
| Right rail | The hidden-engine notice, the prompt, and **Hint** |
| Candidate rows | **0** |
| "Play the next move" | **Absent**, as required for an opening |
| "Leave lesson" | Present, outside the explanation box |

## The quiz loop

**Wrong answer — PASS, and this is the heart of it.** Played `e3` (legal, not
the answer) by keyboard:

- breadcrumb stayed `["start"]` — **the move never entered the game tree**;
- a red **✕** appeared over the board;
- the panel showed the *authored near-miss reply for `e3` specifically*:
  "…lets the bishop out and claims no central square at all — and nothing is
  stopping you taking the whole step.";
- the question and Hint stayed on screen.

**Retry retention — PASS.** The piece stays held after a rejection. Pressing
Enter again on `e3` announced "e3 is not the answer" rather than dropping the
piece or treating `e3` as a fresh pick-up.

**Correct answer — PASS.** Moving the cursor to `e4` and placing gave
breadcrumb `start › e4`, a green **✓**, announcement "e4", and the left rail
advanced to "Move 1 of 17" with the authored note for the move.

**Opponent's turn — PASS on the part that matters.** With the player's move
made and no checkpoint pending, the right rail is **empty** — it does *not*
fall back to showing engine candidates. That is the Task 6 fix confirmed in the
running app: before it, the engine's top move would have appeared on screen
during the opponent's turn, handing over the next answer.

## Not verified

- **Auto-play's 700ms reply.** The timer does not fire in a backgrounded tab.
  Its logic is covered by unit tests with fake timers, including the
  tip-of-line guard, but **the reply has not been watched arriving on a real
  board.** A human should confirm this in two seconds: start any opening,
  answer the first question, and watch Black respond on its own.
- **Sound.** No audio files are committed by design, so `correct`, `incorrect`,
  `hint` and `lessonComplete` play nothing. The calls are wired and unit-tested;
  what they sound like is unverified because there is nothing to hear.
- **The reduced-motion path** for the ✓/✕ mark.

---

## 2026-08-13 — Task 10 browser pass, second run

**This is a second, independent browser pass**, run without knowledge of the one
recorded immediately above (`73b92f1`) — the two sessions overlapped on the same
branch. It is kept as a separate section rather than merged, because two
independent observations of the same behaviour are worth more than one, and
because this run reaches three things the first one explicitly could not.

**It closes the first pass's largest recorded gap.** That section lists under
"Not verified": *"Auto-play's 700ms reply. The timer does not fire in a
backgrounded tab… the reply has not been watched arriving on a real board. A
human should confirm this in two seconds."* No human is needed — see Finding 3
below, where the reply was watched arriving, twice, with timings. It also
observes the segment-level board flip (Finding 4) and the revived `Bb5`
near-miss (Finding 1), neither of which the first pass covered.

Run against `npm run dev` on `http://localhost:5181` (5173-5180 were in use),
branch `feat/lesson-quiz-loop`. Findings 4-8 were measured at HEAD `04ebeb4`.
Findings 1-3 were first measured at `607b7b3`, before `65ec5a0`
(`fix(lesson): keep autoplay out of theme lessons`) and `12d7361`
(`fix(ui): retire the check mark on a timer`) landed from the parallel session;
**both were then re-run from a cold page load at `04ebeb4` and reproduced
exactly** — same SAN, same grade kind, same node counts, same authored reply.
Every number below was read out of the live app, not judged from a screenshot.

### Method, and why it is trustworthy

Two channels, both established before any claim was made.

**Store channel.** Vite dev serves the source modules, so
`await import('/src/tree/store.ts')` in the page returns the *same* module
singleton the running app holds. Identity was proven rather than assumed: the
lesson was started by clicking "The Italian Game" in the real UI, and
`useLessonStore.getState().lessonId` read through the imported module returned
`"italian-game"`. Nothing was patched into the app to measure it.

**Keyboard channel.** `react-chessboard` handles only drops, so pieces are moved
through the app's own keyboard layer (`src/chess/boardCursor.ts`, the
`div[role="application"]` in `src/ui/Board.tsx`) by dispatching
`new KeyboardEvent('keydown', {key, bubbles:true})` at that element. The
board's `role="status"` region names the square under the cursor after every
press (`"f1, white bishop"`), so the cursor position is *read* before each
`Enter` rather than inferred from a press count.

Two mechanical cautions, recorded so the next pass does not relearn them:

- **A press gap of 25 ms drops presses.** Four `ArrowRight` from `b1` landed on
  `e1`, not `f1` — three of four registered. This is the stale-closure cursor
  update already filed in `Known Issues`, reproduced here at 25 ms. At **90 ms**
  no press was dropped in any subsequent run. It is a real defect with a real
  trigger, not just a theoretical one.
- **A CDP `Runtime.evaluate` timeout does not stop the page.** Two long await
  chains timed out at 45 s and *kept running* in the renderer afterwards,
  leaving a piece picked up that a later call then misread. Long driver chains
  were abandoned in favour of short calls whose result is read back each time.

### Finding 1 — the dead near-miss is alive (`london-system`, `Bd3`)

The defect the content review found — a reply keyed `'Bb5+'` at a checkpoint
where the board can only ever produce `Bb5`, so the player got the generic
"Try again" — has now been **watched firing correctly in the running app**.
This is the only way this fix could ever be confirmed; no test on this branch
exercises the string the board actually emits.

Setup: `london-system` started, then the ten authored moves before `Bd3`
(`d4 d5 Bf4 Nf6 e3 e6 Nf3 Bd6 Bg3 O-O`) replayed into the tree, leaving
`selectedId = root/d4/d5/Bf4/Nf6/e3/e6/Nf3/Bd6/Bg3/O-O`, FEN
`rnbq1rk1/ppp2ppp/3bpn2/3p4/3P4/4PNB1/PPP2PPP/RN1QKB1R w KQ - 4 6`,
**11 tree nodes**. The bishop was then carried f1 → b5 on the keyboard.

| Measured | Value |
|---|---|
| Board's own SAN for the move | `"Bb5 is not the answer"` (board `role="status"`) |
| `lastRejection.san` | `"Bb5"` |
| `lastRejection.grade.kind` | `"near-miss"` — **not** `"wrong"` |
| Tree nodes before → after | **11 → 11** |
| `selectedId` before → after | unchanged |
| FEN before → after | unchanged |

**Re-run from a cold page load at HEAD `04ebeb4`**: reproduced exactly —
announcement `"Bb5 is not the answer"`, `grade.kind === "near-miss"`, 11 → 11
nodes, `selectedId` unchanged, same authored reply.

The panel rendered the authored reply verbatim, not the generic one:

> Engine suggestions are hidden while the lesson is asking you for a move. It
> looks like a threat and it is not: Black castled a move ago, so the diagonal
> in front of the bishop is empty all the way to e8. Then ...c6 kicks it away,
> and you have spent two moves to end up worse than if you had gone straight to
> the right square. Moves that only look aggressive just lose time.

### Finding 2 — a generic wrong move is rejected, and the tree does not grow

Same position and same checkpoint, playing `a3` (a pawn move carrying no
authored reply), by keyboard a2 → a3.

| Measured | Value |
|---|---|
| Announcement | `"a3 is not the answer"` |
| `lastRejection.san` / `.grade.kind` | `"a3"` / `"wrong"` |
| Panel tail | `"… asking you for a move. Try again."` |
| Tree nodes before → after | **11 → 11** |
| `selectedId`, FEN before → after | unchanged |

Both rejection paths leave the game tree untouched, which is the actual claim —
"the piece went back" is what it looks like, not what was measured.

### Finding 3 — a correct move plays, and the opponent replies on its own

Same checkpoint, playing the accepted answer `Bd3` (f1 → d3 on the keyboard).
Timings measured with `performance.now()` from the moment the `Enter` was
dispatched.

| Measured | Value |
|---|---|
| Announcement | `"Bd3"` (not "is not the answer") |
| Tree nodes before | 11 |
| Tree nodes at **+291 ms** | **12** — `…/Bg3/O-O/Bd3`, FEN side-to-move `b` |
| Tree nodes at **+7820 ms** | **13** — `…/Bg3/O-O/Bd3/c5` |
| `nodes[selectedId].move.san` at the end | `"c5"` |

So the player's move landed alone first and Black's reply arrived afterwards
on its own, with no further input — the 700 ms `AUTOPLAY_DELAY_MS` beat in
`useLessonAutoplay`. The +291 ms sample is the part that matters: it shows the
reply is genuinely deferred rather than applied in the same tick.

**Re-run from a cold page load at HEAD `04ebeb4`**, after `65ec5a0` changed
`useLessonAutoplay`: identical shape — 12 nodes at +699 ms, **13 nodes with
`nodes[selectedId].move.san === "c5"` at +6356 ms.**

This is the observation the previous section asked a human to make. It did not
need one: the tab is backgrounded here too, but a *freshly created* tab's timers
still fire (see the environment note below), so the 700 ms reply is watchable
from automation after all.

### Environment: two limits that cost time, recorded so the next pass does not

Neither is a defect in ChessTrainer.

- **A backgrounded tab freezes and the driver dies with it.** After several
  minutes with `document.hidden === true`, the tab entered Chrome's deep
  background-throttle: `setTimeout` stopped firing entirely (`Promise.resolve()`
  microtasks still ran), so every `await` in the driver — and every dynamic
  `import()` — hung until the 45 s CDP timeout. The app itself was fine and
  still rendering engine lines at depth 19; only the evaluation context's timers
  were dead. **A screenshot did not revive it and neither did a reload; only a
  brand-new tab did.** A fresh tab is also `hidden` but its timers fire, so
  hiddenness alone is not the trigger — elapsed time in the background is.
  Diagnose this with `setTimeout(()=>window.__tick=1,10)` and read `__tick` in
  the next call; if it is still 0, open a new tab rather than debugging the page.
  **This refines the caveat at the top of the previous section**, which treated
  `visibilityState === "hidden"` as the blocker and concluded the 700 ms reply
  was unwatchable from automation. Hiddenness alone is survivable; what kills
  the driver is a tab that has been backgrounded for several minutes. Open a
  fresh tab and the timer fires.
- **Keep driver chains to about six key presses per call.** Chains of 16
  presses hit the 45 s CDP timeout every time even at 90 ms spacing (~1.4 s of
  intended work), while 4-6 press chains always returned promptly. Worse, a
  timed-out evaluation *keeps running in the page*, so a later call can observe
  a piece that a supposedly-abandoned chain picked up.

### Finding 4 — segment-level board orientation after "Next part", observed at last

**This is the behaviour `Start Here.md` has recorded as never once observed in
this project.** It has now been watched, in `theme-development-and-tempo`,
whose segment 1 carries `side: 'black'` against a lesson-level
`side: 'white'`.

Orientation is measured from the board's own DOM: `react-chessboard` emits 64
`[data-square]` elements in visual reading order, so the first is the top-left
square and the 64th is the bottom-right.

| | Segment 0 | Segment 1 |
|---|---|---|
| `segmentIndex` | 0 | 1 |
| First `[data-square]` (top-left) | `a8` | **`h1`** |
| Second | `b8` | `g1` |
| 64th (bottom-right) | `h1` | **`a8`** |
| Tree | 8 nodes, segment played out | reseeded to **1 node** |
| FEN | — | `rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2` |

The flip was triggered by clicking the real **"Next part"** button found in the
DOM, not by calling `nextSegment()` — the button is half of what was being
checked. It was present once the segment was complete.

The keyboard layer flips with it, which is the stronger half of the claim
because `moveCursor` takes `orientation` as an argument and would silently be
wrong for every Black segment if it did not: after the flip, `ArrowUp` moved
the cursor `b2 → b1` (rank *decreasing*) and `ArrowRight` moved it `b1 → a1`
(file *decreasing*). Screen-up is board-down, as designed.

### Finding 5 — `black-vs-e4` starts with Black on the near side, White having moved

Measured immediately after `startLesson('black-vs-e4')` **and then again one
tool call later** — the first read was taken in the same tick as the store
write and returned stale DOM, which is worth recording because it would have
produced a false defect report. The settled reading:

| Measured | Value |
|---|---|
| First / 64th `[data-square]` | `h1` / `a8` — Black orientation, Black's back ranks nearest the player |
| Tree nodes | **2** — White's `e4` has already played itself |
| FEN | `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1` (Black to move) |
| `Hint` button | present |
| "Play the next move" | absent |

So White's move auto-played and the very first thing asked of the player is a
Black move.

### Finding 6 — "Play the next move" is gone from openings and present in a theme lesson

Both halves measured by enumerating every `<button>` on the page.

| Lesson | Kind | Nodes at start | "CANDIDATE MOVES" heading | "Play the next move" | `Hint` |
|---|---|---|---|---|---|
| `italian-game` | opening | 1 | absent | **absent** | present |
| `london-system` | opening | 1 | absent | **absent** | present |
| `black-vs-e4` | opening | 2 (after auto-`e4`) | absent | **absent** | present |
| `theme-development-and-tempo`, segment 1 | theme | 1 | — | **present** | — |

All three openings therefore ask a question immediately with no engine
candidate rows on screen; the rail is replaced by "Engine suggestions are
hidden while the lesson is asking you for a move."

Note the landmark trap found while measuring this: `section[aria-label="Candidate
moves"]` is **not** a valid test for "the engine rail is visible", because
`CheckpointPanel` renders under the same `aria-label` when it stands in the
rail's place. Counting that landmark returns 1 in both states. The heading text
`CANDIDATE MOVES · depth N` is the thing that actually distinguishes them.

### Finding 7 — the hint ladder reveals one tier per click and stops

Measured at `black-vs-e4`'s first checkpoint (`black-e4-meet-with-e5`) by
clicking the real `Hint` button and counting `<li>` elements after each click.

| Clicks | `<li>` rendered | `hintsShown` in store | `Hint` button |
|---|---|---|---|
| 0 | 0 | `{}` | present |
| 1 | 1 | `{black-e4-meet-with-e5: 1}` | present |
| 2 | 2 | `{black-e4-meet-with-e5: 2}` | present |
| 3 | 3 | `{black-e4-meet-with-e5: 3}` | **gone** |

The counter is keyed by checkpoint id, as designed. Read as a player, none of
the three tiers names `e5` — tier 3 ("Exactly one of your pawns can get into
that pawn's way at all, and only if the two of them end up face to face…")
is pointed, which the plan permits of a last tier, but stops short of the move.

### Finding 8 — stepping back with the breadcrumb does not drag the player forward

The autoplay guard that matters is `selectedNode.childIds.length !== 0`, so the
test has to land on a node that is **both** the opponent's turn and already has
a child — otherwise the guard is never exercised.

`black-vs-e4` was played out to 13 nodes, then the breadcrumb button `Bc5` was
clicked, selecting `root/e4/e5/Nf3/Nc6/Bc4/Bc5`: side to move `w` (the
opponent, since the player is Black), `childIds.length = 1`.

| Measured at +6311 ms | Value |
|---|---|
| `selectedId` | `root/e4/e5/Nf3/Nc6/Bc4/Bc5` — unchanged |
| Total tree nodes | 13 — unchanged |

6.3 s is nine times `AUTOPLAY_DELAY_MS`, so this is not a race that happened to
be won.

### One thing to adjudicate, not a measurement

`italian-open-with-e4` hint 3 reads: *"That is the bishop standing beside your
king, and its pawn should not stop half-way: a pawn on the third rank never
actually stands in the centre."* The plan's own test for this rule (added in
`2bfebcd`) is *"could a player make the move from this sentence alone?"*, and
its worked counter-example is "the pawn in front of your king steps one square".
This sentence identifies the piece (the f1 bishop's pawn) and the distance (not
the third rank, so two squares), which is arguably the same shape one square
over. It is a last tier, which the plan allows to be "very pointed", so this is
a judgement call on prose rather than something measurement settles — recorded
here for the controller, deliberately not changed.

### What this pass did NOT check

- **Drag-and-drop.** Every move above went through the keyboard layer.
  `react-chessboard`'s drop path is still unreachable to automation, so
  `onPieceDrop` in `src/ui/Board.tsx` is verified only by its unit tests.
- **The `(min-width: 1100px) and (min-height: 640px)` breakpoint.** Not
  attempted; the window cannot be resized in this environment, as four previous
  agents established.
- **Near-miss replies other than `london-bishop-at-the-king`'s `Bb5`.** One
  near-miss and one generic rejection were watched; the other authored replies
  are covered only by `lessons.test.ts` proving their keys are legal and
  canonically spelled, which is not the same as reading them on screen.
- **Hint tiers other than `black-e4-meet-with-e5`'s three.** The "no tier names
  the move" reading was done for one checkpoint plus the `italian-open-with-e4`
  tier flagged above, not for all 24.
- **Sound.** No audio files are committed by design, so nothing was audible and
  nothing was measured; the `sounds.play` calls were not observed firing.
- **"Next part" in an opening.** All three openings have exactly one segment, so
  the control cannot appear there; the segment transition was exercised in
  `theme-development-and-tempo` only.
