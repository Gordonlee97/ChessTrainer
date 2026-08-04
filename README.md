# ChessTrainer

A browser-based chess trainer for new and improving players. It is built around
a **line explorer**: from any position, Stockfish proposes the top candidate
moves, and you can branch off into each one, walk the resulting lines, and
compare them against each other. Beginner lessons — basic openings and
fundamental ideas like controlling the centre, spotting forks and pins, and
attacking the kingside — sit on top of that explorer as a content layer.

The design goals, in the order they drove decisions:

- **Fundamentals, then application.** Not "how does a knight move," but why this
  move is better than that one, in a position you actually reached.
- **Interactive and responsive.** Tactile buttons, sound on every meaningful
  action, and feedback that arrives fast enough to feel like a conversation.
- **Offload the thinking.** A real engine does the evaluation, in a Web Worker,
  so the UI never blocks.

## Status

**Plan 1 (foundation + line explorer) is complete.** What runs today: an
interactive board, an evaluation bar, a breadcrumb of the current line, and a
candidate rail driven by live `MultiPV` analysis, all backed by an immutable
game tree you can branch and navigate.

Not built yet (Plan 2): the rule-based move explainer, the compare drawer,
the lesson runner and its content, and progress persistence.

Two things are deliberately absent from the repo:

- **Sound files.** `public/sounds/README.md` lists the ten clips the app looks
  for. Every one is optional — a missing file plays nothing and logs nothing,
  so the app is fully usable without them.
- **A mute toggle and keyboard board navigation.** Both are queued for Plan 2.

## Getting started

```bash
npm install
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check the project references, then production build |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` |

The suite is 138 passing / 1 skipped. The skip is `src/engine/engine.smoke.test.ts`,
which needs a real `Worker`; jsdom has none, so the engine is exercised in a
browser instead.

## Architecture

The core is plain TypeScript with no React in it, and a test
(`src/test/purity.test.ts`) fails the build if that ever stops being true.

| Directory | Responsibility |
|---|---|
| `src/chess/` | Position feature extraction and move resolution, over chess.js |
| `src/engine/` | UCI protocol, the Stockfish Worker transport, and search serialization |
| `src/tree/` | The immutable game tree and its Zustand store |
| `src/sound/` | Howler wrapper with mute and graceful degradation |
| `src/ui/` | React components, the analysis hook, and the theme tokens |

A few decisions worth knowing before changing things:

- **One tree is the source of truth.** Every position in the session is a node;
  navigating selects a node, and exploring a candidate inserts one.
- **One search, three lines.** The candidate list comes from a single
  `MultiPV=3` search, not three separate ones.
- **The engine serializes its own searches.** A superseded search stays
  subscribed so its stale `bestmove` is consumed rather than resolving the next
  one. This is the most delicate code in the repo — read the comments in
  `src/engine/engine.ts` before touching it.
- **Evaluations are White-relative** after normalization, everywhere above the
  UCI layer.
- **Target search depth is 20**, chosen from a measured spike (~975 ms at the
  start position, ~700 ms in a middlegame) recorded in
  `docs/superpowers/plans/spike-results.md`.
- `prefers-reduced-motion` is honoured throughout; button press feedback uses
  `box-shadow`, never a box-model property, so nothing reflows on press.

## Documentation

- `docs/superpowers/specs/` — the design spec, including what is explicitly out
  of scope
- `docs/superpowers/plans/` — implementation plans and the engine-depth spike

## Licensing

This project vendors a prebuilt Stockfish under **GPL-3.0** at `public/engine/`.
See `public/engine/README.md` for the details and `public/engine/COPYING.txt`
for the license text. The bundled Nunito font is under the SIL Open Font
License; see `public/fonts/OFL.txt`.
