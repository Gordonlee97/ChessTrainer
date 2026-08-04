---
updated: 2026-08-04
status: current
tags: [chesstrainer, roadmap]
---

# Roadmap

## Done

**Plan 1 — Foundation and line explorer.** Nine tasks, complete 2026-08-03.
Board, eval bar, breadcrumb, candidate rail, the immutable game tree, the UCI
engine wrapper, the sound layer, and the theme. See [[Current State]] for what
that actually gets you. Awaiting merge as PR #1.

## Next: Plan 2 — the teaching layer

Not yet written as a plan document. This is the ordering the design spec implies,
with the highest-risk item first.

### 1. The rule-based explainer — `src/explain/`

The single highest-value and highest-risk piece of remaining work, and the reason
the core was kept React-free: it is testable against a table of FEN fixtures, and
that is where the TDD effort belongs.

Turns a before/after feature pair plus an eval delta into ordered `Reason[]`,
tagged `center | development | king-safety | material | fork | pin | hanging |
tempo | pawn-structure | mobility | space`. The top two or three by weight render
as prose.

Depends on **pawn-structure features**, which `extractFeatures` does not yet
have. Do that first.

Move-quality banding is fixed by the spec:

| Centipawn loss vs best | Band |
|---|---|
| ≤ 20 | Best / excellent |
| ≤ 50 | Good |
| ≤ 100 | Inaccuracy |
| ≤ 250 | Mistake |
| > 250 | Blunder |

### 2. The compare drawer

Walk two sibling PVs out ~8 plies, extract features at both endpoints, contrast
them. Two mini-boards, eval bars, pros and cons, and a verdict line.

The verdict is deliberately calibrated: **under ~0.3 difference it must say
"practically equal — the real difference is character"** and lead with the
structural contrast. This is a teaching decision, not a display detail.

### 3. Content pipeline — `src/content/`

Zod schema plus a validating loader. A test replays every authored `san` through
chess.js, so a typo fails the suite instead of blanking the board at runtime.

Then the v1 content itself: 3 openings and 4 theme lessons, listed in
[[Project Overview]].

### 4. Lesson runner — `src/lesson/`

Derives the current step from the tree selection; grades checkpoints; serves
three hint tiers. Behaviour the spec pins down:

- At a checkpoint the **candidate rail hides** so it cannot leak the answer.
- `nearMiss` moves get their authored reply, not a generic "wrong".
- Going off-script is **not an error state** — a "return to lesson" pill waits in
  the rail until taken.

### 5. Progress persistence — `src/progress/`

Versioned localStorage: lesson completions, checkpoint accuracy, saved lines.
Two schema decisions already made and worth not re-litigating:

- Checkpoints are keyed by their **authored `id`**, not by position index, so
  inserting a move into a lesson does not silently reassign past results.
- Saved lines are stored as **PGN**, not node paths — portable, replayable, and
  immune to changes in the tree's addressing scheme.

## Also queued for Plan 2

Small, and each has a stated reason for existing:

- **Mute toggle UI.** `SoundManager` already honours mute; nothing exposes it.
- **Keyboard board navigation.** Spec accessibility requirement.
- **A real `App.tsx` layout.** Currently a placeholder shell.
- **A new-game control.** The store's `reset` action has no caller.

## Deliberately not planned

- No end-to-end suite in v1 — deferred on purpose.
- Everything in the out-of-scope list in [[Project Overview]].

## Before Plan 2 starts

Two items in [[Known Issues]] should be settled first, because Plan 2 builds
directly on them: **node identity and transpositions**, and the **spec's React 18
reference**.
