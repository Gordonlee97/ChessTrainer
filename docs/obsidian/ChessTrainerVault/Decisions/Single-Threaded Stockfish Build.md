---
updated: 2026-08-04
status: current
tags: [chesstrainer, decision, engine]
---

# Decision: vendor the single-threaded Stockfish build

**Date:** 2026-08-01 (spike), 2026-08-02 (vendored)
**Where:** `public/engine/`, `src/engine/stockfishWorker.ts`

## Context

Multi-threaded Stockfish WASM builds need `SharedArrayBuffer`, which browsers
only expose under cross-origin isolation — meaning COOP and COEP response
headers. For an app intended to run as plain static files, that is a real
deployment constraint, not a config detail.

The spec flagged this as a load-bearing assumption and required a spike before
planning.

## Decision

**Use `stockfish-18-lite-single`** — single-threaded, small NNUE — vendored to
`public/engine/stockfish.js` and `.wasm` (7.3 MB).

## The measurement

Depth 20, in a real browser:

| Position | Time |
|---|---|
| Start position | ~975 ms |
| Middlegame | ~697 ms |

Fast enough for interactive use, so **target depth is 20**. Recorded in
`docs/superpowers/plans/spike-results.md`.

The spec anticipated this correctly: if the single-threaded build had been too
slow, it would have changed the *depth budget*, not the architecture.

## Why vendored rather than imported

Vite serves `public/` verbatim, and the engine loads as a Web Worker from
`/engine/stockfish.js` at runtime. Copying the build there keeps `stockfish` a
**devDependency** — never imported by application code, never in the bundle.

The two files are byte-identical copies of
`node_modules/stockfish/bin/stockfish-18-lite-single.{js,wasm}`. Provenance and
refresh instructions are in `public/engine/README.md`.

## Licensing

**Stockfish is GPL-3.0.** The licence text is committed at
`public/engine/COPYING.txt`. The repo is public, so redistribution obligations
are live.

The engine runs as a separate program in a Web Worker, communicating only over
the UCI text protocol; the rest of the repository is not a derivative work. That
separation is worth preserving — do not link Stockfish into application code.

## What this makes harder

- **7.3 MB loads before the first search.** The first analysis of a session is
  visibly slower than the rest. A loading state is required, not optional.
- **No multi-threading headroom.** If deeper analysis is ever needed — the
  compare drawer walking two PVs out 8 plies is the likely candidate — the
  options are a longer wait or COOP/COEP headers, which would rule out the
  simplest static hosting.
- **Upgrades are manual.** Bumping the npm package does not update the vendored
  copies; both files must be re-copied and the version note updated.

Related: [[Architecture]], [[Current State]].
