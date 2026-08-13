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
