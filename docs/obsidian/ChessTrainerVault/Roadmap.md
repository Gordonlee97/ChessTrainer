---
updated: 2026-08-06
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
`feat/teaching-layer`, **merged to `master` 2026-08-05 as PR #2**. Pawn-structure features and fork/pin
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

**Plan 3 — the teaching layer.** Eight tasks, complete 2026-08-05 on
`feat/content-and-lessons` (not yet merged). The content pipeline
(`src/content/schema.ts`, `load.ts`) with a validator that replays every
authored move, checkpoint answer, near-miss key and alternative through
chess.js; seven authored lessons; the runner (`src/lesson/`) that derives its
state from the tree and stores no position; the lesson rail with tiered hints
and graded near misses; the picker; and authored pros and cons feeding the
compare drawer. Plan:
`docs/superpowers/plans/2026-08-05-content-and-lessons.md`.

**Reviewed and fixed 2026-08-05.** The whole-branch review found the lessons
delivered less than they claimed and one taught a move that loses by force. One
fix wave of nine items closed it (suite 246 → 343). [[Current State]] has the
before/after table; three findings were left, in [[Known Issues]].

**Plan 4 — Progress, saved lines, and controls.** Six tasks, complete
2026-08-06 on `feat/progress-and-controls` (not yet merged). Segment-level
board orientation (settling the decision that gated this plan); the progress
schema, pure reducers, and resilient localStorage I/O in `src/progress/`; the
progress store recording checkpoint outcomes and lesson completion; progress
shown in the picker; saved lines stored as PGN plus starting FEN
(`src/chess/pgn.ts`, `src/ui/SavedLines.tsx`); and the new-game control plus a
persisted mute toggle (`src/ui/AppControls.tsx`). Plan:
`docs/superpowers/plans/2026-08-06-progress-and-controls.md`.

**Reviewed and fixed 2026-08-06.** The whole-branch review found cross-task
drift the six task-scoped reviews could not see: ten `act()` warnings, a saved
line reopened during a running lesson that could record a checkpoint the
player never answered, a durable-data bug in checkpoint recording for a
multi-entry `accept` (dormant — no lesson has one yet), a save failure with
nowhere to surface it once a lesson stopped running, and a dead re-export. One
fix wave of five items closed it. [[Current State]] has the before/after
table; what was found and deliberately left is in [[Known Issues]].

## Next: browser verification, then Plan 5

**Nothing in Plan 4 has been watched in a browser.** That is the next action —
see [[Start Here]] for the manual checklist.

### Plan 5 — App shell and keyboard navigation

Not yet written. Two things Plan 4 explicitly deferred because both are shell
work and belong together:

- **A properly designed `App.tsx` layout.** Currently an inline-styled flex
  shell now hosting the picker, lesson rail, saved lines, and app controls
  stacked with no design pass.
- **Keyboard board navigation.** The spec's outstanding accessibility
  requirement.

Also on the table for Plan 5 or whichever plan revisits the compare drawer:

- **The compare drawer's contrast vocabulary**, which [[Known Issues]] records
  as needing a design decision rather than a patch.
- **More authored `alternatives`.** One move in the whole corpus carries them.

## Also queued

Small, and each has a stated reason for existing:

- **A way for a player to clear their own progress**, and a dismiss control
  for the recovered/save-failed notices — `dismissNotice()` exists and is
  tested but has no caller. See [[Known Issues]].
- **Wire `tree.pinned` to saved lines, or remove it.** Currently dead — saved
  lines are PGN, not node ids, so nothing populates it. See [[Known Issues]].

## Deliberately not planned

- No end-to-end suite in v1 — deferred on purpose.
- Everything in the out-of-scope list in [[Project Overview]].

## Still undecided

Nothing gating.

- **The comparison's contrast vocabulary.** `summarise` can distinguish two
  lines on five features, and two strong openings usually score identically on
  all of them — so the honest verdict is "these are the same, choose on feel."
  Widening that (pawn structure, open vs closed, which minor came out, space) is
  what makes compare teach rather than describe. Decide the *shape* of the
  vocabulary before adding another feature to `summarise`. Detail in
  [[Known Issues]].
- **Whether the compare drawer is really a modal.** It claims `role="dialog"`
  without `aria-modal`, a focus trap, or Escape. Either implement those or make
  it a labelled section. Cheapest once Plan 5 rebuilds the layout anyway.
- **How the lesson rail should display a correct answer from a multi-entry
  `accept` list.** The *recorded* outcome was fixed 2026-08-06; the rail still
  shows "stepped off the line" for it. See [[Known Issues]].

Also queued and small: `MiniBoard` gives screen-reader users no position
information, and compare is hardwired to the top two candidates. Both in
[[Known Issues]].
