---
updated: 2026-08-06
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

## Lessons — found in the 2026-08-05 fix wave, left unfixed

### One authored comparison in the whole corpus

**Where:** `src/content/lessons/`
**Severity:** low, but it is why the feature nearly shipped unreachable.

`alternatives` appears on exactly one move, the Italian's `Bc4`. The rail's
authored-contrast path is now reachable and tested, but a single data point is
not evidence the shape of the field is right. Author two or three more before
trusting it.

### Compare at a checkpoint depends on the engine returning the authored moves

**Where:** `src/ui/CandidateRail.tsx` — `checkpointComparison`
**Severity:** low.

The pair is picked from authored alternatives *found among the current lines*,
which is what keeps the answer from leaking. If a search's three lines happen
not to include two of them, the Compare button simply is not offered — no
comparison, no error. At the Italian's `Bc4` position Stockfish 18 ranks `Bb5`,
`d4`, `Bc4` at depth 18, so both authored moves are there; shallower or
differently-ordered searches may not have them, and mid-search the button can
appear and disappear.

## Progress and controls — found in the 2026-08-06 whole-branch review, left unfixed

### `AppControls` mirrors `sounds.muted` in local `useState` without subscribing

**Where:** `src/ui/AppControls.tsx`
**Severity:** low today; a real trap for the next hand that touches it.

The mute button reads `sounds.muted` once, into its own `useState`, rather than
subscribing to it. Nothing else in production calls `SoundManager.setMuted`, so
there is exactly one writer and it happens to be the same component that reads
it — the local copy cannot go stale *yet*. A second mute control (a settings
panel, a keyboard shortcut) would silently desync from this one the moment it
existed, with no test able to catch it because there is only one today.

### No production caller of `dismissNotice`, and no way to clear progress

**Where:** `src/progress/store.ts`
**Severity:** medium — a corrupted-storage notice, once shown, never goes away
inside a session; there is also no player-facing way to reset lesson progress
or saved lines short of clearing the browser's storage by hand.

`dismissNotice()` exists and is tested, but nothing in `src/ui/` calls it —
`LessonPicker`'s notice re-renders every time `recovered` or `saveFailed` is
true, with no dismiss control on screen. Related but separate: there is no
"reset my progress" affordance anywhere, authored or accidental.

### Multi-tab writes are last-writer-wins on the whole blob

**Where:** `src/progress/storage.ts`, `src/progress/store.ts`
**Severity:** low; ChessTrainer is not designed for multiple tabs, but nothing
stops a player from opening one.

`saveProgress` overwrites `chesstrainer.progress.v1` wholesale, and the store
never listens for the `storage` event. Two tabs each finishing a different
lesson will have the second tab's save clobber the first's, silently — no
merge, no conflict notice.

### `loadProgress` discards everything on any single validation failure

**Where:** `src/progress/storage.ts` — `loadProgress`
**Severity:** medium. Matches spec §10 (degrade, never blank) at the level of
"the app still works," but the blast radius is the whole progress object.

`progressSchema.safeParse` validates `Progress` as one unit, so one malformed
`SavedLine` — say, a future field that fails a tightened schema, or storage
truncated mid-write — resets *every lesson's progress* along with the saved
lines, not just the broken part. A per-collection or per-item recovery would
be more forgiving, at the cost of a more complex loader.

### Storage key conventions have drifted

**Where:** `src/progress/storage.ts`, `src/sound/SoundManager.ts`
**Severity:** low; a naming inconsistency, not a functional bug.

`chesstrainer.progress.v1` versions both the key and the payload's own
`version: 1` field — redundant, but at least explicit. `chesstrainer.muted` (added
in Task 6) versions neither. Not a problem yet — a boolean has nowhere to drift
to — but the next storage key added should pick one convention rather than a
third.

### `savedLines` is unbounded, with no duplicate guard

**Where:** `src/progress/progress.ts` — `addSavedLine`
**Severity:** low.

Every "Save this line" click adds a new entry, even one identical in `pgn` and
`startFen` to an existing one, and nothing caps the list length or the
localStorage quota it eventually hits (at which point `saveFailed` is now
surfaced — see the fix wave in `Current State.md` — but the list still grows
unbounded up to that point).

### The rail still says "stepped off the line" for a correct alternate answer

**Where:** `src/ui/LessonRail.tsx`
**Severity:** low; a display-only gap, now that the *recorded* outcome is
correct (fixed 2026-08-06 — see `Current State.md`).

`deriveLessonState` decides on/off-script by string equality against the
checkpoint's single canonical `san`, so a move that matches a second entry in
`checkpoint.accept` still renders the "You have stepped off the lesson line"
copy even though it is now recorded as solved. No lesson today has a
multi-entry `accept`, so nothing visible is wrong yet — but the fix that landed
this review only closed the *durable-data* half of the bug. Making the display
agree needs `deriveLessonState` (or the rail) to consult `accept`, not just
`san`, which is a small design question, not a one-line patch.

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
- **`src/App.tsx` is an inline-styled placeholder**, not the designed layout —
  now hosting the picker, lesson rail, saved lines, and controls on top of it.
- **`tree.pinned` is never populated.** `src/tree/tree.ts` — it exists so a
  node can keep its cached eval past the ~1000-node cap regardless of
  recency, and the docstring on `evict()` still describes "pinned nodes" as
  live machinery, but nothing in the app ever writes to it. Plan 4's saved
  lines (2026-08-06) were the obvious candidate consumer and deliberately do
  not use it — a saved line is PGN plus its starting FEN, replayed into
  whatever tree exists when it is opened, never a set of node ids. Not a
  correctness gap (eviction never removes a node, only its cached eval), just
  unused machinery worth removing or wiring up next time the tree module is
  touched.

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
