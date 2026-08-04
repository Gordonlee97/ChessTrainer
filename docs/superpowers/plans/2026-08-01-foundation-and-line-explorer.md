# ChessTrainer Plan 1 — Foundation & Line Explorer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working chess line explorer — a board you can play any legal move on, backed by Stockfish, showing the top three candidate moves with evals, with full branching navigation and the app's sound and motion language in place.

**Architecture:** A single game tree is the source of truth. Pure, React-free modules (`chess/`, `engine/`, `tree/`, `sound/`) sit underneath a thin React UI layer. The engine runs in a Web Worker driven over UCI with MultiPV=3, and every analysis request is tagged with the node id that requested it so stale results are discarded rather than rendered.

**Tech Stack:** Vite, React 18, TypeScript, chess.js, react-chessboard v5, stockfish (WASM, Web Worker), Zustand, Framer Motion, Howler, Vitest, React Testing Library.

**Source spec:** `docs/superpowers/specs/2026-08-01-chesstrainer-design.md`

## Global Constraints

- **No React or DOM imports** in `src/chess/`, `src/engine/`, `src/tree/`. These
  are pure TypeScript and must be unit-testable without a DOM. A test asserting
  this is part of Task 1.
- **react-chessboard v5 API:** all board configuration goes through a single
  `options` prop object. `onPieceDrop` receives
  `{ piece, sourceSquare, targetSquare }` and returns `boolean`. Do not use the
  v4 style of individual props (`position=`, `onPieceDrop={(src, tgt) => …}`) —
  it does not exist in v5.
- **chess.js v1.4 API:** use `isAttacked(square, color)` and
  `attackers(square, color)` for attack maps. Do not hand-roll attack detection.
- **Engine MultiPV = 3.** The candidate rail comes from one search, not three.
- **Every `analyze()` call is tagged with the requesting node id.** Results whose
  tag is not the currently selected node are discarded, never rendered.
- **Visual style: Bright & bouncy.** Warm wood board (`#f2dcbb` light /
  `#b58863` dark), chunky buttons with a 4px bottom lip that compresses on press,
  bold rounded type, orange `#ff7a45` primary and purple `#5b3fd6` secondary.
- **`prefers-reduced-motion` and a mute toggle are honoured everywhere.**
  Reduced motion keeps all state changes and drops overshoot and confetti.
- **Commit after every task.** Conventional commit prefixes (`feat:`, `test:`,
  `chore:`).

---

### Task 1: Project scaffold, tooling, and purity guard

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/test/setup.ts`
- Test: `src/test/purity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test`, `npm run dev`, `npm run typecheck`. All later
  tasks assume Vitest with `globals: true` and a `jsdom` environment.

We write the config files by hand rather than running `npm create vite`, because
the scaffolder is interactive in a non-empty directory and this repo already has
`docs/` and `.gitignore` in it.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chesstrainer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "chess.js": "^1.4.0",
    "framer-motion": "^11.11.0",
    "howler": "^2.2.4",
    "react": "^18.3.1",
    "react-chessboard": "^5.0.0",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/howler": "^2.2.12",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 3: Create `tsconfig.json` and `tsconfig.node.json`**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ChessTrainer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:

```tsx
export function App() {
  return <h1>ChessTrainer</h1>;
}
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Write the purity guard test**

This test enforces the Global Constraint that the core modules stay React-free.
It reads source files off disk, so it needs no DOM.

`src/test/purity.test.ts`:

```ts
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PURE_DIRS = ['src/chess', 'src/engine', 'src/tree'];
const FORBIDDEN = [/from ['"]react['"]/, /from ['"]react-dom/, /from ['"]zustand/];

function tsFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFilesIn(full);
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
  });
}

describe('core module purity', () => {
  it('keeps chess/, engine/ and tree/ free of React and store imports', () => {
    const offenders: string[] = [];
    for (const dir of PURE_DIRS) {
      for (const file of tsFilesIn(dir)) {
        const source = readFileSync(file, 'utf8');
        if (FORBIDDEN.some((pattern) => pattern.test(source))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 6: Install and verify**

Run:

```bash
npm install
npm run typecheck
npm test
```

Expected: install succeeds, typecheck clean, one passing test
(`core module purity`).

**If `npm install` reports a peer dependency conflict on `react-chessboard`**
requiring React 19, raise `react`, `react-dom`, `@types/react`, and
`@types/react-dom` to the major version it asks for, re-run `npm install`, and
record the versions you landed on in the spike notes created in Task 2. Do not
use `--legacy-peer-deps` to paper over it.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json index.html src
git commit -m "chore: scaffold Vite + React + TS + Vitest with core purity guard"
```

---

### Task 2: Stockfish worker spike and smoke test

**Files:**
- Create: `src/engine/stockfishWorker.ts`
- Create: `src/engine/engine.smoke.test.ts`
- Create: `docs/superpowers/plans/spike-results.md`
- Modify: `package.json` (add the stockfish dependency)
- Modify: `vite.config.ts` (worker/asset handling if the spike shows it is needed)

**Interfaces:**
- Produces: `createWorkerTransport(): UciTransport` — the real transport that
  Task 4's `Engine` consumes. `UciTransport` itself is defined in Task 4; write
  this file to match that shape exactly:
  `{ send(cmd: string): void; onLine(cb: (line: string) => void): () => void; terminate(): void }`.

This task resolves the two load-bearing unknowns flagged in spec §3.1. It is
deliberately early: the measured depth budget feeds Plan 2's compare algorithm.

- [ ] **Step 1: Install the engine**

Run:

```bash
npm install stockfish
```

Then find what the package actually ships — the file layout differs between
releases and this determines how we load the worker:

```bash
ls node_modules/stockfish/src/
```

Expected: one or more `.js` and `.wasm` files. Note which build is
single-threaded (usually named `*-single.js` or lacking a `-mt`/`threaded`
suffix). **Use the single-threaded build.** The multi-threaded builds require
`SharedArrayBuffer`, which requires COOP/COEP response headers — not available
for a plain static app.

- [ ] **Step 2: Copy the engine into `public/` and write the transport**

Copy the single-threaded build's `.js` and `.wasm` into `public/engine/`
(substitute the real filenames you found in Step 1):

```bash
mkdir -p public/engine
cp node_modules/stockfish/src/<single-threaded-build>.js public/engine/stockfish.js
cp node_modules/stockfish/src/<matching-wasm-file>.wasm public/engine/
```

Serving from `public/` keeps the worker a plain same-origin URL, which avoids
bundler worker-format issues entirely.

`src/engine/stockfishWorker.ts`:

```ts
import type { UciTransport } from './types';

export const ENGINE_URL = '/engine/stockfish.js';

export function createWorkerTransport(url: string = ENGINE_URL): UciTransport {
  const worker = new Worker(url);
  const listeners = new Set<(line: string) => void>();

  worker.onmessage = (event: MessageEvent) => {
    const data = typeof event.data === 'string' ? event.data : String(event.data);
    for (const line of data.split('\n')) {
      if (line.trim().length > 0) listeners.forEach((cb) => cb(line.trim()));
    }
  };

  return {
    send(cmd: string) {
      worker.postMessage(cmd);
    },
    onLine(cb: (line: string) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    terminate() {
      listeners.clear();
      worker.terminate();
    },
  };
}
```

Create `src/engine/types.ts` with just the transport type for now — Task 4
extends this file:

```ts
export interface UciTransport {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): () => void;
  terminate(): void;
}
```

- [ ] **Step 3: Write the smoke test**

This is the one test that talks to the real engine. It runs in a browser-like
environment, so it is gated to skip when `Worker` is unavailable rather than
failing the suite.

`src/engine/engine.smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createWorkerTransport } from './stockfishWorker';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const canRunWorkers = typeof Worker !== 'undefined';

describe.skipIf(!canRunWorkers)('stockfish worker smoke test', () => {
  it('returns a bestmove for the starting position', async () => {
    const transport = createWorkerTransport();
    const bestmove = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('engine timed out')), 20_000);
      const unsubscribe = transport.onLine((line) => {
        if (line.startsWith('bestmove')) {
          clearTimeout(timer);
          unsubscribe();
          resolve(line);
        }
      });
      transport.send('uci');
      transport.send('isready');
      transport.send(`position fen ${START_FEN}`);
      transport.send('go depth 10');
    });

    expect(bestmove).toMatch(/^bestmove [a-h][1-8][a-h][1-8]/);
    transport.terminate();
  }, 30_000);
});
```

- [ ] **Step 4: Run the smoke test and measure the depth budget**

Run:

```bash
npm test -- src/engine/engine.smoke.test.ts
```

Expected: PASS, or SKIPPED if `Worker` is not available in this jsdom setup.

**If it is skipped**, verify the engine in the browser instead: add a temporary
button in `src/App.tsx` that calls `createWorkerTransport()` and logs lines,
run `npm run dev`, and confirm `bestmove` appears in the console. Remove the
temporary button afterwards.

Then time the engine at increasing depths (depth 12, 15, 18, 20) from the
starting position and from a middlegame FEN. Record the wall-clock time for
each.

- [ ] **Step 5: Record the spike results**

Create `docs/superpowers/plans/spike-results.md` containing, with real measured
values:

```markdown
# Spike Results — 2026-08-01

## react-chessboard
- Installed version: <version>
- React version required: <version>
- Confirmed: configuration goes through a single `options` prop object.

## Stockfish
- Package version: <version>
- Build used: <filename> (single-threaded, no SharedArrayBuffer)
- Served from: `public/engine/stockfish.js`

## Depth budget (measured)
| Position | Depth 12 | Depth 15 | Depth 18 | Depth 20 |
|---|---|---|---|---|
| Start position | <ms> | <ms> | <ms> | <ms> |
| Middlegame FEN | <ms> | <ms> | <ms> | <ms> |

**Chosen interactive target depth:** <depth> (the deepest that returns in
under ~1500ms, with results streaming from depth 8 upward).

**Implication for Plan 2:** the compare feature walks two PVs, so its budget is
roughly double a single analysis. If the chosen depth exceeds ~800ms, compare
must reuse the already-cached node evals rather than re-analysing.
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json public/engine src/engine docs/superpowers/plans/spike-results.md
git commit -m "feat: add stockfish worker transport with smoke test and depth spike"
```

---

### Task 3: Position feature extraction

**Files:**
- Create: `src/chess/features.ts`
- Test: `src/chess/features.test.ts`

**Interfaces:**
- Consumes: chess.js only.
- Produces:
  - `CENTER_SQUARES: Square[]`
  - `PIECE_VALUES: Record<PieceSymbol, number>`
  - `extractFeatures(fen: string): PositionFeatures`
  - `PositionFeatures` — consumed by Plan 2's explainer.

- [ ] **Step 1: Write the failing tests**

`src/chess/features.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { extractFeatures } from './features';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// 1.e4 e5 2.Nf3 Nc6 3.Bc4 — the Italian
const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
// White has castled kingside
const CASTLED = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4';
// Black bishop on b4 is attacked by a3 pawn and undefended
const HANGING = 'rnbqk1nr/pppp1ppp/8/4p3/1b2P3/P4N2/1PPP1PPP/RNBQKB1R b KQkq - 0 3';

describe('extractFeatures', () => {
  it('counts equal material and no development at the start', () => {
    const f = extractFeatures(START);
    expect(f.material).toEqual({ w: 39, b: 39 });
    expect(f.developedMinors).toEqual({ w: 0, b: 0 });
    expect(f.castled).toEqual({ w: false, b: false });
  });

  it('counts center control from both sides', () => {
    const f = extractFeatures(START);
    // Both sides symmetrically contest d4/e4/d5/e5 at the start.
    expect(f.centerControl.w).toBe(f.centerControl.b);
    expect(f.centerControl.w).toBeGreaterThan(0);
  });

  it('counts developed minor pieces in the Italian', () => {
    const f = extractFeatures(ITALIAN);
    expect(f.developedMinors.w).toBe(2); // Nf3 and Bc4
    expect(f.developedMinors.b).toBe(1); // Nc6
  });

  it('detects a castled king', () => {
    expect(extractFeatures(CASTLED).castled).toEqual({ w: true, b: false });
  });

  it('reports an undefended attacked piece as hanging', () => {
    const f = extractFeatures(HANGING);
    expect(f.hanging.b).toContain('b4');
    expect(f.hanging.w).toEqual([]);
  });

  it('reports mobility for both sides', () => {
    const f = extractFeatures(START);
    expect(f.mobility.w).toBe(20);
    expect(f.mobility.b).toBe(20);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/chess/features.test.ts`
Expected: FAIL — `Failed to resolve import "./features"`.

- [ ] **Step 3: Implement `src/chess/features.ts`**

```ts
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

export const CENTER_SQUARES: Square[] = ['d4', 'e4', 'd5', 'e5'];

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const HOME_MINORS: Record<Color, Square[]> = {
  w: ['b1', 'g1', 'c1', 'f1'],
  b: ['b8', 'g8', 'c8', 'f8'],
};

/** Squares a king occupies only as the result of castling, in practice. */
const CASTLED_KING_SQUARES: Record<Color, Square[]> = {
  w: ['g1', 'c1'],
  b: ['g8', 'c8'],
};

const COLORS: Color[] = ['w', 'b'];

export interface PositionFeatures {
  /** Number of attacks each side exerts on the four central squares. */
  centerControl: Record<Color, number>;
  /** Knights and bishops no longer on their home squares. */
  developedMinors: Record<Color, number>;
  /**
   * Whether each king sits on a castled square. This is an approximation — a
   * king that walked to g1 counts as castled — which is acceptable for a
   * heuristic explainer and keeps the check cheap.
   */
  castled: Record<Color, boolean>;
  /** Summed piece values, kings excluded. */
  material: Record<Color, number>;
  /**
   * Legal move count per side. `null` when the count cannot be determined —
   * flipping the side to move can produce an illegal position (for example
   * when the other king is already in check). Rules that read mobility must
   * skip when it is null.
   */
  mobility: Record<Color, number | null>;
  /** Squares holding a piece that is attacked and undefended. */
  hanging: Record<Color, Square[]>;
}

function occupiedSquares(chess: Chess): { square: Square; type: PieceSymbol; color: Color }[] {
  return chess
    .board()
    .flat()
    .filter((cell): cell is { square: Square; type: PieceSymbol; color: Color } => cell !== null);
}

/** Rebuilds the FEN with the side to move flipped, so we can count the other side's moves. */
function mobilityFor(fen: string, color: Color): number | null {
  const parts = fen.split(' ');
  if (parts[1] === color) return new Chess(fen).moves().length;
  parts[1] = color;
  parts[3] = '-'; // an en-passant square is only valid for the original mover
  try {
    return new Chess(parts.join(' ')).moves().length;
  } catch {
    return null;
  }
}

export function extractFeatures(fen: string): PositionFeatures {
  const chess = new Chess(fen);
  const pieces = occupiedSquares(chess);

  const centerControl = { w: 0, b: 0 } as Record<Color, number>;
  const developedMinors = { w: 0, b: 0 } as Record<Color, number>;
  const castled = { w: false, b: false } as Record<Color, boolean>;
  const material = { w: 0, b: 0 } as Record<Color, number>;
  const mobility = { w: null, b: null } as Record<Color, number | null>;
  const hanging = { w: [], b: [] } as Record<Color, Square[]>;

  for (const color of COLORS) {
    for (const square of CENTER_SQUARES) {
      centerControl[color] += chess.attackers(square, color).length;
    }
    mobility[color] = mobilityFor(fen, color);
  }

  for (const { square, type, color } of pieces) {
    material[color] += PIECE_VALUES[type];

    if ((type === 'n' || type === 'b') && !HOME_MINORS[color].includes(square)) {
      developedMinors[color] += 1;
    }

    if (type === 'k' && CASTLED_KING_SQUARES[color].includes(square)) {
      castled[color] = true;
    }

    if (type !== 'k') {
      const enemy: Color = color === 'w' ? 'b' : 'w';
      const attacked = chess.attackers(square, enemy).length > 0;
      const defended = chess.attackers(square, color).length > 0;
      if (attacked && !defended) hanging[color].push(square);
    }
  }

  return { centerControl, developedMinors, castled, material, mobility, hanging };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/chess/features.test.ts`
Expected: PASS, 6 tests.

If `mobility` for the non-moving side comes back `null` on the starting
position, the FEN rebuild is wrong — check that `parts[3]` is being cleared.

- [ ] **Step 5: Commit**

```bash
git add src/chess
git commit -m "feat: add position feature extraction for the explainer"
```

---

### Task 4: UCI engine wrapper with MultiPV

**Files:**
- Modify: `src/engine/types.ts`
- Create: `src/engine/parseInfo.ts`
- Create: `src/engine/engine.ts`
- Test: `src/engine/parseInfo.test.ts`
- Test: `src/engine/engine.test.ts`

**Interfaces:**
- Consumes: `UciTransport` (Task 2), chess.js.
- Produces:
  - `parseInfoLine(line: string): RawInfo | null`
  - `class Engine { constructor(transport: UciTransport); analyze(req: AnalyzeRequest): Promise<EvalResult>; stop(): void; dispose(): void }`
  - `EvalResult { depth: number; lines: PvLine[] }`
  - `PvLine { san: string; cp: number | null; mate: number | null; pv: string[] }`

- [ ] **Step 1: Extend `src/engine/types.ts`**

```ts
export interface UciTransport {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): () => void;
  terminate(): void;
}

export interface PvLine {
  /** The first move of the line, in SAN. */
  san: string;
  /** Score in centipawns from the side-to-move's perspective. Null if mate. */
  cp: number | null;
  /** Moves to mate, signed. Null if not a mate line. */
  mate: number | null;
  /** The principal variation in SAN, first move included. */
  pv: string[];
}

export interface EvalResult {
  depth: number;
  lines: PvLine[];
}

export interface AnalyzeRequest {
  fen: string;
  depth: number;
  multiPV: number;
  /** Called with each deeper result as the search streams. */
  onUpdate?: (result: EvalResult) => void;
  signal?: AbortSignal;
}

export interface RawInfo {
  depth: number;
  multipv: number;
  cp: number | null;
  mate: number | null;
  /** Principal variation in UCI long algebraic form, e.g. ['e2e4', 'e7e5']. */
  pv: string[];
}
```

- [ ] **Step 2: Write the failing parser tests**

`src/engine/parseInfo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseInfoLine } from './parseInfo';

describe('parseInfoLine', () => {
  it('parses a centipawn info line', () => {
    const line =
      'info depth 18 seldepth 24 multipv 1 score cp 31 nodes 1000 nps 500 time 200 pv e2e4 e7e5 g1f3';
    expect(parseInfoLine(line)).toEqual({
      depth: 18,
      multipv: 1,
      cp: 31,
      mate: null,
      pv: ['e2e4', 'e7e5', 'g1f3'],
    });
  });

  it('parses a mate info line', () => {
    const line = 'info depth 12 multipv 2 score mate -3 pv h5f7 e8f7';
    expect(parseInfoLine(line)).toEqual({
      depth: 12,
      multipv: 2,
      cp: null,
      mate: -3,
      pv: ['h5f7', 'e8f7'],
    });
  });

  it('defaults multipv to 1 when absent', () => {
    const line = 'info depth 5 score cp 10 pv d2d4';
    expect(parseInfoLine(line)?.multipv).toBe(1);
  });

  it('ignores lines with no principal variation', () => {
    expect(parseInfoLine('info depth 1 currmove e2e4 currmovenumber 1')).toBeNull();
    expect(parseInfoLine('bestmove e2e4 ponder e7e5')).toBeNull();
    expect(parseInfoLine('readyok')).toBeNull();
  });

  it('handles promotion moves in the pv', () => {
    expect(parseInfoLine('info depth 9 score cp 900 pv a7a8q b8a8')?.pv).toEqual([
      'a7a8q',
      'b8a8',
    ]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/engine/parseInfo.test.ts`
Expected: FAIL — `Failed to resolve import "./parseInfo"`.

- [ ] **Step 4: Implement `src/engine/parseInfo.ts`**

```ts
import type { RawInfo } from './types';

/**
 * Parses a UCI `info` line into structured data.
 * Returns null for any line that does not carry a principal variation —
 * `bestmove`, `readyok`, `currmove`-only progress lines, and so on.
 */
export function parseInfoLine(line: string): RawInfo | null {
  if (!line.startsWith('info ')) return null;

  const tokens = line.split(/\s+/);
  const pvIndex = tokens.indexOf('pv');
  if (pvIndex === -1 || pvIndex === tokens.length - 1) return null;

  const readNumberAfter = (key: string): number | null => {
    const index = tokens.indexOf(key);
    if (index === -1 || index + 1 >= tokens.length) return null;
    const value = Number(tokens[index + 1]);
    return Number.isFinite(value) ? value : null;
  };

  const depth = readNumberAfter('depth');
  if (depth === null) return null;

  const scoreIndex = tokens.indexOf('score');
  let cp: number | null = null;
  let mate: number | null = null;
  if (scoreIndex !== -1) {
    const kind = tokens[scoreIndex + 1];
    const value = Number(tokens[scoreIndex + 2]);
    if (kind === 'cp' && Number.isFinite(value)) cp = value;
    if (kind === 'mate' && Number.isFinite(value)) mate = value;
  }

  return {
    depth,
    multipv: readNumberAfter('multipv') ?? 1,
    cp,
    mate,
    pv: tokens.slice(pvIndex + 1).filter((token) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token)),
  };
}
```

- [ ] **Step 5: Run to verify the parser passes**

Run: `npm test -- src/engine/parseInfo.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Write the failing Engine tests with a fake transport**

`src/engine/engine.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { Engine } from './engine';
import type { UciTransport } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A scriptable stand-in for the Stockfish worker. */
function createFakeTransport() {
  const listeners = new Set<(line: string) => void>();
  const sent: string[] = [];
  const transport: UciTransport = {
    send: (cmd) => {
      sent.push(cmd);
    },
    onLine: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    terminate: () => listeners.clear(),
  };
  return {
    transport,
    sent,
    emit: (line: string) => listeners.forEach((cb) => cb(line)),
  };
}

describe('Engine', () => {
  it('sends MultiPV configuration and the position before searching', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: START, depth: 12, multiPV: 3 });
    fake.emit('info depth 12 multipv 1 score cp 31 pv e2e4 e7e5');
    fake.emit('bestmove e2e4');
    await promise;

    expect(fake.sent).toContain('setoption name MultiPV value 3');
    expect(fake.sent).toContain(`position fen ${START}`);
    expect(fake.sent).toContain('go depth 12');
  });

  it('converts the principal variation from UCI to SAN', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    fake.emit('info depth 12 multipv 1 score cp 31 pv e2e4 e7e5 g1f3');
    fake.emit('bestmove e2e4');
    const result = await promise;

    expect(result.lines[0].san).toBe('e4');
    expect(result.lines[0].pv).toEqual(['e4', 'e5', 'Nf3']);
    expect(result.lines[0].cp).toBe(31);
  });

  it('keeps only the deepest info per multipv slot, ordered by slot', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: START, depth: 12, multiPV: 2 });
    fake.emit('info depth 8 multipv 1 score cp 10 pv d2d4');
    fake.emit('info depth 12 multipv 2 score cp 28 pv c2c4');
    fake.emit('info depth 12 multipv 1 score cp 31 pv e2e4');
    fake.emit('bestmove e2e4');
    const result = await promise;

    expect(result.depth).toBe(12);
    expect(result.lines.map((line) => line.san)).toEqual(['e4', 'c4']);
  });

  it('streams intermediate results through onUpdate', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);
    const onUpdate = vi.fn();

    const promise = engine.analyze({ fen: START, depth: 12, multiPV: 1, onUpdate });
    fake.emit('info depth 8 multipv 1 score cp 10 pv d2d4');
    fake.emit('info depth 12 multipv 1 score cp 31 pv e2e4');
    fake.emit('bestmove e2e4');
    await promise;

    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate.mock.calls[0][0].lines[0].san).toBe('d4');
  });

  it('rejects and sends stop when aborted', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);
    const controller = new AbortController();

    const promise = engine.analyze({
      fen: START,
      depth: 20,
      multiPV: 3,
      signal: controller.signal,
    });
    controller.abort();

    await expect(promise).rejects.toThrow(/aborted/i);
    // analyze() also sends `stop` on entry, so assert a stop was sent *after*
    // the search started — otherwise this passes without the abort working.
    expect(fake.sent.lastIndexOf('stop')).toBeGreaterThan(fake.sent.indexOf('go depth 20'));
  });

  it('drops principal variations that are illegal in the given position', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    fake.emit('info depth 12 multipv 1 score cp 31 pv e2e4 e7e5 e2e4');
    fake.emit('bestmove e2e4');
    const result = await promise;

    // The third move is illegal, so the pv is truncated rather than throwing.
    expect(result.lines[0].pv).toEqual(['e4', 'e5']);
  });
});
```

- [ ] **Step 7: Run to verify failure**

Run: `npm test -- src/engine/engine.test.ts`
Expected: FAIL — `Failed to resolve import "./engine"`.

- [ ] **Step 8: Implement `src/engine/engine.ts`**

```ts
import { Chess } from 'chess.js';
import { parseInfoLine } from './parseInfo';
import type { AnalyzeRequest, EvalResult, PvLine, RawInfo, UciTransport } from './types';

/** Converts a UCI principal variation to SAN, stopping at the first illegal move. */
function pvToSan(fen: string, uciMoves: string[]): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of uciMoves) {
    try {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      san.push(move.san);
    } catch {
      break;
    }
  }
  return san;
}

export class Engine {
  private busy = false;

  constructor(private readonly transport: UciTransport) {
    this.transport.send('uci');
    this.transport.send('isready');
  }

  /**
   * Runs a MultiPV search. Only one search may be in flight; callers are
   * expected to abort the previous one before starting another.
   */
  analyze(request: AnalyzeRequest): Promise<EvalResult> {
    const { fen, depth, multiPV, onUpdate, signal } = request;

    return new Promise<EvalResult>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Analysis aborted', 'AbortError'));
        return;
      }

      const bySlot = new Map<number, RawInfo>();
      let deepest = 0;

      const buildResult = (): EvalResult => {
        const lines: PvLine[] = [...bySlot.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, info]) => {
            const pv = pvToSan(fen, info.pv);
            return { san: pv[0] ?? '', cp: info.cp, mate: info.mate, pv };
          })
          .filter((line) => line.san.length > 0);
        return { depth: deepest, lines };
      };

      const finish = (settle: () => void) => {
        unsubscribe();
        signal?.removeEventListener('abort', onAbort);
        this.busy = false;
        settle();
      };

      const onAbort = () => {
        this.transport.send('stop');
        finish(() => reject(new DOMException('Analysis aborted', 'AbortError')));
      };

      const unsubscribe = this.transport.onLine((line) => {
        if (line.startsWith('bestmove')) {
          finish(() => resolve(buildResult()));
          return;
        }

        const info = parseInfoLine(line);
        if (!info) return;

        const existing = bySlot.get(info.multipv);
        if (existing && existing.depth > info.depth) return;

        bySlot.set(info.multipv, info);
        deepest = Math.max(deepest, info.depth);
        onUpdate?.(buildResult());
      });

      signal?.addEventListener('abort', onAbort, { once: true });

      this.busy = true;
      this.transport.send('stop');
      this.transport.send(`setoption name MultiPV value ${multiPV}`);
      this.transport.send(`position fen ${fen}`);
      this.transport.send(`go depth ${depth}`);
    });
  }

  get isBusy(): boolean {
    return this.busy;
  }

  stop(): void {
    this.transport.send('stop');
  }

  dispose(): void {
    this.transport.terminate();
  }
}
```

- [ ] **Step 9: Run to verify the Engine tests pass**

Run: `npm test -- src/engine/`
Expected: PASS — 5 parser tests plus 6 engine tests. The smoke test passes or
skips.

- [ ] **Step 10: Commit**

```bash
git add src/engine
git commit -m "feat: add UCI engine wrapper with MultiPV parsing and abort support"
```

---

### Task 5: The game tree

**Files:**
- Create: `src/tree/tree.ts`
- Test: `src/tree/tree.test.ts`

**Interfaces:**
- Consumes: chess.js, `EvalResult` from `src/engine/types`.
- Produces (all pure, no mutation of inputs):
  - `createTree(startFen?: string): GameTree`
  - `insertMove(tree: GameTree, parentId: NodeId, san: string): { tree: GameTree; nodeId: NodeId }`
  - `select(tree: GameTree, nodeId: NodeId): GameTree`
  - `setEval(tree: GameTree, nodeId: NodeId, evaluation: EvalResult): GameTree`
  - `pathTo(tree: GameTree, nodeId: NodeId): TreeNode[]`
  - `evict(tree: GameTree, maxExplored: number): GameTree`
  - `TreeNode`, `GameTree`, `NodeId`

- [ ] **Step 1: Write the failing tests**

`src/tree/tree.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTree, evict, insertMove, pathTo, select, setEval } from './tree';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function withMoves(sans: string[]) {
  let tree = createTree();
  let nodeId = tree.rootId;
  for (const san of sans) {
    const result = insertMove(tree, nodeId, san);
    tree = result.tree;
    nodeId = result.nodeId;
  }
  return { tree, nodeId };
}

describe('game tree', () => {
  it('starts with a root node holding the initial position', () => {
    const tree = createTree();
    expect(tree.nodes[tree.rootId].fen).toBe(START);
    expect(tree.nodes[tree.rootId].move).toBeNull();
    expect(tree.selectedId).toBe(tree.rootId);
  });

  it('inserts a move as a child and advances the position', () => {
    const { tree, nodeId } = withMoves(['e4']);
    const node = tree.nodes[nodeId];
    expect(node.move?.san).toBe('e4');
    expect(node.move?.from).toBe('e2');
    expect(node.move?.to).toBe('e4');
    expect(node.fen).toContain('b KQkq');
    expect(tree.nodes[tree.rootId].childIds).toContain(nodeId);
  });

  it('reuses an existing node instead of duplicating a transposition', () => {
    const first = withMoves(['e4']);
    const second = insertMove(first.tree, first.tree.rootId, 'e4');
    expect(second.nodeId).toBe(first.nodeId);
    expect(second.tree.nodes[second.tree.rootId].childIds).toHaveLength(1);
  });

  it('throws on an illegal move', () => {
    const tree = createTree();
    expect(() => insertMove(tree, tree.rootId, 'e5')).toThrow(/illegal/i);
  });

  it('supports sibling branches from the same parent', () => {
    let { tree } = withMoves([]);
    const a = insertMove(tree, tree.rootId, 'e4');
    const b = insertMove(a.tree, a.tree.rootId, 'd4');
    expect(b.tree.nodes[b.tree.rootId].childIds).toHaveLength(2);
    expect(a.nodeId).not.toBe(b.nodeId);
  });

  it('returns the path from root to a node', () => {
    const { tree, nodeId } = withMoves(['e4', 'e5', 'Nf3']);
    expect(pathTo(tree, nodeId).map((n) => n.move?.san ?? 'start')).toEqual([
      'start',
      'e4',
      'e5',
      'Nf3',
    ]);
  });

  it('caches an eval on a node', () => {
    const { tree, nodeId } = withMoves(['e4']);
    const updated = setEval(tree, nodeId, {
      depth: 12,
      lines: [{ san: 'e5', cp: 20, mate: null, pv: ['e5'] }],
    });
    expect(updated.nodes[nodeId].eval?.depth).toBe(12);
    expect(tree.nodes[nodeId].eval).toBeUndefined(); // original untouched
  });

  it('records selection order when selecting', () => {
    const { tree, nodeId } = withMoves(['e4', 'e5']);
    const updated = select(tree, nodeId);
    expect(updated.selectedId).toBe(nodeId);
    expect(updated.nodes[nodeId].lastSelectedAt).toBeGreaterThan(0);
  });

  it('evicts the least recently selected explored leaves over the cap', () => {
    let tree = createTree();
    const first = insertMove(tree, tree.rootId, 'e4');
    const second = insertMove(first.tree, first.tree.rootId, 'd4');
    const third = insertMove(second.tree, second.tree.rootId, 'c4');
    tree = select(third.tree, third.nodeId);

    const evicted = evict(tree, 2);
    expect(Object.keys(evicted.nodes)).toHaveLength(3); // root + 2 survivors
    expect(evicted.nodes[third.nodeId]).toBeDefined(); // currently selected survives
    expect(evicted.nodes[first.nodeId]).toBeUndefined(); // oldest goes
  });

  it('never evicts authored nodes, pinned nodes, or the selected path', () => {
    let tree = createTree();
    const a = insertMove(tree, tree.rootId, 'e4');
    tree = a.tree;
    tree.nodes[a.nodeId] = { ...tree.nodes[a.nodeId], origin: 'authored' };
    const b = insertMove(tree, a.nodeId, 'e5');
    tree = select(b.tree, b.nodeId);

    const evicted = evict(tree, 0);
    expect(evicted.nodes[a.nodeId]).toBeDefined();
    expect(evicted.nodes[b.nodeId]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/tree/tree.test.ts`
Expected: FAIL — `Failed to resolve import "./tree"`.

- [ ] **Step 3: Implement `src/tree/tree.ts`**

```ts
import { Chess, type Square } from 'chess.js';
import type { EvalResult } from '../engine/types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type NodeId = string;

export interface TreeMove {
  san: string;
  from: Square;
  to: Square;
  promotion?: string;
}

export interface TreeNode {
  id: NodeId;
  parentId: NodeId | null;
  move: TreeMove | null;
  fen: string;
  childIds: NodeId[];
  eval?: EvalResult;
  origin: 'authored' | 'explored';
  annotationRef?: string;
  /** Monotonic counter, not a timestamp — makes eviction order deterministic in tests. */
  lastSelectedAt: number;
}

export interface GameTree {
  rootId: NodeId;
  selectedId: NodeId;
  nodes: Record<NodeId, TreeNode>;
  /** Node ids that must never be evicted (saved lines). */
  pinned: NodeId[];
  /** Incremented on every selection; the source of `lastSelectedAt`. */
  clock: number;
}

const ROOT_ID = 'root';

export function createTree(startFen: string = START_FEN): GameTree {
  return {
    rootId: ROOT_ID,
    selectedId: ROOT_ID,
    clock: 1,
    pinned: [],
    nodes: {
      [ROOT_ID]: {
        id: ROOT_ID,
        parentId: null,
        move: null,
        fen: startFen,
        childIds: [],
        origin: 'authored',
        lastSelectedAt: 1,
      },
    },
  };
}

export function insertMove(
  tree: GameTree,
  parentId: NodeId,
  san: string,
): { tree: GameTree; nodeId: NodeId } {
  const parent = tree.nodes[parentId];
  if (!parent) throw new Error(`Unknown node: ${parentId}`);

  const chess = new Chess(parent.fen);
  let move;
  try {
    move = chess.move(san);
  } catch {
    throw new Error(`Illegal move "${san}" in position ${parent.fen}`);
  }

  const nodeId = parentId === ROOT_ID ? `${ROOT_ID}/${move.san}` : `${parentId}/${move.san}`;
  const existing = tree.nodes[nodeId];
  if (existing) return { tree, nodeId };

  const node: TreeNode = {
    id: nodeId,
    parentId,
    move: {
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    },
    fen: chess.fen(),
    childIds: [],
    origin: 'explored',
    lastSelectedAt: tree.clock,
  };

  return {
    nodeId,
    tree: {
      ...tree,
      nodes: {
        ...tree.nodes,
        [parentId]: { ...parent, childIds: [...parent.childIds, nodeId] },
        [nodeId]: node,
      },
    },
  };
}

export function select(tree: GameTree, nodeId: NodeId): GameTree {
  const node = tree.nodes[nodeId];
  if (!node) throw new Error(`Unknown node: ${nodeId}`);
  const clock = tree.clock + 1;
  return {
    ...tree,
    clock,
    selectedId: nodeId,
    nodes: { ...tree.nodes, [nodeId]: { ...node, lastSelectedAt: clock } },
  };
}

export function setEval(tree: GameTree, nodeId: NodeId, evaluation: EvalResult): GameTree {
  const node = tree.nodes[nodeId];
  if (!node) return tree;
  return { ...tree, nodes: { ...tree.nodes, [nodeId]: { ...node, eval: evaluation } } };
}

export function pathTo(tree: GameTree, nodeId: NodeId): TreeNode[] {
  const path: TreeNode[] = [];
  let current: TreeNode | undefined = tree.nodes[nodeId];
  while (current) {
    path.unshift(current);
    current = current.parentId ? tree.nodes[current.parentId] : undefined;
  }
  return path;
}

/**
 * Drops the least recently selected explored nodes once the explored count
 * exceeds `maxExplored`. Authored nodes, pinned nodes, the selected node's
 * ancestry, and any node with surviving children are all protected — eviction
 * removes leaves only, so no reachable position is ever orphaned.
 */
export function evict(tree: GameTree, maxExplored: number): GameTree {
  const protectedIds = new Set<NodeId>([
    ...tree.pinned,
    ...pathTo(tree, tree.selectedId).map((node) => node.id),
  ]);

  const nodes = { ...tree.nodes };
  let explored = Object.values(nodes).filter((node) => node.origin === 'explored');

  while (explored.length > maxExplored) {
    const removable = explored
      .filter((node) => !protectedIds.has(node.id) && node.childIds.length === 0)
      .sort((a, b) => a.lastSelectedAt - b.lastSelectedAt);

    const victim = removable[0];
    if (!victim) break; // nothing left that is safe to remove

    const parent = victim.parentId ? nodes[victim.parentId] : undefined;
    if (parent) {
      nodes[parent.id] = {
        ...parent,
        childIds: parent.childIds.filter((id) => id !== victim.id),
      };
    }
    delete nodes[victim.id];
    explored = explored.filter((node) => node.id !== victim.id);
  }

  return { ...tree, nodes };
}
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `npm test -- src/tree/tree.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tree
git commit -m "feat: add immutable game tree with transposition reuse and safe eviction"
```

---

### Task 6: Sound manager

**Files:**
- Create: `src/sound/sounds.ts`
- Create: `src/sound/SoundManager.ts`
- Test: `src/sound/SoundManager.test.ts`
- Create: `public/sounds/README.md`

**Interfaces:**
- Consumes: Howler.
- Produces: `SoundManager` with
  `play(name: SoundName): void`, `setMuted(muted: boolean): void`, `get muted(): boolean`,
  and `SoundName` — the union of event names from spec §9.

Audio files are not committed by this task. The manager degrades silently when a
file is missing so the app is fully usable before the sounds exist.

- [ ] **Step 1: Write the failing tests**

`src/sound/SoundManager.test.ts`:

`vi.mock` factories are hoisted above every `const` in the file, so the mock's
state must come from `vi.hoisted` — referencing a plain outer `const` throws
`ReferenceError: Cannot access before initialization`.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  play: vi.fn(),
  rate: vi.fn(),
  once: vi.fn(),
}));

vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate, once: mocks.once })),
}));

import { SoundManager } from './SoundManager';

describe('SoundManager', () => {
  beforeEach(() => {
    mocks.play.mockClear();
    mocks.rate.mockClear();
  });

  it('plays the requested sound', () => {
    new SoundManager().play('move');
    expect(mocks.play).toHaveBeenCalledTimes(1);
  });

  it('varies button click pitch within +/- 2 semitones', () => {
    const manager = new SoundManager();
    for (let i = 0; i < 40; i += 1) manager.play('buttonPress');

    const rates = mocks.rate.mock.calls.map(([value]) => value as number);
    expect(rates.length).toBe(40);
    // 2 semitones is a factor of 2^(2/12) either way.
    const min = 2 ** (-2 / 12);
    const max = 2 ** (2 / 12);
    for (const value of rates) {
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    }
    expect(new Set(rates).size).toBeGreaterThan(1); // actually varying
  });

  it('does not vary pitch for non-button sounds', () => {
    new SoundManager().play('move');
    expect(mocks.rate).not.toHaveBeenCalled();
  });

  it('plays nothing while muted', () => {
    const manager = new SoundManager();
    manager.setMuted(true);
    manager.play('move');
    expect(mocks.play).not.toHaveBeenCalled();
    expect(manager.muted).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/sound/`
Expected: FAIL — `Failed to resolve import "./SoundManager"`.

- [ ] **Step 3: Implement the sound registry and manager**

`src/sound/sounds.ts`:

```ts
export const SOUND_FILES = {
  pickup: '/sounds/pickup.mp3',
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  correct: '/sounds/correct.mp3',
  incorrect: '/sounds/incorrect.mp3',
  hint: '/sounds/hint.mp3',
  drawerOpen: '/sounds/drawer-open.mp3',
  lessonComplete: '/sounds/lesson-complete.mp3',
  buttonPress: '/sounds/button-press.mp3',
} as const;

export type SoundName = keyof typeof SOUND_FILES;

/** Sounds that get random pitch variation so repeats do not sound mechanical. */
export const PITCH_VARIED: ReadonlySet<SoundName> = new Set<SoundName>(['buttonPress']);

/** Two semitones up or down, expressed as a playback rate multiplier. */
export const PITCH_RANGE_SEMITONES = 2;
```

`src/sound/SoundManager.ts`:

```ts
import { Howl } from 'howler';
import { PITCH_RANGE_SEMITONES, PITCH_VARIED, SOUND_FILES, type SoundName } from './sounds';

export class SoundManager {
  private readonly cache = new Map<SoundName, Howl>();
  private isMuted = false;

  get muted(): boolean {
    return this.isMuted;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  play(name: SoundName): void {
    if (this.isMuted) return;

    let howl = this.cache.get(name);
    if (!howl) {
      // A missing file must never break the app — the sound simply does not play.
      howl = new Howl({ src: [SOUND_FILES[name]], preload: true, onloaderror: () => {} });
      this.cache.set(name, howl);
    }

    if (PITCH_VARIED.has(name)) {
      const semitones = (Math.random() * 2 - 1) * PITCH_RANGE_SEMITONES;
      howl.rate(2 ** (semitones / 12));
    }

    howl.play();
  }
}
```

`public/sounds/README.md`:

```markdown
# Sound assets

Drop the following files here. Every one is optional — a missing file plays
nothing and logs nothing, so the app stays fully usable without them.

| File | Event | Character |
|---|---|---|
| `pickup.mp3` | Piece lifted | Soft pop |
| `move.mp3` | Quiet move placed | Rounded thunk |
| `capture.mp3` | Capture | Heavier thunk with a crunch |
| `check.mp3` | Check delivered | Rising two-note |
| `correct.mp3` | Checkpoint solved | Three-note rising chime |
| `incorrect.mp3` | Checkpoint missed | Soft descending tone, not punishing |
| `hint.mp3` | Hint revealed | Paper slide |
| `drawer-open.mp3` | Compare drawer opens | Whoosh |
| `lesson-complete.mp3` | Lesson finished | Short fanfare |
| `button-press.mp3` | Any button press | Short click (pitch-varied at runtime) |
```

- [ ] **Step 4: Run to verify the tests pass**

Run: `npm test -- src/sound/`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/sound public/sounds
git commit -m "feat: add sound manager with pitch-varied button presses"
```

---

### Task 7: Design tokens and the app shell

**Files:**
- Create: `src/ui/theme.css`
- Create: `src/ui/Button.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Test: `src/ui/Button.test.tsx`

**Interfaces:**
- Consumes: `SoundManager` (Task 6).
- Produces: `Button` — the chunky pressable used everywhere,
  `<Button onClick variant="primary" | "secondary" | "ghost">`. CSS custom
  properties in `theme.css` are the single source of colour and radius for all
  later UI tasks.

- [ ] **Step 1: Write the failing Button test**

`src/ui/Button.test.tsx`:

Howler is mocked rather than `SoundManager`, so the test exercises the real
manager and asserts the click sound actually fires. As in Task 6, the mock's
state comes from `vi.hoisted` because `vi.mock` is hoisted above every `const`.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));

vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { Button } from './Button';

describe('Button', () => {
  beforeEach(() => {
    mocks.play.mockClear();
  });

  it('plays a click sound when pressed', async () => {
    render(<Button>Compare lines</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Compare lines' }));
    expect(mocks.play).toHaveBeenCalledTimes(1);
  });

  it('renders its label and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Compare lines</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Compare lines' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Compare lines
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Compare lines' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('exposes the variant as a data attribute for styling', () => {
    render(<Button variant="secondary">Hint</Button>);
    expect(screen.getByRole('button', { name: 'Hint' })).toHaveAttribute(
      'data-variant',
      'secondary',
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/ui/Button.test.tsx`
Expected: FAIL — `Failed to resolve import "./Button"`.

- [ ] **Step 3: Create `src/ui/theme.css`**

```css
:root {
  --bg: #fffaf2;
  --surface: #ffffff;
  --ink: #2b2b3c;
  --ink-soft: #6b6b80;

  --primary: #ff7a45;
  --primary-shadow: #d1522a;
  --secondary: #5b3fd6;
  --secondary-shadow: #4430a8;
  --good: #57cc7d;
  --bad: #e5484d;

  --board-light: #f2dcbb;
  --board-dark: #b58863;
  --board-highlight: #f6c945;

  --border: #ffd9bd;
  --radius: 14px;
  --radius-sm: 8px;
  --lip: 4px;

  --font: 'Nunito', 'Baloo 2', system-ui, -apple-system, sans-serif;
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font);
}

.btn {
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 11px 18px;
  cursor: pointer;
  transition: transform 90ms var(--spring), filter 90ms ease;
}

.btn[data-variant='primary'] {
  background: var(--primary);
  border-bottom: var(--lip) solid var(--primary-shadow);
}

.btn[data-variant='secondary'] {
  background: var(--secondary);
  border-bottom: var(--lip) solid var(--secondary-shadow);
}

.btn[data-variant='ghost'] {
  background: transparent;
  color: var(--ink);
  border: 2px solid var(--border);
  border-bottom-width: var(--lip);
}

.btn:not(:disabled):active {
  transform: translateY(3px);
  border-bottom-width: 1px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:focus-visible {
  outline: 3px solid var(--secondary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none;
  }
  .btn:not(:disabled):active {
    transform: none;
  }
}
```

- [ ] **Step 4: Implement `src/ui/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SoundManager } from '../sound/SoundManager';

const sounds = new SoundManager();

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

export function Button({ variant = 'primary', children, onClick, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className="btn"
      data-variant={variant}
      onClick={(event) => {
        sounds.play('buttonPress');
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Wire the theme into the app**

In `src/main.tsx`, add the stylesheet import above the `App` import:

```tsx
import './ui/theme.css';
```

Replace `src/App.tsx` with the shell later tasks fill in:

```tsx
export function App() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 18px' }}>ChessTrainer</h1>
      <p style={{ color: 'var(--ink-soft)' }}>Explorer coming online.</p>
    </main>
  );
}
```

- [ ] **Step 6: Run to verify tests pass**

Run: `npm test -- src/ui/Button.test.tsx`
Expected: PASS, 4 tests.

Then run `npm run dev` and confirm the button style renders and compresses on
press.

- [ ] **Step 7: Commit**

```bash
git add src/ui src/App.tsx src/main.tsx
git commit -m "feat: add bright-and-bouncy design tokens and pressable button"
```

---

### Task 8: Board and breadcrumb wired to the tree store

**Files:**
- Create: `src/tree/store.ts`
- Create: `src/ui/Board.tsx`
- Create: `src/ui/Breadcrumb.tsx`
- Modify: `src/App.tsx`
- Test: `src/tree/store.test.ts`
- Test: `src/ui/Breadcrumb.test.tsx`

**Interfaces:**
- Consumes: `createTree`, `insertMove`, `select`, `setEval`, `pathTo`, `evict` (Task 5); `SoundManager` (Task 6).
- Produces: `useTreeStore` — a Zustand store exposing
  `{ tree, playMove(san): NodeId | null, selectNode(id): void, cacheEval(id, evaluation): void }`,
  plus `useSelectedNode()` and `useCurrentPath()` selectors consumed by Task 9.

Note the store lives in `src/tree/store.ts` but imports Zustand, which the purity
guard forbids in `src/tree/`. Add `src/tree/store.ts` to the guard's exclusion
list in `src/test/purity.test.ts`.

- [ ] **Step 1: Update the purity guard to exempt the store**

In `src/test/purity.test.ts`, change the `tsFilesIn` filter line to skip the
store file:

```ts
    return full.endsWith('.ts') && !full.endsWith('.test.ts') && !full.endsWith('store.ts')
      ? [full]
      : [];
```

- [ ] **Step 2: Write the failing store test**

`src/tree/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useTreeStore } from './store';

describe('tree store', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
  });

  it('plays a legal move from the selected node and selects the result', () => {
    const nodeId = useTreeStore.getState().playMove('e4');
    expect(nodeId).not.toBeNull();
    expect(useTreeStore.getState().tree.selectedId).toBe(nodeId);
  });

  it('returns null and changes nothing for an illegal move', () => {
    const before = useTreeStore.getState().tree;
    expect(useTreeStore.getState().playMove('e5')).toBeNull();
    expect(useTreeStore.getState().tree).toBe(before);
  });

  it('caches an eval onto a node', () => {
    const nodeId = useTreeStore.getState().playMove('e4')!;
    useTreeStore.getState().cacheEval(nodeId, {
      depth: 14,
      lines: [{ san: 'e5', cp: 22, mate: null, pv: ['e5'] }],
    });
    expect(useTreeStore.getState().tree.nodes[nodeId].eval?.depth).toBe(14);
  });

  it('navigates back to an ancestor and branches from there', () => {
    const store = useTreeStore.getState();
    store.playMove('e4');
    store.playMove('e5');
    store.selectNode(useTreeStore.getState().tree.rootId);
    const d4 = useTreeStore.getState().playMove('d4');

    const root = useTreeStore.getState().tree.nodes.root;
    expect(root.childIds).toHaveLength(2);
    expect(useTreeStore.getState().tree.selectedId).toBe(d4);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/tree/store.test.ts`
Expected: FAIL — `Failed to resolve import "./store"`.

- [ ] **Step 4: Implement `src/tree/store.ts`**

```ts
import { create } from 'zustand';
import type { EvalResult } from '../engine/types';
import {
  createTree,
  evict,
  insertMove,
  pathTo,
  select,
  setEval,
  type GameTree,
  type NodeId,
  type TreeNode,
} from './tree';

const MAX_EXPLORED_NODES = 1000;

interface TreeStore {
  tree: GameTree;
  playMove: (san: string) => NodeId | null;
  selectNode: (nodeId: NodeId) => void;
  cacheEval: (nodeId: NodeId, evaluation: EvalResult) => void;
  reset: () => void;
}

export const useTreeStore = create<TreeStore>((set, get) => ({
  tree: createTree(),

  playMove: (san) => {
    const { tree } = get();
    let inserted;
    try {
      inserted = insertMove(tree, tree.selectedId, san);
    } catch {
      return null;
    }
    set({ tree: evict(select(inserted.tree, inserted.nodeId), MAX_EXPLORED_NODES) });
    return inserted.nodeId;
  },

  selectNode: (nodeId) => set({ tree: select(get().tree, nodeId) }),

  cacheEval: (nodeId, evaluation) => set({ tree: setEval(get().tree, nodeId, evaluation) }),

  reset: () => set({ tree: createTree() }),
}));

export function useSelectedNode(): TreeNode {
  return useTreeStore((state) => state.tree.nodes[state.tree.selectedId]);
}

export function useCurrentPath(): TreeNode[] {
  return useTreeStore((state) => pathTo(state.tree, state.tree.selectedId));
}
```

- [ ] **Step 5: Run the store test**

Run: `npm test -- src/tree/store.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the failing Breadcrumb test**

`src/ui/Breadcrumb.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTreeStore } from '../tree/store';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb', () => {
  beforeEach(() => useTreeStore.getState().reset());

  it('shows the start crumb alone at the root', () => {
    render(<Breadcrumb />);
    expect(screen.getByRole('button', { name: 'start' })).toBeInTheDocument();
  });

  it('shows a crumb per move played', () => {
    useTreeStore.getState().playMove('e4');
    useTreeStore.getState().playMove('e5');
    render(<Breadcrumb />);
    expect(screen.getByRole('button', { name: 'e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'e5' })).toBeInTheDocument();
  });

  it('navigates back when an earlier crumb is clicked', async () => {
    useTreeStore.getState().playMove('e4');
    useTreeStore.getState().playMove('e5');
    render(<Breadcrumb />);

    await userEvent.click(screen.getByRole('button', { name: 'e4' }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');
  });
});
```

- [ ] **Step 7: Run to verify failure**

Run: `npm test -- src/ui/Breadcrumb.test.tsx`
Expected: FAIL — `Failed to resolve import "./Breadcrumb"`.

- [ ] **Step 8: Implement `src/ui/Breadcrumb.tsx`**

```tsx
import { useCurrentPath, useTreeStore } from '../tree/store';

export function Breadcrumb() {
  const path = useCurrentPath();
  const selectNode = useTreeStore((state) => state.selectNode);
  const selectedId = useTreeStore((state) => state.tree.selectedId);

  return (
    <nav
      aria-label="Move history"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}
    >
      {path.map((node, index) => (
        <span key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {index > 0 && <span style={{ color: 'var(--ink-soft)' }}>›</span>}
          <button
            type="button"
            onClick={() => selectNode(node.id)}
            aria-current={node.id === selectedId ? 'true' : undefined}
            style={{
              font: 'inherit',
              fontWeight: node.id === selectedId ? 800 : 600,
              fontSize: 13,
              padding: '4px 10px',
              borderRadius: 999,
              cursor: 'pointer',
              border: '2px solid var(--border)',
              background: node.id === selectedId ? 'var(--border)' : 'transparent',
              color: 'var(--ink)',
            }}
          >
            {node.move?.san ?? 'start'}
          </button>
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 9: Implement `src/ui/Board.tsx`**

Note the v5 `options`-object API and the `{ sourceSquare, targetSquare }`
argument shape — see Global Constraints.

```tsx
import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { SoundManager } from '../sound/SoundManager';
import { useSelectedNode, useTreeStore } from '../tree/store';

const sounds = new SoundManager();

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function Board() {
  const node = useSelectedNode();
  const playMove = useTreeStore((state) => state.playMove);

  const highlight = useMemo(() => {
    if (!node.move) return {};
    const style = { background: 'rgba(246, 201, 69, 0.55)' };
    return { [node.move.from]: style, [node.move.to]: style };
  }, [node.move]);

  function onPieceDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!targetSquare) return false;

    // Resolve the drag to SAN before handing it to the tree, which speaks SAN.
    const probe = new Chess(node.fen);
    let san: string;
    try {
      san = probe.move({ from: sourceSquare, to: targetSquare, promotion: 'q' }).san;
    } catch {
      return false;
    }

    const played = playMove(san);
    if (!played) return false;

    if (probe.isCheck()) sounds.play('check');
    else if (san.includes('x')) sounds.play('capture');
    else sounds.play('move');

    return true;
  }

  return (
    <Chessboard
      options={{
        id: 'main-board',
        position: node.fen,
        onPieceDrop,
        squareStyles: highlight,
        lightSquareStyle: { backgroundColor: 'var(--board-light)' },
        darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
        boardStyle: { borderRadius: 12, boxShadow: '0 5px 0 #e0c3a3, 0 10px 24px rgba(180,120,60,.25)' },
        dropSquareStyle: { boxShadow: 'inset 0 0 0 4px var(--board-highlight)' },
        animationDurationInMs: prefersReducedMotion ? 0 : 180,
        showAnimations: !prefersReducedMotion,
      }}
    />
  );
}
```

- [ ] **Step 10: Wire both into `src/App.tsx`**

```tsx
import { Board } from './ui/Board';
import { Breadcrumb } from './ui/Breadcrumb';

export function App() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 18px' }}>ChessTrainer</h1>
      <Breadcrumb />
      <div style={{ maxWidth: 480 }}>
        <Board />
      </div>
    </main>
  );
}
```

- [ ] **Step 11: Run the full suite and the app**

Run: `npm test && npm run typecheck`
Expected: all tests pass, typecheck clean.

Run `npm run dev` and verify by hand: pieces drag and drop, illegal moves snap
back, the last move's squares highlight, breadcrumb grows with each move, and
clicking an earlier crumb rewinds the board.

- [ ] **Step 12: Commit**

```bash
git add src/tree/store.ts src/ui src/App.tsx src/test/purity.test.ts
git commit -m "feat: add board and breadcrumb wired to the game tree store"
```

---

### Task 9: Candidate rail with live engine analysis

**Files:**
- Create: `src/ui/useAnalysis.ts`
- Create: `src/ui/CandidateRail.tsx`
- Create: `src/ui/EvalBar.tsx`
- Modify: `src/App.tsx`
- Test: `src/ui/useAnalysis.test.ts`
- Test: `src/ui/CandidateRail.test.tsx`

**The hook lives in `src/ui/`, not `src/engine/`.** It imports React hooks, and
`src/engine/` is covered by the Task 1 purity guard. Putting it under `engine/`
would fail that test.

**Interfaces:**
- Consumes: `Engine`, `createWorkerTransport` (Tasks 2 and 4); `useTreeStore`,
  `useSelectedNode` (Task 8).
- Produces: `useAnalysis()` returning
  `{ result: EvalResult | null; status: 'idle' | 'analyzing' | 'unavailable' }`,
  and `formatScore(line: PvLine): string`. Plan 2's compare drawer consumes both.

This task implements the Global Constraint on stale results: each analysis is
tagged with the node id that requested it, and a result whose tag is no longer
the selected node is discarded.

- [ ] **Step 1: Write the failing hook test**

`src/ui/useAnalysis.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatScore } from './useAnalysis';

describe('formatScore', () => {
  it('formats a positive centipawn score with a sign', () => {
    expect(formatScore({ san: 'e4', cp: 31, mate: null, pv: ['e4'] })).toBe('+0.31');
  });

  it('formats a negative centipawn score', () => {
    expect(formatScore({ san: 'e4', cp: -145, mate: null, pv: ['e4'] })).toBe('-1.45');
  });

  it('formats an even score', () => {
    expect(formatScore({ san: 'e4', cp: 0, mate: null, pv: ['e4'] })).toBe('0.00');
  });

  it('formats mate scores', () => {
    expect(formatScore({ san: 'Qh7', cp: null, mate: 3, pv: ['Qh7'] })).toBe('M3');
    expect(formatScore({ san: 'Kg1', cp: null, mate: -2, pv: ['Kg1'] })).toBe('-M2');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/ui/useAnalysis.test.ts`
Expected: FAIL — `Failed to resolve import "./useAnalysis"`.

- [ ] **Step 3: Implement `src/ui/useAnalysis.ts`**

```ts
import { useEffect, useRef, useState } from 'react';
import { Engine } from '../engine/engine';
import { createWorkerTransport } from '../engine/stockfishWorker';
import type { EvalResult, PvLine } from '../engine/types';
import { useSelectedNode, useTreeStore } from '../tree/store';

export const TARGET_DEPTH = 16;
export const MULTI_PV = 3;

export type AnalysisStatus = 'idle' | 'analyzing' | 'unavailable';

/** Renders a score from the side-to-move's perspective, e.g. "+0.31" or "M3". */
export function formatScore(line: PvLine): string {
  if (line.mate !== null) return line.mate < 0 ? `-M${Math.abs(line.mate)}` : `M${line.mate}`;
  const pawns = (line.cp ?? 0) / 100;
  if (pawns === 0) return '0.00';
  return `${pawns > 0 ? '+' : '-'}${Math.abs(pawns).toFixed(2)}`;
}

export function useAnalysis(): { result: EvalResult | null; status: AnalysisStatus } {
  const node = useSelectedNode();
  const cacheEval = useTreeStore((state) => state.cacheEval);
  const engineRef = useRef<Engine | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [result, setResult] = useState<EvalResult | null>(node.eval ?? null);

  useEffect(() => {
    try {
      engineRef.current = new Engine(createWorkerTransport());
    } catch {
      setStatus('unavailable');
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    // Show any cached result immediately so navigating back is instant.
    setResult(node.eval ?? null);
    if (node.eval && node.eval.depth >= TARGET_DEPTH) return;

    const requestedFor = node.id;
    const controller = new AbortController();
    setStatus('analyzing');

    engine
      .analyze({
        fen: node.fen,
        depth: TARGET_DEPTH,
        multiPV: MULTI_PV,
        signal: controller.signal,
        onUpdate: (partial) => {
          // Stale-result guard: only the node that asked may render.
          if (useTreeStore.getState().tree.selectedId !== requestedFor) return;
          setResult(partial);
        },
      })
      .then((final) => {
        if (useTreeStore.getState().tree.selectedId !== requestedFor) return;
        cacheEval(requestedFor, final);
        setResult(final);
        setStatus('idle');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('unavailable');
      });

    return () => controller.abort();
  }, [node.id, node.fen, node.eval, cacheEval]);

  return { result, status };
}
```

- [ ] **Step 4: Run the hook test**

Run: `npm test -- src/ui/useAnalysis.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing CandidateRail test**

`src/ui/CandidateRail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTreeStore } from '../tree/store';
import { CandidateRail } from './CandidateRail';

const analysis = vi.hoisted(() => ({ value: { result: null, status: 'idle' } as never }));
vi.mock('./useAnalysis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useAnalysis')>()),
  useAnalysis: () => analysis.value,
}));

describe('CandidateRail', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
    analysis.value = { result: null, status: 'idle' } as never;
  });

  it('lists candidate moves with their scores', () => {
    analysis.value = {
      status: 'idle',
      result: {
        depth: 16,
        lines: [
          { san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5'] },
          { san: 'd4', cp: 28, mate: null, pv: ['d4', 'd5'] },
        ],
      },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /e4/ })).toHaveTextContent('+0.31');
    expect(screen.getByRole('button', { name: /d4/ })).toHaveTextContent('+0.28');
  });

  it('plays the move when a candidate is clicked', async () => {
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    await userEvent.click(screen.getByRole('button', { name: /e4/ }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');
  });

  it('shows the degraded banner when the engine is unavailable', () => {
    analysis.value = { result: null, status: 'unavailable' } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('status')).toHaveTextContent(/engine unavailable/i);
  });

  it('shows a thinking state while analysing with no result yet', () => {
    analysis.value = { result: null, status: 'analyzing' } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('status')).toHaveTextContent(/thinking/i);
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- src/ui/CandidateRail.test.tsx`
Expected: FAIL — `Failed to resolve import "./CandidateRail"`.

- [ ] **Step 7: Implement `src/ui/EvalBar.tsx` and `src/ui/CandidateRail.tsx`**

`src/ui/EvalBar.tsx`:

```tsx
export function EvalBar({ cp, mate }: { cp: number | null; mate: number | null }) {
  // Map centipawns onto 0-100% with a soft clamp; +/-500cp is treated as decisive.
  const advantage = mate !== null ? (mate > 0 ? 1 : 0) : 0.5 + Math.max(-500, Math.min(500, cp ?? 0)) / 1000;

  return (
    <div
      role="presentation"
      style={{ height: 10, borderRadius: 5, background: '#3a3a46', overflow: 'hidden' }}
    >
      <div
        style={{
          width: `${advantage * 100}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--good), #cddc39)',
        }}
      />
    </div>
  );
}
```

`src/ui/CandidateRail.tsx`:

```tsx
import { useTreeStore } from '../tree/store';
import { EvalBar } from './EvalBar';
import { formatScore, useAnalysis } from './useAnalysis';

export function CandidateRail() {
  const { result, status } = useAnalysis();
  const playMove = useTreeStore((state) => state.playMove);

  if (status === 'unavailable') {
    return (
      <div
        role="status"
        style={{
          padding: 12,
          borderRadius: 'var(--radius)',
          border: '2px solid var(--border)',
          fontSize: 13,
        }}
      >
        Engine unavailable — lesson content still works, but live evaluation is off.
      </div>
    );
  }

  if (!result || result.lines.length === 0) {
    return (
      <div role="status" style={{ padding: 12, color: 'var(--ink-soft)', fontSize: 13 }}>
        Thinking…
      </div>
    );
  }

  return (
    <section aria-label="Candidate moves">
      <h2 style={{ fontSize: 12, letterSpacing: '.08em', color: 'var(--ink-soft)', margin: '0 0 8px' }}>
        CANDIDATE MOVES · depth {result.depth}
      </h2>
      {result.lines.map((line, index) => (
        <button
          key={line.san}
          type="button"
          onClick={() => playMove(line.san)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            font: 'inherit',
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 8,
            padding: '10px 12px',
            cursor: 'pointer',
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: `2px solid ${index === 0 ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            boxShadow: `0 3px 0 ${index === 0 ? 'var(--primary)' : 'var(--border)'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{line.san}</span>
            <span>{formatScore(line)}</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <EvalBar cp={line.cp} mate={line.mate} />
          </div>
          <div style={{ marginTop: 6, fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)' }}>
            {line.pv.slice(0, 6).join(' ')}
          </div>
        </button>
      ))}
    </section>
  );
}
```

- [ ] **Step 8: Wire the rail into `src/App.tsx`**

```tsx
import { Board } from './ui/Board';
import { Breadcrumb } from './ui/Breadcrumb';
import { CandidateRail } from './ui/CandidateRail';

export function App() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 18px' }}>ChessTrainer</h1>
      <Breadcrumb />
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 420px', maxWidth: 520 }}>
          <Board />
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 240 }}>
          <CandidateRail />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Run the full suite, typecheck, and the app**

Run: `npm test && npm run typecheck`
Expected: every test passes, typecheck clean.

Run `npm run dev` and verify by hand:
- Three candidates appear with evals, refining as depth climbs.
- Clicking a candidate advances the board and a fresh analysis starts.
- Clicking an earlier breadcrumb crumb shows its cached eval **instantly**.
- Clicking rapidly through several nodes never renders a score belonging to a
  previous position.
- Dragging a bad-but-legal move still works and gets analysed.

- [ ] **Step 10: Commit**

```bash
git add src/ui src/App.tsx
git commit -m "feat: add candidate rail with streaming analysis and stale-result guard"
```

---

## What Plan 1 delivers

A working line explorer: drag any legal move or click an engine candidate,
branch freely, navigate back through the breadcrumb with cached evals, and hear
the app respond. The pure core — features, engine, tree — is fully unit tested
and ready for the explainer.

## What Plan 2 covers

Written once Plan 1 lands and `spike-results.md` records the real depth budget:

- `explain/` — the rule-based explainer over `PositionFeatures`, with a FEN
  fixture table per rule
- Move-quality banding (best / good / inaccuracy / mistake / blunder) surfaced
  on free moves
- The compare drawer, including the sub-0.3 "practically equal" verdict rule
- `content/` — Zod schema, loader, SAN-replay validation, and the three openings
  plus four theme lessons
- `lesson/` — the lesson rail, checkpoint grading, hint tiers, `nearMiss`
  replies, and the candidate rail hiding during checkpoints
- `progress/` — versioned localStorage, "My Lines" as PGN
- **Mute toggle UI.** `SoundManager.setMuted()` exists after Plan 1 Task 6 but
  nothing in the UI calls it. Spec §9 requires a user-facing toggle, persisted
  alongside progress.
- **Keyboard board navigation.** Spec §11 requires it and Plan 1 does not
  deliver it. Check what react-chessboard v5 provides natively before building
  anything custom; arrow keys to move a cursor and Enter to pick up and drop is
  the target.
