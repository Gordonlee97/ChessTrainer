---
updated: 2026-08-15
status: current
tags: [chesstrainer, architecture]
---

# Architecture

## Shape

A **pure TypeScript core with a thin React shell over it.** `src/chess/`,
`src/engine/`, `src/tree/`, `src/explain/`, `src/content/`, `src/lesson/`, and
`src/progress/` contain no React and no DOM.

This is not a style preference — it is enforced. `src/test/purity.test.ts`
scans those directories for React imports (covering `from`, bare `import`,
`require()`, dynamic `import()`, and subpaths) and fails the build. Three files
are exempted, by an explicitly enumerated set — never a glob or a basename
match: `src/tree/store.ts`, `src/lesson/store.ts`, and `src/progress/store.ts`,
each the Zustand binding for its layer.

The payoff is that the components most likely to be subtly wrong — feature
extraction and, later, the explainer — are testable against FEN fixture tables
with no rendering involved.

## Modules

### Built

| Directory | Responsibility |
|---|---|
| `src/chess/` | Helpers over chess.js: position feature extraction (`features.ts`), pawn structure (`pawnStructure.ts`), fork/pin detection (`tactics.ts`), drop resolution (`resolveDrop.ts`), and PGN round-tripping for saved lines (`pgn.ts`) |
| `src/engine/` | UCI protocol parsing, the Stockfish Worker transport, the `Engine` class that serializes searches, and a position-keyed eval cache (`evalCache.ts`) shared across transposed positions. Its key is the first four FEN fields — placement, side to move, castling, en passant — deliberately excluding the move clocks, which are how a position was reached rather than what it is |
| `src/explain/` | Pure functions over `PvLine`s and position features, no React: move-quality banding (`quality.ts`), the rule-based explainer with a FEN fixture table (`rules.ts`, `explain.ts`), and line comparison with a calibrated verdict (`compare.ts`) |
| `src/tree/` | The immutable game tree (`tree.ts`), its Zustand store (`store.ts`), and the pure derivation of a numbered moves table from it (`movesTable.ts`) |
| `src/sound/` | Howler wrapper: preload, pooling, mute, graceful degradation |
| `src/content/` | The authored corpus: the Zod schema (`schema.ts`), the parsing and chess-validating loader (`load.ts`), and seven lessons under `lessons/`. Validation replays every authored move, every accepted checkpoint answer, every `nearMiss` key and every `alternative` through chess.js — legality only; it cannot tell a legal move from a good one |
| `src/lesson/` | The runner. `lessonState.ts` derives where the player is by matching the tree's path against the segment's moves; `grade.ts` judges an attempted answer; `store.ts` is the only stateful piece and holds just the lesson id, the segment index, and per-checkpoint hint counts |
| `src/progress/` | A versioned progress object, reduced by pure functions (`progress.ts`) over a Zod-validated shape (`schema.ts`), read/written through resilient localStorage I/O (`storage.ts`) and a Zustand store (`store.ts`) that dedupes repeat attempts within a session and reports write failures. Nothing here knows about the tree or the lesson runner — recording is the UI's job, keyed by the authored checkpoint `id` the content layer guarantees is unique |
| `src/ui/` | Board, EvalBar, MovesTable, CandidateRail, QualityBadge, CompareDrawer, MiniBoard, Button, LessonPicker, LessonRail, SavedLines, AppControls, the analysis hook, theme tokens |

**The lesson layer stores no position.** `useActiveLesson` recomputes everything
from the tree's path on every render, which is why branching off a lesson and
coming back needs no special handling — and why a second source of position
state would break it silently rather than loudly.

**Recording happens at the UI edge, not inside the runner.** `LessonRail`
watches the *derived* grade in an effect that deliberately re-runs on every
render (`useActiveLesson()` returns a fresh object each time, so no dependency
array can prevent that) and dedupes by
`${lessonId}:${checkpointId}:${nodeId}` — a session-only `Set`, never
persisted, because it is about render behaviour, not the player's history.
**`clearAll` does not empty that `Set`** (2026-08-10): it used to, and the next
render re-derived the in-flight attempt from the tree and wrote it straight
back, so a twice-confirmed "Clear progress" silently undid itself mid-lesson.
Any
component that can change the tree while a lesson is running must stop the
lesson first, or this effect will grade moves the player never chose to
answer — `SavedLines.open()` and `AppControls.newGame()` both do.

## Data flow

```
user action (drag a piece / click a candidate / click a moves-table row)
  → tree.select(nodeId)  or  tree.insertMove(san)
  → engine.analyze(fen, multiPV: 3)      [tagged with the requesting nodeId]
  → tree caches EvalResult on the node
  → ui renders board + candidate rail
```

Results tagged with a node id that is no longer current are **discarded, not
rendered**. This is covered by a test that starts a search for node A, navigates
to node B, emits A's result, and asserts it never renders.

## Data model

```ts
type NodeId = string;                    // "root/e4/e5/Nf3/Nc6/Bc4"

interface TreeNode {
  id: NodeId;
  parentId: NodeId | null;
  move: { san: string; from: Square; to: Square; promotion?: string } | null;
  fen: string;
  childIds: NodeId[];
  eval?: EvalResult;                     // memoised; survives navigation
  origin: 'authored' | 'explored';       // authored nodes are never evicted
  annotationRef?: string;
}
```

**Growth control.** Explored nodes are capped at ~1000, evicted
least-recently-selected, leaves first. `tree.pinned` exists for nodes that
should keep their cached eval regardless of the cap, but nothing populates it:
Plan 4's saved lines deliberately do **not** reference tree node ids (see
[[Known Issues]]) — a saved line is PGN plus its starting FEN, replayed fresh
into whatever tree exists when it is opened. Critically,
**eviction discards only the cached `eval`, never a position the user can
still navigate to** — the tree only grows, and memory is bounded by dropping
evaluations, not history — so this is a missed perf optimisation, not a
correctness gap.

## Invariants

Break any of these and the failure will be subtle and late.

1. **The core imports no React.** Enforced by `src/test/purity.test.ts`.
2. **The tree is the only source of position state.** No parallel copy. The
   store's `lastPlayedId` is not one: it records how the current node was
   *reached*, which the tree deliberately does not keep — see
   [[Decisions/Arrival By Move Versus Navigation]].
3. **One search, three lines.** Candidates come from a single `MultiPV=3`
   search — see [[Decisions/Single MultiPV Search]].
4. **Evaluations are White-relative above the UCI layer.** UCI reports
   side-to-move-relative; normalization happens once, at the boundary. See
   [[Decisions/White-Relative Evaluations]].
5. **Stale results are discarded by node id**, never rendered.
6. **Eviction never removes a reachable node.**
7. **Press feedback uses `box-shadow`, never a box-model property.** Collapsing a
   border or padding on `:active` reflows the page on every click. Verified by
   bounding-box measurement in a real browser.
8. **`prefers-reduced-motion` still leaves a visible press signal.** Removing
   motion must not remove feedback entirely.
9. **Sound never throws.** A missing or unloadable file plays nothing, logs
   nothing.
10. **Checkpoints are keyed by their authored `id`, never by position or ply
    index.** Editing a lesson's move order must not silently reassign past
    progress records.
11. **Progress writes never throw.** Corrupt or unreadable storage degrades to
    empty progress with a notice; a failed write reports a reason instead of
    throwing. Neither may take the app down. See [[Current State]] for the
    specifics.

## The delicate part

`src/engine/engine.ts` is the most fragile code in the repo and the one to read
carefully before editing. Its search-serialization protocol took six revisions;
the first three each traded one bug for another. Full account in
[[Decisions/Engine Search Serialization]].

## Failure handling

The theme is **degrade, never blank**.

| Failure | Behaviour |
|---|---|
| Engine fails to load or crashes | "Engine unavailable" card with a retry button. Authored content still works; only live eval is lost. |
| Engine slow | Results stream by depth; the UI never blocks. |
| Stale results | Discarded by node id tag. |
| localStorage corrupt, unreadable, or an unknown version | Caught in `src/progress/storage.ts`; resets to empty progress with a `recovered` flag, surfaced as a `role="status"` notice in the picker. |
| localStorage full or otherwise unwritable | `saveProgress` reports `{ ok: false, reason }` rather than throwing; surfaced as `saveFailed` in the picker and in `SavedLines`, the two places that write. |
| Invalid content file | *(Planned)* caught by tests in CI; at runtime renders an error card. |

## Stack

Vite · React 19 · TypeScript · chess.js · react-chessboard 5 · Stockfish 18
(WASM, single-threaded) · Zustand 5 · Howler · Vitest + React Testing Library ·
Zod (Plan 3)

`framer-motion` was removed 2026-08-04 (Plan 2, Task 9): it was a declared
runtime dependency imported nowhere, and the compare drawer's entrance
animation — its last plausible use — is a CSS `@keyframes` instead. All motion
in this app is CSS.

React 19 rather than the spec's React 18 — see
[[Decisions/React 19 Upgrade]]. Engine build choice in
[[Decisions/Single-Threaded Stockfish Build]].

## The app shell (Plan 5, 2026-08-09)

`src/App.tsx` is a CSS grid exactly one viewport tall: header, then a
three-column main region (`.app-shell`'s `grid-template-rows` is `auto 1fr`).
**The board column never moves.** Only the two side
rails change contents by mode — picker plus saved lines when idle, the lesson
rail during a lesson, and the candidate rail handing its whole column to
`CheckpointPanel` while a checkpoint is being asked.

Three invariants hold this together:

- **`min-height: 0` on the rails** is what makes them scroll rather than grow
  the page. Without it a grid item refuses to shrink below its content, and it
  fails silently, only at small window heights.
- **Every child of `.app-main` is explicitly placed.** An empty, definitely
  positioned `.compare-portal` once stole row 1 from auto-placement and pushed
  the board and candidate rail into an implicit row 2 on every page load. Leave
  no child auto-placed.
- **The board is sized by container-query units** — `min(100cqw, 100cqh)` — so
  it is square by construction. Both `aspect-ratio` variants were measured
  failing, in both directions; see
  `docs/superpowers/plans/spike-results-shell.md`. `container-type: size` needs
  a definite size on both axes, so the flowing fallback below 1100x640 must
  reset it to `normal` or the board vanishes.

`CompareDrawer` renders through a React portal into `.compare-portal`, letting
it span the centre and right columns while still being owned by the rail that
opened it.

**One shared condition, one definition.** `askingCheckpoint(active)` in
`src/lesson/store.ts` is the single source of truth for "a checkpoint is being
asked". Both `CandidateRail`, which decides whether to mount the panel, and
`CheckpointPanel`, which renders it, call it. They previously each held their
own copy of the rule and drifted — see [[Known Issues]] and [[Start Here]].

**A checkpoint outranks engine status, and there is only one search.**
`CandidateRail`'s checkpoint gate sits *above* its `unavailable` and thinking
returns (2026-08-10): the prompt and the hint ladder are lesson content and
must reach the player whether or not a search ever returns. Only the authored
comparison is engine-derived, and it degrades to absent. The panel takes
`result`, `status` and `onRetry` as props rather than calling `useAnalysis()`
itself — a second call meant two `go depth 20` searches on the same FEN, the
second aborting the first, against **one search, three lines**. The
engine-unavailable notice and its retry live in
`src/ui/EngineUnavailableNotice.tsx` so both renderers share one copy.

Keyboard board navigation is documented in
[[Decisions/Keyboard Board Navigation Model]].


## The lesson quiz loop (Plan 6, 2026-08-13)

An opening lesson asks for every move on the player's side. Three mechanisms
carry it, and the boundaries between them are where the bodies were buried.

**Auto-play lives in exactly one hook**, `src/ui/useLessonAutoplay.ts`, called
once from `App`. It fires only when four guards agree: an opening lesson is
running, the line is on-script and unfinished, the side to move is *not* the
player's, and the selected node has no children.

- **Side-to-move, never "this move has no checkpoint."** Those coincide only
  once the content is finished; inferring from the missing checkpoint would
  have played the player's own moves for them throughout the build.
- **Tip-of-line, or the lesson fights the player.** Without it, stepping back to
  review drags you forward again 700ms later.
- **Openings only.** Theme lessons pace themselves with "Play the next move";
  this guard was missing for three tasks and quietly changed all four of them.

**A rejected answer is the one piece of lesson state that is stored**, because
it is the one thing that cannot be derived: the tree is the source of truth for
position, and a rejected move deliberately never enters it. `Board` writes
`lastRejection` and `lastAcceptance` (both carrying the node they belong to);
`CheckpointPanel` and `MoveFeedback` read them. Everything else in the runner is
re-derived from the tree by `deriveLessonState`.

**`askingCheckpoint(active)` in `src/lesson/store.ts` is the single decider of
"is a checkpoint being asked".** Three components call it. Do not add a fourth
copy of the rule - a duplicate of exactly this condition caused a Critical in
Plan 5. Note that "is an *opening lesson* running" is a genuinely different
question, and `CandidateRail` asks both: the first to hide the candidates for
the whole lesson, the second to decide whether there is a question to show.

**Content is validated in two directions.** `validateLessonChess` replays every
authored move, answer and near-miss key through chess.js; `validateOpeningCoverage`
proves every player-side move in an opening carries a checkpoint - with whose
turn it is taken **from the position**, never from index parity, because a
segment may start Black-to-move or override its lesson's side.

## The moves table (Plan 7, 2026-08-15)

`Breadcrumb.tsx` is deleted. `src/tree/movesTable.ts`'s `buildMovesTable` is
the only place that turns the tree into a displayed line, and it is called
fresh on every render from `src/ui/MovesTable.tsx` — **the table stores no
line of its own**, the same discipline the lesson layer follows for position.

- **One walk produces both the rows and the navigation order.** `pathTo` gives
  the ancestors of the selected node; a second walk then follows whichever
  child had the greatest `lastSelectedAt` at each branch, for as long as
  children exist. Rows are numbered from each position's own FEN fullmove
  field, never from index parity — the same rule `validateOpeningCoverage`
  already enforces on lesson content, now enforced on display too.
- **This is what makes the table survive stepping back.** The breadcrumb it
  replaced rendered only the ancestor path, so selecting an earlier node
  dropped everything after it from view (though never from the tree). The
  moves table's forward walk means the continuation stays listed and
  clickable — confirmed in a browser 2026-08-15, the whole reason this plan
  existed.
- **Deriving the rows and the four controls (first/previous/next/last) from
  one `lineIds` array** is deliberate: this repo's recurring failure mode is
  two correct-looking definitions of the same idea drifting apart
  ([[Lessons]] §5), and a control that disagreed with a row about what the
  line is would be exactly that.
- **Arrow keys are focus-scoped.** The table only intercepts `ArrowLeft` /
  `ArrowRight` when it holds DOM focus; the board's own keyboard cursor (also
  Arrow-key driven) is a different focus target and unaffected.

**One fix travelled with this plan but predates it.** `.app-main` was missing
`min-height: 0` — the same rule `.app-rail` already needed (see "The app
shell" above) — so `.app-shell`'s `1fr` row grew to fit content instead of the
viewport, and `overflow: hidden` silently clipped the excess. Long rail
content, including a long moves table, vanished off the bottom unscrollable.
Full measurement in the CSS comment above `.app-main` in `src/ui/theme.css`.
