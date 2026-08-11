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
