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

// Task 2's spike measured the real engine at ~1s for a depth-20 search. This
// is a generous multiple of that budget, used only as a second net against a
// silently dead engine (wasm failed to instantiate with no `onerror`, or a
// worker that stopped responding) — not something a healthy search should
// ever approach.
export const ANALYZE_TIMEOUT_MS = 15_000;

/** A search that's currently occupying the `pending` slot on the Engine. */
interface PendingSearch {
  /** Idempotently rejects this search with an AbortError. Safe to call more than once. */
  cancel: () => void;
  /** Idempotently rejects this search with a non-abort error (transport failure, timeout). Safe to call more than once. */
  fail: (reason: unknown) => void;
}

export class Engine {
  private busy = false;
  /** The most recently created search, whether or not it has started yet. */
  private pending: PendingSearch | null = null;
  /**
   * Resolves once the engine has emitted the `bestmove` for the search
   * currently occupying it (genuine or stale-after-stop). `null` when no
   * search has commands in flight with the engine, so the next `analyze()`
   * may send its own commands immediately.
   *
   * This awaits an external `bestmove` with no timeout: if the underlying
   * engine process crashes or hangs after `go`, nothing here ever forces
   * this promise to resolve. A later `analyze()` queued behind it (via
   * `this.drain.then(start)`) would wait forever on its own — it relies on
   * a subsequent `analyze()` (which cancels it, rejecting it directly) or
   * `dispose()` to release it instead.
   */
  private drain: Promise<void> | null = null;
  private readonly errorListeners = new Set<(reason: unknown) => void>();
  private readonly unsubscribeTransportError: () => void;

  constructor(private readonly transport: UciTransport) {
    this.transport.send('uci');
    this.transport.send('isready');
    this.unsubscribeTransportError = this.transport.onError((reason) => this.handleTransportError(reason));
  }

  /**
   * Registers a callback invoked when the transport reports a fatal failure
   * (worker script 404, wasm failed to instantiate) or a search times out
   * with no bestmove ever arriving. Consumers (e.g. useAnalysis) use this to
   * surface a degraded/unavailable state instead of spinning forever.
   */
  onError(cb: (reason: unknown) => void): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  private handleTransportError(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error('Engine transport failed');
    this.pending?.fail(error);
    this.pending = null;
    this.busy = false;
    this.drain = null;
    this.errorListeners.forEach((cb) => cb(error));
  }

  /**
   * Runs a MultiPV search. Searches are serialized: calling `analyze()`
   * while a previous search is still in flight aborts that search and waits
   * for its terminating `bestmove` to drain from the engine before sending
   * this search's own `position`/`go` — this prevents a stale `bestmove`
   * from a stopped search resolving a different, later search.
   */
  analyze(request: AnalyzeRequest): Promise<EvalResult> {
    const { fen, depth, multiPV, onUpdate, signal } = request;

    // UCI reports cp/mate from the side to move, not from White. Flip the
    // sign whenever Black is to move so a positive score always favors
    // White — see the convention documented on PvLine.
    const sideToMoveSign = fen.trim().split(/\s+/)[1] === 'b' ? -1 : 1;

    // A new search always supersedes whatever was pending before it.
    this.pending?.cancel();

    return new Promise<EvalResult>((resolve, reject) => {
      let cancelled = false;
      let started = false;
      let unsubscribe: () => void = () => {};

      const bySlot = new Map<number, RawInfo>();
      let deepest = 0;

      const buildResult = (): EvalResult => {
        const lines: PvLine[] = [...bySlot.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, info]) => {
            const pv = pvToSan(fen, info.pv);
            return {
              san: pv[0] ?? '',
              cp: info.cp === null ? null : info.cp * sideToMoveSign,
              mate: info.mate === null ? null : info.mate * sideToMoveSign,
              pv,
            };
          })
          .filter((line) => line.san.length > 0);
        return { depth: deepest, lines };
      };

      const onAbort = () => cancel();

      const clearGuards = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
      };

      const cancel = () => {
        if (cancelled) return;
        cancelled = true;
        clearGuards();
        reject(new DOMException('Analysis aborted', 'AbortError'));
        if (started) {
          // The engine still owes this search a `bestmove`. Stay subscribed
          // so it can be drained (and ignored) below before the next
          // search's commands are sent.
          this.transport.send('stop');
        } else {
          // Never sent `go`, so no `bestmove` will ever arrive for this
          // search — nothing to drain. `this.drain` is left untouched: it
          // still reflects whatever the *previous* search needs to drain.
          unsubscribe();
          if (this.pending === handle) this.pending = null;
          // Only clear busy if nothing else is still draining. A
          // different, earlier search may still be outstanding at the
          // engine (this.drain non-null) — isBusy must keep reflecting
          // that, not go stale just because *this* search never started.
          if (!this.drain) this.busy = false;
        }
      };

      // A fatal, non-abort failure: the transport died, or no bestmove ever
      // arrived within the wall-clock budget. Unlike `cancel()`, there is no
      // `bestmove` left to drain — the engine (or transport) is presumed
      // dead — so this always fully releases the busy/drain state.
      const fail = (reason: unknown) => {
        if (cancelled) return;
        cancelled = true;
        clearGuards();
        unsubscribe();
        if (this.pending === handle) this.pending = null;
        this.busy = false;
        this.drain = null;
        reject(reason instanceof Error ? reason : new Error(String(reason)));
      };

      const handle: PendingSearch = { cancel, fail };

      const timeoutId = setTimeout(
        () => handle.fail(new Error(`analyze() timed out after ${ANALYZE_TIMEOUT_MS}ms with no bestmove`)),
        ANALYZE_TIMEOUT_MS,
      );

      if (signal?.aborted) {
        cancel();
        return;
      }

      this.pending = handle;
      signal?.addEventListener('abort', onAbort, { once: true });

      const start = () => {
        if (cancelled) return;
        started = true;

        let releaseDrain!: () => void;
        this.drain = new Promise<void>((res) => {
          releaseDrain = res;
        });

        unsubscribe = this.transport.onLine((line) => {
          if (line.startsWith('bestmove')) {
            const wasCancelled = cancelled;
            unsubscribe();
            clearGuards();
            if (this.pending === handle) this.pending = null;
            this.busy = false;
            this.drain = null;
            releaseDrain();
            if (!wasCancelled) resolve(buildResult());
            return;
          }

          if (cancelled) return;

          const info = parseInfoLine(line);
          if (!info) return;

          const existing = bySlot.get(info.multipv);
          if (existing && existing.depth > info.depth) return;

          bySlot.set(info.multipv, info);
          deepest = Math.max(deepest, info.depth);
          onUpdate?.(buildResult());
        });

        this.busy = true;
        this.transport.send('stop');
        this.transport.send(`setoption name MultiPV value ${multiPV}`);
        this.transport.send(`position fen ${fen}`);
        this.transport.send(`go depth ${depth}`);
      };

      if (this.drain) {
        this.drain.then(start);
      } else {
        start();
      }
    });
  }

  get isBusy(): boolean {
    return this.busy;
  }

  stop(): void {
    this.transport.send('stop');
  }

  dispose(): void {
    // Reject any in-flight search before tearing down the transport —
    // otherwise its `bestmove` can never arrive and the promise hangs
    // forever.
    this.pending?.cancel();
    this.pending = null;
    this.busy = false;
    this.unsubscribeTransportError();
    this.drain = null;
    this.transport.terminate();
  }
}
