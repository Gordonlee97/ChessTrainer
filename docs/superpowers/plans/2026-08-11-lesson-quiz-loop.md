# Lesson Quiz Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the three opening lessons into a move-by-move quiz — every
player move asked, the opponent replying automatically, wrong moves rejected
rather than played.

**Architecture:** Quizzing every move needs no schema change: `checkpoint` is
already optional per move, so this is content plus three mechanisms. Auto-play
triggers on **side to move**, not on the absence of a checkpoint, so it stays
correct while the content is still being written. A rejected move never reaches
the game tree, so it cannot be derived from it — the attempt is the one piece
of genuinely new state.

**Tech Stack:** React 19, TypeScript, chess.js 1.4, react-chessboard v5,
Zustand, Zod, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-11-lesson-loop-and-moves-table-design.md`

**This is plan 1 of 2.** The moves table is plan 2 and is not in scope here.
`Breadcrumb.tsx` survives this plan untouched.

## Global Constraints

- **The core is React-free.** `src/chess/`, `src/engine/`, `src/tree/`,
  `src/explain/`, `src/content/`, `src/lesson/`, `src/progress/` must not
  import React. `src/test/purity.test.ts` enforces this. `STORE_EXEMPTIONS` is
  an explicitly enumerated `Set` of exactly three paths — never loosen it to a
  glob.
- **The game tree is the single source of truth for position.** A rejected move
  adds no node.
- **One search, three lines.** Do not add a second `useAnalysis()` call site.
- **Sound is optional by construction.** A missing sound plays nothing, logs
  nothing, never throws. `correct`, `incorrect`, `hint` and `lessonComplete`
  are already declared in `src/sound/sounds.ts`; **no audio files are committed
  and none are to be added by this plan.**
- **Press feedback uses `box-shadow`, never a box-model property.**
- **`prefers-reduced-motion` is honoured everywhere and must still leave a
  visible signal.**
- **Never hand-write a FEN.** Derive it by replaying through chess.js.
- **Legality is not correctness.** `validateLessonChess` proves a move is legal,
  never that it is good.
- **Existing files: read in full before editing.** This plan describes changes
  to existing files and pastes complete code only for new ones. Report
  divergence rather than forcing an edit.
- Run `npm test` and `npm run typecheck` before reporting any task complete.
  One skip is expected: `src/engine/engine.smoke.test.ts` needs a real `Worker`.
- **Report the test warning count as a number.** It is currently zero.
- Do not modify `src/engine/`.

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/chess/side.ts` | Pure: whose turn it is in a FEN, in the schema's vocabulary. |
| `src/chess/side.test.ts` | Tests for the above. |
| `src/ui/LessonMenu.tsx` | The header lessons dropdown. |
| `src/ui/LessonMenu.test.tsx` | Tests for the above. |
| `src/ui/MoveFeedback.tsx` | The brief correct/incorrect mark over the board. |
| `src/ui/useLessonAutoplay.ts` | The single place that decides to auto-play. |
| `src/ui/useLessonAutoplay.test.tsx` | Tests for the above. |
| `docs/superpowers/plans/opening-answers-spike.md` | Task 1's engine results. |

**Modify:** `src/content/load.ts`, `src/lesson/store.ts`, `src/ui/Board.tsx`,
`src/ui/CheckpointPanel.tsx`, `src/ui/LessonRail.tsx`, `src/ui/CandidateRail.tsx`,
`src/App.tsx`, `src/ui/theme.css`, `src/ui/AppShell.test.tsx`, and the three
lesson files under `src/content/lessons/`.

**Delete:** `src/ui/LessonPicker.tsx` and `src/ui/LessonPicker.test.tsx` in
Task 6 — its progress-line logic moves into `LessonMenu`, and its tests move
rather than being deleted.

## Shared surfaces — read this if your task touches either

**The rejected answer.** `Board.tsx` decides a move is wrong and rejects it;
`CheckpointPanel.tsx` renders the feedback. They communicate through
`lessonStore.lastRejection`, which is the **only** new stored state in this plan.
It carries the node id it was made at, so a stale attempt from another position
is ignored — the same guard the progress store already uses for its dedupe key.
Tasks 4 and 5 own the two halves and must agree.

**Auto-play lives in exactly one place**, `useLessonAutoplay`. Do not add a
second caller, and do not let `LessonRail` or `CheckpointPanel` play moves.

---

### Task 1: Spike — engine-check every move that becomes an answer

Sixteen moves that are currently *narrated* become moves the lesson teaches as
**the answer**. This project has shipped a lesson teaching the losing side of a
known trap, which passed both the validator and a task review. `Lessons.md` §1
is emphatic: legality is not correctness, and a plan that authors chess spikes
the chess first.

**Nothing else in this plan may start until this reports.**

**Files:**
- Create: `docs/superpowers/plans/opening-answers-spike.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a verdict per move. Tasks 7-9 author prompts only for moves this
  task clears.

- [ ] **Step 1: Derive the positions**

Write a scratch script (not committed to `src/`) that imports the three opening
lessons, replays each segment through chess.js, and for **every move made by
the lesson's own side** emits the FEN before that move and the SAN played.

**Do not hand-write a single FEN.** Import the lessons and replay them:

```js
const { Chess } = require('C:/Users/gordo/Repos/ChessTrainer/node_modules/chess.js');
// Read the three lesson files and take segments[].moves[].san in order.
// For each move: record chess.fen() BEFORE chess.move(san).
// Keep only moves where chess.turn() matches the lesson's side
// ('w' for white, 'b' for black) — those are the player's.
```

The player-side moves are expected to be:

| Lesson | Side | Player moves |
|---|---|---|
| `italian-game` | white | `e4` `Nf3` `Bc4` `c3` `d3` `O-O` `Re1` `Bb3` `Nbd2` |
| `london-system` | white | `d4` `Bf4` `e3` `Nf3` `Bg3` `Bd3` `c3` `Nbd2` `O-O` |
| `black-vs-e4` | black | `e5` `Nc6` `Bc5` `Nf6` `d6` `O-O` |

If your replay produces a different list, **the table above is wrong and your
replay is right** — report the difference and use yours.

- [ ] **Step 2: Run the engine on each position**

Use the vendored engine at `public/engine/`. For each position, search to depth
18 with `MultiPV 3` and record the engine's top move and score, and the score
of the lesson's move.

- [ ] **Step 3: Record a verdict per move**

Write `docs/superpowers/plans/opening-answers-spike.md` with a table:
lesson, ply, SAN taught, engine best, taught-move score, delta in centipawns.

Classify each:

- **CLEAR** — the taught move is the engine's best, or within 30cp of it.
- **ACCEPTABLE** — 30-75cp behind. Normal for opening theory that prioritises a
  plan over an engine's preference. Note it; authoring proceeds.
- **QUESTIONABLE** — more than 75cp behind, or the engine considers it a
  mistake. **Stop and report to the controller.** Do not author a prompt asking
  a beginner to find a move the engine dislikes without a human deciding.

Write the numbers you observed. "Looks fine" is not a measurement.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/opening-answers-spike.md
git commit -m "test: engine-check every opening move that becomes a taught answer"
```

---

### Task 2: `sideToMove`, and a coverage rule for opening lessons

**Files:**
- Create: `src/chess/side.ts`, `src/chess/side.test.ts`
- Modify: `src/content/load.ts`

**Interfaces:**
- Produces:
  - `sideToMove(fen: string): 'white' | 'black'` from `src/chess/side.ts`
  - `validateOpeningCoverage(lesson: Lesson): string[]` from `src/content/load.ts`

`src/chess/` must not import React.

**The rule is written and tested here but NOT yet applied to the real lessons** —
they do not satisfy it until Task 9. Task 10 wires it in.

- [ ] **Step 1: Write the failing test for `sideToMove`**

```ts
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { sideToMove } from './side';

describe('sideToMove', () => {
  it('reads the side to move from a position', () => {
    const chess = new Chess();
    expect(sideToMove(chess.fen())).toBe('white');
    chess.move('e4');
    expect(sideToMove(chess.fen())).toBe('black');
    chess.move('e5');
    expect(sideToMove(chess.fen())).toBe('white');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/chess/side.test.ts`
Expected: FAIL — cannot resolve `./side`.

- [ ] **Step 3: Implement it**

```ts
import { Chess } from 'chess.js';

/**
 * Whose turn it is, in the vocabulary the lesson schema uses ('white' /
 * 'black') rather than chess.js's 'w' / 'b'.
 *
 * This exists so nothing has to infer whose move it is by counting plies. A
 * segment may declare a `startFen` where it is Black to move, and a segment
 * may override its lesson's `side`, so index parity is wrong in exactly the
 * cases that matter.
 */
export function sideToMove(fen: string): 'white' | 'black' {
  return new Chess(fen).turn() === 'w' ? 'white' : 'black';
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/chess/side.test.ts` — expected PASS.
Then `npx vitest run src/test/purity.test.ts` — expected PASS.

- [ ] **Step 5: Write the failing test for the coverage rule**

Add to `src/content/load.test.ts` — **read that file first** and follow its
existing fixture style.

```ts
it('flags an opening move on the player side that has no checkpoint', () => {
  const lesson = parseLesson({
    id: 'x', title: 'X', kind: 'opening', side: 'white',
    summary: 'S', tags: [],
    segments: [{
      startFen: null,
      moves: [
        { san: 'e4', checkpoint: { id: 'c1', prompt: 'p', accept: ['e4'], hints: ['h'] } },
        { san: 'e5' },
        { san: 'Nf3' }, // White's, and unasked — this is the defect
      ],
    }],
  });
  expect(validateOpeningCoverage(lesson)).toEqual([
    'segment 0, move 2: "Nf3" is played by the player (white) but has no checkpoint',
  ]);
});

it('says nothing about a theme lesson', () => {
  const lesson = parseLesson({
    id: 'y', title: 'Y', kind: 'theme', side: 'white',
    summary: 'S', tags: [],
    segments: [{ startFen: null, moves: [{ san: 'e4' }] }],
  });
  expect(validateOpeningCoverage(lesson)).toEqual([]);
});

it('honours a segment side override', () => {
  const lesson = parseLesson({
    id: 'z', title: 'Z', kind: 'opening', side: 'white',
    summary: 'S', tags: [],
    segments: [{
      startFen: null, side: 'black',
      moves: [
        { san: 'e4' }, // White's — the opponent here, so no checkpoint needed
        { san: 'e5' }, // Black's, and the player's — must be asked
      ],
    }],
  });
  expect(validateOpeningCoverage(lesson)).toEqual([
    'segment 0, move 1: "e5" is played by the player (black) but has no checkpoint',
  ]);
});
```

- [ ] **Step 6: Run and watch it fail**

Run: `npx vitest run src/content/load.test.ts`
Expected: FAIL — `validateOpeningCoverage` is not exported.

- [ ] **Step 7: Implement `validateOpeningCoverage` in `src/content/load.ts`**

Add alongside `validateLessonChess`. Reuse the same replay approach that
`validateSegment` already uses — walk each segment with a `Chess`, take
`chess.fen()` *before* each move, and compare `sideToMove(fenBefore)` against
the segment's `side ?? lesson.side`. Return early with an empty array when
`lesson.kind !== 'opening'`.

Message format, exactly:
`` `segment ${segmentIndex}, move ${moveIndex}: "${move.san}" is played by the player (${side}) but has no checkpoint` ``

If a move is illegal the replay cannot continue; return what has been found so
far rather than throwing — `validateLessonChess` already reports illegality and
is the right place for that complaint.

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one expected skip, zero warnings. The real lessons are not yet
subject to this rule, so nothing else should break.

- [ ] **Step 9: Commit**

```bash
git add src/chess/side.ts src/chess/side.test.ts src/content/load.ts src/content/load.test.ts
git commit -m "feat(content): add a coverage rule for unasked player moves in openings"
```

---

### Task 3: Auto-play the opponent's reply

**Files:**
- Create: `src/ui/useLessonAutoplay.ts`, `src/ui/useLessonAutoplay.test.tsx`
- Modify: `src/App.tsx` — call the hook once.

**Interfaces:**
- Consumes: `sideToMove` (Task 2); `useActiveLesson()` and `useLessonStore` from
  `src/lesson/store.ts`; `useTreeStore` from `src/tree/store.ts`;
  `resolveSan` from `src/chess/resolveDrop.ts`; `sounds` from `src/sound`.
- Produces: `useLessonAutoplay(): void`.

**Read `src/lesson/store.ts` and `src/ui/LessonRail.tsx` in full first.**
`useActiveLesson()` returns a fresh object every call — it re-derives from the
tree — so **no dependency array can hold it stable**. `LessonRail`'s recording
effect has a long comment explaining this; read it before writing your own
effect, and key your effect on primitives (`selectedId`, `lessonId`, `ply`),
never on `active`.

**The two rules this hook exists to enforce:**

1. **Play only when the side to move is not the player's.** Do not infer the
   opponent from "this move has no checkpoint" — during Tasks 3-8 the content is
   half-written, and that inference would make the app play the player's move
   for them.
2. **Play only when the selected node is the tip of the line** — when the
   selected node has no children. Otherwise stepping back to review drags the
   player forward again. `Breadcrumb` can already navigate backwards, so this
   bites from the moment this task lands.

Delay: **700ms**. Clear the timer on cleanup so a fast navigation cannot fire a
stale move.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLessonAutoplay } from './useLessonAutoplay';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';

function Harness() { useLessonAutoplay(); return <div data-testid="ok" />; }

const path = () =>
  pathTo(useTreeStore.getState().tree, useTreeStore.getState().tree.selectedId)
    .slice(1)
    .map((n) => n.move!.san);

describe('useLessonAutoplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => {
      useLessonStore.getState().stopLesson();
      useTreeStore.getState().reset();
    });
  });
  afterEach(() => vi.useRealTimers());

  it('plays the opponent reply after the player answers', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => { useTreeStore.getState().playMove('e4'); });      // the player's answer
    expect(path()).toEqual(['e4']);                               // nothing yet
    act(() => { vi.advanceTimersByTime(700); });
    expect(path()).toEqual(['e4', 'e5']);                         // Black replied
  });

  it('does not move while the player is being asked', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(path()).toEqual([]);                                   // White to move: the player's
  });

  // The rule that stops the lesson fighting a player who looks back.
  //
  // The node matters. Stepping back to the *root* proves nothing here: the
  // player is White, so the root is the player's own turn and guard 3 blocks
  // it whether or not the tip-of-line guard exists. The only position in this
  // line where guard 4 is load-bearing is the node after `e4` — Black to move,
  // so the opponent's, and it already has a child.
  it('does not move when the selection is not the tip of the line', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => { useTreeStore.getState().playMove('e4'); });
    act(() => { vi.advanceTimersByTime(700); });                  // now at e4 e5
    const tree = useTreeStore.getState().tree;
    const afterE4 = pathTo(tree, tree.selectedId)[1].id;          // Black to move here
    act(() => { useTreeStore.getState().selectNode(afterE4); });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(useTreeStore.getState().tree.selectedId).toBe(afterE4);
  });

  it('does nothing when no lesson is running', () => {
    render(<Harness />);
    act(() => { useTreeStore.getState().playMove('e4'); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(path()).toEqual(['e4']);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/ui/useLessonAutoplay.test.tsx`
Expected: FAIL — cannot resolve `./useLessonAutoplay`.

- [ ] **Step 3: Implement the hook**

Structure it as one `useEffect` keyed on primitives. Read the current lesson
state through `useActiveLesson()` *inside* the effect body, not as a dependency.

Guards, in order — return early unless **all** hold:

1. a lesson is running;
2. the lesson's line is not complete and the path is on script;
3. `sideToMove(currentFen) !== segment.side ?? lesson.side`;
4. the selected node has no children (`childIds.length === 0`).

Then `setTimeout(700)` and, inside, play `state.nextMove.san` via
`useTreeStore.getState().playMove(...)`, playing the resolved sound through
`resolveSan` exactly as `LessonRail.playNextMove` does today — **reuse that
path, do not introduce a second sound path.** Return a cleanup that clears the
timer.

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run src/ui/useLessonAutoplay.test.tsx` — expected PASS.

- [ ] **Step 5: Call it once, from `App.tsx`**

Add `useLessonAutoplay();` at the top of `App`. It is a behaviour hook and
renders nothing.

- [ ] **Step 6: Mutation-check the tip-of-line rule**

This guards a named defect. Remove guard 4 (the childless check).

Run: `npx vitest run src/ui/useLessonAutoplay.test.tsx`
Expected: FAIL on "does not move when the selection is not the tip of the
line", with a **clean assertion mismatch** — the selected id will no longer be
the root. Confirm it is an assertion failure and not a thrown exception; a
failure caused by a crash is not evidence, because a later `try/catch` would
silence it. Restore, re-run, confirm PASS. **Report the assertion message.**

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one expected skip, zero warnings. `LessonRail`'s "Play the next
move" button still exists at this point and is expected to still work for theme
lessons — do not remove it here.

- [ ] **Step 8: Commit**

```bash
git add src/ui/useLessonAutoplay.ts src/ui/useLessonAutoplay.test.tsx src/App.tsx
git commit -m "feat(lesson): play the opponent's reply automatically at the tip of the line"
```

---

### Task 4: Reject a wrong move instead of playing it

**Files:**
- Modify: `src/lesson/store.ts` — add the attempt record.
- Modify: `src/ui/Board.tsx` — reject on both input paths.
- Create/extend: `src/ui/Board.lesson.test.tsx`

**Interfaces:**
- Consumes: `askingCheckpoint(active)` and `useActiveLesson()` from
  `src/lesson/store.ts`; `gradeMove(checkpoint, san)` from `src/lesson/grade.ts`.
- Produces, on the lesson store:
  - `lastRejection: { san: string; grade: Grade; atNodeId: string } | null`
  - `noteRejection(san: string, grade: Grade, atNodeId: string): void`
  - `clearRejection(): void`

**Why this is stored rather than derived.** Everything else in the lesson runner
is re-derived from the tree. A rejected move is the one thing that cannot be —
it is deliberately absent from the tree. `atNodeId` is what stops a stale
attempt from another position rendering; the progress store already uses the
same idea for its dedupe key.

**Read `src/ui/Board.tsx` in full first.** Invariants that must survive: the
drag handlers' existing behaviour for non-lesson play, the last-move `highlight`
memo, the `squareStyles` merge, orientation derivation, `prefersReducedMotion`,
and the single sound path.

**The change, both input paths:** before calling `playMove`, if
`askingCheckpoint(activeLesson)` returns a checkpoint, grade the SAN. On
`correct`, clear any attempt and proceed as now. On `near-miss` or `wrong`,
record the attempt, play the `incorrect` sound, and **do not call `playMove`** —
`onPieceDrop` returns `false` so `react-chessboard` returns the piece, and the
keyboard path simply announces and leaves `picked` set so the player can try
another square.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Board } from './Board';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';

const nodeCount = () => Object.keys(useTreeStore.getState().tree.nodes).length;

describe('Board during a lesson', () => {
  beforeEach(() => {
    act(() => {
      useLessonStore.getState().stopLesson();
      useTreeStore.getState().reset();
      useLessonStore.getState().startLesson('italian-game');
    });
  });

  it('refuses a wrong answer and adds no node to the tree', async () => {
    const before = nodeCount();
    render(<Board />);
    const board = screen.getByRole('application', { name: /chess board/i });
    board.focus();
    // Cursor starts on e2. Pick up, go up one, place: e3 — legal, but not the answer.
    // One act() per key. Dispatching several inside a single act() does not
    // re-render between them, so every handler after the first reads a stale
    // `cursor`/`picked` from its render closure and only the first key lands.
    for (const key of ['Enter', 'ArrowUp', 'Enter']) {
      await act(async () => {
        board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    }
    expect(nodeCount()).toBe(before);
    expect(useLessonStore.getState().lastRejection?.san).toBe('e3');
  });

  it('accepts the right answer and plays it', async () => {
    render(<Board />);
    const board = screen.getByRole('application', { name: /chess board/i });
    board.focus();
    for (const key of ['Enter', 'ArrowUp', 'ArrowUp', 'Enter']) {
      await act(async () => {
        board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    }
    const tree = useTreeStore.getState().tree;
    expect(tree.nodes[tree.selectedId].move?.san).toBe('e4');
    expect(useLessonStore.getState().lastRejection).toBeNull();
  });
});
```

Mock `react-chessboard` and `howler` the way `src/ui/Board.keyboard.test.tsx`
already does — **read that file and copy its mock**, including the
prop-capturing form. A bare `() => null` mock discards `squareStyles`.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/ui/Board.lesson.test.tsx`
Expected: FAIL — `lastRejection` does not exist, and the wrong move is played.

- [ ] **Step 3: Add the attempt record to the lesson store**

Add the three members to the `LessonStore` interface and implement them.
`stopLesson` and `nextSegment` must clear `lastRejection` alongside `hintsShown`.

- [ ] **Step 4: Reject wrong moves in `Board.tsx`**

Apply the change described above to both `onPieceDrop` and the keyboard
`Enter`/`Space` placement branch.

- [ ] **Step 5: Run and watch them pass**

Run: `npx vitest run src/ui/Board.lesson.test.tsx` — expected PASS.

- [ ] **Step 6: Mutation-check the rejection test**

Make the wrong branch fall through to `playMove` anyway.

Run: `npx vitest run src/ui/Board.lesson.test.tsx`
Expected: FAIL on "refuses a wrong answer", as a **clean assertion mismatch** on
the node count — not an exception. Restore, re-run, confirm PASS. **Report the
assertion message.**

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one expected skip, zero warnings. Existing `Board` tests cover
non-lesson play and must be untouched.

- [ ] **Step 8: Commit**

```bash
git add src/lesson/store.ts src/ui/Board.tsx src/ui/Board.lesson.test.tsx
git commit -m "feat(lesson): reject a wrong answer instead of playing it"
```

---

### Task 5: Feedback — sounds, a check mark, and "Try again"

**Files:**
- Create: `src/ui/MoveFeedback.tsx`, `src/ui/MoveFeedback.test.tsx`
- Modify: `src/ui/CheckpointPanel.tsx`, `src/ui/theme.css`, `src/ui/Board.tsx`,
  `src/ui/LessonRail.tsx`, `src/lesson/store.ts`, `src/App.tsx`
- Extend: `src/ui/CheckpointPanel.test.tsx`

**`src/lesson/store.ts` is in scope, and this matters.** A correct answer must
be **recorded where it is known** — `Board.tsx`, at the moment it accepts the
move — not inferred by `MoveFeedback` from state transitions. Inference looks
workable and is not: stepping backwards during a lesson changes the selected
node *and* the pending checkpoint id while the lesson and segment stay the
same, which is indistinguishable from having just answered. That produces a
green check for a move the player never made, and `Breadcrumb` makes it
reachable today.

**Interfaces:**
- Consumes: `lastRejection` from the lesson store (Task 4).
- Produces: `<MoveFeedback />`, taking no props.

**Read `src/ui/CheckpointPanel.tsx` in full first.** It must keep the "engine
suggestions are hidden" notice, the prompt, the hint ladder, and the authored
`checkpointComparison` — that comparison exists because a previous review found
the authored contrast otherwise unreachable, and its `accept`-exclusion filter
is what stops it leaking the answer. Do not disturb it.

**Sounds.** `correct` on an accepted answer, `incorrect` on a rejection, `hint`
when a tier is revealed, `lessonComplete` when the last segment finishes. All
four names already exist in `src/sound/sounds.ts`. **No audio files are added.**
They will play nothing until files exist, which is correct behaviour, not a
defect — so **do not write a test asserting a sound was audible.** Assert that
`sounds.play` was called with the right name, using a spy.

**The check mark.** `MoveFeedback` renders a brief mark centred over the board.
**Mount it in `App.tsx` inside `.app-centre`**, as a sibling of the board
wrapper, absolutely positioned over it — not inside `Board.tsx`, which must stay
focused on the board itself, and not in the right rail, where it would be a
second copy of what the panel already says. It is driven by `lastRejection` and
by a correct answer having just landed. Under
`prefers-reduced-motion` it must appear **without animating and stay until
replaced**, rather than fading — the project's rule is that reduced motion still
leaves a visible signal. Use the existing `prefersReducedMotion` idiom from
`src/ui/Board.tsx`. Animate with `transform`/`opacity` only; never a box-model
property.

Accessibility: the mark is decorative and duplicated by the panel's `role="status"`
text, so give it `aria-hidden="true"` rather than announcing it twice.

- [ ] **Step 1: Write the failing tests**

Extend `src/ui/CheckpointPanel.test.tsx`, following its existing
`startAtCheckpoint()` helper — **read the file first.**

```tsx
it('says try again after a rejected answer', () => {
  startAtCheckpoint();
  act(() =>
    useLessonStore.getState().noteRejection(
      'e3',
      { kind: 'wrong' },
      useTreeStore.getState().tree.selectedId,
    ),
  );
  render(<CheckpointPanel />);
  expect(screen.getByRole('status')).toHaveTextContent(/try again/i);
});

it('prefers the authored near-miss reply over the generic message', () => {
  startAtCheckpoint();
  act(() =>
    useLessonStore.getState().noteRejection(
      'd4',
      { kind: 'near-miss', reply: 'That is the Queen\u2019s Gambit family.' },
      useTreeStore.getState().tree.selectedId,
    ),
  );
  render(<CheckpointPanel />);
  expect(screen.getByRole('status')).toHaveTextContent(/Queen\u2019s Gambit family/i);
});

// An attempt made at another position must not follow the player here.
it('ignores an attempt recorded at a different node', () => {
  startAtCheckpoint();
  act(() => useLessonStore.getState().noteRejection('e3', { kind: 'wrong' }, 'some-other-node'));
  render(<CheckpointPanel />);
  expect(screen.queryByText(/try again/i)).toBeNull();
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/ui/CheckpointPanel.test.tsx`
Expected: FAIL — no "try again" copy exists.

- [ ] **Step 3: Create `MoveFeedback` and wire the panel**

Render the feedback text in `CheckpointPanel`'s existing `role="status"` region:
the authored `reply` for a near miss, otherwise "Try again." Show it only when
`lastRejection.atNodeId` equals the currently selected node id.

- [ ] **Step 4: Add the sounds**

`incorrect` at the rejection site in `Board.tsx` (Task 4 left the hook for it),
`correct` when an answer is accepted, `hint` in the reveal handler, and
`lessonComplete` where `LessonRail` already detects completion.

- [ ] **Step 5: Run and watch them pass**

Run: `npx vitest run src/ui/CheckpointPanel.test.tsx` — expected PASS.

- [ ] **Step 6: Mutation-check the stale-attempt test**

Drop the `atNodeId` comparison so any attempt renders.

Run: `npx vitest run src/ui/CheckpointPanel.test.tsx`
Expected: FAIL on "ignores an attempt recorded at a different node", as a clean
assertion failure. Restore, re-run, confirm PASS. **Report the message.**

- [ ] **Step 7: Run everything and commit**

Run: `npm test && npm run typecheck` — PASS, one skip, zero warnings.

```bash
git add src/ui/MoveFeedback.tsx src/ui/CheckpointPanel.tsx src/ui/CheckpointPanel.test.tsx src/ui/theme.css src/ui/Board.tsx src/ui/LessonRail.tsx
git commit -m "feat(lesson): sound and a visible mark on every answer"
```

---

### Task 6: The lessons dropdown and the explanation rail

**Files:**
- Create: `src/ui/LessonMenu.tsx`, `src/ui/LessonMenu.test.tsx`
- Modify: `src/App.tsx`, `src/ui/LessonRail.tsx`, `src/ui/LessonPicker.tsx`,
  `src/ui/theme.css`

**Interfaces:**
- Consumes: `ALL_LESSONS` and `lessonById` from `src/content/lessons/index.ts`;
  `lessonProgress` and `checkpointIds` as `LessonPicker` uses them today.
- Produces: `<LessonMenu />`, taking no props.

**What changes:**

- **`LessonMenu`** is a disclosure button in the header labelled "Lessons",
  opening a panel listing the seven lessons grouped as `LessonPicker` groups
  them, each with its progress line. Choosing one starts it and closes the
  panel. Closes on Escape and on click outside; returns focus to the button.
  **Do not add `aria-modal`** unless full Tab containment is implemented — a
  lying `aria-modal` is worse than none, and this project has that rule already.
- **`LessonPicker` is deleted**, its progress-line logic moving into
  `LessonMenu`. Move its tests rather than deleting them.
- **`LessonRail` becomes the explanation panel**: lesson title, progress
  ("Move 3 of 7", counting both sides), and the note for the move just played,
  in a bordered box. **"Leave lesson" moves outside that box, below it.**
- **"Play the next move" is removed for opening lessons only.** Theme lessons
  keep it. Gate on `lesson.kind === 'opening'`.
- The **left rail** holds `LessonRail` during a lesson and `SavedLines` when
  idle. `SavedLines` stays hidden during a lesson, as now.
- **The candidate rail is hidden for the whole of an opening lesson**, not only
  while a checkpoint is pending. `CandidateRail` currently swaps to
  `CheckpointPanel` when `askingCheckpoint(active)` is truthy — but during the
  opponent's turn, including the 700ms auto-play window, nothing is pending, so
  the engine's moves would flash on screen and hand over the next answer.
  Widen the condition to *a lesson of `kind === 'opening'` is running*, keeping
  `askingCheckpoint` as the single decider of whether there is a **question** to
  show. Theme lessons keep today's behaviour.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LessonMenu } from './LessonMenu';
import { useLessonStore } from '../lesson/store';

describe('LessonMenu', () => {
  beforeEach(() => act(() => useLessonStore.getState().stopLesson()));

  it('hides the list until it is opened', () => {
    render(<LessonMenu />);
    expect(screen.queryByRole('button', { name: /the italian game/i })).toBeNull();
    expect(screen.getByRole('button', { name: /lessons/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('starts a lesson and closes', async () => {
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    await user.click(screen.getByRole('button', { name: /the italian game/i }));
    expect(useLessonStore.getState().lessonId).toBe('italian-game');
    expect(screen.queryByRole('button', { name: /the italian game/i })).toBeNull();
  });

  it('closes on Escape without starting anything', async () => {
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: /the italian game/i })).toBeNull();
    expect(useLessonStore.getState().lessonId).toBeNull();
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/ui/LessonMenu.test.tsx`
Expected: FAIL — cannot resolve `./LessonMenu`.

- [ ] **Step 3: Build `LessonMenu` and wire it into the header**

- [ ] **Step 4: Rework `LessonRail` and delete `LessonPicker`**

Keep `LessonRail`'s recording `useEffect` and its long comment **exactly as they
are** — it deliberately runs on every render because `useActiveLesson()` returns
a fresh object, and a memo keyed on anything stable goes stale against the tree.

- [ ] **Step 5: Run the suite**

Run: `npm test && npm run typecheck`
Expected: PASS, one skip, zero warnings. `LessonPicker.test.tsx` moves; report
which tests moved where. `AppShell.test.tsx` asserts on the left rail and will
need updating — update it to match the new structure rather than deleting it.

- [ ] **Step 6: Check it in a browser — inside this task**

This task changes layout, and **jsdom performs no layout**. A grid bug shipped
past a fully green suite in this repo one plan ago. Start `npm run dev` and
confirm, with `getBoundingClientRect()` rather than by eye: the three regions
still share a `top`; the board is square and non-zero; the dropdown opens over
the page without displacing anything; and "Leave lesson" sits below the
explanation box. Report the numbers.

- [ ] **Step 7: Commit**

```bash
git add src/ui/LessonMenu.tsx src/ui/LessonMenu.test.tsx src/App.tsx src/ui/LessonRail.tsx src/ui/theme.css src/ui/AppShell.test.tsx
git rm src/ui/LessonPicker.tsx src/ui/LessonPicker.test.tsx
git commit -m "feat(ui): move lessons into a header menu and make the left rail the explanation"
```

---

### Task 7: Content - the Italian Game

**Files:**
- Modify: `src/content/lessons/italian-game.ts`

**Interfaces:**
- Consumes: `validateOpeningCoverage` (Task 2) and Task 1's verdicts.
- Produces: content only. No code depends on it.

**Player side: white. Six moves need a new checkpoint:**
`Nf3`, `c3`, `d3`, `Re1`, `Bb3`, `Nbd2`.

**Three existing checkpoints need their final hint rewritten**, because each
names its move today: `italian-open-with-e4` ("Play e4."),
`italian-bishop-to-c4` ("The bishop belongs on c4.") and
`italian-castle-kingside` ("Castle kingside.").

**The authoring rules.** They are repeated in full in each content task rather
than cross-referenced, because an implementer may read tasks out of order.

1. **Add a `checkpoint` to every player-side move that lacks one**, listed
   above. Each needs a stable `id` prefixed with the lesson id, a `prompt`,
   `accept`, and `hints`.
2. **No hint may name the move.** Not "Play e4.", not
   "The bishop belongs on c4.", not "Castle kingside." A hint points at the
   idea - which square is weak, what the position needs, which piece is idle.
   The last tier may be very pointed; it may not be the answer.
3. **Rewrite the existing final-tier hints**, listed above. They all name their
   move today and are not exempt.
4. **Deepen every `note`.** The left rail is now the lesson's main reading
   surface, not a caption. Say *why* the move is right - what it threatens,
   what it prepares, what it prevents.
5. **Author `nearMiss` entries for the plausible wrong answers** you can name.
   A near miss earns a specific reply; anything else gets "Try again".
6. **Never hand-write a FEN.** Derive any position you need by replaying.
7. **Do not change any `san`.** The moves are fixed; only prose changes. If
   Task 1 flagged a move QUESTIONABLE, **stop and report** - do not quietly
   substitute a different move.

**A worked example of the target quality**, for `Nf3`:

```ts
{
  san: 'Nf3',
  note: 'A knight comes out, and it attacks the e5 pawn on the way. Moves that develop and threaten at the same time are the ones that gain you time: Black now has to spend a move answering the threat instead of getting on with their own plan. That extra move is called a tempo, and collecting them is most of what a good opening does.',
  checkpoint: {
    id: 'italian-develop-with-tempo',
    prompt: 'Black has matched you in the centre. Which developing move also asks a question of the e5 pawn?',
    accept: ['Nf3'],
    hints: [
      'The best developing moves do a second job at the same time.',
      'One of Black\u2019s central pawns is defended by nothing at all.',
      'A knight on the kingside can reach a square that attacks it.',
    ],
    nearMiss: {
      Nc3: 'A perfectly good developing move, and in other openings it is the right one \u2014 but it does not touch e5, so Black is free to carry on with their own plan.',
      Bc4: 'The bishop belongs there and you will play it next, but developing with a threat first makes Black answer you rather than the other way round.',
    },
  },
}
```

Note what the hints do: they narrow to *a kingside knight attacking an
undefended pawn* without ever writing `Nf3`.

- [ ] **Step 1: Read Task 1's spike results for this lesson**

Confirm every player move is CLEAR or ACCEPTABLE. If any is QUESTIONABLE, stop
and report to the controller before authoring anything.

- [ ] **Step 2: Author the checkpoints and rewrite the notes**

- [ ] **Step 3: Verify coverage**

In a scratch script, call `validateOpeningCoverage(lesson)` for this lesson and
confirm it returns `[]`. Report the result.

- [ ] **Step 4: Verify no hint names its move**

Check every hint in the file against its checkpoint's `accept` list. A hint
containing the accepted SAN as a word, or an unambiguous phrasing of it
("castle kingside" for `O-O`, "the bishop goes to c4" for `Bc4`), fails rule 2.
Report what you checked and what you changed.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one expected skip, zero warnings. `validateLessonChess` runs
over every lesson in `lessons.test.ts` and will catch an illegal `accept` or
`nearMiss` key.

- [ ] **Step 6: Commit**

```bash
git add src/content/lessons/italian-game.ts
git commit -m "content(italian): ask for every player move, with hints that do not give it away"
```

---

### Task 8: Content - the London System

**Files:**
- Modify: `src/content/lessons/london-system.ts`

**Interfaces:**
- Consumes: `validateOpeningCoverage` (Task 2) and Task 1's verdicts.
- Produces: content only.

**Player side: white. Seven moves need a new checkpoint:**
`d4`, `e3`, `Nf3`, `Bg3`, `Bd3`, `c3`, `Nbd2`.

**Two existing checkpoints need their final hint rewritten:**
`london-bishop-out-first` ("Play Bf4.") and `london-castle`
("Castle kingside.").

**The authoring rules.** They are repeated in full in each content task rather
than cross-referenced, because an implementer may read tasks out of order.

1. **Add a `checkpoint` to every player-side move that lacks one**, listed
   above. Each needs a stable `id` prefixed with the lesson id, a `prompt`,
   `accept`, and `hints`.
2. **No hint may name the move.** Not "Play e4.", not
   "The bishop belongs on c4.", not "Castle kingside." A hint points at the
   idea - which square is weak, what the position needs, which piece is idle.
   The last tier may be very pointed; it may not be the answer.
3. **Rewrite the existing final-tier hints**, listed above. They all name their
   move today and are not exempt.
4. **Deepen every `note`.** The left rail is now the lesson's main reading
   surface, not a caption. Say *why* the move is right - what it threatens,
   what it prepares, what it prevents.
5. **Author `nearMiss` entries for the plausible wrong answers** you can name.
   A near miss earns a specific reply; anything else gets "Try again".
6. **Never hand-write a FEN.** Derive any position you need by replaying.
7. **Do not change any `san`.** The moves are fixed; only prose changes. If
   Task 1 flagged a move QUESTIONABLE, **stop and report** - do not quietly
   substitute a different move.

**A worked example of the target quality**, for `e3` - a quiet move, which is
the hardest kind to ask about well:

```ts
{
  san: 'e3',
  note: 'Now the pawn comes out to build the chain, and the order matters more than the move itself. Your dark-squared bishop is already outside the pawn chain; if you had played this first, that bishop would have spent the game staring at its own pawns. This is the single idea that makes the London work, and it is why the bishop went first.',
  checkpoint: {
    id: 'london-close-the-chain',
    prompt: 'The bishop is safely outside. Which modest pawn move now supports d4 and opens a path for the other bishop?',
    accept: ['e3'],
    hints: [
      'This one is small and solid rather than ambitious \u2014 it is about support, not space.',
      'Your d4 pawn would like a neighbour defending it.',
      'The pawn in front of your king only needs to step one square to do both jobs.',
    ],
    nearMiss: {
      e4: 'Too ambitious here \u2014 it gives up the solid pawn chain the London is built on, and that square is better used supporting d4 than grabbing space.',
      c3: 'A useful London move and you will play it later, but the other side needs the support first, and this leaves your light-squared bishop shut in.',
    },
  },
}
```

- [ ] **Step 1: Read Task 1's spike results for this lesson**

Confirm every player move is CLEAR or ACCEPTABLE. If any is QUESTIONABLE, stop
and report to the controller before authoring anything.

- [ ] **Step 2: Author the checkpoints and rewrite the notes**

- [ ] **Step 3: Verify coverage**

In a scratch script, call `validateOpeningCoverage(lesson)` for this lesson and
confirm it returns `[]`. Report the result.

- [ ] **Step 4: Verify no hint names its move**

Check every hint in the file against its checkpoint's `accept` list. A hint
containing the accepted SAN as a word, or an unambiguous phrasing of it
("castle kingside" for `O-O`, "the bishop goes to c4" for `Bc4`), fails rule 2.
Report what you checked and what you changed.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one expected skip, zero warnings. `validateLessonChess` runs
over every lesson in `lessons.test.ts` and will catch an illegal `accept` or
`nearMiss` key.

- [ ] **Step 6: Commit**

```bash
git add src/content/lessons/london-system.ts
git commit -m "content(london): ask for every player move, with hints that do not give it away"
```

---

### Task 9: Content - Answering 1.e4 as Black

**Files:**
- Modify: `src/content/lessons/black-vs-e4.ts`

**Interfaces:**
- Consumes: `validateOpeningCoverage` (Task 2) and Task 1's verdicts.
- Produces: content only.

**Player side: black.** This is the lesson where side matters most: White's
moves belong to the opponent and auto-play, and only Black's are asked.
**Three moves need a new checkpoint:** `Nc6`, `Nf6`, `d6`.

**Three existing checkpoints need their final hint rewritten:**
`black-e4-meet-with-e5` ("Play e5."), `black-e4-bishop-to-c5`
("The bishop belongs on c5.") and `black-e4-castle` ("Castle kingside.").

**The authoring rules.** They are repeated in full in each content task rather
than cross-referenced, because an implementer may read tasks out of order.

1. **Add a `checkpoint` to every player-side move that lacks one**, listed
   above. Each needs a stable `id` prefixed with the lesson id, a `prompt`,
   `accept`, and `hints`.
2. **No hint may name the move.** Not "Play e4.", not
   "The bishop belongs on c4.", not "Castle kingside." A hint points at the
   idea - which square is weak, what the position needs, which piece is idle.
   The last tier may be very pointed; it may not be the answer.
3. **Rewrite the existing final-tier hints**, listed above. They all name their
   move today and are not exempt.
4. **Deepen every `note`.** The left rail is now the lesson's main reading
   surface, not a caption. Say *why* the move is right - what it threatens,
   what it prepares, what it prevents.
5. **Author `nearMiss` entries for the plausible wrong answers** you can name.
   A near miss earns a specific reply; anything else gets "Try again".
6. **Never hand-write a FEN.** Derive any position you need by replaying.
7. **Do not change any `san`.** The moves are fixed; only prose changes. If
   Task 1 flagged a move QUESTIONABLE, **stop and report** - do not quietly
   substitute a different move.

**A worked example of the target quality**, for `Nc6`:

```ts
{
  san: 'Nc6',
  note: 'White attacked your e5 pawn, so you have to deal with it - but notice you did not have to spend a move only defending. This knight guards the pawn and develops toward the centre at the same time, which is exactly what White just did to you. When a threat can be answered by a move you wanted to play anyway, it costs you nothing.',
  checkpoint: {
    id: 'black-e4-defend-and-develop',
    prompt: 'White\u2019s knight is attacking your e5 pawn. Which move defends it and develops a piece at the same time?',
    accept: ['Nc6'],
    hints: [
      'Defending with a pawn would work, but it would not bring a piece into the game.',
      'Your queenside knight has a natural square where it guards the centre.',
      'Answer the threat with the piece that was going to come out anyway.',
    ],
    nearMiss: {
      d6: 'This does defend the pawn, and it is a real opening \u2014 but it develops nothing and shuts in your dark-squared bishop for now. Prefer the move that does two jobs.',
      f6: 'It guards e5, but it takes the best square away from your knight and loosens the squares around your king. Defending with this pawn costs more than it saves.',
      Qe7: 'The queen defends the pawn, but she blocks your own bishop and will be chased around later. Bring out a minor piece before the queen.',
    },
  },
}
```

- [ ] **Step 1: Read Task 1's spike results for this lesson**

Confirm every player move is CLEAR or ACCEPTABLE. If any is QUESTIONABLE, stop
and report to the controller before authoring anything.

- [ ] **Step 2: Author the checkpoints and rewrite the notes**

- [ ] **Step 3: Verify coverage**

In a scratch script, call `validateOpeningCoverage(lesson)` for this lesson and
confirm it returns `[]`. Report the result.

- [ ] **Step 4: Verify no hint names its move**

Check every hint in the file against its checkpoint's `accept` list. A hint
containing the accepted SAN as a word, or an unambiguous phrasing of it
("castle kingside" for `O-O`, "the bishop goes to c4" for `Bc4`), fails rule 2.
Report what you checked and what you changed.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one expected skip, zero warnings. `validateLessonChess` runs
over every lesson in `lessons.test.ts` and will catch an illegal `accept` or
`nearMiss` key.

- [ ] **Step 6: Commit**

```bash
git add src/content/lessons/black-vs-e4.ts
git commit -m "content(black-vs-e4): ask for every player move, with hints that do not give it away"
```

---

### Task 10: Enforce the coverage rule, and verify in a browser

**Files:**
- Modify: `src/content/lessons/lessons.test.ts`
- Modify: `docs/superpowers/plans/opening-answers-spike.md` — append findings.

- [ ] **Step 1: Wire the coverage rule into the corpus test**

Add to `src/content/lessons/lessons.test.ts` — **read it first and follow its
existing style**:

```ts
it('asks the player for every move on their side of an opening', () => {
  for (const lesson of ALL_LESSONS) {
    expect({ id: lesson.id, problems: validateOpeningCoverage(lesson) })
      .toEqual({ id: lesson.id, problems: [] });
  }
});
```

Reporting the id alongside the problems is deliberate: a bare
`toEqual([])` failure does not say which lesson broke.

- [ ] **Step 2: Run it**

Run: `npx vitest run src/content/lessons/lessons.test.ts`
Expected: PASS. If it fails, Tasks 7-9 left a player move unasked — fix the
content, not the rule.

- [ ] **Step 3: Verify the loop in a browser**

Start `npm run dev`. For **each** of the three openings:

- starting it asks a question immediately, with no candidate rows visible;
- a wrong move returns the piece, leaves the board unchanged, and shows "Try
  again" — check the move count in the tree did not grow;
- a right move plays, then the opponent replies on its own after a beat;
- the hint button reveals one tier at a time and **no tier names the move**;
- stepping back with the breadcrumb does **not** drag you forward again;
- finishing a segment offers "Next part", and the board flips where the segment
  changes side.

Also confirm "Play the next move" is **gone** from openings and **still present**
in a theme lesson.

- [ ] **Step 4: Record what you saw, including anything you could not check**

Append to `docs/superpowers/plans/opening-answers-spike.md`. "I could not verify
this" is a more useful sentence than a guess.

- [ ] **Step 5: Commit**

```bash
git add src/content/lessons/lessons.test.ts docs/superpowers/plans/opening-answers-spike.md
git commit -m "test(content): require every player move in an opening to be asked"
```

---

## Vault updates — part of the work, not a follow-up

Before this branch is reported complete:

- `Current State.md` — the lesson loop, the dropdown, what a lesson now feels
  like.
- `Architecture.md` — auto-play living in one hook, and `lastRejection` being the
  one piece of stored lesson state with the reason why.
- `Known Issues.md` — anything found and not fixed.
- `Roadmap.md` — plan 1 done, plan 2 (the moves table) next.
- `Lessons.md` — only if something recurred.
- `Start Here.md` — last, and always.
