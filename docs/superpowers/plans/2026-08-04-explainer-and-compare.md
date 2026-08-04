# Plan 2 — The Explainer and Compare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app answer *why* — every move gets a plain-English reason and a quality band, and any two candidate moves can be put side by side with a calibrated verdict.

**Architecture:** A new React-free `src/explain/` turns a before/after `PositionFeatures` pair plus a centipawn loss into ranked `Reason[]`. It reads two new pure chess modules — pawn structure and tactical motifs — and is consumed by the candidate rail and a compare drawer. Engine evaluations move into a FEN-keyed cache so transposed positions stop being re-analysed.

**Tech Stack:** TypeScript, chess.js 1.4, React 19, Zustand, Vitest. No new runtime dependencies.

**Source spec:** `docs/superpowers/specs/2026-08-01-chesstrainer-design.md` (§7 explainer, §7.1 compare)
**Vault context:** `docs/obsidian/ChessTrainerVault/` — read `Start Here.md` first.

## Scope

This plan delivers the explanation layer only. **Content, the lesson runner, and progress persistence are Plan 3**, along with the mute toggle, keyboard board navigation, and a new-game control. Splitting here keeps each plan to something that produces working software on its own: after Plan 2 the explorer explains itself; after Plan 3 it teaches.

## Global Constraints

- **No React, react-dom, or zustand imports in `src/chess/`, `src/engine/`, `src/tree/`, or `src/explain/`.** `src/test/purity.test.ts` enforces this; **add `src/explain` to its `PURE_DIRS` list in Task 4.** `src/tree/store.ts` is the sole existing exemption.
- **Evaluations above `src/engine/` are White-relative**: positive always favours White, regardless of side to move. `PvLine` documents this. Never normalize a second time — see `Decisions/White-Relative Evaluations`.
- **Move-quality bands are fixed by the spec**, measured as centipawn loss versus the engine's best move:

  | Loss (cp) | Band |
  |---|---|
  | ≤ 20 | best |
  | ≤ 50 | good |
  | ≤ 100 | inaccuracy |
  | ≤ 250 | mistake |
  | > 250 | blunder |

- **The compare verdict is calibrated, not cosmetic.** Under a 30cp difference it must say the lines are practically equal and lead with the structural contrast. Telling a beginner that +0.31 beats +0.28 teaches something false.
- **Attack maps use chess.js `isAttacked(square, color)` / `attackers(square, color)`.** Do not hand-roll attack detection.
- **Press feedback uses `box-shadow`, never a box-model property** — collapsing a border or padding on `:active` reflows the page on every click.
- **`prefers-reduced-motion` is honoured**, and must still leave a visible press signal.
- **The tree stays path-addressed.** Transpositions are deduped at the *evaluation* layer only — see `Decisions/Transposition Identity`.
- Commit with conventional prefixes: `feat` `fix` `test` `docs` `chore`.
- `npm test` and `npm run typecheck` before any task is reported complete. One expected skip: `src/engine/engine.smoke.test.ts` needs a real `Worker`. **A second skip is a real failure.**

---

### Task 1: Pawn-structure features

**Files:**
- Create: `src/chess/pawnStructure.ts`
- Test: `src/chess/pawnStructure.test.ts`
- Modify: `src/chess/features.ts` (add `pawnStructure` to `PositionFeatures`)
- Modify: `src/chess/features.test.ts` (one assertion for the new field)

**Interfaces:**
- Consumes: chess.js only.
- Produces:
  - `PawnStructure { doubled: Record<Color, number>; isolated: Record<Color, Square[]>; passed: Record<Color, Square[]>; islands: Record<Color, number> }`
  - `extractPawnStructure(fen: string): PawnStructure`
  - `PositionFeatures.pawnStructure: PawnStructure` — Task 6's rules read this.

The explainer cannot talk about pawn structure until this exists, which is why it is first.

- [ ] **Step 1: Write the failing tests**

Fixtures use pawns and kings only, so each assertion is checkable by eye.

`src/chess/pawnStructure.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractPawnStructure } from './pawnStructure';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White pawns a2 b2 g2 h2 — two groups, no black pawns
const TWO_ISLANDS = '4k3/8/8/8/8/8/PP4PP/4K3 w - - 0 1';
// White pawns a2 a3 — doubled, and isolated (no b-file pawn)
const DOUBLED_ISOLATED = '4k3/8/8/8/8/P7/P7/4K3 w - - 0 1';
// Lone white e4 pawn, no black pawns at all
const PASSED = '4k3/8/8/8/4P3/8/8/4K3 w - - 0 1';
// Black d7 pawn sits ahead on an adjacent file, so e4 is not passed
const BLOCKED = '4k3/3p4/8/8/4P3/8/8/4K3 w - - 0 1';

describe('extractPawnStructure', () => {
  it('reports one island per side and nothing else at the start', () => {
    const s = extractPawnStructure(START);
    expect(s.islands).toEqual({ w: 1, b: 1 });
    expect(s.doubled).toEqual({ w: 0, b: 0 });
    expect(s.isolated).toEqual({ w: [], b: [] });
    expect(s.passed).toEqual({ w: [], b: [] });
  });

  it('counts pawn islands as contiguous occupied files', () => {
    expect(extractPawnStructure(TWO_ISLANDS).islands.w).toBe(2);
  });

  it('counts a doubled pawn once, not twice', () => {
    expect(extractPawnStructure(DOUBLED_ISOLATED).doubled.w).toBe(1);
  });

  it('reports both pawns of an unsupported file as isolated', () => {
    const s = extractPawnStructure(DOUBLED_ISOLATED);
    expect(s.isolated.w.sort()).toEqual(['a2', 'a3']);
  });

  it('reports a pawn with no enemy pawn ahead or adjacent as passed', () => {
    expect(extractPawnStructure(PASSED).passed.w).toEqual(['e4']);
  });

  it('does not report a pawn blocked by an adjacent-file enemy pawn as passed', () => {
    const s = extractPawnStructure(BLOCKED);
    expect(s.passed.w).toEqual([]);
    // Symmetric: the white e4 pawn is adjacent-and-ahead of black's d7
    expect(s.passed.b).toEqual([]);
  });

  it('treats a position with no pawns as zero islands', () => {
    expect(extractPawnStructure('4k3/8/8/8/8/8/8/4K3 w - - 0 1').islands).toEqual({ w: 0, b: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/chess/pawnStructure.test.ts`
Expected: FAIL — `Failed to resolve import "./pawnStructure"`.

- [ ] **Step 3: Implement `src/chess/pawnStructure.ts`**

```ts
import { Chess, type Color, type Square } from 'chess.js';

const FILES = 'abcdefgh';
const COLORS: Color[] = ['w', 'b'];

export interface PawnStructure {
  /** Pawns beyond the first on any file, summed. Two pawns on a file counts 1. */
  doubled: Record<Color, number>;
  /** Pawns with no friendly pawn on either adjacent file. */
  isolated: Record<Color, Square[]>;
  /** Pawns with no enemy pawn ahead of them on their own or an adjacent file. */
  passed: Record<Color, Square[]>;
  /** Contiguous runs of files holding at least one pawn. */
  islands: Record<Color, number>;
}

interface PawnPos {
  square: Square;
  file: number; // 0 = a
  rank: number; // 1..8
}

function pawnsOf(chess: Chess, color: Color): PawnPos[] {
  return chess
    .board()
    .flat()
    .filter((cell) => cell !== null && cell.type === 'p' && cell.color === color)
    .map((cell) => {
      const square = cell!.square;
      return { square, file: FILES.indexOf(square[0]), rank: Number(square[1]) };
    });
}

function countIslands(pawns: PawnPos[]): number {
  const files = [...new Set(pawns.map((p) => p.file))].sort((a, b) => a - b);
  let islands = 0;
  for (let i = 0; i < files.length; i += 1) {
    if (i === 0 || files[i] !== files[i - 1] + 1) islands += 1;
  }
  return islands;
}

function countDoubled(pawns: PawnPos[]): number {
  const perFile = new Map<number, number>();
  for (const p of pawns) perFile.set(p.file, (perFile.get(p.file) ?? 0) + 1);
  let doubled = 0;
  for (const count of perFile.values()) doubled += count - 1;
  return doubled;
}

/** A pawn is passed when no enemy pawn stands ahead of it on its own or an adjacent file. */
function isPassed(pawn: PawnPos, color: Color, enemyPawns: PawnPos[]): boolean {
  return !enemyPawns.some((enemy) => {
    if (Math.abs(enemy.file - pawn.file) > 1) return false;
    return color === 'w' ? enemy.rank > pawn.rank : enemy.rank < pawn.rank;
  });
}

export function extractPawnStructure(fen: string): PawnStructure {
  const chess = new Chess(fen);
  const byColor = { w: pawnsOf(chess, 'w'), b: pawnsOf(chess, 'b') };

  const doubled = { w: 0, b: 0 } as Record<Color, number>;
  const isolated = { w: [], b: [] } as Record<Color, Square[]>;
  const passed = { w: [], b: [] } as Record<Color, Square[]>;
  const islands = { w: 0, b: 0 } as Record<Color, number>;

  for (const color of COLORS) {
    const own = byColor[color];
    const enemy = byColor[color === 'w' ? 'b' : 'w'];
    const ownFiles = new Set(own.map((p) => p.file));

    doubled[color] = countDoubled(own);
    islands[color] = countIslands(own);

    for (const pawn of own) {
      if (!ownFiles.has(pawn.file - 1) && !ownFiles.has(pawn.file + 1)) {
        isolated[color].push(pawn.square);
      }
      if (isPassed(pawn, color, enemy)) passed[color].push(pawn.square);
    }

    isolated[color].sort();
    passed[color].sort();
  }

  return { doubled, isolated, passed, islands };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/chess/pawnStructure.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Add `pawnStructure` to `PositionFeatures`**

In `src/chess/features.ts`, import the module and add the field. Add to the `PositionFeatures` interface:

```ts
  /** Doubled, isolated, and passed pawns, plus pawn-island counts. */
  pawnStructure: PawnStructure;
```

Add the import at the top:

```ts
import { extractPawnStructure, type PawnStructure } from './pawnStructure';
```

and include it in the object `extractFeatures` returns:

```ts
  return {
    centerControl,
    developedMinors,
    castled,
    material,
    mobility,
    hanging,
    pawnStructure: extractPawnStructure(fen),
  };
```

Add one assertion to `src/chess/features.test.ts` inside the existing start-position test:

```ts
    expect(f.pawnStructure.islands).toEqual({ w: 1, b: 1 });
```

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all pass, one skip (`engine.smoke.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/chess
git commit -m "feat: add pawn-structure features for the explainer"
```

---

### Task 2: Tactical motif detection

**Files:**
- Create: `src/chess/tactics.ts`
- Test: `src/chess/tactics.test.ts`

**Interfaces:**
- Consumes: chess.js only.
- Produces:
  - `Fork { forker: Square; targets: Square[] }`
  - `Pin { pinner: Square; pinned: Square; against: Square }`
  - `findFork(fen: string, from: Square): Fork | null`
  - `findPin(fen: string, from: Square): Pin | null`

Both answer "what did the piece that just moved to `from` create?", so the explainer can say "forks the queen and rook" rather than "material may change".

Note both use `attackers(square, color)`, which reports attacks **regardless of whose turn it is** — no FEN turn-flipping needed.

- [ ] **Step 1: Write the failing tests**

`src/chess/tactics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findFork, findPin } from './tactics';

// A knight on d5 attacks b4 b6 c3 c7 e3 e7 f4 f6 — so it hits both the queen
// on b6 and the rook on f6.
const KNIGHT_FORK = '4k3/8/1q3r2/3N4/8/8/8/4K3 w - - 0 1';
// Same knight, only the f6 rook in range
const NO_FORK = '4k3/8/5r2/3N4/8/8/8/4K3 w - - 0 1';
// Bishop b5, knight c6, king e8 — one unbroken diagonal
const BISHOP_PIN = '4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1';
// The same board with Black to move: a pin is a fact about the position, not
// about whose turn it is
const PIN_BLACK_TO_MOVE = '4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1';
// Rook a1 pins the bishop a5 against the king a8 down the a-file
const ROOK_PIN = 'k7/8/8/b7/8/8/8/R3K3 w - - 0 1';

describe('findFork', () => {
  it('finds a knight forking two valuable pieces', () => {
    const fork = findFork(KNIGHT_FORK, 'd5');
    expect(fork).not.toBeNull();
    expect(fork!.forker).toBe('d5');
    expect(fork!.targets.sort()).toEqual(['b6', 'f6']);
  });

  it('returns null when only one enemy piece is attacked', () => {
    expect(findFork(NO_FORK, 'd5')).toBeNull();
  });

  it('returns null when the square is empty', () => {
    expect(findFork(NO_FORK, 'h8')).toBeNull();
  });
});

describe('findPin', () => {
  it('finds a bishop pinning a knight against the king', () => {
    const pin = findPin(BISHOP_PIN, 'b5');
    expect(pin).toEqual({ pinner: 'b5', pinned: 'c6', against: 'e8' });
  });

  it('finds a rook pin along a file', () => {
    const pin = findPin(ROOK_PIN, 'a1');
    expect(pin).toEqual({ pinner: 'a1', pinned: 'a5', against: 'a8' });
  });

  it('returns null for a knight, which cannot pin', () => {
    expect(findPin(KNIGHT_FORK, 'd5')).toBeNull();
  });

  it('returns null when the square is empty', () => {
    expect(findPin(BISHOP_PIN, 'h1')).toBeNull();
  });

  it('does not treat the side-to-move flag as relevant', () => {
    expect(findPin(PIN_BLACK_TO_MOVE, 'b5')).toEqual({
      pinner: 'b5',
      pinned: 'c6',
      against: 'e8',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/chess/tactics.test.ts`
Expected: FAIL — `Failed to resolve import "./tactics"`.

- [ ] **Step 3: Implement `src/chess/tactics.ts`**

```ts
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { PIECE_VALUES } from './features';

const FILES = 'abcdefgh';

export interface Fork {
  forker: Square;
  targets: Square[];
}

export interface Pin {
  pinner: Square;
  pinned: Square;
  against: Square;
}

const DIAGONALS: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ORTHOGONALS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function directionsFor(piece: PieceSymbol): [number, number][] {
  if (piece === 'b') return DIAGONALS;
  if (piece === 'r') return ORTHOGONALS;
  if (piece === 'q') return [...DIAGONALS, ...ORTHOGONALS];
  return [];
}

function toSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}` as Square;
}

function enemyOf(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/**
 * Reports a fork created by the piece standing on `from`: two or more enemy
 * pieces it attacks that are either worth more than it or left undefended.
 * Returns null when there is no piece there, or fewer than two such targets.
 */
export function findFork(fen: string, from: Square): Fork | null {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece) return null;

  const enemy = enemyOf(piece.color);
  const forkerValue = PIECE_VALUES[piece.type];

  const targets = chess
    .board()
    .flat()
    .filter((cell) => cell !== null && cell.color === enemy)
    .map((cell) => cell!)
    .filter((cell) => chess.attackers(cell.square, piece.color).includes(from))
    .filter((cell) => {
      // A king is always worth attacking; otherwise the target must be worth
      // more than the forker, or be undefended.
      if (cell.type === 'k') return true;
      const defended = chess.attackers(cell.square, enemy).length > 0;
      return PIECE_VALUES[cell.type] > forkerValue || !defended;
    })
    .map((cell) => cell.square);

  return targets.length >= 2 ? { forker: from, targets: targets.sort() } : null;
}

/**
 * Reports a pin created by the sliding piece on `from`: the first enemy piece
 * along one of its rays, with the enemy king directly behind it on that same
 * ray. Returns null for non-sliding pieces and empty squares.
 */
export function findPin(fen: string, from: Square): Pin | null {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece) return null;

  const directions = directionsFor(piece.type);
  if (directions.length === 0) return null;

  const enemy = enemyOf(piece.color);
  const startFile = FILES.indexOf(from[0]);
  const startRank = Number(from[1]);

  for (const [df, dr] of directions) {
    let pinned: Square | null = null;

    for (let step = 1; step <= 7; step += 1) {
      const square = toSquare(startFile + df * step, startRank + dr * step);
      if (!square) break;

      const occupant = chess.get(square);
      if (!occupant) continue;

      if (pinned === null) {
        // First piece along the ray must be a non-king enemy to be pinnable.
        if (occupant.color !== enemy || occupant.type === 'k') break;
        pinned = square;
        continue;
      }

      // Second piece along the ray decides whether that was a pin.
      if (occupant.color === enemy && occupant.type === 'k') {
        return { pinner: from, pinned, against: square };
      }
      break;
    }
  }

  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/chess/tactics.test.ts`
Expected: PASS, 8 tests.

If the knight-fork fixture reports unexpected targets, print `findFork(KNIGHT_FORK, 'd5')` and check the FEN by eye before changing any assertion — the fixture is the thing most likely to be wrong, and a wrong fixture that is "fixed" by relaxing the assertion produces a test that proves nothing.

- [ ] **Step 5: Commit**

```bash
git add src/chess/tactics.ts src/chess/tactics.test.ts
git commit -m "feat: add fork and pin detection for the explainer"
```

---

### Task 3: FEN-keyed evaluation cache

**Files:**
- Create: `src/engine/evalCache.ts`
- Test: `src/engine/evalCache.test.ts`
- Modify: `src/ui/useAnalysis.ts`
- Modify: `src/ui/useAnalysis.test.ts`

**Interfaces:**
- Consumes: `EvalResult` from `src/engine/types`.
- Produces:
  - `class EvalCache { constructor(maxEntries?: number); get(fen: string): EvalResult | undefined; set(fen: string, result: EvalResult): void; readonly size: number; clear(): void }`
  - `sharedEvalCache: EvalCache` — the module-level instance `useAnalysis` uses.

This is the transposition decision made real: the tree keeps duplicate nodes for a transposed position, but they share one analysis. See `Decisions/Transposition Identity`.

Two rules the cache must follow:
- **Never replace a deeper result with a shallower one.** Streaming updates arrive shallow-first.
- **Bound the map.** Least-recently-used eviction. It is a second unbounded map otherwise, which is exactly what the decision note warns about.

- [ ] **Step 1: Write the failing tests**

`src/engine/evalCache.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EvalCache } from './evalCache';
import type { EvalResult } from './types';

const at = (depth: number): EvalResult => ({
  depth,
  lines: [{ san: 'e4', cp: 30, mate: null, pv: ['e4'] }],
});

const FEN_A = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_B = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

describe('EvalCache', () => {
  it('returns undefined for an unseen position', () => {
    expect(new EvalCache().get(FEN_A)).toBeUndefined();
  });

  it('stores and returns a result by FEN', () => {
    const cache = new EvalCache();
    cache.set(FEN_A, at(12));
    expect(cache.get(FEN_A)?.depth).toBe(12);
  });

  it('replaces a shallower result with a deeper one', () => {
    const cache = new EvalCache();
    cache.set(FEN_A, at(12));
    cache.set(FEN_A, at(20));
    expect(cache.get(FEN_A)?.depth).toBe(20);
    expect(cache.size).toBe(1);
  });

  it('keeps the deeper result when a shallower one arrives late', () => {
    const cache = new EvalCache();
    cache.set(FEN_A, at(20));
    cache.set(FEN_A, at(8));
    expect(cache.get(FEN_A)?.depth).toBe(20);
  });

  it('evicts the least recently used entry past the bound', () => {
    const cache = new EvalCache(2);
    cache.set(FEN_A, at(12));
    cache.set(FEN_B, at(12));
    cache.get(FEN_A);                      // refreshes A, making B least recent
    cache.set('third-fen', at(12));
    expect(cache.size).toBe(2);
    expect(cache.get(FEN_A)).toBeDefined();
    expect(cache.get(FEN_B)).toBeUndefined();
  });

  it('clears every entry', () => {
    const cache = new EvalCache();
    cache.set(FEN_A, at(12));
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/engine/evalCache.test.ts`
Expected: FAIL — `Failed to resolve import "./evalCache"`.

- [ ] **Step 3: Implement `src/engine/evalCache.ts`**

```ts
import type { EvalResult } from './types';

const DEFAULT_MAX_ENTRIES = 300;

/**
 * Caches engine results by FEN so a position reached through two different move
 * orders is analysed once. The game tree deliberately keeps both nodes — only
 * the analysis is shared. See the vault's `Decisions/Transposition Identity`.
 *
 * A `Map` preserves insertion order, which is what makes LRU eviction cheap:
 * re-inserting on read moves an entry to the end.
 */
export class EvalCache {
  private readonly entries = new Map<string, EvalResult>();

  constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

  get(fen: string): EvalResult | undefined {
    const found = this.entries.get(fen);
    if (!found) return undefined;
    this.entries.delete(fen);
    this.entries.set(fen, found);
    return found;
  }

  set(fen: string, result: EvalResult): void {
    const existing = this.entries.get(fen);
    // Streaming updates arrive shallow-first; never regress a deeper result.
    if (existing && existing.depth > result.depth) return;

    this.entries.delete(fen);
    this.entries.set(fen, result);

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

/** The instance the app uses. One cache per page, like the shared Engine. */
export const sharedEvalCache = new EvalCache();
```

- [ ] **Step 4: Run the cache tests**

Run: `npm test -- src/engine/evalCache.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Wire the cache into `useAnalysis`**

Open `src/ui/useAnalysis.ts`. It currently seeds state from `node.eval` and writes back with `cacheEval`. Make three changes, keeping everything else — especially the abort handling and the stale-result guard — exactly as it is:

1. Import the cache:

```ts
import { sharedEvalCache } from '../engine/evalCache';
```

2. Where the effect seeds the displayed result from `node.eval`, prefer whichever of the node's own eval and the FEN cache is deeper:

```ts
    // A transposed position may already have been analysed under a different
    // node id, so consult the FEN cache as well as this node's own eval.
    const cached = sharedEvalCache.get(node.fen);
    const seed =
      cached && (!node.eval || cached.depth > node.eval.depth) ? cached : node.eval ?? null;
    setResult(seed);
    if (seed && seed.depth >= TARGET_DEPTH) {
      setStatus('idle');
      return;
    }
```

3. Where the completed result is written back to the node, also write it to the cache:

```ts
        cacheEval(requestedFor, final);
        sharedEvalCache.set(node.fen, final);
```

**Do not remove `node.eval`.** Tree eviction clears node evals and its tests depend on that; the FEN cache is an additional layer, not a replacement.

- [ ] **Step 6: Add a regression test for transposition reuse**

Append to `src/ui/useAnalysis.test.ts`:

```ts
import { sharedEvalCache } from '../engine/evalCache';

describe('transposition reuse', () => {
  it('serves a previously analysed position from the FEN cache', () => {
    sharedEvalCache.clear();
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    sharedEvalCache.set(fen, {
      depth: 20,
      lines: [{ san: 'Nf3', cp: 31, mate: null, pv: ['Nf3'] }],
    });

    // Two different node ids can reach this same FEN; the cache is keyed by
    // position, so both get the analysis without a second search.
    expect(sharedEvalCache.get(fen)?.depth).toBe(20);
    expect(sharedEvalCache.get(fen)?.lines[0].san).toBe('Nf3');
  });
});
```

- [ ] **Step 7: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all pass, one skip.

If `useAnalysis` tests fail, the likely cause is cache state leaking between tests — `sharedEvalCache` is module-level. Add `sharedEvalCache.clear()` to the existing `beforeEach` in that file rather than making the cache per-test.

- [ ] **Step 8: Commit**

```bash
git add src/engine/evalCache.ts src/engine/evalCache.test.ts src/ui/useAnalysis.ts src/ui/useAnalysis.test.ts
git commit -m "feat: share engine evaluations across transpositions via a FEN cache"
```

---

### Task 4: Move-quality banding

**Files:**
- Create: `src/explain/quality.ts`
- Test: `src/explain/quality.test.ts`
- Modify: `src/test/purity.test.ts` (add `src/explain` to `PURE_DIRS`)

**Interfaces:**
- Consumes: `PvLine` from `src/engine/types`.
- Produces:
  - `QualityBand = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'`
  - `MATE_SCORE = 100000`
  - `toCentipawns(line: PvLine): number`
  - `centipawnLoss(best: PvLine, played: PvLine, mover: Color): number`
  - `classifyMove(best: PvLine, played: PvLine, mover: Color): { band: QualityBand; loss: number; label: string }`

**The single most important detail in this task:** scores are **White-relative**. For White the best line is the one with the *highest* score; for Black it is the *lowest*. Computing loss as `best - played` unconditionally inverts every judgement for Black — the explainer would praise Black's blunders.

- [ ] **Step 1: Add `src/explain` to the purity guard**

In `src/test/purity.test.ts`, add `'src/explain'` to the `PURE_DIRS` array so the new module is held to the same no-React rule as `chess/`, `engine/`, and `tree/`.

- [ ] **Step 2: Write the failing tests**

`src/explain/quality.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PvLine } from '../engine/types';
import { centipawnLoss, classifyMove, toCentipawns } from './quality';

const line = (cp: number | null, mate: number | null = null): PvLine => ({
  san: 'x',
  cp,
  mate,
  pv: ['x'],
});

describe('toCentipawns', () => {
  it('passes a centipawn score through', () => {
    expect(toCentipawns(line(31))).toBe(31);
  });

  it('maps mate for White to a large positive score', () => {
    expect(toCentipawns(line(null, 3))).toBeGreaterThan(90000);
  });

  it('maps mate against White to a large negative score', () => {
    expect(toCentipawns(line(null, -3))).toBeLessThan(-90000);
  });

  it('scores a faster mate higher than a slower one', () => {
    expect(toCentipawns(line(null, 1))).toBeGreaterThan(toCentipawns(line(null, 5)));
  });
});

describe('centipawnLoss', () => {
  it('measures how far White fell below the best move', () => {
    expect(centipawnLoss(line(100), line(40), 'w')).toBe(60);
  });

  it('measures how far Black rose above the best move', () => {
    // White-relative: Black wants the score LOW. Best -100, played -40,
    // so Black gave up 60 centipawns.
    expect(centipawnLoss(line(-100), line(-40), 'b')).toBe(60);
  });

  it('never reports a negative loss', () => {
    expect(centipawnLoss(line(40), line(100), 'w')).toBe(0);
  });

  it('reports zero when the played move is the best move', () => {
    expect(centipawnLoss(line(31), line(31), 'w')).toBe(0);
  });
});

describe('classifyMove', () => {
  it.each([
    [0, 'best'],
    [20, 'best'],
    [21, 'good'],
    [50, 'good'],
    [51, 'inaccuracy'],
    [100, 'inaccuracy'],
    [101, 'mistake'],
    [250, 'mistake'],
    [251, 'blunder'],
  ])('classifies a loss of %i as %s', (loss, band) => {
    expect(classifyMove(line(0), line(-loss), 'w').band).toBe(band);
  });

  it('classifies from Black\'s perspective correctly', () => {
    // Black played a move that raised White's score by 300 — a blunder.
    expect(classifyMove(line(0), line(300), 'b').band).toBe('blunder');
  });

  it('gives a human label alongside the band', () => {
    expect(classifyMove(line(0), line(0), 'w').label).toBe('Best move');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/explain/quality.test.ts`
Expected: FAIL — `Failed to resolve import "./quality"`.

- [ ] **Step 4: Implement `src/explain/quality.ts`**

```ts
import type { Color } from 'chess.js';
import type { PvLine } from '../engine/types';

export type QualityBand = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/** Mate is scored beyond any material advantage, discounted by distance. */
export const MATE_SCORE = 100000;

const BANDS: { maxLoss: number; band: QualityBand; label: string }[] = [
  { maxLoss: 20, band: 'best', label: 'Best move' },
  { maxLoss: 50, band: 'good', label: 'Good move' },
  { maxLoss: 100, band: 'inaccuracy', label: 'Inaccuracy' },
  { maxLoss: 250, band: 'mistake', label: 'Mistake' },
  { maxLoss: Infinity, band: 'blunder', label: 'Blunder' },
];

/**
 * Collapses a line's score to a single White-relative number so two lines can
 * be compared. Mate lines sort above every centipawn score, and a mate in 1
 * outranks a mate in 5.
 */
export function toCentipawns(line: PvLine): number {
  if (line.mate !== null) {
    const magnitude = MATE_SCORE - Math.abs(line.mate);
    return line.mate > 0 ? magnitude : -magnitude;
  }
  return line.cp ?? 0;
}

/**
 * How much the played move gave up against the best available one, in
 * centipawns, never negative.
 *
 * Scores are White-relative, so the direction of "worse" depends on who moved:
 * White wants the score high, Black wants it low. Subtracting unconditionally
 * would invert every judgement for Black.
 */
export function centipawnLoss(best: PvLine, played: PvLine, mover: Color): number {
  const bestScore = toCentipawns(best);
  const playedScore = toCentipawns(played);
  const loss = mover === 'w' ? bestScore - playedScore : playedScore - bestScore;
  return Math.max(0, loss);
}

export function classifyMove(
  best: PvLine,
  played: PvLine,
  mover: Color,
): { band: QualityBand; loss: number; label: string } {
  const loss = centipawnLoss(best, played, mover);
  const match = BANDS.find((entry) => loss <= entry.maxLoss)!;
  return { band: match.band, loss, label: match.label };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/explain/quality.test.ts`
Expected: PASS, 16 tests (the `it.each` block counts as 9).

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all pass, one skip. The purity guard now also scans `src/explain`.

- [ ] **Step 7: Commit**

```bash
git add src/explain src/test/purity.test.ts
git commit -m "feat: add move-quality banding with White-relative loss"
```

---

### Task 5: Explainer core

**Files:**
- Create: `src/explain/types.ts`
- Create: `src/explain/explain.ts`
- Test: `src/explain/explain.test.ts`

**Interfaces:**
- Consumes: `PositionFeatures` (Task 1), `Color`/`Square` from chess.js.
- Produces:
  - `ReasonTag`, `Reason`, `MoveContext`, `Rule` (in `types.ts`)
  - `buildContext(before: string, san: string, bestLine: PvLine | null, playedLine: PvLine | null): MoveContext` (in `explain.ts`)
  - `explainMove(ctx: MoveContext, rules?: Rule[]): Reason[]` — sorted by weight, descending
  - `describeMove(ctx: MoveContext, max?: number, rules?: Rule[]): string`

This task builds the ranking machinery and proves it with two trivial stub rules. Task 6 supplies the real rule set. Splitting them keeps this task's test about *ranking* rather than about chess.

- [ ] **Step 1: Write `src/explain/types.ts`**

```ts
import type { Color, Square } from 'chess.js';
import type { PositionFeatures } from '../chess/features';

export type ReasonTag =
  | 'center'
  | 'development'
  | 'king-safety'
  | 'material'
  | 'fork'
  | 'pin'
  | 'hanging'
  | 'tempo'
  | 'pawn-structure'
  | 'mobility'
  | 'space';

export interface Reason {
  tag: ReasonTag;
  polarity: 'good' | 'bad';
  /** Higher wins the ranking. Rules use 0-100 so they stay comparable. */
  weight: number;
  /** A complete sentence, ready to render. */
  text: string;
}

export interface MoveContext {
  /** FEN before the move was played. */
  before: string;
  /** FEN after the move was played. */
  after: string;
  san: string;
  from: Square;
  to: Square;
  /** The side that played the move. */
  mover: Color;
  featuresBefore: PositionFeatures;
  featuresAfter: PositionFeatures;
  /** Centipawns given up against the engine's best move; null when unknown. */
  loss: number | null;
}

export type Rule = (ctx: MoveContext) => Reason | Reason[] | null;
```

- [ ] **Step 2: Write the failing tests**

`src/explain/explain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildContext, describeMove, explainMove } from './explain';
import type { Reason, Rule } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const reason = (weight: number, text: string): Reason => ({
  tag: 'center',
  polarity: 'good',
  weight,
  text,
});

describe('buildContext', () => {
  it('derives the after-position and the move squares from SAN', () => {
    const ctx = buildContext(START, 'e4', null, null);
    expect(ctx.from).toBe('e2');
    expect(ctx.to).toBe('e4');
    expect(ctx.mover).toBe('w');
    expect(ctx.after).toContain(' b ');
    expect(ctx.loss).toBeNull();
  });

  it('computes loss when both lines are supplied', () => {
    const best = { san: 'e4', cp: 30, mate: null, pv: ['e4'] };
    const played = { san: 'a3', cp: -70, mate: null, pv: ['a3'] };
    expect(buildContext(START, 'a3', best, played).loss).toBe(100);
  });

  it('throws on an illegal move', () => {
    expect(() => buildContext(START, 'e5', null, null)).toThrow(/illegal/i);
  });
});

describe('explainMove', () => {
  it('orders reasons by weight, descending', () => {
    const rules: Rule[] = [
      () => reason(10, 'low'),
      () => reason(90, 'high'),
      () => reason(50, 'middle'),
    ];
    expect(explainMove(buildContext(START, 'e4', null, null), rules).map((r) => r.text)).toEqual([
      'high',
      'middle',
      'low',
    ]);
  });

  it('flattens rules that return several reasons', () => {
    const rules: Rule[] = [() => [reason(10, 'a'), reason(20, 'b')]];
    expect(explainMove(buildContext(START, 'e4', null, null), rules)).toHaveLength(2);
  });

  it('drops rules that return null', () => {
    const rules: Rule[] = [() => null, () => reason(5, 'only')];
    expect(explainMove(buildContext(START, 'e4', null, null), rules)).toHaveLength(1);
  });

  it('never lets one rule throwing lose the other reasons', () => {
    const rules: Rule[] = [
      () => {
        throw new Error('rule blew up');
      },
      () => reason(5, 'survivor'),
    ];
    const reasons = explainMove(buildContext(START, 'e4', null, null), rules);
    expect(reasons.map((r) => r.text)).toEqual(['survivor']);
  });
});

describe('describeMove', () => {
  it('joins the top reasons into prose', () => {
    const rules: Rule[] = [() => reason(90, 'Takes the centre.'), () => reason(10, 'Frees the bishop.')];
    expect(describeMove(buildContext(START, 'e4', null, null), 2, rules)).toBe(
      'Takes the centre. Frees the bishop.',
    );
  });

  it('respects the maximum reason count', () => {
    const rules: Rule[] = [
      () => reason(90, 'One.'),
      () => reason(80, 'Two.'),
      () => reason(70, 'Three.'),
    ];
    expect(describeMove(buildContext(START, 'e4', null, null), 2, rules)).toBe('One. Two.');
  });

  it('returns an empty string when no rule fires', () => {
    expect(describeMove(buildContext(START, 'e4', null, null), 2, [])).toBe('');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/explain/explain.test.ts`
Expected: FAIL — `Failed to resolve import "./explain"`.

- [ ] **Step 4: Implement `src/explain/explain.ts`**

```ts
import { Chess } from 'chess.js';
import { extractFeatures } from '../chess/features';
import type { PvLine } from '../engine/types';
import { centipawnLoss } from './quality';
import type { MoveContext, Reason, Rule } from './types';

/**
 * Assembles everything the rules need from a position and a move in SAN.
 *
 * `bestLine` and `playedLine` are optional: off-book positions still get
 * explained, they just carry no centipawn loss.
 */
export function buildContext(
  before: string,
  san: string,
  bestLine: PvLine | null,
  playedLine: PvLine | null,
): MoveContext {
  const chess = new Chess(before);
  const mover = chess.turn();

  let move;
  try {
    move = chess.move(san);
  } catch {
    throw new Error(`Illegal move "${san}" in position ${before}`);
  }

  return {
    before,
    after: chess.fen(),
    san: move.san,
    from: move.from,
    to: move.to,
    mover,
    featuresBefore: extractFeatures(before),
    featuresAfter: extractFeatures(chess.fen()),
    loss: bestLine && playedLine ? centipawnLoss(bestLine, playedLine, mover) : null,
  };
}

/**
 * Runs every rule and returns their reasons ranked by weight.
 *
 * A rule that throws is skipped rather than allowed to take the whole
 * explanation down with it — a missing reason degrades the prose, an exception
 * would blank the panel.
 */
export function explainMove(ctx: MoveContext, rules: Rule[] = ALL_RULES): Reason[] {
  const reasons: Reason[] = [];

  for (const rule of rules) {
    let produced: Reason | Reason[] | null;
    try {
      produced = rule(ctx);
    } catch {
      continue;
    }
    if (!produced) continue;
    if (Array.isArray(produced)) reasons.push(...produced);
    else reasons.push(produced);
  }

  return reasons.sort((a, b) => b.weight - a.weight);
}

export function describeMove(ctx: MoveContext, max = 2, rules: Rule[] = ALL_RULES): string {
  return explainMove(ctx, rules)
    .slice(0, max)
    .map((reason) => reason.text)
    .join(' ');
}

/**
 * Placeholder until Task 6 supplies the real rule set. Kept as a named export
 * so both default parameters above have something to point at.
 */
export const ALL_RULES: Rule[] = [];
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/explain/explain.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add src/explain
git commit -m "feat: add explainer context building and reason ranking"
```

---

### Task 6: The rule set

**Files:**
- Create: `src/explain/rules.ts`
- Test: `src/explain/rules.test.ts`
- Modify: `src/explain/explain.ts` (replace the empty `ALL_RULES` with the real set)

**Interfaces:**
- Consumes: `MoveContext`, `Reason`, `Rule` (Task 5); `findFork`, `findPin` (Task 2); `PositionFeatures.pawnStructure` (Task 1).
- Produces: `ALL_RULES: Rule[]` re-exported through `explain.ts`.

This is the FEN-fixture table the spec calls the highest-value tests in the project. Each rule gets a fixture that fires it and the suite asserts the resulting tag.

- [ ] **Step 1: Write the failing tests**

`src/explain/rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildContext, explainMove } from './explain';
import { ALL_RULES } from './rules';
import type { ReasonTag } from './types';

function tagsFor(fen: string, san: string): ReasonTag[] {
  return explainMove(buildContext(fen, san, null, null), ALL_RULES).map((r) => r.tag);
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White to move, can castle kingside
const CAN_CASTLE = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5';
// Knight c3 plays Nd5, which attacks b6 and f6 at once — the queen and the rook
const FORK_AVAILABLE = '4k3/8/1q3r2/8/8/2N5/8/4K3 w - - 0 1';
// Bishop f1 plays Bb5 along the f1-b5 diagonal, pinning the c6 knight to the e8 king
const PIN_AVAILABLE = '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1';
// Rook d1 can take the undefended black rook on d5, or step to d4 where that
// same black rook attacks it and nothing defends it
const FREE_ROOK = '4k3/8/8/3r4/8/8/8/3RK3 w - - 0 1';
// White pawns e4 and d2; exd5 puts a second white pawn on the d-file
const DOUBLES_PAWNS = '4k3/8/8/3p4/4P3/8/3P4/4K3 w - - 0 1';

describe('rule set', () => {
  it('credits a move that grabs the centre', () => {
    expect(tagsFor(START, 'e4')).toContain('center');
  });

  it('credits developing a minor piece', () => {
    expect(tagsFor(START, 'Nf3')).toContain('development');
  });

  it('credits castling as king safety', () => {
    expect(tagsFor(CAN_CASTLE, 'O-O')).toContain('king-safety');
  });

  it('credits winning material', () => {
    expect(tagsFor(FREE_ROOK, 'Rxd5')).toContain('material');
  });

  it('names a fork', () => {
    expect(tagsFor(FORK_AVAILABLE, 'Nd5')).toContain('fork');
  });

  it('names a pin', () => {
    expect(tagsFor(PIN_AVAILABLE, 'Bb5')).toContain('pin');
  });

  it('warns when a move leaves a piece hanging', () => {
    // The rook steps to a square attacked by the black rook and defended by nothing.
    expect(tagsFor(FREE_ROOK, 'Rd4')).toContain('hanging');
  });

  it('flags a move that doubles our own pawns', () => {
    expect(tagsFor(DOUBLES_PAWNS, 'exd5')).toContain('pawn-structure');
  });

  it('credits a check as a tempo gain', () => {
    const tags = tagsFor('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'Ra8+');
    expect(tags).toContain('tempo');
  });

  it('produces every reason as a complete sentence', () => {
    const reasons = explainMove(buildContext(START, 'e4', null, null), ALL_RULES);
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason.text).toMatch(/^[A-Z].*[.!]$/);
      expect(reason.weight).toBeGreaterThan(0);
      expect(reason.weight).toBeLessThanOrEqual(100);
    }
  });

  it('says nothing about tactics that are not there', () => {
    const tags = tagsFor(START, 'a3');
    expect(tags).not.toContain('fork');
    expect(tags).not.toContain('pin');
    expect(tags).not.toContain('material');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/explain/rules.test.ts`
Expected: FAIL — `Failed to resolve import "./rules"`.

- [ ] **Step 3: Implement `src/explain/rules.ts`**

```ts
import type { Color } from 'chess.js';
import { findFork, findPin } from '../chess/tactics';
import type { MoveContext, Reason, Rule } from './types';

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/** Material from the mover's point of view, so a gain is always positive. */
function materialEdge(ctx: MoveContext, when: 'featuresBefore' | 'featuresAfter'): number {
  const f = ctx[when].material;
  return f[ctx.mover] - f[other(ctx.mover)];
}

const centerRule: Rule = (ctx) => {
  const gained =
    ctx.featuresAfter.centerControl[ctx.mover] - ctx.featuresBefore.centerControl[ctx.mover];
  if (gained <= 0) return null;
  return {
    tag: 'center',
    polarity: 'good',
    weight: 40 + gained * 5,
    text: 'Stakes a claim in the centre, the squares both sides need.',
  };
};

const developmentRule: Rule = (ctx) => {
  const gained =
    ctx.featuresAfter.developedMinors[ctx.mover] - ctx.featuresBefore.developedMinors[ctx.mover];
  if (gained <= 0) return null;
  return {
    tag: 'development',
    polarity: 'good',
    weight: 45,
    text: 'Brings a new piece into the game.',
  };
};

const kingSafetyRule: Rule = (ctx) => {
  if (ctx.featuresBefore.castled[ctx.mover] || !ctx.featuresAfter.castled[ctx.mover]) return null;
  return {
    tag: 'king-safety',
    polarity: 'good',
    weight: 55,
    text: 'Tucks the king away and connects the rooks.',
  };
};

const materialRule: Rule = (ctx) => {
  const gained = materialEdge(ctx, 'featuresAfter') - materialEdge(ctx, 'featuresBefore');
  if (gained <= 0) return null;
  return {
    tag: 'material',
    polarity: 'good',
    weight: 70 + gained * 3,
    text: `Wins material — up ${gained} point${gained === 1 ? '' : 's'} on the exchange.`,
  };
};

const forkRule: Rule = (ctx) => {
  const fork = findFork(ctx.after, ctx.to);
  if (!fork) return null;
  return {
    tag: 'fork',
    polarity: 'good',
    weight: 85,
    text: `Forks ${fork.targets.length} pieces at once — they cannot both be saved.`,
  };
};

const pinRule: Rule = (ctx) => {
  const pin = findPin(ctx.after, ctx.to);
  if (!pin) return null;
  return {
    tag: 'pin',
    polarity: 'good',
    weight: 75,
    text: `Pins the piece on ${pin.pinned} — it cannot move without exposing the king.`,
  };
};

const hangingRule: Rule = (ctx) => {
  const before = new Set(ctx.featuresBefore.hanging[ctx.mover]);
  const nowHanging = ctx.featuresAfter.hanging[ctx.mover].filter((sq) => !before.has(sq));
  if (nowHanging.length === 0) return null;
  return {
    tag: 'hanging',
    polarity: 'bad',
    weight: 80,
    text: `Leaves the piece on ${nowHanging[0]} undefended and under attack.`,
  };
};

const pawnStructureRule: Rule = (ctx) => {
  const reasons: Reason[] = [];
  const before = ctx.featuresBefore.pawnStructure;
  const after = ctx.featuresAfter.pawnStructure;

  if (after.doubled[ctx.mover] > before.doubled[ctx.mover]) {
    reasons.push({
      tag: 'pawn-structure',
      polarity: 'bad',
      weight: 35,
      text: 'Doubles a pawn, which weakens the structure long term.',
    });
  }

  const newPassed = after.passed[ctx.mover].length - before.passed[ctx.mover].length;
  if (newPassed > 0) {
    reasons.push({
      tag: 'pawn-structure',
      polarity: 'good',
      weight: 50,
      text: 'Creates a passed pawn with a clear run at promotion.',
    });
  }

  return reasons.length > 0 ? reasons : null;
};

const tempoRule: Rule = (ctx) => {
  if (!ctx.san.includes('+')) return null;
  return {
    tag: 'tempo',
    polarity: 'good',
    weight: 60,
    text: 'Gives check, forcing a reply and winning a tempo.',
  };
};

const mobilityRule: Rule = (ctx) => {
  const before = ctx.featuresBefore.mobility[ctx.mover];
  const after = ctx.featuresAfter.mobility[ctx.mover];
  if (before === null || after === null) return null;
  const gained = after - before;
  if (gained < 5) return null;
  return {
    tag: 'mobility',
    polarity: 'good',
    weight: 30,
    text: 'Opens lines, giving the pieces noticeably more freedom.',
  };
};

export const ALL_RULES: Rule[] = [
  forkRule,
  hangingRule,
  pinRule,
  materialRule,
  tempoRule,
  kingSafetyRule,
  pawnStructureRule,
  developmentRule,
  centerRule,
  mobilityRule,
];
```

**On the `space` tag:** `ReasonTag` declares it because the spec lists it, but no
rule emits one in this plan — space is hard to measure honestly without a
territory heuristic, and a rule that fired on a bad proxy would teach the wrong
lesson. Leave the tag declared and unused; Plan 3 or a later pass can add the
rule. Do not delete the tag, and do not invent a rule to justify it.

- [ ] **Step 4: Point `explain.ts` at the real rules**

In `src/explain/explain.ts`, delete the placeholder `ALL_RULES` and re-export the real one instead. Put the import with the others at the top:

```ts
import { ALL_RULES } from './rules';
```

and at the bottom of the file:

```ts
export { ALL_RULES };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/explain/`
Expected: PASS.

If a fixture does not fire the rule you expect, **check the FEN before touching the rule or the assertion.** Print `buildContext(FIXTURE, 'san', null, null).featuresAfter` and compare against what you believe the position is. A fixture that is quietly relaxed until it passes tests nothing.

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all pass, one skip.

- [ ] **Step 7: Commit**

```bash
git add src/explain
git commit -m "feat: add the explainer rule set with a FEN fixture table"
```

---

### Task 7: Explanations in the candidate rail

**Files:**
- Create: `src/ui/QualityBadge.tsx`
- Test: `src/ui/QualityBadge.test.tsx`
- Modify: `src/ui/CandidateRail.tsx`
- Modify: `src/ui/CandidateRail.test.tsx`
- Modify: `src/ui/theme.css` (badge colour tokens)

**Interfaces:**
- Consumes: `describeMove`, `buildContext` (Task 5), `classifyMove` (Task 4), `useSelectedNode` from `src/tree/store`.
- Produces: `QualityBadge` — `<QualityBadge band={QualityBand} label={string} />`.

This is the payoff: the rail stops showing only numbers.

- [ ] **Step 1: Write the failing QualityBadge test**

`src/ui/QualityBadge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QualityBadge } from './QualityBadge';

describe('QualityBadge', () => {
  it('renders the label', () => {
    render(<QualityBadge band="blunder" label="Blunder" />);
    expect(screen.getByText('Blunder')).toBeInTheDocument();
  });

  it('exposes the band as a data attribute so CSS can colour it', () => {
    render(<QualityBadge band="inaccuracy" label="Inaccuracy" />);
    expect(screen.getByText('Inaccuracy')).toHaveAttribute('data-band', 'inaccuracy');
  });

  it('does not signal quality by colour alone', () => {
    // Accessibility: the band must be readable as text, not just hue.
    render(<QualityBadge band="mistake" label="Mistake" />);
    expect(screen.getByText('Mistake')).toHaveTextContent(/mistake/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/ui/QualityBadge.test.tsx`
Expected: FAIL — `Failed to resolve import "./QualityBadge"`.

- [ ] **Step 3: Implement `src/ui/QualityBadge.tsx`**

```tsx
import type { QualityBand } from '../explain/quality';

export function QualityBadge({ band, label }: { band: QualityBand; label: string }) {
  return (
    <span
      data-band={band}
      className="quality-badge"
      style={{
        fontSize: 11,
        fontWeight: 800,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Add the badge colours to `src/ui/theme.css`**

Append:

```css
.quality-badge {
  border: 2px solid currentColor;
}
.quality-badge[data-band='best'] { color: #1d6b39; background: #e9fbef; }
.quality-badge[data-band='good'] { color: #2f6b52; background: #eef7f2; }
.quality-badge[data-band='inaccuracy'] { color: #8a6d0b; background: #fdf6e3; }
.quality-badge[data-band='mistake'] { color: #a2521c; background: #fdf0e6; }
.quality-badge[data-band='blunder'] { color: #a12126; background: #fdecec; }
```

- [ ] **Step 5: Write the failing rail tests**

Append to `src/ui/CandidateRail.test.tsx`, inside the existing top-level `describe`:

```tsx
  it('shows a one-line idea under each candidate', () => {
    analysis.value = {
      status: 'idle',
      result: {
        depth: 20,
        lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5'] }],
      },
    } as never;

    render(<CandidateRail />);
    // The explainer describes 1.e4 as a central claim.
    expect(screen.getByRole('button', { name: /e4/ })).toHaveTextContent(/centre|center/i);
  });

  it('shows a quality badge relative to the best move', () => {
    analysis.value = {
      status: 'idle',
      result: {
        depth: 20,
        lines: [
          { san: 'e4', cp: 30, mate: null, pv: ['e4'] },
          { san: 'a3', cp: -80, mate: null, pv: ['a3'] },
        ],
      },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByText('Best move')).toBeInTheDocument();
    // 110cp worse than the best move lands in the "mistake" band.
    expect(screen.getByText('Mistake')).toBeInTheDocument();
  });

  it('still renders the candidate when the explainer cannot describe it', () => {
    // A move the rules have nothing to say about must not blank the row.
    analysis.value = {
      status: 'idle',
      result: { depth: 20, lines: [{ san: 'a3', cp: 5, mate: null, pv: ['a3'] }] },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /a3/ })).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run to verify the new rail tests fail**

Run: `npm test -- src/ui/CandidateRail.test.tsx`
Expected: FAIL — the idea text and the badges are not rendered yet.

- [ ] **Step 7: Wire the explainer into `src/ui/CandidateRail.tsx`**

Add these imports:

```tsx
import { useMemo } from 'react';
import { classifyMove } from '../explain/quality';
import { buildContext, describeMove } from '../explain/explain';
import { useSelectedNode } from '../tree/store';
import { QualityBadge } from './QualityBadge';
```

Inside the component, above the `return`, derive one annotation per line. Building a context runs chess.js twice per candidate, so memoise on the node's FEN and the result:

```tsx
  const node = useSelectedNode();

  const annotations = useMemo(() => {
    if (!result || result.lines.length === 0) return [];
    const best = result.lines[0];
    return result.lines.map((line) => {
      try {
        const ctx = buildContext(node.fen, line.san, best, line);
        return {
          idea: describeMove(ctx, 1),
          quality: classifyMove(best, line, ctx.mover),
        };
      } catch {
        // A PV whose first move is not legal here must not take the rail down.
        return null;
      }
    });
  }, [node.fen, result]);
```

Then, inside the existing `result.lines.map(...)` render, add the badge next to the score and the idea beneath the eval bar. Replace the row's inner content with:

```tsx
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{line.san}</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {annotations[index] && (
                <QualityBadge
                  band={annotations[index]!.quality.band}
                  label={annotations[index]!.quality.label}
                />
              )}
              <span>{formatScore(line)}</span>
            </span>
          </div>
          <div style={{ marginTop: 6 }}>
            <EvalBar cp={line.cp} mate={line.mate} />
          </div>
          {annotations[index]?.idea ? (
            <div style={{ marginTop: 6, fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>
              {annotations[index]!.idea}
            </div>
          ) : null}
          <div style={{ marginTop: 4, fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)' }}>
            {line.pv.slice(0, 6).join(' ')}
          </div>
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- src/ui/`
Expected: PASS.

- [ ] **Step 9: Run the full suite and the app**

Run: `npm test && npm run typecheck`
Expected: all pass, one skip.

Run `npm run dev` and confirm by hand: each candidate now carries a quality badge and a sentence, the top candidate reads "Best move", and clicking through positions never leaves a stale sentence attached to the wrong position.

- [ ] **Step 10: Commit**

```bash
git add src/ui
git commit -m "feat: show move quality and a one-line idea per candidate"
```

---

### Task 8: The comparison computation

**Files:**
- Create: `src/explain/compare.ts`
- Test: `src/explain/compare.test.ts`

**Interfaces:**
- Consumes: `PvLine` (engine types), `extractFeatures` (Task 1), `toCentipawns` (Task 4).
- Produces:
  - `LineSummary { san: string; endFen: string; scoreCp: number; pros: string[]; cons: string[] }`
  - `Comparison { a: LineSummary; b: LineSummary; practicallyEqual: boolean; verdict: string }`
  - `PRACTICALLY_EQUAL_CP = 30`
  - `compareLines(baseFen: string, a: PvLine, b: PvLine, plies?: number): Comparison`

The pure half of the compare drawer, so the calibrated verdict is testable without rendering anything.

- [ ] **Step 1: Write the failing tests**

`src/explain/compare.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PvLine } from '../engine/types';
import { compareLines, PRACTICALLY_EQUAL_CP } from './compare';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const italian: PvLine = {
  san: 'e4',
  cp: 31,
  mate: null,
  pv: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
};
const scotch: PvLine = {
  san: 'd4',
  cp: 28,
  mate: null,
  pv: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'],
};
const winning: PvLine = { san: 'e4', cp: 400, mate: null, pv: ['e4', 'e5'] };

describe('compareLines', () => {
  it('summarises both lines with their final positions', () => {
    const result = compareLines(START, italian, scotch);
    expect(result.a.san).toBe('e4');
    expect(result.b.san).toBe('d4');
    expect(result.a.endFen).not.toBe(START);
    expect(result.b.endFen).not.toBe(result.a.endFen);
  });

  it('calls a sub-30-centipawn gap practically equal', () => {
    const result = compareLines(START, italian, scotch);
    expect(result.practicallyEqual).toBe(true);
    expect(result.verdict).toMatch(/practically equal/i);
    expect(result.verdict).toMatch(/character/i);
  });

  it('does not call a decisive gap equal', () => {
    const result = compareLines(START, winning, scotch);
    expect(result.practicallyEqual).toBe(false);
    expect(result.verdict).not.toMatch(/practically equal/i);
  });

  it('names the better line when the gap is real', () => {
    expect(compareLines(START, winning, scotch).verdict).toContain('e4');
  });

  it('uses the documented equality threshold', () => {
    expect(PRACTICALLY_EQUAL_CP).toBe(30);
  });

  it('produces at least one pro or con per line', () => {
    const result = compareLines(START, italian, scotch);
    expect(result.a.pros.length + result.a.cons.length).toBeGreaterThan(0);
    expect(result.b.pros.length + result.b.cons.length).toBeGreaterThan(0);
  });

  it('stops walking a principal variation at an illegal move', () => {
    const broken: PvLine = { san: 'e4', cp: 20, mate: null, pv: ['e4', 'e5', 'e4'] };
    expect(() => compareLines(START, broken, scotch)).not.toThrow();
  });

  it('respects the ply limit', () => {
    const short = compareLines(START, italian, scotch, 2);
    const long = compareLines(START, italian, scotch, 5);
    expect(short.a.endFen).not.toBe(long.a.endFen);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- src/explain/compare.test.ts`
Expected: FAIL — `Failed to resolve import "./compare"`.

- [ ] **Step 3: Implement `src/explain/compare.ts`**

```ts
import { Chess, type Color } from 'chess.js';
import { extractFeatures, type PositionFeatures } from '../chess/features';
import type { PvLine } from '../engine/types';
import { toCentipawns } from './quality';

/**
 * Below this gap the two lines are treated as equal and the verdict leads with
 * structure instead of numbers. Telling a beginner that +0.31 beats +0.28 would
 * teach them something false — the spec calls this out explicitly.
 */
export const PRACTICALLY_EQUAL_CP = 30;

const DEFAULT_PLIES = 8;

export interface LineSummary {
  san: string;
  endFen: string;
  scoreCp: number;
  pros: string[];
  cons: string[];
}

export interface Comparison {
  a: LineSummary;
  b: LineSummary;
  practicallyEqual: boolean;
  verdict: string;
}

/** Plays a principal variation out, stopping at the ply limit or the first illegal move. */
function walk(baseFen: string, pv: string[], plies: number): string {
  const chess = new Chess(baseFen);
  for (const san of pv.slice(0, plies)) {
    try {
      chess.move(san);
    } catch {
      break;
    }
  }
  return chess.fen();
}

function summarise(
  line: PvLine,
  baseFen: string,
  baseFeatures: PositionFeatures,
  mover: Color,
  plies: number,
): LineSummary {
  const endFen = walk(baseFen, line.pv, plies);
  const end = extractFeatures(endFen);
  const pros: string[] = [];
  const cons: string[] = [];

  const developed = end.developedMinors[mover] - baseFeatures.developedMinors[mover];
  if (developed > 0) pros.push(`Develops ${developed} more piece${developed === 1 ? '' : 's'}`);

  const centre = end.centerControl[mover] - baseFeatures.centerControl[mover];
  if (centre > 0) pros.push('Holds more of the centre');
  if (centre < 0) cons.push('Concedes centre control');

  if (end.castled[mover] && !baseFeatures.castled[mover]) pros.push('Gets the king castled');

  const doubled = end.pawnStructure.doubled[mover] - baseFeatures.pawnStructure.doubled[mover];
  if (doubled > 0) cons.push('Leaves a doubled pawn');

  if (end.pawnStructure.passed[mover].length > baseFeatures.pawnStructure.passed[mover].length) {
    pros.push('Creates a passed pawn');
  }

  if (end.hanging[mover].length > 0) cons.push('Leaves a piece loose at the end of the line');

  // Every line needs something said about it, even a quiet one.
  if (pros.length === 0 && cons.length === 0) pros.push('Keeps the position balanced and flexible');

  return { san: line.san, endFen, scoreCp: toCentipawns(line), pros, cons };
}

function buildVerdict(a: LineSummary, b: LineSummary, mover: Color): {
  practicallyEqual: boolean;
  verdict: string;
} {
  const gap = Math.abs(a.scoreCp - b.scoreCp);

  if (gap < PRACTICALLY_EQUAL_CP) {
    const contrast = a.pros[0] ?? a.cons[0] ?? 'a different structure';
    const otherContrast = b.pros[0] ?? b.cons[0] ?? 'a different structure';
    return {
      practicallyEqual: true,
      verdict:
        `Practically equal — the real difference is character, not evaluation. ` +
        `${a.san} ${contrast.toLowerCase()}; ${b.san} ${otherContrast.toLowerCase()}. ` +
        `Pick the one whose plan you would rather play.`,
    };
  }

  // Scores are White-relative, so the better line for Black is the lower one.
  const aIsBetter = mover === 'w' ? a.scoreCp > b.scoreCp : a.scoreCp < b.scoreCp;
  const better = aIsBetter ? a : b;
  const worse = aIsBetter ? b : a;

  return {
    practicallyEqual: false,
    verdict:
      `${better.san} is clearly stronger here — about ${(gap / 100).toFixed(2)} ` +
      `better than ${worse.san}. That gap is real, not noise.`,
  };
}

export function compareLines(
  baseFen: string,
  a: PvLine,
  b: PvLine,
  plies: number = DEFAULT_PLIES,
): Comparison {
  const mover = new Chess(baseFen).turn();
  const baseFeatures = extractFeatures(baseFen);

  const summaryA = summarise(a, baseFen, baseFeatures, mover, plies);
  const summaryB = summarise(b, baseFen, baseFeatures, mover, plies);
  const { practicallyEqual, verdict } = buildVerdict(summaryA, summaryB, mover);

  return { a: summaryA, b: summaryB, practicallyEqual, verdict };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/explain/compare.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/explain/compare.ts src/explain/compare.test.ts
git commit -m "feat: add line comparison with a calibrated verdict"
```

---

### Task 9: The compare drawer

**Files:**
- Create: `src/ui/CompareDrawer.tsx`
- Create: `src/ui/MiniBoard.tsx`
- Test: `src/ui/CompareDrawer.test.tsx`
- Modify: `src/ui/CandidateRail.tsx` (a Compare button)
- Modify: `src/ui/theme.css` (drawer styles)
- Modify: `package.json` (remove `framer-motion`)

**Interfaces:**
- Consumes: `compareLines`, `Comparison` (Task 8), `PvLine`, `formatScore`, `EvalBar`, `Button`.
- Produces: `CompareDrawer` — `<CompareDrawer a={PvLine} b={PvLine} baseFen={string} onClose={() => void} />`.

**On `framer-motion`:** it is a declared runtime dependency that nothing imports. This drawer is the last place in Plan 2 that could have justified it, and a CSS transition does the job — so **remove the dependency** rather than leave it shipping unused. See `Known Issues`.

- [ ] **Step 1: Write the failing tests**

`src/ui/CompareDrawer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PvLine } from '../engine/types';
import { CompareDrawer } from './CompareDrawer';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const a: PvLine = { san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5', 'Nf3'] };
const b: PvLine = { san: 'd4', cp: 28, mate: null, pv: ['d4', 'd5', 'Nf3'] };

describe('CompareDrawer', () => {
  it('names both lines being compared', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /e4/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /d4/ })).toBeInTheDocument();
  });

  it('shows the calibrated verdict for two near-equal lines', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    expect(screen.getByTestId('verdict')).toHaveTextContent(/practically equal/i);
  });

  it('lists pros and cons for each line', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    expect(screen.getAllByRole('list').length).toBeGreaterThanOrEqual(2);
  });

  it('closes when the close button is pressed', async () => {
    const onClose = vi.fn();
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is announced as a dialog', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/compare/i);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- src/ui/CompareDrawer.test.tsx`
Expected: FAIL — `Failed to resolve import "./CompareDrawer"`.

- [ ] **Step 3: Implement `src/ui/MiniBoard.tsx`**

A small read-only board. `react-chessboard` is heavier than needed here and its drag machinery is pointless for a static preview, so this renders squares directly.

```tsx
import { Chess } from 'chess.js';

const GLYPHS: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

export function MiniBoard({ fen, label }: { fen: string; label: string }) {
  const board = new Chess(fen).board();

  return (
    <div
      role="img"
      aria-label={label}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        aspectRatio: '1',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 3px 0 #e0c3a3',
      }}
    >
      {board.flatMap((row, rankIndex) =>
        row.map((cell, fileIndex) => (
          <div
            key={`${rankIndex}-${fileIndex}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'min(3vw, 18px)',
              lineHeight: 1,
              background:
                (rankIndex + fileIndex) % 2 === 0 ? 'var(--board-light)' : 'var(--board-dark)',
              color: cell?.color === 'w' ? '#fff' : '#111',
              textShadow:
                cell?.color === 'w' ? '0 0 2px rgba(0,0,0,.8)' : '0 0 2px rgba(255,255,255,.8)',
            }}
          >
            {cell ? GLYPHS[cell.type] : ''}
          </div>
        )),
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `src/ui/CompareDrawer.tsx`**

```tsx
import { useMemo } from 'react';
import type { PvLine } from '../engine/types';
import { compareLines, type LineSummary } from '../explain/compare';
import { formatScore } from './useAnalysis';
import { Button } from './Button';
import { EvalBar } from './EvalBar';
import { MiniBoard } from './MiniBoard';

function LinePanel({ summary, line }: { summary: LineSummary; line: PvLine }) {
  return (
    <section
      style={{
        flex: '1 1 240px',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 12,
        background: 'var(--surface)',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{summary.san}</h3>
      <MiniBoard fen={summary.endFen} label={`Position after the ${summary.san} line`} />
      <div style={{ marginTop: 8 }}>
        <EvalBar cp={line.cp} mate={line.mate} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '6px 0 10px' }}>
        {formatScore(line)} after {line.pv.length} plies
      </p>
      {summary.pros.length > 0 && (
        <>
          <h4 style={{ fontSize: 12, margin: '0 0 4px' }}>Pros</h4>
          <ul style={{ fontSize: 12, margin: '0 0 8px', paddingLeft: 18 }}>
            {summary.pros.map((pro) => (
              <li key={pro}>{pro}</li>
            ))}
          </ul>
        </>
      )}
      {summary.cons.length > 0 && (
        <>
          <h4 style={{ fontSize: 12, margin: '0 0 4px' }}>Cons</h4>
          <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
            {summary.cons.map((con) => (
              <li key={con}>{con}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function CompareDrawer({
  a,
  b,
  baseFen,
  onClose,
}: {
  a: PvLine;
  b: PvLine;
  baseFen: string;
  onClose: () => void;
}) {
  const comparison = useMemo(() => compareLines(baseFen, a, b), [baseFen, a, b]);

  return (
    <div role="dialog" aria-label={`Compare ${a.san} and ${b.san}`} className="compare-drawer">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>
          Compare {a.san} and {b.san}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <LinePanel summary={comparison.a} line={a} />
        <LinePanel summary={comparison.b} line={b} />
      </div>

      <p
        data-testid="verdict"
        style={{
          fontSize: 13,
          marginTop: 12,
          padding: '10px 12px',
          borderLeft: '4px solid var(--primary)',
          background: 'rgba(255, 122, 69, 0.08)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <strong>Verdict:</strong> {comparison.verdict}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Add the drawer styles to `src/ui/theme.css`**

The slide-in is CSS, which is why `framer-motion` is being removed rather than adopted.

```css
.compare-drawer {
  margin-top: 18px;
  padding: 16px;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  box-shadow: 0 -4px 24px rgba(180, 120, 60, 0.16);
  animation: drawer-rise 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes drawer-rise {
  from { transform: translateY(14px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .compare-drawer { animation: none; }
}
```

- [ ] **Step 6: Add the Compare button to `src/ui/CandidateRail.tsx`**

Add `useState` to the React import, plus:

```tsx
import { CompareDrawer } from './CompareDrawer';
```

Inside the component:

```tsx
  const [comparing, setComparing] = useState(false);
```

Then, after the candidate list and before the closing `</section>`:

```tsx
      {result.lines.length >= 2 && (
        <>
          <Button
            variant="secondary"
            style={{ width: '100%', marginTop: 4 }}
            onClick={() => setComparing((open) => !open)}
          >
            {comparing ? 'Hide comparison' : `Compare ${result.lines[0].san} and ${result.lines[1].san}`}
          </Button>
          {comparing && (
            <CompareDrawer
              a={result.lines[0]}
              b={result.lines[1]}
              baseFen={node.fen}
              onClose={() => setComparing(false)}
            />
          )}
        </>
      )}
```

Add the `Button` import if it is not already there:

```tsx
import { Button } from './Button';
```

- [ ] **Step 7: Remove the unused `framer-motion` dependency**

Run:

```bash
npm uninstall framer-motion
```

Then confirm nothing imported it:

```bash
grep -rn "framer-motion" src/ || echo "no framer-motion imports"
```

Expected: `no framer-motion imports`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- src/ui/`
Expected: PASS.

- [ ] **Step 9: Run the full suite and the app**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass, one skip, build succeeds.

Run `npm run dev` and confirm by hand: the Compare button appears when there are two or more candidates, the drawer opens with two mini-boards and a verdict, the verdict says "practically equal" for two close candidates, and the drawer's animation is suppressed under `prefers-reduced-motion`.

- [ ] **Step 10: Commit**

```bash
git add src/ui package.json package-lock.json
git commit -m "feat: add the compare drawer and drop the unused framer-motion dependency"
```

---

## What Plan 2 delivers

The rail stops being a scoreboard. Every candidate carries a quality band and a
sentence explaining the idea, any two candidates can be laid side by side with a
verdict that refuses to oversell a 3-centipawn difference, and transposed
positions are analysed once instead of twice.

## What Plan 3 covers

- `src/content/` — Zod schema, validating loader, and the SAN-replay test
- The v1 content: 3 openings and 4 theme lessons
- `src/lesson/` — the lesson rail, checkpoint grading, hint tiers, `nearMiss`
  replies, and hiding the candidate rail during checkpoints
- `src/progress/` — versioned localStorage, "My Lines" as PGN
- Mute toggle UI, keyboard board navigation, a real `App.tsx` layout, and a
  new-game control

## Before finishing this branch

Update the vault, per `CLAUDE.md`: `Current State.md`, `Known Issues.md`
(the `framer-motion` entry is resolved by Task 9 — delete it, no tombstone),
`Roadmap.md`, `Architecture.md` for the new `src/explain/` layer, and
`Start Here.md` last.
