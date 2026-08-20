# Compare Drawer: Contrast Vocabulary — Design

**Date:** 2026-08-20
**Status:** design, awaiting review
**Supersedes:** the "Still undecided → the comparison's contrast vocabulary" entry
in `Roadmap.md`, and the `Known Issues.md` entry "The comparison has only one
axis of contrast".

## 1. The problem, stated precisely

`summarise` describes each line independently against six checks, and
`buildVerdict` then compares two independent descriptions. Two lines that score
alike on every check produce identical prose, and the verdict falls back to
"practically equal — choose on feel."

The obvious reading is "not enough checks". **That reading is wrong, and it was
tested.** Book lines were replayed through chess.js and measured at ply 8:

| From | Candidate | centre | development | tempo | pawns left |
|---|---|---|---|---|---|
| 1.e4 e5 2.Nf3 Nc6 | 3.Bc4 Italian | 1v1 | 2v3 | −1 | 16 |
| | 3.Bb5 Ruy | 1v1 | 2v2 | 0 | 16 |
| | 3.d4 Scotch | 1v0 | 1v2 | −1 | **14** |
| 1.d4 d5 | 2.c4 QG | 1v1 | 2v2 | 0 | 16 |
| | 2.Bf4 London | 1v1 | 2v2 | 0 | 16 |
| 1.e4 c5 | Open Sicilian | 1v0 | 1v1 | 0 | **14** |
| | Closed Sicilian | 1v0 | 2v2 | 0 | 16 |

The finding: **good openings are good precisely because they satisfy the
fundamentals**, so comparing two strong candidates on "does it claim the centre
/ develop / castle" mostly shows parity. The fundamentals separate a good move
from a bad one; they do not separate two good moves. Adding more axes of the
same kind does not fix this.

A second measurement: **castling occurs at ply 9, 10 and 11** in the three
lesson openings. King safety is dead at every depth a beginner can follow.

## 2. What the drawer is for

To show **why a player would pick one move over the other**, reinforcing the
fundamentals the lessons teach — not to hand down an answer. Both candidates are
usually sound; the panel should say so, and then say what each one *chooses*.

This makes parity informative rather than a failure. "Both claim the centre" is
a lesson, provided the panel says it in the same words every time.

## 3. The design

### 3.1 Five rows, fixed order, always rendered

Each row compares **line A's value against line B's value**. Each value is
computed for the **mover** — the side choosing between the two candidates. The
opponent's position enters only through Tempo.

| Row | Value | Source |
|---|---|---|
| Centre | count of the mover's pawns on d4/e4/d5/e5 | `PositionFeatures.centerControl` occupancy |
| Development | count of the mover's minors off their home squares | `developedMinors[mover]` |
| King safety | whether the mover has castled | `castled[mover]` |
| Tempo | `developedMinors[mover] − developedMinors[opponent]` | derived |
| Character | pawns remaining on the board, both sides | derived |

**Development and Tempo must display different things.** Development shows the
mover's own count ("three pieces out"); Tempo shows only the differential ("a
move ahead of Black"). If Development displayed both sides' counts, Tempo would
be a subtraction the reader could already perform, and the row would carry no
information. This was caught in design review and is the single easiest way to
get this feature wrong.

**King safety is expected to read "neither has castled yet" in nearly every
comparison.** It stays anyway: a beginner who does not know *when* castling
happens learns it from a row that says so every time. Its gloss must therefore
be informative rather than empty — it names when castling usually arrives, not
merely that it has not.

**Character is the one row not drawn from the lesson curriculum.** It is
included because it is the only measured axis that reliably separates two strong
candidates, and because "this line opens the position, that one keeps it closed"
is the real difference between the games that follow.

It is rendered as a concept, never as a raw count — a player must never read
"16 pawns". The mapping from pawns traded (32 minus pawns remaining) is:

| Pawns traded | Renders as |
|---|---|
| 0 | "closed — nothing traded yet" |
| 1–2 | "opening up — a pair has come off" |
| 3+ | "open — several pawns traded" |

Two lines differ on this row when their bands differ, not when their counts do:
15 pawns and 16 pawns are the same band and must read as equal.

### 3.2 Row rendering

Every row shows both values and whether they differ, plus one short gloss.

A row's *value* is the measurement in the table above; its *rendering* may name
the concrete thing rather than the number when that reads better — "pawn on e4"
rather than "1", "castled" rather than "true". Two renderings that describe the
same value must still be marked equal: `e4` and `d4` both count 1 central pawn,
so that row reads as a match even though the words differ. **Equality is decided
on the value, never on the rendered string.**

```
Development    3 pieces   ►►   2 pieces
               e4 gets the bishop out sooner
```

Matching rows are still rendered, marked as equal, and glossed:

```
Centre         pawn on e4  ══  pawn on d4
               both claim a central square
```

### 3.3 The footer replaces the verdict

`buildVerdict`'s sentence is replaced by a footer naming the rows that differ:
"One real difference: development." When no row differs: "These do the same five
things, equally well — pick the one you would rather play."

`practicallyEqual` changes meaning. It currently means "the engine scores are
within `PRACTICALLY_EQUAL_CP`"; it becomes **"no row differs"**. The engine score
keeps its own separate line, as now, and keeps being labelled as a verdict on
the whole line rather than on the pictured position.

### 3.4 The line is shown

The drawer renders the moves it walked — `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5` — above
the mini-board.

This is the fix for a comprehension problem that looked like a depth problem.
The drawer currently shows a first move as a heading and then a board eight
plies later with **nothing in between**, so the pieces stand on squares the
player cannot account for. At any depth past one move they are guessing. With
the line shown, four moves is followable.

`LineSummary` gains the SANs actually walked. It already reports `plies`; the
moves are the same walk.

### 3.5 Depth stays at 8 plies

Because §3.4 makes it followable, and because shortening it kills the rows that
still move: at 4 plies, development and tempo flatten too, leaving only
Character live.

The mini-board caption continues to count in **moves**, not plies.

### 3.6 Authored prose stacks beneath the grid

`applyAuthored` currently **replaces** the derived pros and cons. It changes to
**append**: the five rows always render, and authored prose appears beneath as
the human account of what kind of game each move leads to.

The reason is the mechanism the whole design rests on — the spine teaches by
repeating. A grid that vanishes exactly where an author took trouble is a grid
the player cannot rely on. The two are also doing different jobs: the grid says
what changed on five axes, the prose says what sort of game you are choosing.
The engine cannot write the second; a human should not have to hand-write the
first.

## 4. What this changes

- `src/explain/compare.ts` — `summarise` returns rows instead of deriving
  pros/cons; `buildVerdict` becomes the footer; `applyAuthored` appends.
- `src/explain/types.ts` — a row type. The existing `ReasonTag` union is for
  `rules.ts` and is **not** reused here; per-move explanation and line
  comparison are different jobs and sharing the union would couple them.
- `src/ui/CompareDrawer.tsx` — renders the grid, the line, and the footer.
- `src/chess/` — a small pure helper for pawns-remaining, alongside the existing
  feature extractors.
- `compare.test.ts` — 21 tests assert the pros/cons shape and will need
  reworking, not deleting. Each one asserts a behaviour that still exists in
  some form; the assertions move to rows.

## 5. Explicitly out of scope

- **Widening `tempoRule` in `rules.ts`.** It defines tempo as "gives check",
  which is right for a single move and useless over a line. Two definitions of
  one word in an app that teaches vocabulary is a real problem, but it is a
  follow-up, not this change.
- More axes of any kind. Five is the vocabulary.
- Alphabetising, weighting, or scoring the rows against each other.
- Any change to the engine, the tree, or the lesson runner.

## 6. Assumptions to verify during implementation

- **The measurements above use book lines written by hand, not engine
  principal variations.** chess.js validated them as legal, and the openings are
  standard, but the drawer's real input is whatever the engine returns. Engines
  often prefer forcing continuations, so Character may fire *more* often than
  this sample suggests, and Development may diverge more. First implementation
  task should re-run the measurement against real PVs from the vendored engine
  and record what it finds.
- **King safety may prove to be noise rather than instruction.** If the browser
  pass finds that a permanently identical row trains players to ignore the grid,
  that is a finding worth acting on, not a detail to leave.

## 7. Testing

- Row derivation is pure and unit-testable without rendering, from a FEN pair.
- The Scotch line (`1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4`) is the fixture that
  makes Centre and Character both move; it is the discriminating case and every
  change to row derivation should be checked against it.
- **Mutation-check the row-difference logic.** A grid that renders five rows
  looks correct whether or not it can tell "differs" from "equal", which is the
  failure shape this repo has recorded ten times.
- A browser pass, because whether five rows plus prose plus a board plus a line
  of moves is *readable* is not a question jsdom can answer.
