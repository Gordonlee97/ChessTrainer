---
updated: 2026-08-04
status: current
tags: [chesstrainer, decision, engine]
---

# Decision: normalize evaluations to White-relative at the UCI boundary

**Date:** 2026-08-03 (post-review fix wave 1)
**Where:** `src/engine/types.ts` (`PvLine`), `src/engine/engine.ts`

## Context

UCI reports scores **relative to the side to move**. `cp 50` means "the player to
move is up half a pawn" — so on Black's turn, a positive score is good for Black.

Rendered naively, the eval bar reads backwards on every Black move. This was a
real bug found in review, not a hypothetical.

## Decision

**Normalize once, at the UCI boundary.** Everything above `src/engine/` sees
White-relative scores: positive is good for White, always. `PvLine` documents
this in its type definition.

## Why at the boundary

The alternative — normalizing at the display layer — means every consumer has to
know the convention and remember to apply it. That is one forgotten call site
away from a bug that looks like the engine being wrong, and it would have to be
re-remembered by the explainer, the compare drawer, and the lesson grader.

Normalizing once means the rest of the codebase can treat "positive is good for
White" as a fact.

## What this makes harder

- **The boundary must be the only place it happens.** A second normalization
  anywhere above it silently double-flips. This is why `PvLine`'s doc comment
  states the convention rather than leaving it implicit.
- **Mate scores need the same treatment**, and their sign convention is
  separately confusing: a negative mate value means the side being evaluated is
  getting mated, and `mate: 0` is a real value distinct from "no mate". Formatting
  those correctly was its own fix (`formatScore`).
- Anyone reading raw UCI output while debugging will see the un-normalized sign
  and must remember the two do not match.

Related: [[Architecture]], [[Glossary]].
