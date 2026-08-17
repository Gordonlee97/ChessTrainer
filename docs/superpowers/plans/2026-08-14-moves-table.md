# Moves Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Breadcrumb.tsx` with a lichess-style numbered moves table that lists the line forward as well as backward, is clickable, and has first/previous/next/last controls.

**Architecture:** The table is **derived state**, not new state. A pure module in `src/tree/` turns a `GameTree` into numbered rows plus an ordered list of node ids; the component renders that and calls the existing `selectNode`. The continuation past the selected node follows the child with the greatest `lastSelectedAt`, which `select` already maintains — no new field, no parallel source of position state.

**Tech Stack:** TypeScript, React 19, Zustand, chess.js 1.4.0, Vitest + Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-11-lesson-loop-and-moves-table-design.md` — §3 (layout), §4 (the table), §5 (the autoplay interaction), §7 (testing). This is "plan 2" of the two named in the spec's §8.

## Global Constraints

- **`src/chess/`, `src/engine/`, `src/tree/` import no React and no Zustand.** `src/test/purity.test.ts` scans them and fails the build. `src/tree/movesTable.ts` is inside that guard: it takes a `GameTree` argument and returns plain data. It gets **no exemption** — the exemption list in `purity.test.ts:33` is three hardcoded literal paths and must not grow for this work.
- **The game tree is the source of truth.** The table derives; it stores nothing.
- **Press feedback uses `box-shadow`, never a box-model property.**
- **`prefers-reduced-motion` is honoured, and must still leave a visible press signal.**
- **Never hand-write a FEN.** The one FEN literal this plan needs is copied from existing validated content and cited; anything else is derived by replaying moves.
- **Test output stays pristine.** The suite is at **485 passing, 1 skipped (expected `engine.smoke`), 0 warnings** as of `089b08b`. The warning count is reported as a number in every task report; non-zero is a finding with an owner.
- **Mutation-check every test written to guard a named defect.** Break the implementation, watch the test fail with a *clean assertion mismatch* (not an exception), restore, confirm green, and report what you saw.
- **This plan pastes full code only for the files it creates.** For files that already exist it describes the change and names the invariants to preserve — read the file first and adapt. This is `CLAUDE.md`'s rule and it overrides the plan-template habit of pasting replacements; five snippets in this repo's history were written against file shapes that had moved.

---

## Before you start: two places the spec is out of date

Read these before Task 1. Both are cases where following the spec literally would reintroduce a defect this repo has already paid for.

**1. §5's tip-of-line rule was replaced on 2026-08-14.** The spec says "auto-play fires only when the selected node is the tip of the line." That was implemented as `selectedNode.childIds.length !== 0` and it dead-ended the lesson: `insertMove` reuses a node when the same move is replayed from the same parent, so replaying a move landed on a node that already had the opponent's reply as a child, which read as "the player is reviewing." Autoplay declined, it was then not the player's turn, and `CheckpointPanel` rendered nothing — a blank rail with no way forward. It now tests `lastPlayedId` instead. See `Decisions/Arrival By Move Versus Navigation.md` and `Lessons.md` §10.

**2. That fix is not sufficient once this plan lands**, which is what Task 1 is for. See Task 1's rationale.

**Do not "simplify" `useLessonAutoplay` back toward either single rule.** Each guard in that file has a specific bug behind it.

---

## What is measured, and what is assumed

`Lessons.md` §3 says naming this is the highest-return thing in the document, because an implementer who cannot tell the difference transcribes uniformly.

**Measured — spiked on 2026-08-14 and then reverted, so Task 2 still writes it:**

- `buildMovesTable` as pasted in Task 2 **compiles and passes all six of Task 2's tests**, and satisfies `purity.test.ts` unchanged (18 passed across the two files). Use it as written; if you reach for a rewrite, stop.
- `chess.moveNumber()` exists in chess.js 1.4.0 and returns the fullmove number: `1` at the start, `1` after `e4`, `2` after `e5`, and `2` for the Black-to-move fixture below.
- `TreeNode.lastSelectedAt` exists (`tree.ts:25`) and `select` maintains it (`tree.ts:113`), so the spec's continuation rule needs no new state.
- **Both of Task 2's mutation checks were run and both fail cleanly** — the reversed comparison fails with `expected 'd4' to be 'e4'`, and the index-parity version fails with `expected { nodeId: 'root/Nc6', … } to be null`. Note what the parity mutation does *not* break: it passes the two ordinary-line tests, and only the Black-to-move fixture catches it. That is `Lessons.md` §8, row 1, reproduced.

**Assumed — not measured, and where you should expect to push back:**

- Every CSS value and all grid placement in Task 4. Nothing here has been rendered. Task 4's browser check is the only thing standing between this plan and the class of defect that has hit every UI plan in this repo.
- That the right rail can hold the table below the candidates without the one-screen shell clipping it. Plausible from reading `theme.css`, unverified.
- The exact copy on the four controls, and whether the elided White cell should read `…` or be empty.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/chess/side.ts` *(modify)* | Gains `moveNumber(fen)` beside the existing `sideToMove(fen)`. FEN interpretation lives in one place. |
| `src/tree/movesTable.ts` *(create)* | Pure. `buildMovesTable(tree) → { rows, lineIds, selectedIndex }`. The only place that knows how a path becomes numbered rows or how the continuation is chosen. |
| `src/tree/movesTable.test.ts` *(create)* | Unit tests, no rendering. |
| `src/ui/MovesTable.tsx` *(create)* | Renders rows and the four controls; owns the focus-scoped arrow keys. Subscribes to the store, calls `selectNode`. |
| `src/ui/MovesTable.test.tsx` *(create)* | Component tests, rendered through the real store. |
| `src/ui/useLessonAutoplay.ts` *(modify)* | Task 1 only: the owed-reply rule. |
| `src/App.tsx` *(modify)* | Drops the `.app-crumb` row and `<Breadcrumb />`; mounts `<MovesTable />` at the foot of the right rail. |
| `src/ui/theme.css` *(modify)* | Drops `.app-crumb`; adds the table's styles and its own scroll region. |
| `src/ui/Breadcrumb.tsx`, `src/ui/Breadcrumb.test.tsx` *(delete)* | Replaced. The spec says deleted, not left duplicating. |

---

### Task 1: Autoplay replies when a reply is owed, however the player got there

**Why this task exists, and why it is first.** Today autoplay fires only when `lastPlayedId === selectedNode.id` — the player *moved* here. This plan introduces `next` and `last`, which reach a position by `selectNode`, and `selectNode` clears `lastPlayedId`. So this sequence stalls the lesson:

1. Player answers correctly. The 700ms autoplay timer arms.
2. Within that window they click a row in the table to look back. The effect re-runs and its cleanup clears the timer, so the reply is never played.
3. They click `last` to return to the tip. `lastPlayedId` is null, so autoplay declines — and it is the opponent's turn, so the checkpoint panel renders nothing.

That is the same blank-rail symptom as the bug fixed on 2026-08-14, reached through this plan's new controls. The fix is a **union, not a replacement**: fire when the player moved here **or** when the node is a genuine tip with no child at all. Stepping back to review is still protected, because a node you step back to always has a child — that is what makes the two conditions safe to `||`.

Landing this first means Tasks 4–6 inherit the rule instead of re-deriving it, which is the spec's own instruction in §8.

**Files:**
- Modify: `src/ui/useLessonAutoplay.ts` — the final guard, currently at line 74
- Test: `src/ui/useLessonAutoplay.test.tsx`

**Interfaces:**
- Consumes: `useTreeStore.getState().lastPlayedId` (`NodeId | null`), `TreeNode.childIds` (`NodeId[]`)
- Produces: nothing new. Behaviour only.

- [ ] **Step 1: Read `src/ui/useLessonAutoplay.ts` in full before editing.** Every guard in it has a bug behind it and the file-level comment explains why `active` is deliberately excluded from the dependency array. Do not restructure it.

- [ ] **Step 2: Write the failing test**

Add to `src/ui/useLessonAutoplay.test.tsx`, after the existing "does not move when the selection is not the tip of the line" test so the two read together:

```tsx
  /**
   * The case this plan's `next`/`last` controls create. Navigating *forward*
   * to a tip that never received its reply is not reviewing — the reply is
   * still owed — but the arrival was a `selectNode`, so `lastPlayedId` is
   * null and the arrival-by-move rule alone declines.
   *
   * The tree is left in exactly that state here: the player answers, and the
   * pending reply is cancelled by navigating away before the 700ms elapses.
   */
  it('plays a reply still owed at a childless tip, even when reached by navigating', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => {
      useTreeStore.getState().playMove('e4');
    });

    const afterE4 = useTreeStore.getState().tree.selectedId;
    const root = pathTo(useTreeStore.getState().tree, afterE4)[0].id;

    // Navigate away before the reply lands: the effect's cleanup clears the
    // armed timer, so the tip keeps no child.
    act(() => {
      useTreeStore.getState().selectNode(root);
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(path()).toEqual(['e4']); // the reply really was cancelled

    // Now walk forward to the tip the way `last` will.
    act(() => {
      useTreeStore.getState().selectNode(afterE4);
    });
    expect(useTreeStore.getState().lastPlayedId).toBeNull(); // arrived by navigation
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(path()).toEqual(['e4', 'e5']);
  });
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/ui/useLessonAutoplay.test.tsx -t "still owed"`
Expected: FAIL, `expected [ 'e4' ] to deeply equal [ 'e4', 'e5' ]` — a clean assertion mismatch. If it fails with an exception instead, stop: the test is wrong, not the implementation.

- [ ] **Step 4: Widen the guard**

In `src/ui/useLessonAutoplay.ts`, replace the single arrival-by-move condition with the union of arrival-by-move and childless-tip. Both halves must remain, and the comment must say why `||` is safe — that a node stepped back to always has a child, which is what keeps the review case protected. Keep the existing explanation of the 2026-08-13 dead-end; add to it rather than replacing it.

- [ ] **Step 5: Run the whole file**

Run: `npx vitest run src/ui/useLessonAutoplay.test.tsx`
Expected: 7 passed. In particular **"does not move when the selection is not the tip of the line" must still pass** — that is the review protection, and it is the thing most likely to break here.

- [ ] **Step 6: Mutation-check both halves separately**

This guard now has two reasons to fire and a test for each. Check them one at a time; a mutation that changes nothing looks exactly like a guard that works.

1. Disable the arrival-by-move half only. Expected: "plays the reply again when the player replays a move they already played" FAILS; the new test still passes.
2. Restore. Disable the childless-tip half only. Expected: the new test FAILS; the replay test still passes.
3. Remove the whole condition. Expected: "does not move when the selection is not the tip of the line" FAILS with `root/e4/e5` where it expects `root/e4`.
4. Restore all three and confirm 7 passed.

Report each observed failure message.

- [ ] **Step 7: Commit**

```bash
git add src/ui/useLessonAutoplay.ts src/ui/useLessonAutoplay.test.tsx
git commit -m "fix(lesson): reply when one is owed at a tip reached by navigation"
```

---

### Task 2: `moveNumber(fen)`, and the pure table derivation

**Files:**
- Modify: `src/chess/side.ts` — add one exported function beside `sideToMove`
- Create: `src/tree/movesTable.ts`
- Create: `src/tree/movesTable.test.ts`
- Test: `src/chess/side.test.ts` (extend)

**Interfaces:**
- Consumes: `GameTree`, `TreeNode`, `NodeId`, `pathTo` from `src/tree/tree.ts`; `sideToMove` from `src/chess/side.ts`
- Produces, and Tasks 4–6 depend on these names exactly:

```ts
export interface MovesCell {
  nodeId: NodeId;
  san: string;
}

export interface MovesRow {
  /** Fullmove number, from the FEN — never from index parity. */
  number: number;
  /** null when the displayed line begins with Black to move. */
  white: MovesCell | null;
  /** null when the line ends on a White move. */
  black: MovesCell | null;
}

export interface MovesTableModel {
  rows: MovesRow[];
  /** Root first, then every move on the displayed line, in order. */
  lineIds: NodeId[];
  /** Index into `lineIds` of the selected node. Always >= 0. */
  selectedIndex: number;
}

export function buildMovesTable(tree: GameTree): MovesTableModel;
```

- [ ] **Step 1: Add `moveNumber` to `src/chess/side.ts`**

Read the file first — it is short and its docstring already explains why index parity is wrong here. Add an exported `moveNumber(fen: string): number` that returns chess.js's `moveNumber()`. Keep FEN interpretation in this one module; do not parse FEN fields by hand elsewhere.

Verified against chess.js 1.4.0: `new Chess().moveNumber()` is `1`; after `e4` it is still `1`; after `e5` it is `2`; and for the Black-to-move FEN used below it is `2`.

- [ ] **Step 2: Extend `src/chess/side.test.ts`**

Cover the start position (1), a position after White's first move (still 1), and the Black-to-move fixture (2). Derive the first two by replaying moves through chess.js rather than writing FENs.

- [ ] **Step 3: Run it**

Run: `npx vitest run src/chess/side.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing tests for the derivation**

Create `src/tree/movesTable.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTree, insertMove, select, type GameTree } from './tree';
import { buildMovesTable } from './movesTable';

/**
 * Replays SANs through the real tree functions rather than constructing
 * node objects by hand, so ids, FENs and `lastSelectedAt` are whatever the
 * production code actually produces.
 */
function play(tree: GameTree, ...sans: string[]): GameTree {
  let next = tree;
  for (const san of sans) {
    const inserted = insertMove(next, next.selectedId, san);
    next = select(inserted.tree, inserted.nodeId);
  }
  return next;
}

describe('buildMovesTable', () => {
  it('pairs a line into numbered rows', () => {
    const tree = play(createTree(), 'e4', 'e5', 'Nf3');
    const { rows } = buildMovesTable(tree);

    expect(rows).toHaveLength(2);
    expect(rows[0].number).toBe(1);
    expect(rows[0].white?.san).toBe('e4');
    expect(rows[0].black?.san).toBe('e5');
    expect(rows[1].number).toBe(2);
    expect(rows[1].white?.san).toBe('Nf3');
    expect(rows[1].black).toBeNull();
  });

  it('lists the continuation past the selected node, not just the path to it', () => {
    let tree = play(createTree(), 'e4', 'e5', 'Nf3');
    // Walk up two parents from the tip to the node after 'e4', rather than
    // writing an id literal — the id format is the tree's business.
    const afterE5 = tree.nodes[tree.selectedId].parentId!;
    const afterE4 = tree.nodes[afterE5].parentId!;
    tree = select(tree, afterE4);

    const { rows, lineIds, selectedIndex } = buildMovesTable(tree);

    // Stepping back hides nothing: this is what makes the arrows worth having.
    expect(rows[1].white?.san).toBe('Nf3');
    expect(lineIds).toHaveLength(4); // root + three moves
    expect(selectedIndex).toBe(1);
  });

  /**
   * The rule that keeps the table linear without storing anything: where a
   * node has several children the continuation follows the most recently
   * selected one. `select` maintains `lastSelectedAt`, and `playMove` selects
   * what it inserts, so playing a different move from an earlier position
   * moves the table onto the new line.
   */
  it('follows the most recently selected child at a branch', () => {
    let tree = play(createTree(), 'e4', 'e5');
    tree = select(tree, 'root');
    tree = play(tree, 'd4'); // a second child of root, now the most recent

    // Documents the intent, but note it does NOT discriminate: 'd4' is the
    // selected node here, so it sits on the path and appears whether or not
    // the continuation rule works. Confirmed by mutation — the reversed
    // comparison passes this line and fails the one below.
    expect(buildMovesTable(tree).rows[0].white?.san).toBe('d4');

    // Re-selecting the older branch makes it the most recent again. Both
    // steps matter: visiting 'e4' bumps it, and stepping back to the branch
    // point is what forces the continuation rule to choose. Asserting while
    // 'e4' is still selected would pass because it sits on the path, whether
    // or not the rule works at all.
    tree = select(tree, 'root/e4');
    tree = select(tree, 'root');
    expect(buildMovesTable(tree).rows[0].white?.san).toBe('e4');
  });

  /**
   * Numbering and colour come from the position, never from index parity.
   * This FEN is copied from `src/content/lessons/theme-development-and-tempo.ts`
   * (segment 2), where it is already validated by `validateLessonChess` — it is
   * Black to move on move 2, so a naive counter starting at 1 with White first
   * gets both the number and the column wrong.
   */
  it('starts on Black when the position does, and numbers from the FEN', () => {
    const blackToMove = 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2';
    const tree = play(createTree(blackToMove), 'Nc6');
    const { rows } = buildMovesTable(tree);

    expect(rows).toHaveLength(1);
    expect(rows[0].number).toBe(2);
    expect(rows[0].white).toBeNull();
    expect(rows[0].black?.san).toBe('Nc6');
  });

  it('gives the root a row-free entry in lineIds so "first" can reach it', () => {
    const tree = play(createTree(), 'e4');
    const { lineIds, selectedIndex } = buildMovesTable(tree);

    expect(lineIds[0]).toBe(tree.rootId);
    expect(selectedIndex).toBe(1);
  });

  it('handles a tree with no moves at all', () => {
    const { rows, lineIds, selectedIndex } = buildMovesTable(createTree());

    expect(rows).toEqual([]);
    expect(lineIds).toEqual(['root']);
    expect(selectedIndex).toBe(0);
  });
});
```

- [ ] **Step 5: Run them and watch them fail**

Run: `npx vitest run src/tree/movesTable.test.ts`
Expected: FAIL — the module does not exist yet.

- [ ] **Step 6: Implement `src/tree/movesTable.ts`**

```ts
import { moveNumber, sideToMove } from '../chess/side';
import { pathTo, type GameTree, type NodeId, type TreeNode } from './tree';

export interface MovesCell {
  nodeId: NodeId;
  san: string;
}

export interface MovesRow {
  /** Fullmove number, from the FEN — never from index parity. */
  number: number;
  /** null when the displayed line begins with Black to move. */
  white: MovesCell | null;
  /** null when the line ends on a White move. */
  black: MovesCell | null;
}

export interface MovesTableModel {
  rows: MovesRow[];
  /** Root first, then every move on the displayed line, in order. */
  lineIds: NodeId[];
  /** Index into `lineIds` of the selected node. Always >= 0. */
  selectedIndex: number;
}

/**
 * Walks forward from `node`, taking the child with the greatest
 * `lastSelectedAt` at every branch, until a node with no children.
 *
 * This is what keeps the table linear without storing which line the player
 * is on: `select` bumps `lastSelectedAt`, and `playMove` selects whatever it
 * inserts, so the most recently visited child is always the one the player
 * last cared about. The consequence — the line you leave disappears from the
 * table — is the existing behaviour of the whole UI and is recorded in
 * `Known Issues.md`, not a regression introduced here.
 */
function continuationFrom(tree: GameTree, node: TreeNode): TreeNode[] {
  const forward: TreeNode[] = [];
  let current = node;
  while (current.childIds.length > 0) {
    let best = tree.nodes[current.childIds[0]];
    for (const childId of current.childIds) {
      const child = tree.nodes[childId];
      if (child.lastSelectedAt > best.lastSelectedAt) best = child;
    }
    forward.push(best);
    current = best;
  }
  return forward;
}

/**
 * The whole displayed line — the path to the selected node *and* the
 * continuation past it — as numbered rows plus the ordered ids the
 * navigation controls step through.
 *
 * Deriving both from one walk is deliberate: first/previous/next/last and the
 * rendered rows must never disagree about what the line is, and the way that
 * goes wrong in this repo is two correct-looking definitions of the same
 * thing drifting apart (`Lessons.md` §5).
 */
export function buildMovesTable(tree: GameTree): MovesTableModel {
  const selected = tree.nodes[tree.selectedId];
  const behind = pathTo(tree, tree.selectedId);
  const line = [...behind, ...continuationFrom(tree, selected)];

  const rows: MovesRow[] = [];
  // `line[0]` is the root, which is a position rather than a move; every
  // other entry is the move that produced it, so the position it was played
  // from is the entry before it.
  for (let index = 1; index < line.length; index += 1) {
    const node = line[index];
    const from = line[index - 1].fen;
    const cell: MovesCell = { nodeId: node.id, san: node.move!.san };

    if (sideToMove(from) === 'white') {
      rows.push({ number: moveNumber(from), white: cell, black: null });
    } else {
      const open = rows[rows.length - 1];
      // A Black move continues the open row unless the line began mid-move,
      // in which case its White half never existed.
      if (open && open.black === null) open.black = cell;
      else rows.push({ number: moveNumber(from), white: null, black: cell });
    }
  }

  const lineIds = line.map((node) => node.id);
  return { rows, lineIds, selectedIndex: lineIds.indexOf(tree.selectedId) };
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/tree/movesTable.test.ts src/chess/side.test.ts src/test/purity.test.ts`
Expected: all PASS. The purity run matters: `movesTable.ts` sits inside the guarded tree and must not have pulled in React or Zustand.

- [ ] **Step 8: Mutation-check the two tests that guard named defects**

The branch-following test and the Black-to-move test each guard a specific recorded failure (`Lessons.md` §8, row 1 — index parity passing 18 fixtures).

1. Change `child.lastSelectedAt > best.lastSelectedAt` to `<`. Expected: the branch test FAILS with `'e4'` where it expects `'d4'`.
2. Restore. Replace the `sideToMove(from) === 'white'` test with an index-parity check (`index % 2 === 1`). Expected: the Black-to-move test FAILS on the column, cleanly. Confirm the parity version still passes the first two tests — that is the point of the exercise.
3. Restore and confirm green.

- [ ] **Step 9: Commit**

```bash
git add src/chess/side.ts src/chess/side.test.ts src/tree/movesTable.ts src/tree/movesTable.test.ts
git commit -m "feat(tree): derive a numbered moves table from the game tree"
```

---

### Task 3: The `MovesTable` component and its controls

**Files:**
- Create: `src/ui/MovesTable.tsx`
- Create: `src/ui/MovesTable.test.tsx`

**Interfaces:**
- Consumes: `buildMovesTable`, `MovesTableModel` from `src/tree/movesTable.ts`; `useTreeStore` from `src/tree/store.ts`
- Produces: `export function MovesTable(): JSX.Element` — mounted by Task 4

**Shared surface, named as required by `Lessons.md` §5:** this component and Task 4's `App.tsx` change both decide where the table lives, and this component and Task 5's arrow keys both own its keyboard behaviour. Neither may keep its own copy of "what the line is" — both read `buildMovesTable`.

- [ ] **Step 1: Write the failing tests**

Create `src/ui/MovesTable.test.tsx`. Tests render the component against the **real** store rather than a mock, so a selector that silently returns a new array on every render shows up as a render loop here rather than in the browser:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MovesTable } from './MovesTable';
import { useTreeStore } from '../tree/store';

function playLine(...sans: string[]) {
  act(() => {
    for (const san of sans) useTreeStore.getState().playMove(san);
  });
}

describe('MovesTable', () => {
  beforeEach(() => {
    act(() => useTreeStore.getState().reset());
  });

  it('lists the moves with their numbers', () => {
    playLine('e4', 'e5', 'Nf3');
    render(<MovesTable />);

    expect(screen.getByRole('button', { name: 'e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nf3' })).toBeInTheDocument();
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
  });

  it('selects the node when a move is clicked', async () => {
    const user = userEvent.setup();
    playLine('e4', 'e5', 'Nf3');
    render(<MovesTable />);

    await user.click(screen.getByRole('button', { name: 'e4' }));

    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');
  });

  it('marks the selected move for assistive technology, not by colour alone', () => {
    playLine('e4', 'e5');
    render(<MovesTable />);

    expect(screen.getByRole('button', { name: 'e5' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'e4' })).not.toHaveAttribute('aria-current');
  });

  it('walks the line with first, previous, next and last', async () => {
    const user = userEvent.setup();
    playLine('e4', 'e5', 'Nf3');
    render(<MovesTable />);

    await user.click(screen.getByRole('button', { name: /first/i }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root');

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');

    await user.click(screen.getByRole('button', { name: /last/i }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4/e5/Nf3');

    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4/e5');
  });

  it('disables the controls that would step off either end', async () => {
    playLine('e4');
    render(<MovesTable />);

    // At the tip: forward is exhausted, backward is not.
    expect(screen.getByRole('button', { name: /last/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /first/i })).toBeEnabled();

    act(() => useTreeStore.getState().selectNode('root'));
    expect(screen.getByRole('button', { name: /first/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('shows the empty line without crashing and disables everything', () => {
    render(<MovesTable />);

    expect(screen.getByRole('button', { name: /first/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /last/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/ui/MovesTable.test.tsx`
Expected: FAIL — no such module.

- [ ] **Step 3: Implement `src/ui/MovesTable.tsx`**

```tsx
import { useMemo } from 'react';
import { buildMovesTable } from '../tree/movesTable';
import { useTreeStore } from '../tree/store';

/**
 * The move list and its four controls.
 *
 * Everything shown here is derived from the tree on each render by
 * `buildMovesTable`; this component stores nothing about the line. The
 * controls and the rows therefore cannot disagree about what the line is,
 * which is the failure this repo keeps meeting when one idea gets two
 * definitions (`Lessons.md` §5).
 *
 * `useMemo` is keyed on the tree object, which the store replaces on every
 * change — `buildMovesTable` allocates fresh arrays, so subscribing to its
 * result directly would hand `useSyncExternalStore` a new reference on every
 * render and loop forever. `useCurrentPath` in `tree/store.ts` solves the
 * same problem with `useShallow`; this shape is cheaper here because the
 * whole model is rebuilt as one value.
 */
export function MovesTable() {
  const tree = useTreeStore((state) => state.tree);
  const selectNode = useTreeStore((state) => state.selectNode);
  const { rows, lineIds, selectedIndex } = useMemo(() => buildMovesTable(tree), [tree]);

  const go = (index: number) => selectNode(lineIds[index]);
  const atStart = selectedIndex <= 0;
  const atEnd = selectedIndex >= lineIds.length - 1;

  return (
    <section className="moves-table" aria-label="Moves">
      <div className="moves-table-controls">
        <button type="button" className="btn" onClick={() => go(0)} disabled={atStart}>
          <span aria-hidden="true">⏮</span>
          <span className="visually-hidden">First move</span>
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => go(selectedIndex - 1)}
          disabled={atStart}
        >
          <span aria-hidden="true">◀</span>
          <span className="visually-hidden">Previous move</span>
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => go(selectedIndex + 1)}
          disabled={atEnd}
        >
          <span aria-hidden="true">▶</span>
          <span className="visually-hidden">Next move</span>
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => go(lineIds.length - 1)}
          disabled={atEnd}
        >
          <span aria-hidden="true">⏭</span>
          <span className="visually-hidden">Last move</span>
        </button>
      </div>

      <ol className="moves-table-rows">
        {rows.map((row) => (
          <li key={`${row.number}-${row.white?.nodeId ?? row.black?.nodeId}`}>
            <span className="moves-table-number">{row.number}.</span>
            {row.white ? (
              <button
                type="button"
                className="moves-table-move"
                onClick={() => selectNode(row.white!.nodeId)}
                aria-current={row.white.nodeId === tree.selectedId ? 'true' : undefined}
              >
                {row.white.san}
              </button>
            ) : (
              <span className="moves-table-move moves-table-elision" aria-hidden="true">
                …
              </span>
            )}
            {row.black && (
              <button
                type="button"
                className="moves-table-move"
                onClick={() => selectNode(row.black!.nodeId)}
                aria-current={row.black.nodeId === tree.selectedId ? 'true' : undefined}
              >
                {row.black.san}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/ui/MovesTable.test.tsx`
Expected: all PASS, and **zero warnings**. Report the count.

- [ ] **Step 5: Commit**

```bash
git add src/ui/MovesTable.tsx src/ui/MovesTable.test.tsx
git commit -m "feat(ui): add the moves table and its navigation controls"
```

---

### Task 4: Mount it, delete the breadcrumb, and check the layout in a browser

**Files:**
- Modify: `src/App.tsx` — remove the `.app-crumb` block and the `Breadcrumb` import; render `<MovesTable />` at the foot of `.app-rail-right`, below `<CandidateRail />`
- Modify: `src/ui/theme.css` — remove `.app-crumb` and any grid row it occupies; add `.moves-table` styles
- Delete: `src/ui/Breadcrumb.tsx`, `src/ui/Breadcrumb.test.tsx`
- Test: `src/ui/AppShell.test.tsx` (extend)

**This task writes grid placement, so it carries its own browser check** — `Lessons.md` §6: jsdom performs no layout, so `npm test` structurally cannot catch this class of bug, and an empty definitely-positioned element stealing a grid row has already shipped here once.

**Read `theme.css` around `.app-shell`'s grid definition before editing.** The shell is a named grid; removing a row without adjusting the template will move every remaining row.

- [ ] **Step 1: Extend `src/ui/AppShell.test.tsx`**

Assert the table is reachable **through `App`**, not by rendering `MovesTable` directly — a test that renders a component directly never exercises its mount gate, which is how the hint ladder shipped behind two engine-status returns (`Lessons.md` §5). Also assert the breadcrumb's landmark is gone.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/ui/AppShell.test.tsx`
Expected: FAIL — no "Moves" landmark yet.

- [ ] **Step 3: Make the change**

Remove `<div className="app-crumb"><Breadcrumb /></div>` and the import; put `<MovesTable />` after `<CandidateRail />` inside the right rail. Delete both breadcrumb files. In `theme.css`, remove `.app-crumb` and give the table a scroll region of its own so a long line scrolls inside the rail rather than growing it — the one-screen shell above 1100×640 sets `overflow: hidden` on `.app-shell`, so anything that grows unbounded is clipped rather than scrolled.

- [ ] **Step 4: Run the suite**

Run: `npm test`
Expected: green, three fewer tests than before (the breadcrumb's), plus the new ones. Report the totals and the warning count.

- [ ] **Step 5: Browser check — this is the step that matters**

```bash
npm run dev -- --port 5183 --strictPort
```

Drive the app and confirm by measurement, not by eye:

1. `.app-main`'s three columns are on **grid row 1** — read `getBoundingClientRect()` for `.app-rail-left`, `.app-centre`, `.app-rail-right` and confirm their `y` values match. The Plan 5 defect was exactly this, and it looked fine in every test.
2. The board is square and unmoved: `.board-wrap`'s width equals its height.
3. The table renders in the right rail below the candidates, and a line long enough to overflow scrolls **inside** the table rather than resizing the rail or the page.
4. Clicking a row moves the board.

**The window cannot be resized in this environment** — confirmed by four agents and recorded in `Lessons.md` §6. Do not plan or attempt a check that needs a different viewport; state the fallback layout as unverified.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/ui/theme.css src/ui/AppShell.test.tsx
git rm src/ui/Breadcrumb.tsx src/ui/Breadcrumb.test.tsx
git commit -m "feat(ui): replace the breadcrumb with the moves table"
```

---

### Task 5: Arrow keys, resolved by focus

**Files:**
- Modify: `src/ui/MovesTable.tsx` — add a keydown handler on the `<section>`
- Test: `src/ui/MovesTable.test.tsx` (extend)

**The constraint, from spec §4:** Left and Right already move the board cursor when the board has focus and **cannot be taken globally** without breaking the keyboard board navigation from Plan 5. The table's handler must live on the table and fire only when focus is inside it.

- [ ] **Step 1: Write the failing tests**

Two tests. First: focus the table, press `ArrowLeft`/`ArrowRight`, assert the selection walks the line and `preventDefault` stops the page scrolling. Second — the one that matters — render `App`, focus the **board**, press `ArrowRight`, and assert the tree's `selectedId` is **unchanged**. That is the regression the focus rule exists to prevent, and it must be asserted on the tree, not on a message.

- [ ] **Step 2: Run and watch both fail**

Run: `npx vitest run src/ui/MovesTable.test.tsx -t "arrow"`
Expected: FAIL, clean assertion mismatches.

- [ ] **Step 3: Implement**

Add `onKeyDown` to the section: `ArrowLeft` steps back, `ArrowRight` steps forward, both `preventDefault()`, both no-ops at their respective ends. Give the section `tabIndex={0}` so it can hold focus. Do not add a global listener.

- [ ] **Step 4: Run the tests, then the suite**

Run: `npx vitest run src/ui/MovesTable.test.tsx` then `npm test`
Expected: green, zero warnings, count reported.

- [ ] **Step 5: Mutation-check the focus rule**

Move the handler to `document` (a global listener) and confirm the board-focus test FAILS — the board cursor test proves the split is real rather than incidental. Restore.

- [ ] **Step 6: Commit**

```bash
git add src/ui/MovesTable.tsx src/ui/MovesTable.test.tsx
git commit -m "feat(ui): walk the move list with arrow keys when it has focus"
```

---

### Task 6: Browser pass and vault update

**Files:**
- Modify: `docs/obsidian/ChessTrainerVault/Current State.md`, `Known Issues.md`, `Roadmap.md`, `Start Here.md`, `Architecture.md`

- [ ] **Step 1: Full browser pass**

With `npm run dev` running, in a lesson and in the explorer:

1. Play a line, step back with `previous`, confirm the continuation **stays visible** — that is the whole point of the table over the breadcrumb.
2. From a position with two children, play a different move and confirm the table follows the new line.
3. **Mid-lesson, answer correctly and immediately click an earlier row, then click `last`.** Confirm the opponent replies. This is Task 1's defect and the only way to see it is here.
4. Step back mid-lesson and confirm nothing drags you forward.
5. Confirm the theme lesson with a Black-to-move segment (`development-and-tempo`, part 2) numbers its first row `2.` with an elided White cell.

Capture what you observed, including anything that made you pause.

- [ ] **Step 2: Update the vault**

`Current State.md` for the behaviour change; `Known Issues.md` — the breadcrumb entry ("stepping back throws away the forward path") is now **fixed and must be deleted, not tombstoned**; `Roadmap.md` moves Plan 7 to Done; `Architecture.md` if the derived-state layer is worth a line; `Start Here.md` last, describing reality as you are leaving it.

- [ ] **Step 3: Final verification and commit**

Run `npm test` and `npm run typecheck`. Report the pass count, the skip, and the warning count as numbers.

**Before opening a PR, re-read the PR and branch state** — `gh pr list --state all` and `git log --oneline origin/master..HEAD`. `Lessons.md` §10: a reading taken at the start of a session has expired, and `--state open` is a filter rather than a fact.

---

## Self-Review

**Spec coverage.** §4's "what it lists" → Task 2 (path plus continuation, linear, `lastSelectedAt`, root selectable). §4's controls → Task 3. §4's focus-resolved arrows → Task 5. §3's layout (right rail, below the quiz/candidates) → Task 4. Breadcrumb deletion → Task 4. §5's autoplay interaction → Task 1, reconciled with the 2026-08-14 fix. §7's testing → derivation unit-tested without rendering (Task 2), mutation checks on both named-defect guards (Tasks 1, 2, 5), browser pass (Tasks 4 and 6), warning count reported every task.

**Gap, stated rather than hidden:** §4 says "the starting position is itself selectable — it is a row in the table." This plan makes the root reachable via `lineIds[0]` and the `First` control, but does **not** render a separate "start" row, because a row with no move has no cell to put in a numbered White/Black pair. If a visible start row is wanted, it is a presentational addition to Task 3 and does not touch the derivation.

**Type consistency.** `MovesCell`, `MovesRow`, `MovesTableModel`, `buildMovesTable`, `lineIds`, `selectedIndex` are used with the same names and shapes in Tasks 2, 3 and 5. `moveNumber`/`sideToMove` are imported from `src/chess/side.ts` in both Task 2's implementation and its tests.

**Placeholder scan.** No TBDs. The two steps that say "describe the change rather than paste" (Tasks 1 and 4) do so deliberately, per `CLAUDE.md`'s rule about existing files, and each names the invariant to preserve.
