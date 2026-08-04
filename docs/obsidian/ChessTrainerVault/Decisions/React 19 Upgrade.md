---
updated: 2026-08-04
status: current
tags: [chesstrainer, decision, stack]
---

# Decision: React 19, not the spec's React 18

**Date:** 2026-08-02 (Task 1)
**Where:** `package.json`

## Context

The design spec names **React 18**. During setup, `react-chessboard@5.10.0` — the
board surface the whole UI is built on — declares a peer dependency of
`react: ^19.0.0`.

## Decision

**Upgrade to React 19.** Landed on react/react-dom 19.2.8, `@types/react`
19.2.18, `@types/react-dom` 19.2.4.

Not really a choice: the alternative was pinning react-chessboard to v4, whose
prop API is entirely different (v5 takes a single `options` object;
`onPieceDrop` receives `{ piece, sourceSquare, targetSquare }`). A plan written
against v4 would have been wrong at every board touchpoint.

## Consequence that caught us out

**React 19 runs effect cleanups in declaration order, not reverse.**

This matters in `useAnalysis`: `Engine.dispose()` runs *before* the hook's
`controller.abort()`. The original reasoning about StrictMode safety was written
assuming reverse order and was simply wrong.

There is no leak — but only because `dispose()` cancels in-flight searches
itself. That is now documented in a comment so a refactor cannot quietly
reintroduce a leaked Worker by changing which cleanup does the cancelling.

## Open item

**The spec still says React 18** and has not been amended. Specs are what future
plans get written against, so this drift will propagate. Tracked in
[[Known Issues]].

## What this makes harder

- Any React 18 guidance found online about cleanup ordering is wrong for this
  codebase.
- The board API is pinned to react-chessboard v5's shape; upgrading or replacing
  it touches every board interaction.

Related: [[Architecture]], [[Known Issues]].
