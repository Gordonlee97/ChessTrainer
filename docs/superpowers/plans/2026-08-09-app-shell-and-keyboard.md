# App Shell and Keyboard Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline-styled `App.tsx` shell with a deliberate one-screen
layout, and add keyboard board navigation.

**Architecture:** A CSS grid shell exactly one viewport tall whose board column
never moves; only the two side rails change contents by mode. Keyboard
navigation is a pure cursor module plus a thin layer in `Board.tsx` that renders
through `react-chessboard`'s existing `squareStyles` prop — it never touches the
library's DOM.

**Tech Stack:** React 19, TypeScript, CSS grid, chess.js 1.4, react-chessboard
v5, Zustand, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-06-app-shell-and-keyboard-design.md`

## Global Constraints

- **The core is React-free.** `src/chess/`, `src/engine/`, `src/tree/`,
  `src/explain/`, `src/content/`, `src/lesson/`, `src/progress/` must not import
  React. `src/test/purity.test.ts` enforces this. `STORE_EXEMPTIONS` is an
  explicitly enumerated `Set` of three exact paths — do not loosen it to a glob.
- **The game tree is the source of truth for position.** No parallel position
  state. The keyboard cursor is a *selection* cursor, not a position.
- **Evaluations are White-relative** above the UCI layer.
- **Press feedback uses `box-shadow`, never a box-model property.**
- **`prefers-reduced-motion` is honoured everywhere** and must still leave a
  visible press signal.
- **Sound is optional by construction.** A missing sound plays nothing, logs
  nothing, never throws.
- **Do not modify `src/engine/`.** Nothing in this plan requires it.
- **Never hand-write a FEN.** Every FEN in this plan was derived by replaying
  moves through chess.js. If you need another, derive it the same way.
- **Existing files: read the file in full before editing.** This plan describes
  *changes* to existing files and pastes complete code only for new ones. If
  what you find diverges from what is described, report the divergence rather
  than forcing the edit.
- **Test output must be pristine.** Report the warning count as a number. It is
  currently zero; any non-zero count is a finding with an owner.
- Run `npm test` and `npm run typecheck` before reporting any task complete.
  One skip is expected: `src/engine/engine.smoke.test.ts` needs a real `Worker`.

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/chess/boardCursor.ts` | Pure cursor arithmetic and square description. No React. |
| `src/chess/boardCursor.test.ts` | Tests for the above. |
| `src/ui/CheckpointPanel.tsx` | The right rail while a checkpoint is pending: prompt, hints, authored comparison. |
| `src/ui/CheckpointPanel.test.tsx` | Tests for the above. |
| `src/ui/ProgressNotice.tsx` | The header notice with its dismiss control. |
| `src/ui/AppShell.test.tsx` | Mode-behaviour assertions for the shell. |
| `docs/superpowers/plans/shell-sizing-spike.html` | Standalone page for Task 1. |
| `docs/superpowers/plans/spike-results-shell.md` | Task 1's recorded measurements. |

Also created: `src/ui/Board.keyboard.test.tsx` (Task 4), and
`src/ui/CompareDrawer.test.tsx` if it does not already exist (Task 6 —
check first).

**Modify:** `src/App.tsx`, `src/ui/theme.css`, `src/ui/Board.tsx`,
`src/ui/Breadcrumb.tsx`, `src/ui/CandidateRail.tsx`, `src/ui/CompareDrawer.tsx`,
`src/ui/LessonRail.tsx`, `src/ui/LessonPicker.tsx`, `src/ui/SavedLines.tsx`,
`src/ui/AppControls.tsx`, `src/progress/store.ts`, `src/progress/storage.ts`,
`src/tree/tree.ts`, `src/tree/tree.test.ts`.

## Shared surfaces — read this if your task touches either

**`useActiveLesson().state.pendingCheckpoint`** is read by both `LessonRail`
and the right rail. When it is set, `LessonRail` must **not** render its hint
block and `CheckpointPanel` **must**. If the two disagree the player gets
either duplicated hints or none at all. **Task 5 owns both sides of this and
changes them together** — this is deliberate, because four of this project's
defects were two tasks that each satisfied their own brief and did not agree.

**`squareStyles`** in `Board.tsx` is written by both the existing last-move
highlight and the new keyboard cursor. They merge; neither replaces the other.

---

### Task 1: Spike — prove the board can be capped by height

The entire layout rests on a claim read from the library's source but never
observed: `react-chessboard` is width-driven (its grid is
`width:100%; height:100%` with squares at `aspectRatio: '1/1'`), so `height`
on a container does not shrink it, and only constraining the wrapper's *width*
by available height will cap the board. **Nothing else in this plan may be
built until this is measured.**

**Files:**
- Create: `docs/superpowers/plans/shell-sizing-spike.html`
- Create: `docs/superpowers/plans/spike-results-shell.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a recorded verdict. Task 2 uses the CSS that this task proves.

- [ ] **Step 1: Create the standalone spike page**

No build step — open it directly in a browser. It reproduces the exact
constraint: an 8×8 grid of `aspect-ratio: 1/1` cells inside a square wrapper,
inside a grid row of definite height.

```html
<!doctype html>
<meta charset="utf-8">
<title>Shell sizing spike</title>
<style>
  html, body { margin: 0; height: 100%; }
  #root {
    height: 100dvh; overflow: hidden;
    display: grid; grid-template-rows: auto auto 1fr;
    font: 14px system-ui;
  }
  header, .crumb { padding: 8px; background: #ffe9d8; }
  main {
    min-height: 0;
    display: grid; grid-template-columns: minmax(220px, 22%) 1fr minmax(260px, 28%);
    gap: 16px; padding: 16px;
  }
  .rail { min-height: 0; overflow-y: auto; background: #fff; border: 1px solid #ffd9bd; }
  .centre { min-height: 0; display: flex; }
  /* The claim under test. */
  .board-wrap {
    aspect-ratio: 1;
    max-block-size: 100%;
    max-inline-size: 100%;
    margin: auto;
  }
  .board {
    width: 100%; height: 100%;
    display: grid; grid-template-columns: repeat(8, 1fr);
    overflow: hidden; border: 2px solid #b58863;
  }
  .board i { display: block; aspect-ratio: 1/1; }
</style>
<div id="root">
  <header>header row</header>
  <div class="crumb">breadcrumb row</div>
  <main>
    <div class="rail">left rail<div style="height:1200px"></div></div>
    <div class="centre"><div class="board-wrap"><div class="board" id="b"></div></div></div>
    <div class="rail">right rail<div style="height:1200px"></div></div>
  </main>
</div>
<script>
  const b = document.getElementById('b');
  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8), c = i % 8, sq = document.createElement('i');
    sq.style.background = (r + c) % 2 ? '#b58863' : '#f2dcbb';
    b.appendChild(sq);
  }
  addEventListener('resize', report);
  function report() {
    const w = b.getBoundingClientRect();
    console.log(JSON.stringify({
      viewport: [innerWidth, innerHeight],
      board: [Math.round(w.width), Math.round(w.height)],
      square: w.width === w.height,
      pageScrolls: document.documentElement.scrollHeight > innerHeight,
    }));
  }
  report();
</script>
```

- [ ] **Step 2: Measure it in a real browser at two window sizes**

Open the file directly (`file://`) in Chrome and read the console at a tall
window and a short one — a short viewport is the case that decides it, because
that is when height, not width, must bind.

Record for each: viewport dimensions, board width and height, whether the board
is square, and whether the page scrolls.

- [ ] **Step 3: Record the verdict**

Write `docs/superpowers/plans/spike-results-shell.md` with the raw numbers and
one of two verdicts:

- **CONFIRMED** — the board stays square, shrinks when the viewport gets short,
  and the page never scrolls. Task 2 proceeds with this CSS.
- **REFUTED** — state exactly what happened (board overflowed, went
  non-square, or the page scrolled). **Stop and report to the controller.**
  Do not improvise a fix; the fallback is a measured `ResizeObserver` sizing
  the board explicitly, which is a different design and needs a decision.

Write the numbers you actually observed. "Looks right" is not a measurement.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/shell-sizing-spike.html docs/superpowers/plans/spike-results-shell.md
git commit -m "test: measure whether the board can be capped by available height"
```

---

### Task 2: The one-screen shell

**Files:**
- Modify: `src/App.tsx` — replace the inline-styled flex shell entirely. This
  file is small and is being rewritten by design, so it is the one existing
  file in this plan you may replace wholesale.
- Modify: `src/ui/theme.css` — append the shell rules. Do not alter existing
  rules; `--lip`, the press-feedback shadows and the reduced-motion block are
  load-bearing elsewhere.
- Modify: `src/ui/Breadcrumb.tsx` — remove only its `marginBottom: 12` inline
  style; the grid now owns spacing. Leave everything else, including
  `aria-label="Move history"` and `aria-current`.

**Interfaces:**
- Consumes: Task 1's CONFIRMED verdict.
- Produces: CSS class names `app-shell`, `app-header`, `app-crumb`, `app-main`,
  `app-rail`, `app-centre`, `board-wrap`. Later tasks attach to these.

**Task 1 refuted this task's original CSS and the corrected version below is
the measured one.** Use it as written. If you find yourself reaching for
`aspect-ratio` on `.board-wrap`, stop — that is the variant that was measured
failing, in both directions.

- [ ] **Step 1: Append the shell CSS to `src/ui/theme.css`**

```css
/* ---- App shell -------------------------------------------------------- */

.app-shell {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 12px;
  padding: 16px 20px 20px;
  max-width: 1600px;
  margin: 0 auto;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.app-wordmark {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
  color: var(--primary);
}

.app-header-spacer { flex: 1; }

.app-crumb { min-width: 0; overflow-x: auto; }

.app-main {
  display: grid;
  grid-template-columns: minmax(220px, 22%) 1fr minmax(260px, 28%);
  gap: 20px;
}

/* min-height: 0 is what makes the rails scroll instead of stretching the
   grid. Without it a grid item refuses to shrink below its content and the
   page grows instead — silently, and only at small window heights. */
.app-rail {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Sizing measured in Task 1 — do not substitute an aspect-ratio variant.
   The centre is a *size container*, and the board takes the smaller of its
   two dimensions in BOTH axes, so it is square by construction rather than
   by aspect-ratio inference. Task 1 tested the obvious alternative
   (block-size: 100% + aspect-ratio: 1 + max-inline-size: 100%) and measured
   it non-square even in the easy case (502x498), and in a narrow-tall column
   it overflowed the page by 546px. See spike-results-shell.md. */
.app-centre {
  min-height: 0;
  min-width: 0;
  container-type: size;
}

.board-wrap {
  width: min(100cqw, 100cqh);
  height: min(100cqw, 100cqh);
  margin: auto;
}

/* One screen only above the floor. Below either threshold the shell flows as
   a single scrolling column — see the spec's §4. */
@media (min-width: 1100px) and (min-height: 640px) {
  html, body, #root { height: 100%; }
  #root { overflow: hidden; }
  .app-shell { height: 100dvh; overflow: hidden; }
}

@media not all and (min-width: 1100px) and (min-height: 640px) {
  .app-main { grid-template-columns: 1fr; }
  .app-rail { overflow-y: visible; }

  /* container-type: size MUST be turned off here. It requires a definite
     size on both axes, and in the flowing fallback the height is indefinite
     — leaving it on makes 100cqh resolve to 0 and the board vanishes. In the
     fallback the board goes back to being width-driven, which is correct for
     a page that scrolls. */
  .app-centre {
    container-type: normal;
    max-width: 560px;
    margin: 0 auto;
    width: 100%;
    order: 1;
  }
  .board-wrap { width: 100%; height: auto; aspect-ratio: 1; }

  /* Board and candidates ahead of the picker and saved lines, so the two
     things a player is looking at do not sit below a list. */
  .app-rail-right { order: 2; }
  .app-rail-left { order: 3; }
}
```

- [ ] **Step 2: Rewrite `src/App.tsx`**

The mode logic is one selector: `useLessonStore((s) => s.lessonId)`. The
picker already self-hides when a lesson runs (`LessonPicker.tsx` returns
`null` if `lessonId`), so this is not duplicating that — it is what removes
`SavedLines` and gives the rails their contents.

```tsx
import { useLessonStore } from './lesson/store';
import { AppControls } from './ui/AppControls';
import { Board } from './ui/Board';
import { Breadcrumb } from './ui/Breadcrumb';
import { CandidateRail } from './ui/CandidateRail';
import { LessonPicker } from './ui/LessonPicker';
import { LessonRail } from './ui/LessonRail';
import { ProgressNotice } from './ui/ProgressNotice';
import { SavedLines } from './ui/SavedLines';

export function App() {
  const lessonId = useLessonStore((store) => store.lessonId);
  const inLesson = lessonId !== null;

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1 className="app-wordmark">ChessTrainer</h1>
        <ProgressNotice />
        <span className="app-header-spacer" />
        <AppControls />
      </header>

      <div className="app-crumb">
        <Breadcrumb />
      </div>

      <div className="app-main">
        <div className="app-rail app-rail-left">
          {inLesson ? (
            <LessonRail />
          ) : (
            <>
              <LessonPicker />
              <SavedLines />
            </>
          )}
        </div>

        <div className="app-centre">
          <div className="board-wrap">
            <Board />
          </div>
        </div>

        <div className="app-rail app-rail-right">
          <CandidateRail />
        </div>
      </div>
    </main>
  );
}
```

`ProgressNotice` does not exist until Task 7. **Create a placeholder now** so
this task compiles and commits on its own — Task 7 replaces its body:

```tsx
// src/ui/ProgressNotice.tsx — body filled in by Task 7.
export function ProgressNotice() {
  return null;
}
```

- [ ] **Step 3: Check the eval bar still has a home**

`EvalBar` is rendered inside `CandidateRail`, not beside the board — read
`src/ui/CandidateRail.tsx` and confirm before assuming otherwise. If it is
where this plan says, `.app-centre` holds only the board wrapper and the
`gap: 10px` is harmless. **Report what you find.**

- [ ] **Step 4: Write the mode-behaviour tests**

Layout itself is not unit-testable in jsdom, which does no layout — but *which
panels exist in which mode* is, and that is where the spec's rules live.

Create `src/ui/AppShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';

describe('app shell', () => {
  beforeEach(() => {
    act(() => {
      useLessonStore.getState().stopLesson();
      useTreeStore.getState().reset();
    });
  });

  it('offers the picker and saved lines when no lesson is running', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: /my lines/i })).toBeInTheDocument();
  });

  // Saved lines must not be reachable mid-lesson: opening one resets the tree,
  // which could credit a checkpoint the player never answered.
  it('hides saved lines while a lesson is running', () => {
    render(<App />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    expect(screen.queryByRole('region', { name: /my lines/i })).toBeNull();
    expect(screen.getByRole('region', { name: /lesson/i })).toBeInTheDocument();
  });
});
```

`SavedLines` renders `<section aria-label="My lines">` and `LessonRail`
renders `<section aria-label="Lesson">` — both verified by reading the
components. If either accessible name has changed, fix the test to match the
component, not the reverse.

- [ ] **Step 5: Run the suite**

Run: `npm test && npm run typecheck`
Expected: PASS, one expected skip, zero warnings. Other existing tests render
components directly rather than through `App`, so they should be unaffected. If
one broke, it was asserting on the old shell — report it rather than deleting
it. `App` mounts `CandidateRail`, which starts the engine; if that produces
`act()` warnings, that is a finding with an owner, not a baseline.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/ui/theme.css src/ui/Breadcrumb.tsx src/ui/ProgressNotice.tsx src/ui/AppShell.test.tsx
git commit -m "feat(ui): give the app a one-screen shell with fixed board column"
```

---

### Task 3: The pure cursor module

**Files:**
- Create: `src/chess/boardCursor.ts`
- Create: `src/chess/boardCursor.test.ts`

**Interfaces:**
- Consumes: `chess.js` only.
- Produces:
  - `type CursorKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'`
  - `moveCursor(square: string, key: CursorKey, orientation: 'white' | 'black'): string`
  - `describeSquare(fen: string, square: string): string`

**This file must not import React** — the purity guard covers `src/chess/`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { describeSquare, moveCursor } from './boardCursor';

// Derived by replaying through chess.js, not written by hand.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('moveCursor', () => {
  it('moves up the board from White\'s point of view', () => {
    expect(moveCursor('e2', 'ArrowUp', 'white')).toBe('e3');
    expect(moveCursor('e2', 'ArrowDown', 'white')).toBe('e1');
    expect(moveCursor('e2', 'ArrowLeft', 'white')).toBe('d2');
    expect(moveCursor('e2', 'ArrowRight', 'white')).toBe('f2');
  });

  // The bug this whole test file exists for. Every lesson played as Black
  // flips the board, and a cursor that ignores it is wrong on every one.
  it('inverts every direction when the board is flipped for Black', () => {
    expect(moveCursor('e2', 'ArrowUp', 'black')).toBe('e1');
    expect(moveCursor('e2', 'ArrowDown', 'black')).toBe('e3');
    expect(moveCursor('e2', 'ArrowLeft', 'black')).toBe('f2');
    expect(moveCursor('e2', 'ArrowRight', 'black')).toBe('d2');
  });

  it('stops at the edge rather than wrapping', () => {
    expect(moveCursor('a1', 'ArrowDown', 'white')).toBe('a1');
    expect(moveCursor('a1', 'ArrowLeft', 'white')).toBe('a1');
    expect(moveCursor('h8', 'ArrowUp', 'white')).toBe('h8');
    expect(moveCursor('h8', 'ArrowRight', 'white')).toBe('h8');
    // Flipped, the edges swap ends.
    expect(moveCursor('a1', 'ArrowUp', 'black')).toBe('a1');
    expect(moveCursor('h8', 'ArrowDown', 'black')).toBe('h8');
  });
});

describe('describeSquare', () => {
  it('names the piece on an occupied square', () => {
    expect(describeSquare(START, 'e2')).toBe('e2, white pawn');
    expect(describeSquare(START, 'a1')).toBe('a1, white rook');
    expect(describeSquare(START, 'd8')).toBe('d8, black queen');
    expect(describeSquare(START, 'e1')).toBe('e1, white king');
  });

  it('says empty when nothing is there', () => {
    expect(describeSquare(START, 'e4')).toBe('e4, empty');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run src/chess/boardCursor.test.ts`
Expected: FAIL — cannot resolve `./boardCursor`.

- [ ] **Step 3: Implement the module**

```ts
import { Chess } from 'chess.js';

const FILES = 'abcdefgh';

export type CursorKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/** Board-space deltas from White's point of view: [file, rank]. */
const DELTAS: Record<CursorKey, [number, number]> = {
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/**
 * Moves the cursor one square in the direction the player pressed, as seen
 * on screen.
 *
 * `orientation` is not decoration. The board flips for a lesson played as
 * Black — `Board.tsx` derives it from the active lesson's segment, and it can
 * change mid-lesson — and when it is flipped, screen-up is board-down. A
 * cursor that ignores this is correct for every White lesson and wrong for
 * every Black one.
 *
 * Movement clamps at the edge rather than wrapping: wrapping from h-file to
 * a-file reads as the cursor teleporting.
 */
export function moveCursor(
  square: string,
  key: CursorKey,
  orientation: 'white' | 'black',
): string {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  if (file < 0 || Number.isNaN(rank) || rank < 0 || rank > 7) return square;

  const [df, dr] = DELTAS[key];
  const sign = orientation === 'black' ? -1 : 1;

  const nextFile = Math.min(7, Math.max(0, file + df * sign));
  const nextRank = Math.min(7, Math.max(0, rank + dr * sign));

  return `${FILES[nextFile]}${nextRank + 1}`;
}

const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/**
 * A square and its occupant, phrased for a screen reader: "e2, white pawn".
 * Colour is spelled out rather than implied, because the spec forbids
 * signalling anything by colour alone.
 */
export function describeSquare(fen: string, square: string): string {
  const piece = new Chess(fen).get(square as never);
  if (!piece) return `${square}, empty`;
  return `${square}, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}`;
}
```

- [ ] **Step 4: Run and watch it pass**

Run: `npx vitest run src/chess/boardCursor.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Mutation-check the orientation test**

This test guards a named defect, so its failure must be witnessed. Change
`const sign = orientation === 'black' ? -1 : 1;` to `const sign = 1;`.

Run: `npx vitest run src/chess/boardCursor.test.ts`
Expected: FAIL — specifically the "inverts every direction" test, reporting
`e3` where `e1` was expected. Confirm the failure names the *orientation*
test and not merely "some test failed". Restore the line, re-run, confirm
PASS.

**Report what you observed** — the assertion that failed and its message. A
test whose failure you have not seen is a guess.

- [ ] **Step 6: Confirm the purity guard is satisfied**

Run: `npx vitest run src/test/purity.test.ts`
Expected: PASS. `boardCursor.ts` imports only `chess.js`.

- [ ] **Step 7: Commit**

```bash
git add src/chess/boardCursor.ts src/chess/boardCursor.test.ts
git commit -m "feat(chess): add orientation-aware board cursor arithmetic"
```

---

### Task 4: Wire the keyboard into the board

**Files:**
- Modify: `src/ui/Board.tsx`
- Create: `src/ui/Board.keyboard.test.tsx`

**Interfaces:**
- Consumes: `moveCursor`, `describeSquare`, `CursorKey` from Task 3;
  `resolveDrop(fen, from, to)` and `playMove(san)` which already exist.
- Produces: nothing later tasks depend on.

**Read `src/ui/Board.tsx` in full first.** Invariants that must survive:

- `onPieceDrop` and `onPieceDrag` behaviour is unchanged. Drag still works.
- The last-move `highlight` memo stays. The cursor **merges into**
  `squareStyles`, it does not replace the highlight.
- `orientation` keeps deriving from
  `activeLesson?.segment.side ?? activeLesson?.lesson.side ?? 'white'`.
- `prefersReducedMotion` handling is untouched.
- The sound on a keyboard move is the same one a drag makes, via the existing
  `resolveDrop` → `sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound)`
  path. Do not introduce a second sound path.

**The change:** wrap the `<Chessboard>` in a focusable `<div>` and add cursor
state.

- Two pieces of state: `cursor` (a square string, initial `'e2'`) and
  `picked` (a square string or `null`).
- The wrapper takes `tabIndex={0}`, `role="application"`,
  `aria-label="Chess board. Use arrow keys to move the cursor, Enter to pick up and place a piece."`,
  and `onKeyDown`.
- An `aria-live="polite"` region — visually hidden, not `display: none`, which
  screen readers skip — holds the current announcement.
- `squareStyles` becomes `{ ...highlight, ...cursorStyles }` where
  `cursorStyles` marks `cursor` with an outline and, when set, `picked` with a
  distinct one. Use `boxShadow: 'inset 0 0 0 4px …'` — the project forbids
  box-model properties for this kind of feedback because they reflow.
- Key handling:
  - Arrow keys → `setCursor(moveCursor(cursor, key, orientation))`, announce
    `describeSquare(node.fen, next)`, and `event.preventDefault()` so the page
    does not scroll.
  - `Enter`/`' '` with `picked === null` → pick up if that square has a piece;
    announce "picked up {description}". If the square is empty, announce
    "{square}, empty — nothing to pick up" and do not set `picked`.
  - `Enter`/`' '` with `picked` set → `resolveDrop(node.fen, picked, cursor)`.
    On `null`, announce `"{picked} to {cursor} is not a legal move"` and leave
    `picked` set. On success, `playMove(resolved.san)`, play the sound, clear
    `picked`, announce the SAN.
  - `Escape` → clear `picked`, announce "put down".
- Clear `picked` whenever `node.id` changes, via an effect — otherwise
  navigating the tree with a piece held leaves a stale pick-up pointing at a
  square that may no longer hold that piece.

- [ ] **Step 1: Write the failing tests**

The board is a third-party component; these tests drive **our** wrapper, which
is exactly why the keyboard path is testable when dragging is not.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from './Board';
import { useTreeStore } from '../tree/store';

// Position after 1.e4, derived by replaying through chess.js.
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

function boardRegion() {
  return screen.getByRole('application', { name: /chess board/i });
}

describe('Board keyboard navigation', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
  });

  it('announces the square the cursor moves to', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(boardRegion());
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('status')).toHaveTextContent('e3, empty');
  });

  it('plays a legal move and advances the tree', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(boardRegion());
    // Cursor starts on e2. Pick up, walk to e4, place.
    await user.keyboard('{Enter}{ArrowUp}{ArrowUp}{Enter}');
    expect(useTreeStore.getState().tree.nodes[
      useTreeStore.getState().tree.selectedId
    ].fen).toBe(AFTER_E4);
  });

  // e2->e5 is illegal from the start position (verified via chess.js).
  it('refuses an illegal move, announces it, and plays nothing', async () => {
    const user = userEvent.setup();
    const before = useTreeStore.getState().tree.selectedId;
    const user2 = user;
    render(<Board />);
    await user2.click(boardRegion());
    await user2.keyboard('{Enter}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent(
      'e2 to e5 is not a legal move',
    );
    expect(useTreeStore.getState().tree.selectedId).toBe(before);
  });

  it('Escape puts a picked-up piece down', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(boardRegion());
    await user.keyboard('{Enter}{Escape}');
    expect(screen.getByRole('status')).toHaveTextContent('put down');
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/ui/Board.keyboard.test.tsx`
Expected: FAIL — no element with role `application`.

- [ ] **Step 3: Implement the wrapper in `src/ui/Board.tsx`**

Follow the change description above and keep every listed invariant. Do not
restructure the existing drag handlers.

The new parts, to integrate into the existing component — **not** to paste
over it. `node`, `playMove`, `orientation` and `highlight` already exist in
this file; reuse them rather than re-declaring.

```tsx
const [cursor, setCursor] = useState('e2');
const [picked, setPicked] = useState<string | null>(null);
const [announcement, setAnnouncement] = useState('');

// A held piece must not survive navigating to another position: the square
// it points at may not hold that piece any more.
useEffect(() => {
  setPicked(null);
}, [node.id]);

const cursorStyles = useMemo(() => {
  const styles: Record<string, CSSProperties> = {
    [cursor]: { boxShadow: 'inset 0 0 0 4px var(--secondary)' },
  };
  if (picked) styles[picked] = { boxShadow: 'inset 0 0 0 4px var(--primary)' };
  return styles;
}, [cursor, picked]);

function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
  const key = event.key;

  if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
    event.preventDefault(); // otherwise the page scrolls under the board
    const next = moveCursor(cursor, key, orientation);
    setCursor(next);
    setAnnouncement(describeSquare(node.fen, next));
    return;
  }

  if (key === 'Escape') {
    if (picked) {
      setPicked(null);
      setAnnouncement('put down');
    }
    return;
  }

  if (key !== 'Enter' && key !== ' ') return;
  event.preventDefault();

  if (picked === null) {
    const description = describeSquare(node.fen, cursor);
    if (description.endsWith('empty')) {
      setAnnouncement(`${description} — nothing to pick up`);
      return;
    }
    setPicked(cursor);
    setAnnouncement(`picked up ${description}`);
    return;
  }

  const resolved = resolveDrop(node.fen, picked, cursor);
  if (!resolved) {
    setAnnouncement(`${picked} to ${cursor} is not a legal move`);
    return; // keep the piece held so the player can try another square
  }

  const played = playMove(resolved.san);
  if (played) {
    sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound);
    setAnnouncement(resolved.san);
  }
  setPicked(null);
}
```

And the wrapper around the existing `<Chessboard>`:

```tsx
<div
  role="application"
  aria-label="Chess board. Use arrow keys to move the cursor, Enter to pick up and place a piece."
  tabIndex={0}
  onKeyDown={onKeyDown}
  style={{ outlineOffset: 3 }}
>
  <Chessboard options={{ /* existing options, with the change below */ }} />
  <p role="status" aria-live="polite" className="visually-hidden">
    {announcement}
  </p>
</div>
```

The one change inside `options` is
`squareStyles: { ...highlight, ...cursorStyles }`.

Add a `.visually-hidden` rule to `theme.css` if one does not already exist —
**grep for it first**. It must not be `display: none`, which screen readers
skip:

```css
.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0; border: 0;
  clip-path: inset(50%);
  overflow: hidden; white-space: nowrap;
}
```

- [ ] **Step 4: Run and watch them pass**

Run: `npx vitest run src/ui/Board.keyboard.test.tsx`
Expected: PASS. Then `npm test` — expected PASS, one skip, **zero** warnings.
If `act()` warnings appear, they are a finding with an owner, not a baseline.

- [ ] **Step 5: Mutation-check the illegal-move test**

This test guards a keyboard path that would otherwise silently play nothing —
or worse, play something. Change the illegal branch so it falls through to
`playMove` regardless of `resolveDrop` returning `null`.

Run: `npx vitest run src/ui/Board.keyboard.test.tsx`
Expected: FAIL on the illegal-move test. Confirm it fails because no
announcement was made or the tree advanced — not because of an unrelated
crash. Restore, re-run, confirm PASS. **Report what you observed.**

- [ ] **Step 6: Commit**

```bash
git add src/ui/Board.tsx src/ui/Board.keyboard.test.tsx
git commit -m "feat(ui): add keyboard board navigation with spoken square feedback"
```

---

### Task 5: The checkpoint panel — both sides of the shared surface

**This task owns both halves of a shared surface deliberately.** Splitting it
is how this project produced four cross-task defects.

**Files:**
- Create: `src/ui/CheckpointPanel.tsx`
- Create: `src/ui/CheckpointPanel.test.tsx`
- Modify: `src/ui/CandidateRail.tsx`
- Modify: `src/ui/LessonRail.tsx`

**Interfaces:**
- Consumes: `useActiveLesson()` and `useLessonStore` — both already exist.
- Produces: `<CheckpointPanel />`, taking no props.

**Read all three existing files in full before editing.**

**What `CandidateRail` gives up.** Its checkpoint branch is currently at lines
204–243 and renders *three* things, not one:

1. The `role="status"` notice "Engine suggestions are hidden while the lesson
   is asking you for a move."
2. The `checkpointComparison` "Compare X and Y" button.
3. The `CompareDrawer` it opens, with `authored={checkpointComparison.authored}`.

**All three move to `CheckpointPanel`, along with the `checkpointComparison`
`useMemo` and the `authoredContrastFor` helper it calls.** That comparison
exists because Plan 3's review found the authored contrast was otherwise
unreachable — every move carrying `alternatives` is also a checkpoint, and the
rail hid itself at checkpoints. **Dropping it silently re-introduces a fixed
bug.** Its pair is chosen from authored `alternatives` and excludes anything in
`checkpoint.accept`, so it never leaks the answer; preserve that filter exactly.

`CandidateRail` keeps everything else — the `annotations` memo, the depth
heading, the candidate buttons, `playCandidate`, the non-checkpoint
`CompareDrawer`, and the `useEffect` that closes the drawer on `node.id`
change. After the extraction its `if (activeLesson?.state.pendingCheckpoint)`
branch returns `<CheckpointPanel />`.

**What `CheckpointPanel` adds** is the hint block, moved verbatim from
`LessonRail`: `asking.prompt`, `asking.hints.slice(0, revealed)` as an `<ol>`,
and the `Hint` button calling `revealHint(asking.id)` while
`revealed < asking.hints.length`. `asking` is
`state.pendingCheckpoint ?? attemptedCheckpoint` and `revealed` is
`hintsShown[asking.id] ?? 0` — copy that derivation exactly; the
`attemptedCheckpoint` fallback is what keeps hints on screen while a wrong
answer's reply refers to them.

**What `LessonRail` loses** is only its `{asking && (…)}` block. Everything
else stays: the recording `useEffect` and its comment, `lastNote`,
`state.complete`, the off-script replies, `returnToLesson`, `playNextMove`,
"Play the next move", "Leave lesson". The `asking` and `revealed` locals
become unused there — remove them, and remove the now-unused `revealHint`
selector, but leave `hintsShown` alone: the recording effect still reads it.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CheckpointPanel } from './CheckpointPanel';
import { LessonRail } from './LessonRail';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';

/**
 * Drives a real lesson to a checkpoint rather than mocking the store — the
 * point of these tests is that two components agree about the same derived
 * state, and a mock would let each fake it independently.
 *
 * The Italian Game's very first move carries a checkpoint
 * ('italian-open-with-e4', accept: ['e4']), so no moves need playing: the
 * lesson is at a pending checkpoint the moment it starts. Verified by
 * reading src/content/lessons/italian-game.ts.
 */
function startAtCheckpoint() {
  act(() => {
    useTreeStore.getState().reset();
    useLessonStore.getState().startLesson('italian-game');
  });
}

describe('checkpoint panel', () => {
  // Guards the whole file: if content changes so that e4 no longer carries a
  // checkpoint, every test below would pass vacuously against an empty
  // render. That is the exact failure mode Lessons.md §2 records six times.
  it('is genuinely at a pending checkpoint', () => {
    startAtCheckpoint();
    render(<CheckpointPanel />);
    expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
  });

  it('reveals hints one at a time', async () => {
    const user = userEvent.setup();
    startAtCheckpoint();
    render(<CheckpointPanel />);
    expect(screen.queryByText(/central pawn moves are the ones/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: /hint/i }));
    expect(screen.getByText(/central pawn moves are the ones/i)).toBeInTheDocument();
    // The second hint stays hidden until asked for.
    expect(screen.queryByText(/pawn in front of your king/i)).toBeNull();
  });

  it('still tells the player why the engine lines are hidden', () => {
    startAtCheckpoint();
    render(<CheckpointPanel />);
    expect(screen.getByRole('status')).toHaveTextContent(
      /hidden while the lesson is asking/i,
    );
  });

  // The shared surface. If both render hints, the player sees them twice.
  it('LessonRail drops its hint block while a checkpoint is pending', () => {
    startAtCheckpoint();
    render(<LessonRail />);
    expect(screen.queryByRole('button', { name: /^hint$/i })).toBeNull();
    // But it keeps its own controls — this must not delete the whole rail.
    expect(screen.getByRole('button', { name: /leave lesson/i })).toBeInTheDocument();
  });
});
```

Add `import { act } from 'react';`, `import userEvent from '@testing-library/user-event';`
and `import { useLessonStore } from '../lesson/store';` to the test file.

**The authored comparison is not unit-testable here.** `checkpointComparison`
needs a real analysis result from `useAnalysis`, which needs the engine. It is
covered by the browser pass in Task 9 instead — do not fake a result to
manufacture coverage.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/ui/CheckpointPanel.test.tsx`
Expected: FAIL — cannot resolve `./CheckpointPanel`.

- [ ] **Step 3: Create `CheckpointPanel` and move the three pieces into it**

Move, do not re-derive. Copy `checkpointComparison`, `authoredContrastFor` and
the `comparing` state across unchanged, including their comments — those
comments record why the filter exists.

- [ ] **Step 4: Reduce `CandidateRail`'s checkpoint branch to `<CheckpointPanel />`**

Delete the moved code from `CandidateRail`, including `authoredContrastFor` if
nothing else there calls it. **Check first** — `authoredContrast` (the
non-checkpoint one) also calls it, so it is probably still needed. Read before
deleting.

- [ ] **Step 5: Remove the `{asking && …}` block from `LessonRail`**

Leave every other behaviour intact, especially the recording `useEffect`.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one skip, zero warnings. Existing `LessonRail` tests asserting
on hints will now fail — that is correct, and they move to
`CheckpointPanel.test.tsx` rather than being deleted. Report which ones moved.

- [ ] **Step 7: Commit**

```bash
git add src/ui/CheckpointPanel.tsx src/ui/CheckpointPanel.test.tsx src/ui/CandidateRail.tsx src/ui/LessonRail.tsx
git commit -m "feat(ui): move the hint ladder into the space the engine lines vacate"
```

---

### Task 6: Compare opens as an overlay

**Files:**
- Modify: `src/ui/CompareDrawer.tsx`
- Modify: `src/ui/theme.css`
- Modify: `src/App.tsx` — add the portal target only.
- Create or extend: `src/ui/CompareDrawer.test.tsx` — **check whether it
  already exists** before creating it.

**Interfaces:**
- Consumes: the `.app-main` grid from Task 2; `CompareDrawer`'s existing
  props `{ a, b, baseFen, onClose, authored? }` — do not change this signature,
  both call sites depend on it.
- Produces: nothing later tasks depend on.

**Read `src/ui/CompareDrawer.tsx` in full first.** It is currently a
`role="region"` with `className="compare-drawer"` that renders inline wherever
it is placed, and `theme.css:129` styles it with `margin-top: 18px` and a
`drawer-rise` animation already guarded by `prefers-reduced-motion`.

Today it renders inside the right rail — roughly 260px wide — holding two
`LinePanel`s each with a `MiniBoard`. Giving it two columns of width is the
main reason comparison stops feeling cramped.

**Why a portal.** The drawer must span the centre and right columns but is
rendered from deep inside the right rail. CSS alone cannot lift it out. It
portals into a target that `App` renders as the last child of `.app-main`, so
the drawer keeps its local state and props while positioning correctly.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CompareDrawer } from './CompareDrawer';

const A = { san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5', 'Nf3'], depth: 18, multipv: 1 };
const B = { san: 'd4', cp: 22, mate: null, pv: ['d4', 'd5', 'c4'], depth: 18, multipv: 2 };
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

it('closes on Escape', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<CompareDrawer a={A} b={B} baseFen={START} onClose={onClose} />);
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledOnce();
});

it('returns focus to whatever was focused when it opened', async () => {
  const user = userEvent.setup();
  render(<button type="button">opener</button>);
  const opener = screen.getByRole('button', { name: 'opener' });
  opener.focus();
  const view = render(
    <CompareDrawer a={A} b={B} baseFen={START} onClose={() => {}} />,
  );
  expect(opener).not.toHaveFocus();
  view.unmount();
  expect(opener).toHaveFocus();
});
```

**Check `PvLine`'s real shape in `src/engine/types.ts` before running this** —
the `A`/`B` literals above must match it exactly, and if they do not, fix the
literals rather than casting them.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/ui/CompareDrawer.test.tsx`
Expected: FAIL — Escape does nothing and focus is not restored.

- [ ] **Step 3: Add the portal target to `App.tsx`**

Inside `.app-main`, after the right rail:

```tsx
<div className="compare-portal" id="compare-portal" />
```

- [ ] **Step 4: Make the drawer an overlay**

In `CompareDrawer.tsx`:

- Import `createPortal` from `react-dom` and `useEffect`, `useRef`.
- On mount, capture `document.activeElement`; on unmount, call `.focus()` on
  it if it is still in the document. This lives in the drawer, not the call
  sites, so both get it.
- On mount, move focus into the drawer — give the outer element
  `tabIndex={-1}` and focus it.
- Add a `keydown` handler for `Escape` calling `onClose`.
- Keep `role="region"` and `aria-label={`Compare ${a.san} and ${b.san}`}` —
  `CompareDrawer` tests and Plan 4 work depend on that accessible name. Add
  `aria-modal` **only if** you also implement full Tab containment; a lying
  `aria-modal` is worse than none.
- Wrap the returned element in
  `createPortal(…, document.getElementById('compare-portal') ?? document.body)`.
  The `?? document.body` fallback is what keeps existing tests that render
  `CompareDrawer` standalone working — **do not remove it**.

- [ ] **Step 5: Style the overlay**

Append to `theme.css`, and change `.compare-drawer`'s `margin-top: 18px` to `0`
— the overlay positions itself now. Leave the `drawer-rise` animation and its
reduced-motion guard exactly as they are.

```css
.compare-portal {
  grid-column: 2 / -1;
  grid-row: 1;
  position: relative;
  pointer-events: none;
  z-index: 5;
}

.compare-portal > * {
  pointer-events: auto;
  position: absolute;
  inset: 0;
  overflow-y: auto;
}

@media not all and (min-width: 1100px) and (min-height: 640px) {
  /* Below the floor there are no columns to span, so it simply flows. */
  .compare-portal { grid-column: 1; position: static; }
  .compare-portal > * { position: static; }
}
```

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one skip, zero warnings. Both call sites — `CandidateRail`'s
non-checkpoint drawer and `CheckpointPanel`'s — must still open and close.
If an existing test asserted the drawer was a DOM descendant of the rail, it
will now fail legitimately: the portal moved it. Report it rather than
deleting it.

- [ ] **Step 7: Commit**

```bash
git add src/ui/CompareDrawer.tsx src/ui/CompareDrawer.test.tsx src/ui/theme.css src/App.tsx
git commit -m "feat(ui): open the comparison as an overlay with real width"
```

---

### Task 7: The progress notice, dismissal, and clearing progress

**Files:**
- Modify: `src/ui/ProgressNotice.tsx` — replace the Task 2 placeholder.
- Modify: `src/ui/LessonPicker.tsx` — remove its notice block only.
- Modify: `src/ui/SavedLines.tsx` — remove its notice block only.
- Modify: `src/ui/AppControls.tsx` — add "Clear progress".
- Modify: `src/progress/storage.ts` — add `clearProgress`.
- Modify: `src/progress/store.ts` — add a `clearAll` action.
- Create: `src/ui/ProgressNotice.test.tsx`

**Interfaces:**
- Consumes: `useProgressStore` — `recovered`, `saveFailed`, `dismissNotice`.
- Produces: `clearProgress(storage?: Storage | null): boolean` in
  `storage.ts`; `clearAll: () => void` on the progress store.

**Why this task exists at all:** `dismissNotice()` (`src/progress/store.ts:67`)
has no caller outside tests, and the notice renders in exactly two places —
`LessonPicker.tsx:70` and `SavedLines.tsx:48` — **both in the left rail, and
both hidden during a lesson under Task 2**. A player whose progress failed to
load would see the notice, start a lesson, and watch it vanish undismissable.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { ProgressNotice } from './ProgressNotice';
import { useProgressStore } from '../progress/store';

describe('ProgressNotice', () => {
  it('renders nothing when there is nothing to say', () => {
    act(() => useProgressStore.getState().dismissNotice());
    const { container } = render(<ProgressNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    act(() => useProgressStore.setState({ recovered: true }));
    render(<ProgressNotice />);
    expect(screen.getByRole('status')).toHaveTextContent(
      /saved progress could not be read/i,
    );
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  // The reason this component exists. Both former render sites are in the
  // left rail, which Task 2 replaces with the lesson rail — so before this
  // change, starting a lesson made the notice vanish undismissable.
  it('stays visible in the header once a lesson starts', () => {
    act(() => useProgressStore.setState({ recovered: true }));
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(
      /saved progress could not be read/i,
    );
    act(() => useLessonStore.getState().startLesson('italian-game'));
    expect(screen.getByRole('status')).toHaveTextContent(
      /saved progress could not be read/i,
    );
  });
});
```

That last test needs `import { App } from '../App';` and
`import { useLessonStore } from '../lesson/store';`. It renders the whole app,
so if the board's `role="status"` announcement region from Task 4 collides with
`getByRole('status')`, scope the query — use `getAllByRole` and assert one of
them matches, or give the notice a `data-testid`. **Report which you did and
why**; a query that silently matched the wrong element is how a test starts
lying.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/ui/ProgressNotice.test.tsx`
Expected: FAIL — the placeholder renders `null`, so the dismiss test finds no
`status` role.

- [ ] **Step 3: Implement `ProgressNotice`**

```tsx
import { useProgressStore } from '../progress/store';
import { Button } from './Button';

/**
 * Lives in the header rather than in a rail. Both previous render sites —
 * LessonPicker and SavedLines — are hidden while a lesson runs, so a player
 * whose progress failed to load could not dismiss the notice: starting a
 * lesson simply took it away and bringing it back required leaving.
 */
export function ProgressNotice() {
  const recovered = useProgressStore((store) => store.recovered);
  const saveFailed = useProgressStore((store) => store.saveFailed);
  const dismissNotice = useProgressStore((store) => store.dismissNotice);

  if (!recovered && !saveFailed) return null;

  return (
    <p role="status" className="progress-notice">
      {recovered
        ? 'Your saved progress could not be read, so it is starting fresh.'
        : 'Progress is not being saved — your browser storage is full or unavailable.'}
      <Button variant="ghost" onClick={dismissNotice} aria-label="Dismiss this notice">
        Dismiss
      </Button>
    </p>
  );
}
```

Keep the two message strings byte-identical to the ones being removed from
`LessonPicker` — `LessonPicker.test.tsx` asserts on them, and changing the
copy here turns a passing test into a puzzle.

- [ ] **Step 4: Remove the duplicate notices**

From `LessonPicker.tsx`, delete the `{(recovered || saveFailed) && (…)}` block
and the now-unused `recovered` / `saveFailed` selectors. Keep everything else,
including the `lessonId` early return.

From `SavedLines.tsx`, delete the `{saveFailed && (…)}` block and its selector.
Note this one's wording differs ("This line was not saved…"); it goes, because
the header now owns the general case. Keep `aria-label="My lines"`, the save
button, and the list.

- [ ] **Step 5: Add `clearProgress` to `src/progress/storage.ts`**

`reset()` on the store reloads *from storage* — it does not clear it — so
clearing needs a real removal.

```ts
/**
 * Removes stored progress entirely. Returns false when storage is
 * unavailable — some privacy modes throw on the act of touching it.
 */
export function clearProgress(storage: Storage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Add `clearAll` to the progress store**

Add `clearAll: () => void` to the `ProgressStore` interface and implement it
beside `reset`. It clears storage, clears the module-level `recorded` set, and
sets empty progress. Import `emptyProgress` from `./progress` and
`clearProgress` from `./storage`.

```ts
clearAll: () => {
  recorded.clear();
  const ok = clearProgress();
  set({ progress: emptyProgress(), recovered: false, saveFailed: !ok });
},
```

- [ ] **Step 7: Add the control to `AppControls.tsx`**

Add a third `Button` reading "Clear progress". It is destructive and writes to
durable storage, so it confirms first: local `useState` toggles the label to
"Really clear?" and only a second click calls `clearAll()`. Reset the
confirming state after acting. Do **not** use `window.confirm` — a modal
dialog blocks the page and the project's browser-automation notes call this
out explicitly.

Keep `newGame` and the sound toggle exactly as they are, including
`aria-pressed={muted}`.

- [ ] **Step 8: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one skip, zero warnings. `LessonPicker.test.tsx` has two tests
calling `dismissNotice()` — check whether they assert on the notice rendering
inside the picker. If they do, they move to `ProgressNotice.test.tsx`. Report
which moved.

- [ ] **Step 9: Commit**

```bash
git add src/ui/ProgressNotice.tsx src/ui/ProgressNotice.test.tsx src/ui/LessonPicker.tsx src/ui/SavedLines.tsx src/ui/AppControls.tsx src/progress/storage.ts src/progress/store.ts
git commit -m "feat(ui): move the progress notice to the header and let it be dismissed"
```

---

### Task 8: Remove the dead `pinned` field

**Files:**
- Modify: `src/tree/tree.ts`
- Modify: `src/tree/tree.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `GameTree` without `pinned`.

`GameTree.pinned` (`src/tree/tree.ts:33`) is initialised to `[]` in
`createTree` and never written to anywhere. `evict()` honours it and
`tree.test.ts:134` covers it, so the branch is tested and permanently
unreachable in production.

- [ ] **Step 1: Confirm it really is dead before deleting anything**

Run: `npx grep -rn "pinned" src/ --include=*.ts --include=*.tsx` — or use your
editor's search. Expected: matches in `src/tree/tree.ts`, `src/tree/tree.test.ts`,
and unrelated matches in `src/chess/tactics.ts`, `src/explain/rules.ts` and
`src/content/lessons/theme-forks-and-pins.ts` where "pinned" is a chess term
about pins, not tree nodes. **Those are not yours — leave them.**

If you find any write to `tree.pinned` outside `createTree`, **stop and
report**: the field is live and this task is wrong.

- [ ] **Step 2: Remove the field**

In `src/tree/tree.ts`: delete the `pinned: NodeId[]` member and its doc
comment from the `GameTree` interface, delete `pinned: []` from `createTree`,
and remove `...tree.pinned,` from the `protectedIds` set in `evict`.

Update `evict`'s doc comment: it currently reads "Nodes on the selected path,
pinned nodes, and authored nodes keep their eval regardless of the cap." Drop
"pinned nodes," — a comment describing a removed mechanism is worse than no
comment.

- [ ] **Step 3: Remove the test**

Delete the `'keeps evals on pinned nodes regardless of the cap'` test at
`src/tree/tree.test.ts:134`. It is the only test that writes `pinned`.

Do **not** touch the neighbouring eviction tests — authored-node protection and
selected-path protection are live behaviour with real callers.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run typecheck`
Expected: PASS, one skip, zero warnings. `typecheck` is what proves no other
file constructed a `GameTree` literal with `pinned`.

- [ ] **Step 5: Commit**

```bash
git add src/tree/tree.ts src/tree/tree.test.ts
git commit -m "refactor(tree): remove the pinned field, which nothing ever set"
```

---

### Task 9: Browser verification

**Runs before the whole-branch review, not after.** Every plan with a UI has
shipped defects past a green suite — four past 223 tests, three lessons
half-unreachable past 318. Running this first means the final reviewer triages
real findings instead of a list it cannot see.

**Files:**
- Modify: `docs/superpowers/plans/spike-results-shell.md` — append findings.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify the shell**

At a normal desktop window: the page does not scroll; the board is square and
fills the centre; both rails scroll inside themselves when their content is
long. Then make the window short (under 640px tall) and narrow (under 1100px
wide) and confirm the single-column fallback appears, in the order board,
candidates, picker, saved lines.

- [ ] **Step 3: Verify keyboard navigation — the three never-observed paths**

This is the first time these can be driven without a mouse. `Lessons.md` §6
records that answering a checkpoint, the wrong-answer reply, and segment-level
board orientation after "Next part" have **never** been verified by hand.

Tab to the board, then with the keyboard: answer a lesson checkpoint correctly
and watch the record appear; answer one wrongly and read the authored
near-miss reply; take "Next part" and confirm the board flips to Black's side
for a segment whose `side` is black.

- [ ] **Step 4: Verify the notice and clear-progress**

In the console: `localStorage.setItem('chesstrainer.progress.v1', 'not json')`,
reload, confirm the header notice appears, start a lesson, confirm **it is
still there**, and dismiss it. Then use "Clear progress", confirm the two-click
confirmation, and reload to confirm progress is genuinely gone.

- [ ] **Step 5: Record what you saw, including what you could not check**

Append to `spike-results-shell.md`. "I could not verify this" is a more useful
sentence than a guess — it is one of the two most valuable things a report here
has produced.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/spike-results-shell.md
git commit -m "docs: record the browser verification pass for the app shell"
```

---

## Vault updates — part of the work, not a follow-up

Before this branch is reported complete:

- `Current State.md` — the shell, keyboard navigation, header notice, clear
  progress, and the removal of `pinned`.
- `Architecture.md` — the shell's three regions and the rule that the board
  column never moves.
- `Known Issues.md` — remove the board-automation blocker if Task 9 confirms
  keyboard navigation closes it. Do not leave a tombstone.
- `Lessons.md` §6 — the "Known blocker" paragraph names keyboard navigation as
  the fix. Update it with what actually happened.
- `Decisions/` — one note for the single-focusable-widget keyboard model over a
  `role="grid"` board, since it is a choice with consequences past this change.
- `Start Here.md` — last, and always.
