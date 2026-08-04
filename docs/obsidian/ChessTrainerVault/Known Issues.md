---
updated: 2026-08-04
status: current
tags: [chesstrainer, issues]
---

# Known Issues

Open items only. When something is fixed, **delete its entry** — no tombstones.
Severity is about consequence, not effort.

## Blocks Plan 2

### Node identity does not handle transpositions

**Where:** `src/tree/tree.ts`
Node ids are built from the SAN move path (`"root/e4/e5/Nf3"`), so the same
position reached by a different move order creates two nodes with the same FEN.
Deduplication only covers replaying the same move from the same parent.

The test named *"reuses an existing node instead of duplicating a transposition"*
overstates what is implemented. Rename it or widen the behaviour.

**Why it blocks:** lesson content and "My Lines" both key off node identity. If
Plan 2 assumes transposition identity works, it will be wrong in a way that shows
up as duplicated lesson state.

### Spec says React 18; the build is React 19

**Where:** `docs/superpowers/specs/2026-08-01-chesstrainer-design.md` §3
The upgrade was forced by `react-chessboard@5.10.0`'s peer dependency and is
correct — but the spec still says 18, and the spec is what a future plan gets
written against. Amend it. See [[Decisions/React 19 Upgrade]].

## Correctness — low consequence

### Grace-timer cleanup covers only the pending search

**Where:** `src/engine/engine.ts` — `dispose()`, `handleTransportError`
Both clear only the *pending* search's grace timer. After a supersede, the armed
timer belongs to the superseded search and is not cleared.

Benign in practice: roughly a 2-second closure leak past teardown, and an
ownership guard prevents a stale timer clobbering live state. But
`clearGraceTimer`'s docstring **overstates its coverage**, which is how this
becomes a real bug later. A proper fix needs a per-search timer registry.

### `transport.send('stop')` before grace arming is unguarded

**Where:** `src/engine/engine.ts`
Unreachable today, because `postMessage` does not throw on a terminated worker.
Reachable if the transport is ever changed.

### `pathTo` has no cycle cap

**Where:** `src/tree/tree.ts`
Would loop forever on a cyclic `parentId`. Unreachable through the public API;
there is no defensive bound.

### `setEval` is inconsistent with its siblings

**Where:** `src/tree/tree.ts`
Silently no-ops on an unknown node, while `insertMove` and `select` throw. This
was plan-specified, but the inconsistency is a trap.

## Dead code and cleanup

- **`Engine.stop()` has no callers** and does no bookkeeping.
  `src/engine/engine.ts`
- **`tsconfig.json` includes `types: ["node"]`**, which is unnecessary —
  `node:fs` resolves via `@types/node` regardless. Drop it next time that file is
  touched.
- **`src/App.tsx` is an inline-styled placeholder**, not the designed layout.
- **The store's `reset` action has no caller.** No new-game control exists.

## Test coverage gaps

- No test covers queenside castled squares (c1/c8) in `extractFeatures`.
- No test covers the `mobility === null` path.
- `hanging` counts a **pinned defender as a valid defender**. This is standard
  `chess.attackers()` control semantics and is correct per the global
  constraint — but it is undocumented, unlike the `castled` approximation, which
  has a comment explaining itself.

## Environment

### `npm audit` reports 5 vulnerabilities, 1 critical

All in the dev toolchain (the Vitest UI dependency tree). **None reach the
production bundle.** Re-check before any public deployment, but this does not
block development.

### A missing sound file returns HTML, not a 404

Observed 2026-08-04 on the Vite dev server: requesting `/sounds/move.mp3` with no
file present returns `index.html` with a 200, via SPA fallback — so Howler
receives an HTML body and fails to *decode* rather than failing to *fetch*.

`SoundManager`'s failed-load path handles this correctly and the app degrades as
designed, so there is nothing to fix. Worth knowing because it means the
"missing file" case is actually exercised as "corrupt file", and a future change
to load-failure handling must keep covering both.
