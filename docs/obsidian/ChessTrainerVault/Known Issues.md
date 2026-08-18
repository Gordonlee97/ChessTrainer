---
updated: 2026-08-17
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

**Where:** `src/ui/CheckpointPanel.tsx` — `checkpointComparison` (moved out of `CandidateRail.tsx` on 2026-08-09)
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

Every save adds a new entry, even one identical in `pgn` and `startFen` to an
existing one, and nothing caps the list length or the localStorage quota it
eventually hits (at which point `saveFailed` is now surfaced — see the fix wave
in `Current State.md` — but the list still grows unbounded up to that point).

The *visible* half of this was fixed on 2026-08-17: the list moved into a
disclosure panel, so an unbounded list no longer grows the rail. Named saves
also make duplicates distinguishable rather than identical-looking. The
underlying growth is unchanged.

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

### The compare drawer still has no focus trap

**Where:** `src/ui/CompareDrawer.tsx`
**Severity:** low, reduced from medium on 2026-08-10.

Plan 5 gave it Escape-to-close, focus movement into the drawer on open, and
focus restoration on unmount (guarded by `document.contains`), and it is now an
overlay spanning the centre and right columns rather than an inline panel. It
carries `role="region"` with an accessible name and **deliberately does not
claim `aria-modal`**, because Tab containment was not implemented — a lying
`aria-modal` is worse than none. Adding a real focus trap is what would let it
claim modal semantics honestly.

### The mini-boards separate the armies by fill, like the main board

**Where:** `src/ui/MiniBoard.tsx`
**Severity:** low. Changed deliberately on 2026-08-11.

The mini-boards used to draw Unicode glyphs, whose white and black sets are
*different characters* — so the two armies stayed distinguishable under
`forced-colors`, where the OS overrides `color` and `textShadow`. That was
genuinely better than the main board on that one axis, and it looked wrong:
the glyphs sat small inside their squares and White's outline characters
(♙♘♗) read as unfinished beside Black's filled ones.

They now render `defaultPieces` from `react-chessboard` — the same artwork
`Board.tsx` draws. react-chessboard's white and black pieces share a path and
differ only by `fill` (`#ffffff` vs `#000000`), so under `forced-colors` they
can flatten together.

**This is already true of the main board**, so the change makes the
mini-boards no worse than the primary surface rather than better than it. If
`forced-colors` support is ever taken up properly it should be fixed in one
place, for both. Tests assert on a `data-piece` attribute (`wP`, `bN`) rather
than text, since there is no longer any text content to match.

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

## Found in the 2026-08-15 whole-branch review of `feat/moves-table`

### The moves table can only ever show one child of a branch point

**Where:** `src/tree/movesTable.ts` — `continuationFrom`
**Severity:** medium. Long-standing behaviour, not introduced by this branch —
the breadcrumb it replaced had the same limit, just less visibly (it only ever
rendered the ancestor path, never a continuation at all). Found in the
2026-08-15 whole-branch review.

When a node has more than one child, `continuationFrom` walks forward through
whichever child has the greatest `lastSelectedAt` and stops there — so the
table shows exactly one line at a time. Playing `e4 e5 Nf3`, stepping back to
after `e4`, and playing `c5` instead replaces the table's continuation with the
`c5` line; the `e5` branch's nodes are still in the tree (nothing is deleted),
but there is no control that lists or reaches them again — the only way back
is to know the position existed and navigate there some other way (e.g.
replaying the moves). A line you navigate away from is effectively
unreachable through the UI.

Showing variations — a table that branches rather than a single flat list —
was considered for this plan and rejected as substantially larger work (design
spec §4): it changes the row shape, the navigation controls, and what
"selected" means when more than one line is visible at once. This entry is
what the spec's §4 sentence "it stays in `Known Issues.md`" refers to; the
code comment above `continuationFrom` in `src/tree/movesTable.ts` names this
file directly.

### A reply owed at a node whose only children are off-script is never played

**Where:** `src/ui/useLessonAutoplay.ts`
**Severity:** medium — it dead-ends a lesson with no error and no visible
cause. Pre-existing: the guard behaved identically before this branch. The
moves table makes it worse, because the continuation follows the most recently
selected child and so lists and walks the off-script line, inviting the player
back into it. Found in the 2026-08-15 whole-branch review.

Repro, Italian Game: play `e4`, autoplay replies `e5`; click the `e4` cell to
go back to `root/e4`; from there play any non-lesson Black move (opponent
moves carry no checkpoint, so nothing rejects it) — say `d5`; then click
"Return to the lesson", which selects `root/e4`. Autoplay now declines because
that node has children, but none of them is the lesson's next move, so the
opponent never moves, the checkpoint panel renders nothing, and the right rail
is blank. The only escape is playing `e5` by hand. The correct rule would be
"a reply is owed when no child of the selected node matches the lesson's next
move," not "the node has no children at all."

### Nothing carries `aria-current` when the root is selected

**Where:** `src/ui/MovesTable.tsx`
**Severity:** low. Found in the 2026-08-15 whole-branch review.

After clicking `First`, the table shows no "you are here" row — the root has
no move and so no cell — and the only cue that the root is selected is the
disabled First/Previous buttons. The design spec wanted a selectable start row;
the plan that built the table deliberately omitted it as a gap, not a defect,
but no `aria-current` element exists anywhere in that state either.

### `preventDefault()` fires even when the arrow-key step is a no-op

**Where:** `src/ui/MovesTable.tsx`
**Severity:** low. Found in the 2026-08-15 whole-branch review.

At either end of the line, `ArrowLeft`/`ArrowRight` cannot move the selection
further, but the handler still calls `preventDefault()` before finding that
out — swallowing a scroll key for nothing when the table has focus in the
flowing sub-1100px layout, where the table is one scrollable region among
several.

### No `scrollIntoView` on the selected row

**Where:** `src/ui/MovesTable.tsx`
**Severity:** low. Found in the 2026-08-15 whole-branch review.

Selecting a row — via click or the four controls — never scrolls it into view.
On a long line, `next`/`last` can move the selection outside the rail's
visible scroll area with no indication that anything changed.

### `buildMovesTable` constructs a `Chess` twice per move

**Where:** `src/tree/movesTable.ts` — `buildMovesTable`, via `src/chess/side.ts`
**Severity:** trivial; a performance note, not a bug. Found in the 2026-08-15
whole-branch review.

`sideToMove(from)` and `moveNumber(from)` each parse the same FEN into a fresh
`Chess` instance rather than sharing one. Negligible at current line lengths
(tens of plies); would matter only if lines grew far longer than any lesson or
saved line does today.

### Repeated SANs produce duplicate accessible names

**Where:** `src/ui/MovesTable.tsx`
**Severity:** low, accessibility. Found in the 2026-08-15 whole-branch review.

A line containing the same SAN twice — e.g. `Nf3 … Ng1 … Nf3` — yields two
buttons with identical accessible names and no positional context, so a screen
reader user cannot tell them apart by name alone. An `aria-label` such as
"Move 12, White: Nf3" (fullmove number, side, SAN) would disambiguate them.

## Dead code and cleanup

- **`Engine.stop()` has no callers** and does no bookkeeping.
  `src/engine/engine.ts`
- **`tsconfig.json` includes `types: ["node"]`**, which is unnecessary —
  `node:fs` resolves via `@types/node` regardless. Drop it next time that file is
  touched.

## Found on the lesson quiz loop branch (2026-08-13)

### No test guards the factual claims in lesson prose

**Where:** `src/content/lessons/`
**Severity:** medium. Nine such defects were found on one branch.

Hints and notes make countable claims about the board — "h7 is guarded by
nothing except the king", "d4 is attacked three times", "one piece has still
never moved". `validateLessonChess` proves every authored *move* is legal.
**Nothing proves a sentence about the board is true.** All nine were found by
replaying positions through chess.js and counting; a tenth would ship green.

The h7 one is the example worth remembering: the f6 knight also defends h7,
which is exactly why h7 sacrifices in that system start by removing it. The
lesson taught the opposite.

A guard is possible but not obvious — the claims are prose, so it would need
either a structured field beside each claim or a convention a test can parse.
That is a design question, which is why this is filed rather than fixed. See
[[Lessons]] §9.

### The near-miss reply is concatenated onto the engine-hidden notice

**Where:** `src/ui/CheckpointPanel.tsx:151-157`
**Severity:** low. Found in the 2026-08-13 browser pass.

Authored feedback is appended inside the *same* `<p role="status">` as the
standing "Engine suggestions are hidden while the lesson is asking you for a
move." boilerplate, so a wrong answer renders as one run-on paragraph:

> Engine suggestions are hidden while the lesson is asking you for a move. The
> bishop belongs there and you will play it next, but developing with a threat
> first makes Black answer you rather than the other way round.

Deliberate in the code (`{' '}` between them), not an accident. Two costs: the
two sentences are unrelated and read as one, and because the whole paragraph is
a single live region, assistive technology re-announces the boilerplate on
every rejected move before reaching the part that changed. Splitting them into
two elements, with only the feedback live, would fix both.

### One hint sits on the line the naming rule draws

**Where:** `src/content/lessons/italian-game.ts` — `italian-open-with-e4`, tier 3
**Severity:** low, and a judgement call rather than a defect. Recorded so it is
re-decided deliberately rather than rediscovered.

*"That is the bishop standing beside your king, and its pawn should not stop
half-way: a pawn on the third rank never actually stands in the centre."*

Measured against the rule's own test — *could a player make the move from this
sentence alone?* — it identifies the piece and the distance, which is the same
shape as the example the rule forbids, one square over. It is a **last** tier,
and the plan explicitly allows the last tier to be "very pointed" so long as it
is not the answer. Two readings are defensible and the branch shipped the
permissive one.

If the rule is ever tightened, this is the first hint to revisit; if it is
loosened, this is the precedent.

## Found in the 2026-08-10 browser pass — all minor

### The keyboard cursor reads stale state within a single tick

**Where:** `src/ui/Board.tsx` — the `onKeyDown` arrow branch
**Severity:** low, latent.

`setCursor(moveCursor(cursor, …))` reads `cursor` from the render closure
rather than using a functional update. Sixteen arrow presses dispatched in one
tick all computed from the same starting square and collapsed into a single
move. A human's key repeats are spaced far enough apart that this will not
surface, but `setCursor(c => moveCursor(c, …))` is the correct idiom and
removes the class entirely.

### Two `role="status"` regions live inside the board wrapper

**Where:** `src/ui/Board.tsx` plus `react-chessboard`'s internals
**Severity:** low.

`react-chessboard` renders its own `aria-live="assertive"` region (via
`@dnd-kit/accessibility`) inside the board, and ours (`aria-live="polite"`,
`.visually-hidden`) sits alongside it. Ours is correctly `position: absolute`
rather than `display: none`. Nothing is broken; a screen reader simply meets
both, and a naive `querySelector('[role="status"]')` finds theirs first — which
is exactly what made the keyboard announcements *look* empty during
verification until the selector was corrected.

### The keyboard cursor does not reset on "New game"

**Where:** `src/ui/Board.tsx`
**Severity:** low, and quieter than it was.

Pressing "New game" resets the tree but leaves the cursor wherever it was.
Defensible — it is a selection cursor, not board state — but it should be a
deliberate decision rather than an accident.

Less visible since 2026-08-17: the cursor ring is only drawn while the board
holds focus, so a stale position is no longer a mark sitting on the board of a
player who never touched the keyboard. The state is still stale underneath.

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
