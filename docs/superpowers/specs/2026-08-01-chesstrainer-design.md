# ChessTrainer — Design Spec

**Date:** 2026-08-01
**Status:** Approved for planning

## 1. What we're building

A local web app that teaches chess fundamentals to new and lower-intermediate
players by letting them explore and compare real opening lines with an engine's
help, and by running short authored lessons through that same explorer.

The two features are one system. A lesson is a curated path through the move
tree with notes and checkpoints attached to its nodes. Branching off a lesson to
explore is not an escape from the lesson — it is the same screen, the same tree,
and the same explanation machinery.

**Audience:** players who already know how the pieces move. Not absolute
beginners (no "the knight moves in an L" content), not advanced players (no deep
theory, no endgame tablebases).

**Success criteria:**

- A player can step through an opening, be asked to find a move, get it wrong,
  receive a specific and useful reply, and understand why the right move is right.
- A player can take any position, see the engine's top three moves, branch into
  two of them, and get a comparison that explains the difference in terms of
  ideas rather than centipawns.
- Interacting with the app is physically satisfying: responsive buttons, sound,
  and immediate feedback.

## 2. Decisions taken

| Decision | Choice | Reasoning |
|---|---|---|
| Primary feature | Line explorer, with lessons as a content layer over it | Lessons ride the same board, tree, and explainer; no second app |
| Explanations | Hybrid — authored annotations for curated openings, rule-based explainer for anything off-book | Quality where it matters, graceful coverage everywhere; no API cost, works offline |
| Lesson shape | Guided line with "your move" checkpoints and free branching | Teaching and practice in one flow |
| v1 content | 3 openings (~8–10 moves deep) + 4 theme lessons | Usable on day one; content lives in data files and grows without code changes |
| Layout | One large board + candidate rail; compare opens in a drawer | Board stays playable; a lesson rail fits the same screen; compare is one click |
| Visual style | Bright & bouncy — warm wood board, chunky pressable buttons, rounded bold type, orange/purple accents. Compare drawer is calmer and denser. | Directly serves the "satisfying buttons and sounds" goal without making the analysis panel cartoonish |
| Persistence | localStorage — lesson progress, checkpoint accuracy, "My Lines" | Makes the app feel owned; no backend, no accounts |
| Architecture | Single game tree as source of truth | Branch-off-and-return and compare fall out of the data model instead of being special-cased |

**Platform:** local web app, desktop-first. Responsive down to tablet; phone is
best-effort.

## 3. Stack

- **Vite + React 18 + TypeScript**
- **chess.js** — legal move generation, SAN, FEN
- **react-chessboard** — board surface, drag and drop, animation hooks
- **stockfish.wasm** — engine, in a Web Worker, driven over UCI
- **Zustand** — tree store
- **Framer Motion** — springs and drawer transitions
- **Howler** — sound pooling and playback
- **Vitest + React Testing Library + Zod** — tests and content validation

### 3.1 Verification spike (do this first)

Two assumptions are load-bearing and both have moved recently. Run a throwaway
spike before finalising the implementation plan:

1. **`react-chessboard` current prop API.** Confirm the version's actual props
   for custom pieces, square styles, and animation duration.
2. **Stockfish WASM build selection.** Multi-threaded builds require
   `SharedArrayBuffer`, which requires COOP/COEP headers — a real constraint for
   a static local app. Confirm the single-threaded build's speed at our target
   depth.

If the single-threaded build is too slow, that changes the **depth budget**, not
the architecture. Record the measured result in the plan.

## 4. Architecture

### 4.1 Module map

| Module | Responsibility | Depends on |
|---|---|---|
| `engine/` | UCI wrapper over the Stockfish worker. `analyze(fen, {depth, multiPV})` returns a promise and cancels any in-flight search when superseded. MultiPV=3 produces the candidate rail in a single search. | — |
| `chess/` | Thin helpers over chess.js, plus **position feature extraction**: center control, development, king safety, mobility, pawn structure, hanging pieces | chess.js |
| `tree/` | The game tree: node type, path addressing, insert / select / prune / evict, eval memoisation | `chess/` |
| `explain/` | Pure ranking functions turning a position pair + eval delta into ordered `Reason[]`; authored annotations take precedence | `chess/` |
| `content/` | Opening and theme data files, Zod schema, validating loader | `chess/` |
| `lesson/` | Derives the current step from the tree selection; checkpoint grading; hint tiers | `tree/`, `content/` |
| `progress/` | Versioned localStorage: completions, checkpoint accuracy, saved lines | — |
| `sound/` | Preload, pool, playback; honours mute and `prefers-reduced-motion` | — |
| `ui/` | Board, candidate rail, breadcrumb, compare drawer, lesson rail, feedback | all |

**Key boundary:** `engine/`, `chess/`, `explain/`, and `tree/` contain no React
and no DOM. The explainer — the component most likely to be subtly wrong — is
therefore testable against a table of FEN fixtures. That is where the TDD effort
belongs.

### 4.2 Data flow

```
user action (click candidate / drag piece / advance lesson)
  → tree.select(nodeId)  or  tree.insert(move)
  → engine.analyze(fen, multiPV: 3)   [tagged with nodeId, streams by depth]
  → tree caches EvalResult on the node
  → explain.reasons(before, move, after, evalDelta, pv)
  → ui renders board + candidate rail + lesson rail
```

Results tagged with a node id that is no longer current are **discarded, not
rendered**.

## 5. Data model

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
  annotationRef?: string;                // → content/
}

interface EvalResult { depth: number; lines: PvLine[]; }   // MultiPV, best first
interface PvLine { san: string; cp: number | null; mate: number | null; pv: string[]; }
```

**Growth control.** Authored nodes and anything referenced by "My Lines" are
pinned. Explored nodes are capped at ~1000 and evicted least-recently-selected,
leaves first. Eviction discards only the cached `eval`, never a position the user
can still navigate to.

```ts
interface Progress {
  version: 1;
  lessons: Record<LessonId, {
    completedAt?: string;
    checkpoints: Record<string, { attempts: number; hintsUsed: number; solved: boolean }>;
  }>;
  savedLines: { id: string; name: string; pgn: string; createdAt: string }[];
}
```

Saved lines are stored as **PGN**, not node paths — portable, replayable, and
immune to changes in the tree's addressing scheme.

## 6. Content format

One shape serves both lesson types. An opening lesson has a single segment; a
theme lesson has several short segments drawn from different openings.

```yaml
id: italian-game
title: The Italian Game
side: white
tags: [center-control, development]
segments:
  - startFen: null                       # null = normal starting position
    moves:
      - san: e4
        note: "Claims the center and opens lines for the bishop and queen at once."
      - san: e5
      - san: Nf3
        note: "Develops *and* attacks e5. A developing move that also makes a threat is a free tempo."
      - san: Nc6
      - checkpoint:
          prompt: "Develop the light-squared bishop to its most aggressive square."
          accept: [Bc4]
          hints:
            - "Aim at Black's weakest point."
            - "f7 is defended by the king and nothing else."
            - "The bishop belongs on c4."
          nearMiss:
            Bb5: "Also strong — that's the Ruy Lopez. But we're on the Italian, where c4 hits f7 directly."
        san: Bc4
        note: "The bishop takes aim at f7, the square only the king defends."
        alternatives:
          - san: d4
            name: Scotch Game
            note: "Strikes in the center immediately instead of developing quietly."
            pros: ["Opens lines at once", "Frees the pieces quickly", "Less theory to memorise"]
            cons: ["Gives up the e-pawn's central grip", "Punishes slow development harder"]
```

Zod-validated. A test replays every `san` through chess.js, so a typo fails the
test suite rather than blanking the board at runtime.

### 6.1 v1 content list

**Openings** (~8–10 moves deep, main branches annotated):

1. **Italian Game** — as White
2. **A Black answer to 1.e4** — the `1…e5` setup, reaching the same structures from the other side
3. **London System** — as White, a low-theory system opening

**Theme lessons**, each anchored in positions drawn from the openings above so
the ideas reinforce each other:

1. Control the center
2. Piece development and tempo
3. Forks and pins
4. Attacking the kingside

## 7. The explainer

```ts
type ReasonTag = 'center' | 'development' | 'king-safety' | 'material' | 'fork'
               | 'pin' | 'hanging' | 'tempo' | 'pawn-structure' | 'mobility' | 'space';

interface Reason { tag: ReasonTag; polarity: 'good' | 'bad'; weight: number; text: string; }
```

Each rule reads a before/after feature pair and emits reasons; the top two or
three by weight are rendered as prose.

**The engine supplies the magnitude, the rules supply the vocabulary.**
Centipawn loss relative to the best move maps to standard bands:

| Loss (cp) | Band |
|---|---|
| ≤ 20 | Best / excellent |
| ≤ 50 | Good |
| ≤ 100 | Inaccuracy |
| ≤ 250 | Mistake |
| > 250 | Blunder |

Authored annotations, where present, take precedence over generated prose.

### 7.1 Compare

Given two sibling candidates: walk each engine PV out ~8 plies, extract features
at both endpoints, and contrast them.

The verdict line is deliberately calibrated. When the eval difference is under
roughly 0.3, it says *"practically equal — the real difference is character"* and
leads with the structural contrast. Telling a beginner that +0.31 beats +0.28
would teach them something false.

## 8. Interaction flows

1. **Explore.** Engine runs MultiPV=3 on the current node. Each candidate shows
   SAN, eval, opening name if known, and a one-line idea. Clicking advances the
   board and grows the breadcrumb; clicking a crumb pops back with the subtree
   preserved.
2. **Free move.** Any legal move can be dragged, not only listed candidates. It
   is played, analysed, and graded against the best move with an explanation —
   this is the "why was that bad?" path. Illegal drags snap back.
3. **Lesson.** The rail runs down the side of the same screen; notes advance with
   the moves. At a checkpoint the rail asks for a move and **the candidate rail
   hides so it cannot leak the answer**. Three hint tiers on demand, each logged
   against accuracy. `nearMiss` moves get their authored reply rather than a
   generic "wrong." Going off-script is not an error state — a "return to lesson"
   pill waits in the rail until taken.
4. **Compare.** Select two siblings, or hit Compare on the top two. The drawer
   slides up with two mini-boards, eval bars, pros/cons, and the verdict line.

## 9. Feel: motion and sound

Buttons carry a 4px bottom lip and lose it on press with a 3px translate. Springs
overshoot slightly. Board moves animate ~180ms.

| Event | Sound |
|---|---|
| Piece pickup | Soft pop |
| Piece placed (quiet move) | Rounded thunk |
| Capture | Heavier thunk with a crunch |
| Check | Rising two-note |
| Checkpoint correct | Three-note rising chime |
| Checkpoint wrong | Soft descending tone, non-punishing |
| Hint revealed | Paper slide |
| Compare drawer opens | Whoosh |
| Lesson complete | Fanfare + confetti |

Button clicks get **±2 semitones of random pitch variation** so repeated presses
do not become a machine gun.

A mute toggle and `prefers-reduced-motion` are both honoured. Reduced motion
keeps every state change and drops the overshoot and confetti.

## 10. Failure handling

The theme is **degrade, never blank**.

| Failure | Behaviour |
|---|---|
| Engine fails to load or crashes | "Annotations only" mode with a visible banner and a retry button. All authored lesson content still works; only live eval and off-book explanation are lost. |
| Engine slow | Results stream. Depth 8 appears immediately and refines toward target with a visible depth indicator. The UI never blocks on analysis. |
| Stale results | Every `analyze` call is tagged with its node id; results for a non-current node are discarded, not rendered. |
| localStorage corrupt or full | Caught; progress resets with an explicit notice. Never a white screen. |
| Invalid content file | Caught by tests in CI. At runtime a failed lesson renders an error card; the rest of the app is unaffected. |

## 11. Testing

Vitest covers the pure modules, where most of the risk lives:

- A **FEN-fixture table for every explainer rule** — the highest-value tests here
- Position feature extraction cases
- Tree insert / select / evict, including eviction never orphaning a reachable node
- A content test replaying every authored `san` through chess.js
- Progress schema migration

The engine gets a **mocked UCI transport** for unit tests, plus **one smoke test
against the real worker** confirming a `bestmove` returns from the starting
position.

React Testing Library covers checkpoint grading, hint tiers, the candidate rail's
MultiPV rendering, and that the candidate rail hides during checkpoints.

**Accessibility:** keyboard board navigation, and success/failure never signalled
by colour alone.

No end-to-end suite in v1 — deferred deliberately.

## 12. Out of scope for v1

Each is a reasonable v2 with its own spec:

- Playing a full game against the engine
- Spaced repetition / mastery scoring
- Accounts, cloud sync, multi-device
- PGN repertoire import
- LLM-written explanations
- Phone-first layout
