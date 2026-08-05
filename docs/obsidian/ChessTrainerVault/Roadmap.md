---
updated: 2026-08-05
status: current
tags: [chesstrainer, roadmap]
---

# Roadmap

## Done

**Plan 1 — Foundation and line explorer.** Nine tasks, complete 2026-08-03.
Board, eval bar, breadcrumb, candidate rail, the immutable game tree, the UCI
engine wrapper, the sound layer, and the theme. See [[Current State]] for what
that actually gets you. **Merged to `master` 2026-08-04 as PR #1** (merge commit,
not squash — the engine's revision-by-revision history is worth keeping).

**Plan 2 — The explainer and compare.** Nine tasks, complete 2026-08-04 on
`feat/teaching-layer` (not yet merged). Pawn-structure features and fork/pin
detection (`src/chess/pawnStructure.ts`, `src/chess/tactics.ts`); a FEN-keyed
eval cache so transposed positions are analysed once (`src/engine/evalCache.ts`);
move-quality banding (`src/explain/quality.ts`); the rule-based explainer with a
FEN fixture table (`src/explain/rules.ts`, `src/explain/explain.ts`); quality
badges and one-line ideas on every candidate row (`src/ui/QualityBadge.tsx`,
`CandidateRail.tsx`); line comparison with a calibrated verdict
(`src/explain/compare.ts`); and the compare drawer itself
(`src/ui/CompareDrawer.tsx`, `src/ui/MiniBoard.tsx`). `framer-motion` was
removed as an unused dependency — the drawer's entrance animation is a CSS
keyframe.

**Browser-verified and fixed 2026-08-04/05.** Hands-on testing plus a
whole-branch review found that the output layer said roughly the same thing
about every move; one fix wave of nine items closed it (suite 223 → 246). See
[[Current State]] for the before/after table, [[Known Issues]] for what was
deliberately left, and [[Architecture]] for the `src/explain/` layer.

## Next: Plan 3 — the lesson layer

Not yet written as a plan document. This is the ordering the design spec
implies.

### 1. Content pipeline — `src/content/`

Zod schema plus a validating loader. A test replays every authored `san` through
chess.js, so a typo fails the suite instead of blanking the board at runtime.

Then the v1 content itself: 3 openings and 4 theme lessons, listed in
[[Project Overview]].

### 2. Lesson runner — `src/lesson/`

Derives the current step from the tree selection; grades checkpoints; serves
three hint tiers. Behaviour the spec pins down:

- At a checkpoint the **candidate rail hides** so it cannot leak the answer.
- `nearMiss` moves get their authored reply, not a generic "wrong".
- Going off-script is **not an error state** — a "return to lesson" pill waits in
  the rail until taken.

### 3. Progress persistence — `src/progress/`

Versioned localStorage: lesson completions, checkpoint accuracy, saved lines.
Two schema decisions already made and worth not re-litigating:

- Checkpoints are keyed by their **authored `id`**, not by position index, so
  inserting a move into a lesson does not silently reassign past results.
- Saved lines are stored as **PGN**, not node paths — portable, replayable, and
  immune to changes in the tree's addressing scheme.

## Also queued for Plan 3

Small, and each has a stated reason for existing:

- **Mute toggle UI.** `SoundManager` already honours mute; nothing exposes it.
- **Keyboard board navigation.** Spec accessibility requirement.
- **A real `App.tsx` layout.** Currently a placeholder shell.
- **A new-game control.** The store's `reset` action has no caller.

## Deliberately not planned

- No end-to-end suite in v1 — deferred on purpose.
- Everything in the out-of-scope list in [[Project Overview]].

## Decide before Plan 3 is written

Nothing gating, unlike Plan 2. Two things want a decision rather than a patch:

- **The comparison's contrast vocabulary.** `summarise` can distinguish two
  lines on five features, and two strong openings usually score identically on
  all of them — so the honest verdict is "these are the same, choose on feel."
  Widening that (pawn structure, open vs closed, which minor came out, space) is
  what makes compare teach rather than describe. Decide the *shape* of the
  vocabulary before adding another feature to `summarise`. Detail in
  [[Known Issues]].
- **Whether the compare drawer is really a modal.** It claims `role="dialog"`
  without `aria-modal`, a focus trap, or Escape. Either implement those or make
  it a labelled section. Cheapest while `App.tsx` is still a placeholder and the
  layout is about to be rebuilt anyway.

Also queued and small: `MiniBoard` gives screen-reader users no position
information, and compare is hardwired to the top two candidates. Both in
[[Known Issues]].
