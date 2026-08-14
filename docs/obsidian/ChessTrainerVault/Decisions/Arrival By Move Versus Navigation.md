---
updated: 2026-08-13
status: current
tags: [chesstrainer, decision, tree, lesson]
---

# Decision: the store records how a node was reached, not just which one

**Date:** 2026-08-13 (during Plan 6's third browser pass)
**Where:** `src/tree/store.ts` — `lastPlayedId`; `src/ui/useLessonAutoplay.ts`

## Context

Autoplay has to answer one question: *has the player just answered, and is owed
the opponent's reply?* Until now it inferred that from the destination — if the
selected node had no children it was the tip of the line, so the player must
have just arrived by moving.

That inference is wrong, and the browser found it. `insertMove` **reuses an
existing node when the same move is replayed from the same parent** (see
[[Decisions/Transposition Identity]]). So a player who steps back to `start` and
plays `e4` again lands on the *same node as before*, which already carries the
opponent's `e5` as a child. To the guard that is indistinguishable from stepping
back to review, and it declined. The opponent never moved; and since it was then
not the player's turn, `CheckpointPanel` had nothing to render either. The
lesson stopped dead with a blank rail and no forward control to escape with.

The two cases differ in exactly one thing, and it is not a property of the node:
one is a **move**, the other is a **navigation**. The destination is identical.

## Decision

**`useTreeStore` records `lastPlayedId` — the node the most recent `playMove`
landed on — and clears it on `selectNode` and `reset`.** Autoplay runs only when
`lastPlayedId === selectedNode.id`.

Rejected: selecting the existing reply child when one is found. It fixes the
dead-end, but it also drags a reviewing player forward the moment they step back
onto a node whose reply already exists — the very behaviour the original guard
was written to prevent.

Rejected: a "player moved" flag in the lesson store. The transition belongs to
whoever performs it, and `playMove` is in the tree store; a second store
observing the first would have to guess at ordering.

## Why this does not violate "the tree is the source of truth"

It is worth being precise, because the constraint in `CLAUDE.md` is strict and
this looks adjacent to breaking it.

`lastPlayedId` is **not** a parallel source of position state. It never decides
what is on the board, which node is selected, or what a node contains — the tree
answers all three, alone, exactly as [[Decisions/Game Tree As Source Of Truth]]
requires. It records a fact about the *transition* that the tree deliberately
does not keep: the tree is a structure of positions, and the same node is the
same node however you got there. That is the right design for a game tree and
the reason the information had to live somewhere else.

## What this makes harder

- **It is a second thing `playMove` and `selectNode` must keep honest.** A
  future action that changes the selection without going through either — a
  jump-to-node, an undo, Plan 7's moves table — must decide what it means for
  arrival, and forgetting to will silently re-open this bug. The field's
  docstring says so; the moves table is the next thing that will have to answer
  it.
- **It is not observable from the tree**, so a test that reasons only about tree
  shape cannot see it. `useLessonAutoplay.test.tsx` asserts on behaviour through
  the hook instead, which is the right level but a slower one to write.

## Evidence

The guard's replacement was mutation-checked in both directions on 2026-08-13:
the new test fails with `['e4']` against the old tip check, and disabling the
new guard makes the pre-existing review test fail with `root/e4/e5` where it
expects `root/e4` — so the new condition genuinely carries the protection the
old one provided, rather than merely coexisting with it.
