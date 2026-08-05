---
updated: 2026-08-05
status: current
tags: [chesstrainer, issues]
---

# Known Issues

Open items only. When something is fixed, **delete its entry** — no tombstones.
Severity is about consequence, not effort.

## Blocks Plan 2

None. Both prior blockers were settled on 2026-08-04:

- **Transpositions** — decided, not fixed. The tree stays path-addressed and
  Plan 2 dedupes *evaluations* by FEN instead. See
  [[Decisions/Transposition Identity]] for what that makes harder. The test that
  overstated the behaviour had already been renamed to "reuses an existing node
  when the same move is replayed from the same parent".
- **React 18 in the spec** — amended to React 19, with a dated note in §3
  recording the correction.

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

## Accepted after browser verification (2026-08-04) and the fix wave (2026-08-05)

Each of these was seen, weighed, and left. They are here so the next session
does not rediscover them and assume they were missed.

### The comparison has only one axis of contrast

**Where:** `src/explain/compare.ts` — `summarise`, `buildVerdict`
**Severity:** medium. This is the ceiling on how useful compare can be.

`summarise` can say five things about a line: minors developed, centre control,
castled, doubled pawn, passed pawn, plus a hanging piece. Over a realistic 8-ply
opening two strong candidates usually score identically on all of them, so both
lines produce the *same whole pros list*. The verdict now detects that collision
and says so honestly rather than asserting a difference it cannot name — which
is correct, but it means the common case is "these are the same, choose on feel."

What would actually separate two openings is vocabulary the feature set does not
have: pawn structure beyond doubled/passed, open versus closed, which minor came
out and to where, space, king-side versus queen-side play. That is design work,
not a patch, and it is **deliberately deferred to the next plan**. Do not bolt
another ad-hoc feature onto `summarise` — the shape of the vocabulary is the
decision to make first.

### The compare drawer is a dialog in name only

**Where:** `src/ui/CompareDrawer.tsx`
**Severity:** medium for keyboard and screen-reader users; blocks nothing.

It carries `role="dialog"` and an accessible name, but it is an inline panel:
no `aria-modal`, no focus trap, no Escape-to-close, and focus is not moved into
it on open or restored on close. Either add those, or drop to a labelled
`<section>` — the current state promises modal semantics it does not implement.

### `MiniBoard` tells assistive technology nothing about the position

**Where:** `src/ui/MiniBoard.tsx`
**Severity:** medium. The drawer's whole argument is visual.

`role="img"` with a label like "Position after the e4 line" is all a screen
reader gets; the pieces themselves are decorative text inside it. A player who
cannot see the board learns only that a board exists. The pros/cons list and the
verdict do carry real content, so the drawer is not useless — but the boards are.

The glyphs *are* now colour-independent (white and black Unicode sets, not one
set tinted by CSS), so `forced-colors` and colour-blind users are fine. This is
about non-visual access, which is a different problem.

### Compare is hardwired to the top two candidates

**Where:** `src/ui/CandidateRail.tsx`
**Severity:** low.

The button always compares `lines[0]` and `lines[1]`. There is no way to compare
#1 against #3, or to compare a move the player is actually considering. Fine for
v1; the natural fix is selection state on the rail, which is Plan 3 UI work.

### `Comparison.practicallyEqual` is computed but never rendered

**Where:** `src/explain/compare.ts`, `src/ui/CompareDrawer.tsx`
**Severity:** low.

The flag is derived and returned, and the drawer ignores it — the "practically
equal" signal reaches the player only as prose inside `verdict`. That is not
wrong (it is not colour-only, and the words are there), but a field no consumer
reads is a field that will drift. Either render it as a badge or drop it.

### `compare.ts`'s hanging-piece con is an absolute, not a delta

**Where:** `src/explain/compare.ts` — `summarise`
**Severity:** low.

Every other pro and con is a difference against `baseFeatures`. The hanging check
is `end.hanging[mover].length > 0`, so a piece that was already loose before the
line started is charged to the line as if it caused it. `rules.ts`'s
`hangingRule` does this correctly — it diffs against `featuresBefore` — so the
two disagree about the same idea.

### The eval cache ignores the fifty-move clock

**Where:** `src/engine/evalCache.ts` — `positionKey`
**Severity:** low; deliberate.

Keying on placement + side + castling + en passant is what makes transpositions
hit, and it means two positions differing only in progress toward the fifty-move
rule share an entry. Irrelevant at opening depths, and the cache never carried
repetition history anyway (a FEN does not encode it). Revisit if the app ever
grows endgame content.

### The `'space'` reason tag has no rule

**Where:** `src/explain/types.ts`
**Severity:** trivial. Vocabulary declared and never produced.

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
