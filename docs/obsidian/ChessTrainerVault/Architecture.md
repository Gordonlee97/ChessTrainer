---
updated: 2026-08-04
status: current
tags: [chesstrainer, architecture]
---

# Architecture

## Shape

A **pure TypeScript core with a thin React shell over it.** `src/chess/`,
`src/engine/`, and `src/tree/` contain no React and no DOM.

This is not a style preference — it is enforced. `src/test/purity.test.ts`
scans those directories for React imports (covering `from`, bare `import`,
`require()`, dynamic `import()`, and subpaths) and fails the build. Exactly one
file is exempted, by exact path: `src/tree/store.ts`, which is the Zustand
binding.

The payoff is that the components most likely to be subtly wrong — feature
extraction and, later, the explainer — are testable against FEN fixture tables
with no rendering involved.

## Modules

### Built

| Directory | Responsibility |
|---|---|
| `src/chess/` | Helpers over chess.js: position feature extraction (`features.ts`) and drop resolution (`resolveDrop.ts`) |
| `src/engine/` | UCI protocol parsing, the Stockfish Worker transport, and the `Engine` class that serializes searches |
| `src/tree/` | The immutable game tree (`tree.ts`) and its Zustand store (`store.ts`) |
| `src/sound/` | Howler wrapper: preload, pooling, mute, graceful degradation |
| `src/ui/` | Board, EvalBar, Breadcrumb, CandidateRail, Button, the analysis hook, theme tokens |

### Planned

| Directory | Responsibility | Status |
|---|---|---|
| `src/explain/` | Pure ranking functions: position pair + eval delta → ordered `Reason[]` | Not started |
| `src/content/` | Opening and theme data, Zod schema, validating loader | Not started |
| `src/lesson/` | Current step from tree selection; checkpoint grading; hint tiers | Not started |
| `src/progress/` | Versioned localStorage | Not started |

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
least-recently-selected, leaves first. Authored nodes and anything referenced by
"My Lines" are pinned. Critically, **eviction discards only the cached `eval`,
never a position the user can still navigate to** — the tree only grows, and
memory is bounded by dropping evaluations, not history.

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
| localStorage corrupt or full | *(Planned)* caught; progress resets with an explicit notice. |
| Invalid content file | *(Planned)* caught by tests in CI; at runtime renders an error card. |

## Stack

Vite · React 19 · TypeScript · chess.js · react-chessboard 5 · Stockfish 18
(WASM, single-threaded) · Zustand 5 · Framer Motion · Howler · Vitest + React
Testing Library · Zod (Plan 2)

React 19 rather than the spec's React 18 — see
[[Decisions/React 19 Upgrade]]. Engine build choice in
[[Decisions/Single-Threaded Stockfish Build]].
