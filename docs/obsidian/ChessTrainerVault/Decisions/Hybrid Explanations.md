---
updated: 2026-08-04
status: planned
tags: [chesstrainer, decision, explain]
---

# Decision: hybrid explanations — authored where it matters, rules everywhere else

**Date:** 2026-08-01 (design spec)
**Status:** decided, **not yet implemented** — `src/explain/` does not exist. See
[[Roadmap]].

## Context

The product's central promise is explaining *why* one move beats another in
words a beginner can use. Three ways to do that:

1. **Author everything.** Best quality, but only covers positions someone wrote
   about — and the explorer's whole point is that players leave the book.
2. **Generate everything from rules.** Full coverage, uniformly mediocre prose.
3. **Call an LLM.** Good prose, but API cost, latency, no offline use, and
   non-determinism in a teaching tool.

## Decision

**Hybrid.** Authored annotations for curated openings; a rule-based explainer for
anything off-book. **Authored annotations take precedence where they exist.**

LLM-written explanations are explicitly out of scope for v1.

## The division of labour

> **The engine supplies the magnitude, the rules supply the vocabulary.**

Centipawn loss relative to the best move picks the severity band:

| Loss (cp) | Band |
|---|---|
| ≤ 20 | Best / excellent |
| ≤ 50 | Good |
| ≤ 100 | Inaccuracy |
| ≤ 250 | Mistake |
| > 250 | Blunder |

Rules read a before/after feature pair and emit `Reason` objects tagged
`center | development | king-safety | material | fork | pin | hanging | tempo |
pawn-structure | mobility | space`, each with a polarity and a weight. The top
two or three by weight render as prose.

So the engine never has to explain itself, and the rules never have to judge how
bad a move is.

## Calibration rule

When two candidates differ by less than roughly **0.3**, the verdict must say
*"practically equal — the real difference is character"* and lead with the
structural contrast.

This is a teaching decision, not a display preference. Telling a beginner that
+0.31 beats +0.28 would teach them something false about how chess works.

## Why this shape is testable

The explainer is pure — no React, no DOM — so every rule can be pinned by a
**FEN fixture table**. The spec identifies this as the highest-value testing in
the project, and it is the main reason the core is kept React-free (enforced by
`src/test/purity.test.ts`).

## What this makes harder

- **Two sources of prose must not contradict each other.** Precedence is defined
  (authored wins), but an authored note that disagrees with the generated
  reasoning will read as the app arguing with itself.
- **Rule weights are a tuning problem with no obvious ground truth.** Fixture
  tables pin behaviour; they do not tell you the weights are *right*.
- **Coverage gaps are silent.** A position where no rule fires produces no
  explanation, and it will not be obvious which positions those are without
  looking.
- Needs **pawn-structure feature extraction**, which `extractFeatures` does not
  have yet.

Related: [[Project Overview]], [[Roadmap]], [[Architecture]].
