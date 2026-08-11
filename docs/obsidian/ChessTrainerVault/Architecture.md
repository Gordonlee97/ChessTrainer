---
updated: 2026-08-10
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
| `src/tree/` | The immutable game tree (`tree.ts`) and its Zustand store (`store.ts`) |
| `src/sound/` | Howler wrapper: preload, pooling, mute, graceful degradation |
| `src/content/` | The authored corpus: the Zod schema (`schema.ts`), the parsing and chess-validating loader (`load.ts`), and seven lessons under `lessons/`. Validation replays every authored move, every accepted checkpoint answer, every `nearMiss` key and every `alternative` through chess.js — legality only; it cannot tell a legal move from a good one |
| `src/lesson/` | The runner. `lessonState.ts` derives where the player is by matching the tree's path against the segment's moves; `grade.ts` judges an attempted answer; `store.ts` is the only stateful piece and holds just the lesson id, the segment index, and per-checkpoint hint counts |
| `src/progress/` | A versioned progress object, reduced by pure functions (`progress.ts`) over a Zod-validated shape (`schema.ts`), read/written through resilient localStorage I/O (`storage.ts`) and a Zustand store (`store.ts`) that dedupes repeat attempts within a session and reports write failures. Nothing here knows about the tree or the lesson runner — recording is the UI's job, keyed by the authored checkpoint `id` the content layer guarantees is unique |
| `src/ui/` | Board, EvalBar, Breadcrumb, CandidateRail, QualityBadge, CompareDrawer, MiniBoard, Button, LessonPicker, LessonRail, SavedLines, AppControls, the analysis hook, theme tokens |

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
user action (drag a piece / click a candidate / click a breadcrumb)
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
2. **The tree is the only source of position state.** No parallel copy.
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

`src/App.tsx` is a CSS grid exactly one viewport tall: header, breadcrumb, then
a three-column main region. **The board column never moves.** Only the two side
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
