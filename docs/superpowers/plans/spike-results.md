# Spike Results — 2026-08-01

## react-chessboard
- Installed version: 5.10.0
- React version required: `^19.0.0` (peer dependency; project uses React 19.2.8)
- Confirmed: configuration goes through a single `options` prop object. From
  `node_modules/react-chessboard/dist/Chessboard.d.ts`:
  `type ChessboardProps = { options?: ChessboardOptions }`.

## Stockfish
- Package version: 18.0.8
- Build used: `stockfish-18-lite-single.js` / `stockfish-18-lite-single.wasm`
  (single-threaded, no SharedArrayBuffer)

  The `stockfish` npm package does **not** ship a `src/` directory as the
  brief's placeholder assumed — for v18.0.8 the built engines live in
  `node_modules/stockfish/bin/`, containing five flavors: full multi-threaded
  (`stockfish-18.js`, 113MB wasm), full single-threaded (`stockfish-18-single.js`,
  113MB wasm), lite multi-threaded (`stockfish-18-lite.js`, 7MB wasm), lite
  single-threaded (`stockfish-18-lite-single.js`, 7MB wasm), and an asm.js
  fallback. The package's own README explicitly recommends the lite
  single-threaded build for most projects ("fast and does not require any
  complicated setup... still far stronger than any human will ever be"). Given
  this app is a static SPA (no COOP/COEP headers available, ruling out the
  multi-threaded builds regardless) and depth budget/interactivity is the
  measured constraint, the 113MB full single-threaded wasm would dominate load
  time for no benefit at these search depths — the lite single-threaded build
  (7MB wasm) was chosen. UCI `option name Threads ... max 1` reported by the
  engine at runtime confirms it is genuinely single-threaded.
- Served from: `public/engine/stockfish.js` (+ `public/engine/stockfish.wasm`,
  renamed from `stockfish-18-lite-single.wasm` because the loader's compiled
  wasm-locate logic requests `stockfish.wasm` relative to the script, not the
  original release filename — confirmed by grepping the built JS for `.wasm`
  string literals).

## Depth budget (measured)
Measured via `createWorkerTransport()` running in a real browser (Microsoft
Edge 151, Chromium-based) loading the actual `public/engine/stockfish.js`
worker over `vite dev` — not jsdom. `Worker` is undefined in this project's
jsdom test environment, so `src/engine/engine.smoke.test.ts` skips per its
`describe.skipIf(!canRunWorkers)` gate (see "How verified" below for how the
browser run was driven without an interactive session).

| Position | Depth 12 | Depth 15 | Depth 18 | Depth 20 |
|---|---|---|---|---|
| Start position | 24ms | 72ms | 278ms | 975ms |
| Middlegame FEN (Kiwipete: `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1`) | 74ms | 105ms | 428ms | 697ms |

A repeat run produced consistent numbers (start: 24/81/289/958ms; middlegame:
75/109/481/745ms), confirming these aren't a one-off fluke.

**Chosen interactive target depth: 20** — the deepest depth tested, and it
still returns in under ~1000ms for both positions (975ms / 697ms), comfortably
inside the ~1500ms interactive budget. On this hardware and with the lite
single-threaded build, depth 18 is the safer default if a wider stability
margin is wanted (278–428ms), with depth 20 available when the extra strength
matters. Results stream from depth 8 upward via `info depth N ...` lines
already, satisfying the "streaming from depth 8" requirement without extra
work.

**Implication for Plan 2:** the compare feature walks two PVs, so its budget
is roughly double a single analysis. At depth 20, the worst measured single
analysis was 975ms — over the ~800ms threshold — so a naive double-analysis
compare (~2s) would not feel interactive. Compare should reuse the
already-cached node evals from each line's own analysis rather than
re-running fresh analysis at compare time. At depth 18 (278–428ms), doubling
stays under ~900ms and re-analysis on demand would likely still be acceptable
if caching turns out to be impractical.

## How verified
No interactive browser tool was available in this session (Claude in Chrome
extension not connected) and no Chrome/Chromium binary was preinstalled, so
the brief's manual "click a temporary button and read the console" step was
automated instead: a temporary button was added to `src/App.tsx` that called
`createWorkerTransport()`, ran the `uci`/`isready` handshake, then timed
`go depth N` for each depth/position pair, logging every engine line
(including the literal `bestmove <move> ponder <move>` lines) to the console.
`playwright` was installed temporarily (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`)
to drive the system's installed Microsoft Edge (channel `msedge`, no browser
download needed) headless against `npm run dev`, click the button, and
capture the browser console via CDP. Console output showed
`bestmove e2e4 ponder e7e5` (start position) and `bestmove e2a6 ponder h3g2`
(Kiwipete) at every tested depth, matching the smoke test's
`/^bestmove [a-h][1-8][a-h][1-8]/` expectation. `playwright` was then
uninstalled and the temporary button removed from `App.tsx` — neither is part
of the committed diff.
