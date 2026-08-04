---
updated: 2026-08-04
status: current
tags: [chesstrainer, decision, architecture]
---

# Decision: a single immutable game tree is the source of truth

**Date:** 2026-08-01 (design spec)
**Where:** `src/tree/tree.ts`, `src/tree/store.ts`

## Context

The app has to support three things that usually fight each other: exploring a
line and returning without losing it, comparing two sibling candidates, and
running a lesson that the player can wander away from and come back to.

Implemented separately, each becomes a special case with its own state.

## Decision

**Every position in a session is a node in one immutable tree.** Navigating
selects a node; exploring inserts one. Lessons are a curated *path* through the
same tree, with notes and checkpoints attached to its nodes — not a separate
mode with separate state.

Nodes carry an `origin` of `authored` or `explored`, which is what makes lesson
content and player exploration coexist without a second data structure.

## Consequences that fall out for free

- **Branch-off-and-return** is just selecting a different node; the old subtree
  is still there.
- **Compare** is two siblings of the same parent.
- **Going off-script in a lesson is not an error state.** The player is simply on
  a node that isn't on the authored path, so a "return to lesson" pill can point
  back at one that is.
- **Eval memoisation** attaches to the node, so navigating back to a position
  costs nothing.

## Growth control

Explored nodes are capped at ~1000, evicted least-recently-selected, leaves
first. Authored nodes and anything referenced by "My Lines" are pinned.

**Eviction discards only the cached `eval`, never a node.** The tree only grows;
memory is bounded by dropping evaluations, not history. An earlier
implementation removed nodes and was reverted to the spec — removing a node the
player can still navigate to is a correctness bug, not an optimisation.

## Alternatives rejected

- **A move list plus an undo stack.** Standard, simple, and cannot represent two
  live sibling lines at once — which is the product's core feature.
- **Separate lesson state machine.** Would make "wander off and come back" a
  special case, and would duplicate position handling.

## What this makes harder

- **Node identity matters more than it looks.** Ids are SAN paths, so
  transpositions currently duplicate. See [[Known Issues]] — this must be
  settled before Plan 2 leans on identity.
- Immutability means every mutation replaces node objects, which is why
  `useCurrentPath` needs `useShallow`; without it, `pathTo()` returns a fresh
  array each render and Zustand v5 re-renders forever. That bug was hit once.
- Anything that wants to be "the current position" must go through the tree.
  There is no second source, deliberately.

Related: [[Architecture]], [[Project Overview]].
