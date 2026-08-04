# Vendored chess engine

The two files alongside this README are a prebuilt Stockfish.js distribution,
copied verbatim from the [`stockfish`](https://www.npmjs.com/package/stockfish)
npm package (version 18.0.8) at `node_modules/stockfish/bin/`.

| File here | Source file in the package |
|---|---|
| `stockfish.js` | `stockfish-18-lite-single.js` |
| `stockfish.wasm` | `stockfish-18-lite-single.wasm` |

The `lite-single` build is the single-threaded, small-NNUE variant. It is the
one this app uses because it needs no `SharedArrayBuffer`, and therefore no
cross-origin isolation headers, so the app can be served as plain static files.

## Why the files are checked in

Vite serves `public/` verbatim, and the engine is loaded as a Web Worker from
`/engine/stockfish.js` at runtime. Copying the build here keeps `stockfish` a
devDependency — it is never imported by application code and never enters the
bundle.

To refresh after upgrading the npm package, re-copy both files and update the
version above.

## License

Stockfish is free software licensed under the **GNU General Public License
version 3**. The full license text is in `COPYING.txt` in this directory.

- Upstream engine: <https://github.com/official-stockfish/Stockfish>
- WASM/JS port: <https://github.com/nmrugg/stockfish.js>
- Copyright (c) 2026 Chess.com, LLC (per the header of `stockfish.js`)

Anyone redistributing these files — including by deploying this app — is bound
by the GPL-3.0 terms, which require that the corresponding source be made
available. The engine runs as a separate program in a Web Worker and
communicates with the app only over the UCI text protocol; the rest of this
repository is not a derivative work of Stockfish.
