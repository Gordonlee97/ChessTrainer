---
updated: 2026-08-05
status: current
tags: [chesstrainer, state]
---

# Current State

**As of 2026-08-05.** Plan 1 (foundation and line explorer) and Plan 2 (the
explainer and compare) are both complete. Plan 2 landed as nine tasks on
`feat/teaching-layer`, followed by one fix wave from a whole-branch review.
Not yet merged.

> Picking the work up rather than reading about it? [[Start Here]] has the repo
> state and the next action. This note is what *exists*; that one is what to *do*.

Suite: **246 passing, 1 skipped**, 29 test files. `tsc --noEmit` clean,
`npm run build` succeeds. The skip is `src/engine/engine.smoke.test.ts`, which
needs a real `Worker`; jsdom has none, so the engine is verified in a browser.

## What works today

Run `npm run dev`, open the local URL, and you can:

| Action | Behaviour |
|---|---|
| Drag a piece | Legal moves land, illegal ones snap back. From/to squares stay highlighted. |
| Read the right-hand rail | Top 3 engine moves at depth 20, each with score, eval bar, a quality badge (Best/Good/Inaccuracy/Mistake/Blunder relative to the top line), the **top two** explainer sentences, and the first 6 plies of its line |
| Watch the rail mid-search | Scores and eval bars stream; **badges and ideas are withheld until the search settles**, because comparing two lines only means something at equal depth |
| Click a candidate | Plays it — identical result to dragging the same move |
| Click "Compare X and Y" | Opens a drawer with two mini-boards (each captioned with the plies actually walked, at most 8), eval bars, pros/cons, and a verdict — mate distances when either line mates, "practically equal" under a 30cp gap, otherwise "X is stronger by N pawns" |
| Click a breadcrumb chip | Jumps back to that position |
| Play a different move from an earlier position | **Branches the tree.** The original line survives and is one click away. |
| Reach checkmate or stalemate | The rail says so rather than spinning |
| Lose the engine | "Engine unavailable" card with a working Retry button |
| Revisit a transposed position | Analysis is served from a FEN-keyed cache instead of re-searched — see `src/engine/evalCache.ts` |

The branching loop is the thing to exercise: play `e4 e5 Nf3`, click back to the
position after `e4`, play `c5` instead — two lines now exist and the breadcrumb
walks either.

**Verified 2026-08-04:** dev server starts in ~300 ms and serves `/`,
`/engine/stockfish.js`, `/engine/stockfish.wasm`, and the Nunito font correctly.

**The compare drawer has now been exercised in a browser (2026-08-04)**, closing
the gap Task 9 left open. It works — and the testing found that the *output
layer* said roughly the same thing about every move, which is the one failure
mode this feature cannot afford. A whole-branch review turned that into a fix
list, applied 2026-08-05:

| Was | Now |
|---|---|
| Every sensible opening move led with "Stakes a claim in the centre" — `centerControl` counts attackers, so a developing knight outscored `developmentRule` | Occupation (a pawn on a central square) and pressure are separate rules with separate text; e4 leads with the centre, Nf3 with development |
| One explainer sentence per candidate | Two, per spec §7 |
| Quality badges flickered through "Mistake"/"Blunder" mid-search | Badges and ideas are withheld while `status === 'analyzing'` |
| "Practically equal — the real difference is character… e4 develops 1 more piece; d4 develops 1 more piece" | When both lines lead with the same pro, the verdict says so instead of asserting a difference that isn't there |
| A mate comparison rendered "about 998.00 better than" | Mate is handled before the centipawn logic and names the distance; the centipawn gap now says "pawns" |
| The drawer captioned a board "after 26 plies" when it walked 8 | `LineSummary.plies` carries the real count; score and position are two separate claims |
| Mini-boards drew both armies from the black glyph set, separated by CSS `color` | Colour-keyed glyphs — survives `forced-colors` |
| The eval cache keyed on the whole FEN, so the Queen's Gambit transposition missed | Keyed on placement + side + castling + en passant |
| A search finishing just after navigation was discarded | Written to the FEN cache first, then the render is guarded |

What that fix wave deliberately did **not** do is in [[Known Issues]].

## What is scaffolding, not feature

- **Sound is wired but silent.** Every call site exists — pickup, move, capture,
  check — and `public/sounds/README.md` lists the ten filenames the app looks
  for. No audio files are committed. A missing file plays nothing and logs
  nothing, so this is a working degraded state, not a bug. Drop MP3s in and they
  light up with no code change.
- **`src/App.tsx` is a placeholder shell** — an inline-styled flex layout, not
  the designed layout. It exists to host the components; Plan 3 replaces it.
- **The store has a `reset` action that nothing calls.** There is no new-game
  button; refreshing the page starts over.

## What does not exist yet

Everything below is Plan 3. See [[Roadmap]] for ordering.

- **Lessons.** No `content/`, no `lesson/`, no lesson rail, no checkpoints,
  hints, or `nearMiss` replies.
- **Progress persistence.** No `progress/`, no localStorage, no "My Lines".
- **Mute toggle UI.** `SoundManager` honours mute internally; nothing exposes it.
- **Keyboard board navigation.** Called for by the spec's accessibility section.
- **A real `App.tsx` layout and a new-game control.**

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

- **2026-08-05** — One fix wave from the whole-branch review of Plan 2: nine
  items across `src/explain/`, `src/ui/`, and `src/engine/evalCache.ts`. The
  table above says what changed. Suite 223 → 246.
- **2026-08-04** — Plan 2 (explainer and compare) finished: nine tasks, from
  pawn-structure feature extraction through the compare drawer. `framer-motion`
  removed as an unused dependency (Task 9); the drawer's animation is a CSS
  keyframe instead.
- **2026-08-04** — Repo pushed to GitHub (public). Added top-level `README.md`,
  `CLAUDE.md`, Stockfish GPL-3.0 attribution at `public/engine/`, and this vault.
- **2026-08-03** — Plan 1 finished after six post-review fix waves, five of them
  in the engine's search serialization.
- **2026-08-01** — Design spec approved; Plan 1 written.
