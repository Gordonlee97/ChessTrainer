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

## Next: browser verification, then Plan 4

**Nothing in Plan 3 has been watched in a browser.** That is the next action —
see [[Start Here]] for what to look at.

### Plan 4 — Progress persistence — `src/progress/`

Versioned localStorage: lesson completions, checkpoint accuracy, saved lines.
Two schema decisions already made and worth not re-litigating:

- Checkpoints are keyed by their **authored `id`**, not by position index, so
  inserting a move into a lesson does not silently reassign past results. The
  lesson store already counts hints this way, so accuracy can record
  solved-cold separately from solved-after-three-hints.
- Saved lines are stored as **PGN**, not node paths — portable, replayable, and
  immune to changes in the tree's addressing scheme.

## Also queued

Small, and each has a stated reason for existing:

- **Mute toggle UI.** `SoundManager` already honours mute; nothing exposes it.
- **Keyboard board navigation.** Spec accessibility requirement.
- **A real `App.tsx` layout.** Currently a placeholder shell, now hosting the
  picker and the lesson rail too.
- **A new-game control.** Nothing outside a lesson clears the board.
- **More authored `alternatives`.** One move in the corpus carries them.

## Deliberately not planned

- No end-to-end suite in v1 — deferred on purpose.
- Everything in the out-of-scope list in [[Project Overview]].

## Still undecided

Nothing gating. Three things want a decision rather than a patch — the third is
new from Plan 3's review and is in [[Known Issues]]: whether board orientation
belongs on the lesson or on the segment, since
`theme-development-and-tempo`'s second segment is played from Black's side of a
White-oriented board.

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
