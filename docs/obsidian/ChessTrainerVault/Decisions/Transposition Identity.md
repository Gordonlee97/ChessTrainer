---
updated: 2026-08-04
status: current
tags: [chesstrainer, decision, tree]
---

# Decision: the tree stays a tree; evals dedupe by FEN

**Date:** 2026-08-04 (before Plan 2)
**Where:** `src/tree/tree.ts`, and the eval cache Plan 2 adds

## Context

Node ids are SAN paths — `"root/e4/e5/Nf3"`. The same position reached by a
different move order therefore produces two nodes with the same FEN. The Italian
via `1.e4 e5 2.Nf3 Nc6 3.Bc4` and via `1.e4 e5 2.Bc4 Nc6 3.Nf3` are two distinct
nodes holding one position.

Deduplication today only covers replaying the *same move from the same parent*.
This was raised as a blocker for Plan 2, because both lesson state and "My Lines"
key off node identity.

## Decision

**Keep the path-addressed tree exactly as it is. Move engine evaluations into a
separate cache keyed by FEN, shared across transpositions.**

Rejected: making the tree a DAG with one node per position.

## Why

- **The expensive part is the analysis, not the node.** A `TreeNode` is a FEN
  string, a move, and some ids. Re-analysing a position at depth 20 costs
  ~975ms; storing it twice costs almost nothing. A FEN-keyed eval cache removes
  the cost that actually hurts and leaves the cheap duplication alone.
- **A DAG breaks navigation.** `pathTo` walks `parentId` to the root, and the
  breadcrumb is that path rendered. With multiple parents there is no single
  answer to "how did I get here", which is precisely the question the breadcrumb
  exists to answer.
- **Chess positions repeat.** A position can recur after a shuffle, so a
  FEN-keyed graph can contain cycles. `pathTo` has no cycle cap
  (see [[Known Issues]]), and eviction's "leaves only" rule assumes a tree.
  A DAG turns two currently-simple functions into graph algorithms.
- **Path identity is arguably correct for teaching.** A lesson *is* a scripted
  path, and move order is itself a teaching point — reaching the Italian by a
  different order is a different lesson context even at an identical position.
  "My Lines" is stored as PGN, which is path-shaped by construction.

## What this makes harder

- **Two nodes can disagree about the same position** if only one has been
  analysed. The FEN-keyed cache is what keeps them consistent, so it must be
  read on node selection, not only written after a search.
- **"Have I seen this position before?"** is not answerable from node identity.
  Any future feature that needs it — a repetition warning, a "you already
  explored this" hint — needs the FEN index, not the tree.
- **The eval cache needs its own eviction.** It is now a second unbounded map.
  Plan 1's node eviction clears evals from nodes; that no longer frees the
  cached analysis, so the cache needs a bound of its own.

Related: [[Decisions/Game Tree As Source Of Truth]], [[Architecture]],
[[Known Issues]].
