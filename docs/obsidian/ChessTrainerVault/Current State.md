---
updated: 2026-08-04
status: current
tags: [chesstrainer, state]
---

# Current State

**As of 2026-08-04.** Plan 1 (foundation and line explorer) is complete and
sitting in PR #1, unmerged. Plan 2 has not been written.

Suite: **138 passing, 1 skipped**, 18 test files. `tsc --noEmit` clean,
`npm run build` succeeds. The skip is `src/engine/engine.smoke.test.ts`, which
needs a real `Worker`; jsdom has none, so the engine is verified in a browser.

## What works today

Run `npm run dev`, open the local URL, and you can:

| Action | Behaviour |
|---|---|
| Drag a piece | Legal moves land, illegal ones snap back. From/to squares stay highlighted. |
| Read the right-hand rail | Top 3 engine moves at depth 20, each with score, eval bar, and the first 6 plies of its line |
| Click a candidate | Plays it — identical result to dragging the same move |
| Click a breadcrumb chip | Jumps back to that position |
| Play a different move from an earlier position | **Branches the tree.** The original line survives and is one click away. |
| Reach checkmate or stalemate | The rail says so rather than spinning |
| Lose the engine | "Engine unavailable" card with a working Retry button |

The branching loop is the thing to exercise: play `e4 e5 Nf3`, click back to the
position after `e4`, play `c5` instead — two lines now exist and the breadcrumb
walks either.

**Verified 2026-08-04:** dev server starts in ~300 ms and serves `/`,
`/engine/stockfish.js`, `/engine/stockfish.wasm`, and the Nunito font correctly.

## What is scaffolding, not feature

- **Sound is wired but silent.** Every call site exists — pickup, move, capture,
  check — and `public/sounds/README.md` lists the ten filenames the app looks
  for. No audio files are committed. A missing file plays nothing and logs
  nothing, so this is a working degraded state, not a bug. Drop MP3s in and they
  light up with no code change.
- **`src/App.tsx` is a placeholder shell** — an inline-styled flex layout, not
  the designed layout. It exists to host the three real components.
- **The store has a `reset` action that nothing calls.** There is no new-game
  button; refreshing the page starts over.

## What does not exist yet

Everything below is Plan 2. See [[Roadmap]] for ordering.

- **The explainer.** The rail shows scores, not reasons. `explain/` has not been
  written. This is the feature the project was asked for most specifically, and
  it is the one still missing.
- **The compare drawer.** No way to put two candidates side by side.
- **Lessons.** No `content/`, no `lesson/`, no lesson rail, no checkpoints,
  hints, or `nearMiss` replies.
- **Progress persistence.** No `progress/`, no localStorage, no "My Lines".
- **Mute toggle UI.** `SoundManager` honours mute internally; nothing exposes it.
- **Keyboard board navigation.** Called for by the spec's accessibility section.
- **Pawn-structure features.** `extractFeatures` covers centre control,
  development, castling, material, mobility, and hanging pieces — not pawn
  structure, which the explainer will need.

## Engine behaviour worth knowing

- First analysis is slow — it loads a 7.3 MB WASM binary before the first
  search. Subsequent searches settle in roughly 0.7–1 s at depth 20.
- Depth 20 was chosen from measurement, not taste: ~975 ms at the start position,
  ~697 ms in a middlegame. Recorded in `docs/superpowers/plans/spike-results.md`.
- Navigating rapidly between positions is the highest-risk interaction. The rail
  must always show the current position's candidates and must never wedge on
  "Thinking…". That is [[Decisions/Engine Search Serialization]], and it took six
  revisions to get right.

## Recent history

- **2026-08-04** — Repo pushed to GitHub (public). Added top-level `README.md`,
  `CLAUDE.md`, Stockfish GPL-3.0 attribution at `public/engine/`, and this vault.
- **2026-08-03** — Plan 1 finished after six post-review fix waves, five of them
  in the engine's search serialization.
- **2026-08-01** — Design spec approved; Plan 1 written.
