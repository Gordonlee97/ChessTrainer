# Compare Contrast Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the compare drawer's independent pros/cons lists with five fixed rows that contrast two candidate lines on the same fundamentals every time, so parity becomes information instead of a shrug.

**Architecture:** A new pure module turns one walked end position into five measured values; a second function turns two sets of values into rendered rows. `compare.ts` calls it instead of deriving prose, and the drawer renders the rows, the moves that produced them, and authored prose beneath.

**Tech Stack:** TypeScript, React 19, chess.js 1.4.0, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-20-compare-contrast-vocabulary-design.md` — read it before Task 1. The plan argues from it; where they differ, the spec wins except where this plan says otherwise and explains why.

## Global Constraints

- **`src/chess/` and `src/explain/` import no React and no Zustand.** `src/test/purity.test.ts` enforces it and its exemption list must not grow.
- **Simple and beginner-friendly wins every tie.** This is the author's explicit standing instruction for this plan. Where a choice is between precision and plainness in anything a player reads, choose plainness. Concretely: the row the spec calls *Character* is labelled **"Open or closed"** on screen; glosses use ordinary words; no row text contains a raw count of pawns.
- **Never hand-write a FEN.** Derive positions by replaying SANs through chess.js.
- **Evaluations are White-relative** above the UCI layer.
- **Press feedback uses `box-shadow`, never a box-model property**, and `prefers-reduced-motion` is honoured while still leaving a visible press signal.
- **Test output must be pristine.** The suite is at **547 passing, 1 skipped (expected `engine.smoke`, which needs a real Worker), 0 warnings**. The warning count is a number reported in every task; non-zero is a finding with an owner.
- **Mutation-check every test written to guard a named defect.** Break the implementation, watch the test fail with a *clean assertion mismatch* rather than an exception, restore, confirm green, and report what you saw.
- **This plan pastes full code only for files it creates.** For existing files it describes the change and names the invariants to preserve; read the file first and adapt.

---

## Two things the code says that the spec does not

Read both before Task 1.

**1. `mateVerdict` must survive.** `compare.ts:232` begins `buildVerdict` with a mate check that returns early, so a line forcing mate is described as mating rather than compared on structure. The spec never mentions it. The footer in §3.3 replaces only the **non-mate** path; the mate early-out stays exactly as it is, ahead of everything this plan adds. Deleting it would turn "White mates in 3" into "one real difference: development".

**2. `LineSummary.pros` / `.cons` are load-bearing in two different ways.** They are currently both the derived prose *and* the slot authored content overwrites. After this change, derived prose is gone and those fields carry **only** authored content — often empty. Task 3 covers the rename; the trap is leaving a consumer reading `pros` and expecting derived text.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/chess/pawnStructure.ts` *(modify)* | Gains `pawnsRemaining(fen)`. It lives here because it is a fact about pawns and this module already owns those. |
| `src/explain/contrastRows.ts` *(create)* | The whole vocabulary: measure one line, compare two, render five rows. Pure. |
| `src/explain/contrastRows.test.ts` *(create)* | Unit tests, no rendering. |
| `src/explain/compare.ts` *(modify)* | `summarise` returns measured values and walked SANs; `applyAuthored` appends; the non-mate verdict becomes the footer. |
| `src/ui/CompareDrawer.tsx` *(modify)* | Renders the moves, the five rows, the footer, then authored prose. |
| `src/ui/theme.css` *(modify)* | Row grid styling. |

---

### Task 1: Verify the measurements against real engine output

The spec's numbers come from **seven book lines written by hand**, not from the engine. The drawer's real input is whatever Stockfish returns, and engines often prefer forcing continuations — so Character may fire more often than the sample suggests, and Development may diverge more. The spec says so in §6 and asks for this first.

This task writes no production code. Its deliverable is a recorded finding.

**Files:**
- Create: `docs/superpowers/plans/2026-08-20-compare-measurements.md` (the finding)

**Interfaces:**
- Consumes: nothing
- Produces: a recorded answer to "do the five rows actually move on engine PVs?", which Task 2's fixtures cite

- [ ] **Step 1: Start the app**

```bash
npm run dev -- --port 5188 --strictPort
```

Kill it at the end: find the listener on 5188 and stop that process. The npm wrapper leaves an orphan otherwise.

- [ ] **Step 2: Collect real principal variations**

Load `http://localhost:5188/`, let the engine reach depth 18–20, and read the three candidate PVs from the page. The candidate rail renders each line's PV as text under the move. Collect PVs for at least six positions: the start position, after `1.e4`, after `1.d4`, after `1.e4 e5 2.Nf3 Nc6`, after `1.d4 d5`, and after `1.e4 c5`.

Browser tools are deferred — load them in ONE `ToolSearch` call: `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp`. Make your own tab and close it when done.

- [ ] **Step 3: Measure each PV at 8 plies**

For each position, for each of its candidate PVs, walk 8 plies through chess.js and record, for the mover: central pawns, developed minors, castled, development differential, and pawns remaining on the board.

- [ ] **Step 4: Write the finding**

Record, in `docs/superpowers/plans/2026-08-20-compare-measurements.md`: the raw table, and then for each of the five rows, **in how many of the collected comparisons it differed between the two best candidates**. State plainly whether each row earns its place.

- [ ] **Step 5: Report before continuing**

If a row differed in **zero** comparisons, say so prominently — that is a design finding, not a detail, and the author asked to be told. Do not silently drop or keep a row on your own judgement. King safety is expected to be dead; if Character is also dead, the design's central claim has failed and the plan should stop for a decision.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-08-20-compare-measurements.md
git commit -m "docs: measure the contrast rows against real engine principal variations"
```

---

### Task 2: The vocabulary module

**Files:**
- Modify: `src/chess/pawnStructure.ts` — add one exported function
- Create: `src/explain/contrastRows.ts`
- Create: `src/explain/contrastRows.test.ts`
- Test: `src/chess/pawnStructure.test.ts` (extend)

**Interfaces:**
- Consumes: `extractFeatures(fen)` from `src/chess/features.ts`, returning `PositionFeatures` with `centerControl`, `developedMinors`, `castled` keyed by `Color` (`'w' | 'b'`)
- Produces, and Tasks 3 and 4 depend on these names exactly:

```ts
export type ContrastRowId = 'centre' | 'development' | 'kingSafety' | 'tempo' | 'character';

/** What one walked line measures to, from the mover's point of view. */
export interface LineValues {
  /** Mover's pawns standing on d4/e4/d5/e5. */
  centre: number;
  /** Mover's knights and bishops off their home squares. */
  development: number;
  /** Whether the mover has castled. */
  kingSafety: boolean;
  /** Mover's developed minors minus the opponent's. May be negative. */
  tempo: number;
  /** Pawns traded so far, banded: 0 = closed, 1 = opening up, 2 = open. */
  character: 0 | 1 | 2;
}

export interface ContrastRow {
  id: ContrastRowId;
  /** The heading a player reads. */
  label: string;
  /** How line A reads on this row. */
  aText: string;
  /** How line B reads on this row. */
  bText: string;
  /** True when the two lines measure the same on this row. */
  equal: boolean;
  /** One short sentence explaining the row for this pair. */
  gloss: string;
}

export function measureLine(endFen: string, mover: Color): LineValues;
export function buildContrastRows(a: LineValues, b: LineValues): ContrastRow[];
```

- [ ] **Step 1: Add `pawnsRemaining` to `src/chess/pawnStructure.ts`**

Read the file first. Add an exported `pawnsRemaining(fen: string): number` returning the count of pawns of both colours on the board. It belongs here rather than in `features.ts` because `PositionFeatures` is consumed in many places and does not need widening for one number.

- [ ] **Step 2: Extend `src/chess/pawnStructure.test.ts`**

Cover the start position (16) and a position after a pawn trade (14), deriving the second by replaying `e4 d5 exd5` through chess.js rather than writing a FEN.

- [ ] **Step 3: Run it**

Run: `npx vitest run src/chess/pawnStructure.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing tests for the vocabulary**

Create `src/explain/contrastRows.test.ts`:

```ts
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { buildContrastRows, measureLine, type LineValues } from './contrastRows';

/** Replays SANs so no FEN in this file is hand-written. */
function fenAfter(...sans: string[]): string {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

/** The Italian at 8 plies — the quiet case where little differs. */
const ITALIAN = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6'];
/** The Scotch at 8 plies — the discriminating case: a central pawn is traded. */
const SCOTCH = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6'];

describe('measureLine', () => {
  it('counts the mover\'s central pawns, not both sides', () => {
    // After the Italian both sides hold one central pawn; the mover is White.
    expect(measureLine(fenAfter(...ITALIAN), 'w').centre).toBe(1);
  });

  it('notices when the opponent\'s central pawn has been traded off', () => {
    // Black's e-pawn captured on d4, so White holds the only central pawn.
    expect(measureLine(fenAfter(...SCOTCH), 'w').centre).toBe(1);
    expect(measureLine(fenAfter(...SCOTCH), 'b').centre).toBe(0);
  });

  it('counts developed minors for the mover alone', () => {
    expect(measureLine(fenAfter(...ITALIAN), 'w').development).toBe(2);
  });

  it('reports tempo as the difference between the two sides', () => {
    // White has two minors out, Black three, so White is a move behind.
    expect(measureLine(fenAfter(...ITALIAN), 'w').tempo).toBe(-1);
    expect(measureLine(fenAfter(...ITALIAN), 'b').tempo).toBe(1);
  });

  it('reports king safety as false before anyone castles', () => {
    // Castling lands at ply 9-11 in real openings, so 8 plies is always false.
    expect(measureLine(fenAfter(...ITALIAN), 'w').kingSafety).toBe(false);
  });

  it('bands character by pawns traded, not by raw count', () => {
    expect(measureLine(fenAfter(...ITALIAN), 'w').character).toBe(0); // nothing traded
    expect(measureLine(fenAfter(...SCOTCH), 'w').character).toBe(1); // one pair off
  });
});

describe('buildContrastRows', () => {
  const quiet: LineValues = {
    centre: 1, development: 2, kingSafety: false, tempo: 0, character: 0,
  };

  it('returns the five rows in a fixed order every time', () => {
    const ids = buildContrastRows(quiet, quiet).map((row) => row.id);
    expect(ids).toEqual(['centre', 'development', 'kingSafety', 'tempo', 'character']);
  });

  it('marks every row equal when the two lines measure the same', () => {
    expect(buildContrastRows(quiet, quiet).every((row) => row.equal)).toBe(true);
  });

  it('marks only the row that differs', () => {
    const faster = { ...quiet, development: 3 };
    const rows = buildContrastRows(quiet, faster);

    expect(rows.filter((row) => !row.equal).map((row) => row.id)).toEqual(['development']);
  });

  /**
   * Equality is decided on the measured value, never on the rendered words.
   * `e4` and `d4` both count one central pawn, so that row is a match even
   * though a renderer might name different squares.
   */
  it('treats equal values as equal however they read', () => {
    const [centre] = buildContrastRows(quiet, quiet);
    expect(centre.equal).toBe(true);
    expect(centre.gloss.length).toBeGreaterThan(0);
  });

  it('treats the same character band as equal even at different counts', () => {
    // Both "opening up"; only the band is compared.
    const a: LineValues = { ...quiet, character: 1 };
    const b: LineValues = { ...quiet, character: 1 };
    const row = buildContrastRows(a, b).find((r) => r.id === 'character')!;
    expect(row.equal).toBe(true);
  });

  it('never puts a raw pawn count in anything a player reads', () => {
    const open: LineValues = { ...quiet, character: 2 };
    const row = buildContrastRows(quiet, open).find((r) => r.id === 'character')!;
    for (const text of [row.label, row.aText, row.bText, row.gloss]) {
      expect(text).not.toMatch(/\b(1[0-9]|2[0-9]|3[0-2])\b/); // no 10-32
    }
  });

  it('labels the character row in plain words, not jargon', () => {
    const row = buildContrastRows(quiet, quiet).find((r) => r.id === 'character')!;
    expect(row.label).toBe('Open or closed');
  });

  it('gives every row a non-empty label, texts and gloss', () => {
    for (const row of buildContrastRows(quiet, { ...quiet, tempo: 2 })) {
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.aText.length).toBeGreaterThan(0);
      expect(row.bText.length).toBeGreaterThan(0);
      expect(row.gloss.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 5: Run them and watch them fail**

Run: `npx vitest run src/explain/contrastRows.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 6: Implement `src/explain/contrastRows.ts`**

Write the module to satisfy those tests. Requirements the tests do not fully pin, which are binding anyway:

- `measureLine` takes the **end** position of a walked line. Both candidates share a base position, so absolute-at-end and delta-from-base rank identically; measuring the end is simpler and is what the tests assume.
- `character` bands from pawns traded (`32 - pawnsRemaining(fen)`): `0` traded → `0`, `1-2` → `1`, `3+` → `2`.
- Row labels, exactly: `Centre`, `Development`, `King safety`, `Tempo`, `Open or closed`.
- The king-safety gloss must **teach when castling happens**, not merely report that it has not: it is expected to read the same in nearly every comparison, so an empty gloss makes the row noise. Something of the shape "neither king is safe yet — castling usually comes around move five".
- The tempo gloss must not use the word *tempo* as its only explanation; say what it means in ordinary words ("a move ahead of Black in development"). The term is in the glossary, but this panel is aimed at beginners and plainness wins ties.
- Glosses are one short sentence. No row text contains a pawn count.

- [ ] **Step 7: Run the tests and the purity guard**

Run: `npx vitest run src/explain/contrastRows.test.ts src/test/purity.test.ts`
Expected: all PASS. The purity run matters: `contrastRows.ts` sits under a guarded directory and must import no React and no Zustand.

- [ ] **Step 8: Mutation-check the row-difference logic**

This is the named defect this repo has recorded ten times: a grid that renders five rows looks correct whether or not it can tell "differs" from "equal".

1. Make `buildContrastRows` set `equal: true` unconditionally. Expected: "marks only the row that differs" FAILS with a clean assertion mismatch showing `[]` where `['development']` was expected.
2. Restore. Make it set `equal: false` unconditionally. Expected: "marks every row equal…" FAILS.
3. Restore. Make the character row compare raw pawn counts instead of bands. Expected: "treats the same character band as equal…" still passes — so **also** confirm the band logic by checking that two lines with 15 and 16 pawns remaining land in the same band before trusting it.
4. Restore and confirm green. Report each observed failure message.

- [ ] **Step 9: Commit**

```bash
git add src/chess/pawnStructure.ts src/chess/pawnStructure.test.ts src/explain/contrastRows.ts src/explain/contrastRows.test.ts
git commit -m "feat(explain): measure and contrast two lines on five fixed rows"
```

---

### Task 3: Rewire `compare.ts`

**Files:**
- Modify: `src/explain/compare.ts`
- Test: `src/explain/compare.test.ts`

**Interfaces:**
- Consumes: `measureLine`, `buildContrastRows`, `ContrastRow`, `LineValues` from Task 2
- Produces, for Task 4:

```ts
export interface LineSummary {
  san: string;
  endFen: string;
  plies: number;
  /** The SANs actually walked, so the drawer can show how the position arose. */
  moves: string[];
  scoreCp: number;
  mate: number | null;
  values: LineValues;
  /** Authored prose only. Empty unless lesson content supplied it. */
  pros: string[];
  cons: string[];
}

export interface Comparison {
  a: LineSummary;
  b: LineSummary;
  rows: ContrastRow[];
  /** True when no row differs. */
  practicallyEqual: boolean;
  /** The footer sentence. */
  verdict: string;
}
```

- [ ] **Step 1: Read `src/explain/compare.ts` in full before editing**

In particular `buildVerdict` and `mateVerdict`. The mate early-out at the top of `buildVerdict` must survive untouched and must still run before anything this task adds.

- [ ] **Step 2: Update the existing tests first, then add**

`compare.test.ts` has 21 tests asserting the pros/cons shape. Each asserts a behaviour that still exists in some form — do not delete them, move the assertion to its new home. A test asserting "reports the plies it actually walked" stays as it is. A test asserting a specific derived pro becomes an assertion about a row's `equal` flag or text.

Add tests for what is new:

- `walk` records the SANs it played, and `moves` matches `plies` in length.
- A mate line still produces the mate verdict, not a row footer. This is the regression guard for the early-out.
- `applyAuthored` **appends**: given authored pros, the comparison still has five rows *and* the authored prose.
- `practicallyEqual` is true when no row differs and false when one does — no longer keyed to the centipawn gap.

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run src/explain/compare.test.ts`
Expected: FAIL, with the new assertions unmet.

- [ ] **Step 4: Make the change**

Describe-not-paste, because this file exists and is dense:

- `walk` returns the SANs it played alongside the FEN and count.
- `summarise` stops building `pros`/`cons` and instead returns `values` from `measureLine` plus `moves`.
- `applyAuthored` stops replacing and starts setting only the authored `pros`/`cons`.
- `compareLines` builds `rows` once from the two `values` and puts them on the `Comparison`.
- `buildVerdict` keeps its mate early-out verbatim; its non-mate body becomes the footer: name the rows that differ, or say none do. `practicallyEqual` becomes "no row differs".

Delete the long comment in `buildVerdict` explaining why the old collision was unavoidable — it documents behaviour that no longer exists, and a stale explanation is worse than none. Replace it with a line pointing at the spec.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: green. Report the pass count, the skip, and the warning count as numbers.

- [ ] **Step 6: Commit**

```bash
git add src/explain/compare.ts src/explain/compare.test.ts
git commit -m "feat(explain): compare lines by row instead of by independent prose"
```

---

### Task 4: Render it

**Files:**
- Modify: `src/ui/CompareDrawer.tsx`
- Modify: `src/ui/theme.css`
- Test: `src/ui/CompareDrawer.test.tsx`

**Interfaces:**
- Consumes: `Comparison` with `rows`, and `LineSummary` with `moves`, from Task 3

- [ ] **Step 1: Write the failing tests**

Extend `src/ui/CompareDrawer.test.tsx`:

- All five row labels render, in order, for any comparison.
- A row that differs is distinguishable from one that does not **by something other than colour** — the project forbids colour-only signalling. Assert on text or an attribute, not a class name alone.
- The walked moves render, and the first move is the candidate's own SAN.
- Authored prose renders **in addition to** the rows, not instead of them.
- The footer names the differing row when there is one.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/ui/CompareDrawer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Render the moves, the rows, and the footer**

Order inside each panel: heading, the walked moves, mini-board, engine score, board caption, the five rows, the footer, then authored prose.

Keep the two existing separate sentences about the score and the caption exactly as they are — they exist because running them together made a false claim, and there is a comment saying so.

- [ ] **Step 4: Style the rows**

Add CSS for the row grid. Constraints: press feedback via `box-shadow` only; `prefers-reduced-motion` honoured with a visible signal retained; differing rows marked by weight or a mark as well as any colour.

- [ ] **Step 5: Run the suite**

Run: `npm test` and `npm run typecheck`
Expected: green, zero warnings, counts reported.

- [ ] **Step 6: Commit**

```bash
git add src/ui/CompareDrawer.tsx src/ui/CompareDrawer.test.tsx src/ui/theme.css
git commit -m "feat(ui): show the contrast rows, the line, and the footer"
```

---

### Task 5: Browser pass, density judgement, and the vault

**Files:**
- Modify: `docs/obsidian/ChessTrainerVault/Current State.md`, `Known Issues.md`, `Roadmap.md`, `Architecture.md`, `Start Here.md`

- [ ] **Step 1: Drive it**

```bash
npm run dev -- --port 5188 --strictPort
```

Kill the listener on 5188 when done. Open a comparison from the explorer — play a move, click "Compare X and Y" in the candidate rail — and check:

1. All five rows render with both values and a gloss.
2. The walked moves are shown and the position on the mini-board is reachable by following them. This is the point of §3.4; if you cannot follow it, say so.
3. A comparison where a central pawn is traded (reach one via the Scotch: `1.e4 e5 2.Nf3 Nc6 3.d4`) moves the Centre and Open-or-closed rows.
4. The authored comparison still works: the Italian's `Bc4` position carries authored prose, which must appear **beneath** five rendered rows.

- [ ] **Step 2: Judge the density, and say what you think**

This is a judgement step, not a checklist. The panel now holds a heading, a move list, a board, a score, a caption, five rows and prose — for each of two lines, side by side. **The author's standing instruction for this plan is that simple and beginner-friendly wins ties.**

Report honestly whether it reads as clear or as a wall. If it is a wall, say which element you would cut and why; do not cut it yourself. Two specific things to look at:

- King safety is expected to read identically in nearly every comparison. Does a permanently identical row teach, or does it train the reader to skip the grid?
- Does the move list duplicate what the candidate rail already showed, and if so does that matter?

- [ ] **Step 3: Update the vault**

- `Current State.md` — the behaviour changed.
- `Known Issues.md` — **delete** "The comparison has only one axis of contrast"; it is fixed. Add anything found and not fixed, including the density judgement if it went against the design.
- `Roadmap.md` — move the contrast vocabulary out of "Still undecided".
- `Architecture.md` — the new module and where the vocabulary lives.
- `Start Here.md` — **last**, describing reality as you leave it, including whether the branch is merged.

Bump `updated:` only on notes you touch. Use absolute dates.

- [ ] **Step 4: Final verification**

Run `npm test` and `npm run typecheck`. Report pass count, skip, and warning count as numbers.

Before opening a PR, re-read the PR and branch state — `gh pr list --state all` and `git log --oneline origin/master..HEAD`. A reading taken at the start of a session has expired.

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(vault): record the contrast vocabulary and the browser pass"
```

---

## Self-Review

**Spec coverage.** §3.1 five rows → Task 2. §3.1's development/tempo separation → Task 2 Step 6 and the `tempo` test. §3.1 character banding → Task 2. §3.2 rendering and value-not-string equality → Task 2 tests plus Task 4. §3.3 footer and the changed meaning of `practicallyEqual` → Task 3. §3.4 showing the line → Task 3 (`moves`) and Task 4 (rendering). §3.5 depth unchanged → no task needed; `DEFAULT_PLIES` is untouched, which is the point. §3.6 authored appends → Task 3. §6 assumptions → Task 1, and the king-safety question → Task 5 Step 2. §7 testing → mutation check in Task 2 Step 8, browser pass in Task 5.

**Gap found and closed:** the spec never mentions `mateVerdict`. Named at the top of this plan and given a regression test in Task 3 Step 2.

**Second gap, stated not closed:** the spec says `ReasonTag` is not reused, and this plan does not touch `rules.ts` — so `tempo` continues to mean "gives check" there and "development differential" here. Two senses of one word in an app that teaches vocabulary. It is out of scope per §5 and should be the next plan.

**Placeholder scan.** No TBDs. Task 3 Step 4 and Task 4 Step 3 describe rather than paste, deliberately, per the global constraint about existing files; each names the invariants to preserve.

**Type consistency.** `ContrastRowId`, `LineValues`, `ContrastRow`, `measureLine`, `buildContrastRows` are used with the same names and shapes in Tasks 2, 3 and 4. `LineSummary.values` and `.moves` are introduced in Task 3 and consumed in Task 4 under those names. `pawnsRemaining` is defined in Task 2 Step 1 and used in Step 6.
