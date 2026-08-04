---
updated: 2026-08-04
status: current
tags: [chesstrainer, decision, engine]
---

# Decision: one MultiPV search, not three searches

**Date:** 2026-08-01 (design spec)
**Where:** `src/ui/useAnalysis.ts` (`MULTI_PV = 3`), `src/engine/engine.ts`

## Context

The candidate rail shows the engine's top three moves. The obvious
implementation is three searches — one per candidate — or a search followed by
two more with the best move excluded.

## Decision

**Set `MultiPV=3` and take all three lines from a single search.**

## Why

- **Cost.** Three searches at depth 20 is roughly three times the work for
  results the engine computes anyway while finding the best move.
- **Consistency.** Lines from one search are evaluated at the same depth against
  the same search tree, so their scores are directly comparable. Scores from
  three independent searches are not, and the candidate rail's whole job is
  comparison.
- **Ordering is free.** MultiPV returns lines best-first.

## What this makes harder

- **The parser must handle interleaved `multipv` indices.** `info` lines for all
  three variations stream together and must be demultiplexed by their `multipv`
  field, not assumed to arrive in order. Handled in `src/engine/parseInfo.ts`.
- **Fewer lines than requested is normal**, not an error — near the end of a game
  there may be only one or two legal moves. The rail must render whatever
  arrives, and a finished analysis with zero lines is not necessarily checkmate
  (a PV can be filtered as illegal, or `bestmove` can arrive before any
  pv-bearing `info`). `CandidateRail` distinguishes these cases deliberately.
- **Depth is shared.** All three lines refine together; there is no way to search
  the top candidate deeper than the others without a second search. The compare
  drawer may want that later — it walks two PVs out ~8 plies, which this search
  already supplies.

Related: [[Architecture]], [[Glossary]].
