---
updated: 2026-08-17
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

**Plan 5 — App shell and keyboard navigation.** Eight tasks plus a browser
pass, complete 2026-08-10, **merged to `master` as PR #6**. A one-screen CSS
grid shell whose board column never moves; keyboard board navigation
(`src/chess/boardCursor.ts`, the layer in `src/ui/Board.tsx`); the checkpoint
panel that takes the candidate rail's column and holds the hint ladder;
compare as a portalled overlay; the progress notice moved to the header with a
dismiss control and a two-click "Clear progress"; and the dead `tree.pinned`
field removed. Plan:
`docs/superpowers/plans/2026-08-09-app-shell-and-keyboard.md`.

**Reviewed and fixed 2026-08-10.** The opening spike refuted the plan's own
board-sizing CSS before anything was built on it (measured at 8x8px; container
query units replaced it). The whole-branch review then found the checkpoint
prompt and hints sitting behind the engine-status early returns — with the
engine unavailable a lesson was **unanswerable** while the banner claimed
otherwise — plus two engine searches per checkpoint, "Clear progress" undoing
itself mid-lesson, and a deleted assertion. One fix wave and a scoped
re-review closed all four (suite 410 → 443).

**This plan resolved the automation blocker.** The board can now be driven by
keyboard, so two behaviours never once observed in this project were watched
working. See [[Lessons]] §6.

**Plan 6 — The lesson quiz loop.** Ten tasks, complete 2026-08-13, **merged
2026-08-13/14** as PR #7 (the plan) and PR #8 (two fixes a third browser pass
found after #7 had already merged). Opening lessons became a move-by-move
quiz: every player-side move asked, wrong answers rejected before they reach the
game tree, the opponent replying automatically. Lessons moved to a header
dropdown so the base page is the explorer, and the left rail became the lesson's
explanation. Content: 24 checkpoints, 72 hints, 110 near-miss replies. Plan:
`docs/superpowers/plans/2026-08-11-lesson-quiz-loop.md`; spec:
`docs/superpowers/specs/2026-08-11-lesson-loop-and-moves-table-design.md`.

**Reviewed and fixed 2026-08-13.** An opening spike engine-checked all 24 taught
moves at depth 18 before any prose was written (all CLEAR). The whole-branch
review then found autoplay leaking into the four theme lessons the plan twice
promised to leave alone, and a feedback mark that never expired where autoplay
did not run; both fixed. Three commits during authoring corrected *false chess
claims* in hints — see [[Lessons]] §9.

**A third browser pass (2026-08-13/14) found what three reviews had not**, and it
took PR #8 because #7 merged first: replaying a move after stepping back
dead-ended the lesson outright, and the feedback mark had never once been on the
board — 210.5px low, on the second rank. Both were found by driving the board's
*keyboard* layer, which is automatable even though drag-and-drop is not. See
[[Decisions/Arrival By Move Versus Navigation]] and [[Lessons]] §10.

**Plan 7 — The moves table.** Six tasks plus a browser pass, complete
2026-08-15 on `feat/moves-table`, **merged 2026-08-17 as PR #10**. A
lichess-style numbered move list — move number, White's move, Black's move —
**replaces `Breadcrumb.tsx`**: click any move to jump to that position, arrows
to step through when the table has focus, first/previous/next/last controls
below it. Linear, never rendering a branch; where a node has several children
it follows the most recently visited (`TreeNode.lastSelectedAt`). Derivation is
pure and unit-tested without rendering (`src/tree/movesTable.ts`); the
component (`src/ui/MovesTable.tsx`) stores nothing. Along the way: the
tip-of-line autoplay guard now fires on reaching a lesson's tip by navigation,
not only by replaying a move (`bd37bb7`), and a pre-existing layout defect
(`.app-main` missing `min-height: 0`, silently clipping long rail content) was
found and fixed. Plan: `docs/superpowers/plans/2026-08-14-moves-table.md`.

**Browser-verified 2026-08-15.** All five checks in the plan's browser pass
held, including the one only a browser can show: the autoplay-owed-reply fix
survives clicking back to an earlier row mid-lesson and then `last`. See
[[Current State]] for detail and [[Start Here]] for the session note. Suite
482 → 505.

## Next

**The compare drawer's contrast vocabulary** — see "Still undecided" below. It
is the one item on this roadmap that changes whether the app *teaches* rather
than *describes*, and it is a design decision before it is code.

One thing still wants a human at the keyboard, and it is the only item on this
roadmap that no amount of automation will close:

- **A design pass by eye.** The layout has been *measured* — regions aligned,
  board square, no overflow — but never *judged*. Nobody has looked at it and
  said whether it feels right — whether the type sits well, whether the rails
  balance, whether the board is the right size in the space it has.

  The wrong-answer ✕ used to be listed here as the concrete instance, on the
  belief that the automation tab rendered at zero size. **Both halves of that
  were wrong**: the tab renders at the full viewport, and looking at it on
  2026-08-13 is exactly how the mark was found sitting 210.5px below the
  board's centre, on the second rank. It was fixed and made translucent in
  PR #8. The general point stands — measured is not judged — but it no longer
  has that example, and no automation limit prevents the next look.

Segment-level board orientation after "Next part" was listed here as never
observed from Plan 4 until 2026-08-13, when the second browser pass finally
watched it. It is no longer outstanding — see [[Start Here]].

## Also queued

Small, and each has a stated reason for existing:

Both former entries here — a player-facing way to clear progress with a
dismiss control for the notices, and the dead `tree.pinned` field — were done
in Plan 5. Nothing is queued.

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
- **Whether the compare drawer is really a modal.** Plan 5 gave it Escape,
  focus movement in, and focus restore on close, and it is now `role="region"`
  deliberately **without** `aria-modal` because Tab containment was not built —
  a lying `aria-modal` is worse than none. Adding a real focus trap is what
  would let it claim modal semantics honestly. Reduced from a decision to a
  small piece of work.
- **How the lesson rail should display a correct answer from a multi-entry
  `accept` list.** The *recorded* outcome was fixed 2026-08-06; the rail still
  shows "stepped off the line" for it. See [[Known Issues]].

Also queued and small: `MiniBoard` gives screen-reader users no position
information, and compare is hardwired to the top two candidates. Both in
[[Known Issues]].
