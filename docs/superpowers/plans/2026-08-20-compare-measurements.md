---
updated: 2026-08-20
status: current
tags: [chesstrainer, compare-drawer, measurement]
---

# Compare drawer: contrast rows measured against real engine PVs

Task 1 of `docs/superpowers/plans/2026-08-20-compare-contrast-vocabulary.md`. The
spec's five-row design (`docs/superpowers/specs/2026-08-20-compare-contrast-vocabulary-design.md`,
§6) was built from seven hand-written book lines and explicitly asked for this
re-run against the vendored engine before Task 2 starts.

## Method

- Ran the app at `http://localhost:5188/` (branch `feat/compare-contrast-vocabulary`).
- For each position, let Stockfish reach depth 18–20 (MultiPV 3, per
  `src/ui/useAnalysis.ts`'s `TARGET_DEPTH = 20`).
- Read the **full** principal variations, not the 6-ply text the candidate
  rail displays (`src/ui/CandidateRail.tsx:226` truncates to
  `line.pv.slice(0, 6)`). The rail's own React state (`useAnalysis`'s `result`)
  holds the untruncated PV; it was read via the component's fiber tree in a
  browser `javascript_tool` session rather than the rendered text, since 8
  plies of a Ruy Lopez/Italian line routinely runs past 6.
- Moves were played either by invoking the candidate row's own `onClick`
  (when the desired SAN was one of the three engine candidates) or, for one
  position (`1.e4 c5` — the Sicilian was not always in White-to-move's or
  Black's top three at depth 20), by invoking the board's own
  `onSquareClick` handler directly with the piece's home square and `c5`.
  Both are the app's real handlers, not a synthetic DOM event.
- For each position, walked the **top two candidates** (`result.lines[0]`
  and `result.lines[1]`) 8 plies through chess.js — the exact pair
  `CandidateRail` passes to `CompareDrawer` (`a=result.lines[0]`,
  `b=result.lines[1]`; see `src/ui/CandidateRail.tsx:241-242`) and the exact
  ply count `compareLines`'s `DEFAULT_PLIES` uses.
- Computed the five rows per the brief's definitions, independent of the
  current `extractFeatures` heuristics in `src/chess/features.ts` (whose
  `centerControl` counts attackers, not standing pawns — a different metric
  from what this design calls "centre"):
  - **centre** — mover's pawns standing on d4/e4/d5/e5.
  - **development** — mover's knights/bishops off their home squares.
  - **king safety** — mover's king on a castled square (g1/c1/g8/c8).
  - **tempo** — mover's developed minors minus the opponent's.
  - **open/closed ("Character")** — pawns traded, banded: 0 → closed,
    1–2 → opening up, 3+ → open. Pawns traded = 16 − pawns remaining on the
    board (16 pawns start the game, not 32 — the earlier draft's error).
- Six positions were the brief's required minimum (start, `1.e4`, `1.d4`,
  `1.e4 e5 2.Nf3 Nc6`, `1.d4 d5`, `1.e4 c5`); two more were collected along
  the way to `1.e4 e5 2.Nf3 Nc6` (`1.e4 e5` and `1.e4 e5 2.Nf3`) and kept
  since they cost nothing extra. Required rows are marked below; the
  headline verdicts are reported both ways.

Scratch script used: a temporary `scratch-measure.mjs` at the repo root,
running the definitions above through `chess.js` 1.4.0 against the collected
PVs. Deleted after this note was written, per the "never hand-write a FEN,
scratch scripts get deleted" rule — every position's FEN below is chess.js
output, not typed by hand.

## Raw table

Each row is one position; **A** and **B** are the engine's best and
second-best candidate. Values are for the mover, measured on the position
reached after walking each candidate's PV 8 plies (or fewer if the PV was
shorter — none were, here).

| Position (mover) | Required | A: san (cp) → centre / dev / king / tempo / traded (band) | B: san (cp) → centre / dev / king / tempo / traded (band) | Rows that differ |
|---|---|---|---|---|
| start (w) | yes | Nf3 (33) → 1 / 1 / no / 0 / 2 (opening up) | e4 (32) → 2 / 1 / no / 0 / 0 (closed) | **centre**, **open/closed** |
| 1.e4 (b) | yes | e5 (36) → 0 / 1 / no / 0 / 2 (opening up) | c5 (37) → 1 / 1 / no / 0 / 2 (opening up) | **centre** |
| 1.e4 e5 (w) | no | Nf3 (31) → 1 / 1 / no / −1 / 2 (opening up) | Nc3 (15) → 1 / 2 / no / 1 / 0 (closed) | **development**, **tempo**, **open/closed** |
| 1.e4 e5 2.Nf3 (b) | no | Nc6 (31) → 0 / 1 / no / 0 / 2 (opening up) | Nf6 (42) → 1 / 1 / no / −1 / 2 (opening up) | **centre**, **tempo** |
| 1.e4 e5 2.Nf3 Nc6 (w) | yes | Bb5 (36) → 1 / 2 / **yes** / 0 / 1 (opening up) | Bc4 (25) → 1 / 4 / no / 1 / 0 (closed) | **development**, **king safety**, **tempo**, **open/closed** |
| 1.d4 (b) | yes | d5 (19) → 1 / 1 / no / −1 / 0 (closed) | Nf6 (24) → 1 / 1 / no / −1 / 0 (closed) | *(none)* |
| 1.d4 d5 (w) | yes | c4 (37) → 1 / 1 / no / 0 / 2 (opening up) | Nf3 (25) → 1 / 2 / no / 0 / 0 (closed) | **development**, **open/closed** |
| 1.e4 c5 (w) | yes | Nf3 (46) → 1 / 2 / no / 0 / 2 (opening up) | Nc3 (37) → 1 / 2 / no / −1 / 0 (closed) | **tempo**, **open/closed** |

## Per-row difference counts

| Row | Required positions (n=6) | All collected (n=8) |
|---|---|---|
| Centre | 2 | 3 |
| Development | 2 | 3 |
| King safety | 1 | 1 |
| Tempo | 2 | 4 |
| **Open/closed ("Character")** | **4** | **5** |

## Verdict per row

- **Open/closed earns its place, decisively.** It differed in 4 of the 6
  required comparisons (67%) and 5 of 8 overall — the strongest signal of
  any row, exactly as the design hoped. This is the row the redesign's whole
  premise rests on, and on real engine PVs it holds up. **This row does not
  fail — the design's central claim is validated, not disproved.**
- **Tempo earns its place**, differing in 2 of 6 required (4 of 8 overall) —
  more often than the prior hand-written sample suggested ("tempo is usually
  0"). Real engine PVs diverge in development tempo more than book lines do.
- **Centre earns its place**, also differing in 2 of 6 required (3 of 8) —
  again more than the prior finding ("centre almost never differs"). Once
  the definition is "pawns standing on the four center squares" rather than
  attacker counts, real PVs separate on it more than expected.
- **Development earns its place**, differing in 2 of 6 required (3 of 8),
  consistent with the prior finding of small (~1-2 minor) swings.
- **King safety is nearly dead but not quite.** It differed in exactly 1 of
  8 comparisons — the Ruy Lopez/Italian split, where `Bb5` castles by ply 8
  (`Bb5 a6 Ba4 Nf6 O-O …`) and `Bc4` does not (`Bc4 Nf6 d3 Bc5 Nc3 a5 Bg5
  h6`). The spec's own §6 flagged this row as the one expected to prove
  noise; this measurement confirms it is very rarely useful (12.5% of the
  sample) but is not literally always "neither" — a beginner playing the
  Italian/Ruy split would see it move exactly once. Whether that single case
  is worth a permanently-almost-always-blank row is the browser-pass
  judgement call the spec already flagged for Task 5, not a reason to drop
  the row now.

## What surprised me

- **King safety is not dead, only close to it.** The context handed into
  this task said flatly "castling happens at ply 9–11 so king safety is
  always neither." That is true for five of the eight sampled positions, but
  the sharpest main-line pair sampled (Ruy Lopez vs. Italian after 1.e4 e5
  2.Nf3 Nc6) castles inside 8 plies for one candidate and not the other.
  Worth surfacing since the design treats "almost always dead" and "always
  dead" differently in Task 5.
- **Centre and tempo move more than the prior hand-written sample found.**
  Both were reported as barely-differing on book lines; on real engine PVs
  each differed in a third of the required sample. Engines apparently do not
  race for identical structures as often as hand-picked "textbook" lines do.
- **Open/closed is the strongest row by a clear margin**, which is the
  opposite of a bad outcome — it means the one row the design most needed to
  work, works.

## Recommendation

No row differed in zero comparisons. Per the plan's Step 5 stop condition
(triggered only if Character/open-closed is dead), **the plan should
continue to Task 2.** King safety is the weakest row (as expected) but not
inert; that nuance belongs in Task 5's browser-pass judgement call, not a
reason to halt here.
