---
updated: 2026-08-10
status: current
tags: [chesstrainer, decision, accessibility]
---

# Decision: the board is one focusable widget, not a grid of 64 cells

**Date:** 2026-08-09, Plan 5.

## Context

The design spec required keyboard board navigation, and `react-chessboard` is a
third-party component that renders its own DOM. Two separate needs pointed at
the same feature: accessibility, and the fact that **nothing requiring a piece
to move could be verified without a human** — the board handled only
drag-and-drop drops, synthetic drags never reached it, and a pointer-event
sequence had once frozen the renderer.

## The choice

The board wrapper is a single focusable element (`tabindex="0"`,
`role="application"`) with a cursor held in React state. Arrows move the cursor,
Enter picks up and places, Escape puts down. A visually-hidden
`aria-live="polite"` region announces each square with its occupant, and
announces illegal attempts without playing them.

The cursor and pick-up highlights render by **merging into
`react-chessboard`'s existing `squareStyles` prop** — the same mechanism the
last-move highlight already used. Moves resolve through the existing
`resolveDrop`, so promotion, castling and the move sound are identical to a
drag. The arithmetic itself lives in `src/chess/boardCursor.ts`, which is pure
and React-free, so orientation handling is unit-testable without rendering
anything.

## Alternatives rejected

**A true `role="grid"` of 64 focusable cells.** Better assistive-technology
practice, and the honest answer if this were our own board. Rejected because it
means shadowing a third-party component's DOM and keeping two representations
in sync — a durable source of drift, for a board whose internals we do not
control. The single-widget pattern is well established for board and canvas
interfaces and will not rot.

**Typing moves in SAN**, as some chess sites offer. Simpler to build and it
matches how experienced players think — but it requires knowing notation, which
is a mismatch for a trainer aimed at improving beginners.

## What this makes harder

A screen-reader user gets a live region rather than a navigable grid: they can
hear what is under the cursor, but cannot Tab through squares or have the
board's structure conveyed natively. If the project ever adopts its own board
renderer, revisit this.

There are also now **two `role="status"` regions inside the board wrapper** —
ours and `react-chessboard`'s own assertive one from `@dnd-kit/accessibility`.
Harmless, but it means a naive `querySelector('[role="status"]')` finds theirs
first, which is a trap for future tests and was one during verification.

## What it bought

Accessibility and an automatable input path in one change. Two of the three
behaviours this project had never once observed were watched working on
2026-08-10 as a direct result — see [[Current State]].

Related: [[Architecture]], [[Current State]], [[Known Issues]].
