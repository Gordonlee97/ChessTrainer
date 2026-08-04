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

// Once a search ends without a genuine `bestmove` in hand — whether it timed
// out, was aborted, or was superseded by a later search — its `stop` is
// expected to be answered within milliseconds by a live engine. The drain is
// left open only to absorb that realistic delay. This bounds how long it
// stays open: if no `bestmove` arrives within this window either, the engine
// is presumed genuinely dead (not just slow), and the drain is released
// anyway so later, queued searches are not stranded behind it forever.
//
// Armed on every started search that ends this way (not just timeouts):
// without that, an aborted/superseded search leaves the drain unresolved
// with no timer of any kind if the engine never answers `stop` at all,
// deadlocking every later queued search — this is exactly the path the app
// takes on every node change (useAnalysis aborts the in-flight search), so a
// silently dead engine plus one click would wedge the app permanently.
//
// If the "merely slow, not dead" engine referenced above answers after this
// window elapses, that stale `bestmove` is swallowed rather than misread as
// the next search's own — see `owedBestmoves`.
export const DRAIN_GRACE_MS = 2_000;

/** A search that's currently occupying the `pending` slot on the Engine. */
interface PendingSearch {
  /**
   * Idempotently rejects this search with an AbortError. Safe to call more
   * than once. Also used internally for a timeout on a search that has
   * already started: since the timer is only ever armed once `go` has been
   * sent, a timeout can only fire post-start, so it always takes the
   * "stay subscribed and drain" branch below rather than the full release.
   */
  cancel: () => void;
  /**
   * Idempotently rejects this search with a non-abort error representing a
   * dead transport. Safe to call more than once. Unlike a timeout, a dead
   * transport will never deliver the owed `bestmove`, so this always fully
   * releases busy/drain — there is nothing left to drain.
   */
  fail: (reason: unknown) => void;
  /**
   * Clears this search's grace timer (see DRAIN_GRACE_MS) if one is armed,
   * regardless of whether the search has already settled. `cancel()`/`fail()`
   * alone are not enough for this: they no-op on an already-cancelled
   * search, so a grace timer armed by an *earlier* settle (e.g. a timeout
   * followed by dispose() before the grace window elapses) would otherwise
   * never be cleared, firing its callback against a torn-down engine and
   * keeping this search's whole closure alive in the meantime.
   */
  clearGraceTimer: () => void;
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
  /**
   * Counts `bestmove` lines presumed still owed to the engine by searches
   * that a grace timer already force-released (see DRAIN_GRACE_MS) before
   * their own `bestmove` arrived, if it ever does. UCI engines process
   * commands and emit responses in the order sent, so the next `bestmove`
   * line received after a grace release is presumed to be one of these
   * stale, already-abandoned answers rather than belonging to whoever is
   * listening now — it is swallowed (see the `bestmove` handling in
   * `analyze()`) and this counter decremented, rather than settling the
   * wrong search.
   */
  private owedBestmoves = 0;
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
   * waiting for a `bestmove`. Consumers (e.g. useAnalysis) use this to
   * surface a degraded/unavailable state instead of spinning forever.
   */
  onError(cb: (reason: unknown) => void): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  private handleTransportError(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error('Engine transport failed');
    this.pending?.fail(error);
    // `fail()` no-ops if this search already settled once (e.g. an earlier
    // timeout or abort) and is now only waiting out its grace timer — clear
    // that timer explicitly so it doesn't fire later against state this
    // method is about to reset anyway. Same reasoning as dispose().
    this.pending?.clearGraceTimer();
    this.pending = null;
    this.busy = false;
    this.drain = null;
    // Same reasoning as the timeout branch in settle(): a misbehaving
    // listener must not prevent other listeners from being notified.
    this.errorListeners.forEach((cb) => {
      try {
        cb(error);
      } catch {
        // Swallowed — see above.
      }
    });
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
      // Armed inside start() (not here) so time spent queued behind another
      // search's drain never counts against the budget — queuing is normal
      // with a shared engine and multiple consumers. Refreshed on every
      // parsed `info` line as a liveness check — the engine is still
      // responding, even if it hasn't reached a new depth — not a check
      // that it's making genuine progress.
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      // Set whenever this search ends up taking the "stay subscribed and
      // drain" branch below — see DRAIN_GRACE_MS.
      let graceTimeoutId: ReturnType<typeof setTimeout> | undefined;
      // Assigned synchronously in start(), before anything can reference it.
      // Lifted out of start() (rather than declared local to it) so both the
      // grace-release path and the genuine-bestmove path can unblock
      // whatever search is queued behind this one's drain.
      let releaseDrain: (() => void) | undefined;
      // This search's own `this.drain` promise, captured at the same time
      // it's assigned to `this.drain` in start(). The grace timeout below
      // must only clear `this.busy`/`this.drain` if `this.drain` is *still*
      // this exact promise — otherwise a stale grace timer could clobber a
      // different, later search's serialization state.
      let ownDrain: Promise<void> | undefined;

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
        clearTimeout(graceTimeoutId);
        signal?.removeEventListener('abort', onAbort);
      };

      // Shared by cancel() (AbortError) and the timeout (a plain Error): both
      // end the search without a genuine `bestmove` in hand, and both must
      // behave identically depending on whether `go` was ever sent.
      const settle = (reason: unknown, timedOut = false) => {
        if (cancelled) return;
        cancelled = true;
        clearGuards();
        reject(reason);
        if (started) {
          // The engine still owes this search a `bestmove`. Stay subscribed
          // so it can be drained (and ignored) below before the next
          // search's commands are sent. Deliberately leaves `this.busy` and
          // `this.drain` untouched — the engine is genuinely still busy
          // until that `bestmove` arrives.
          this.transport.send('stop');
          // Bound how long this search can keep the next one queued: a live
          // engine answers `stop` within milliseconds, but a genuinely dead
          // one never will. Armed here unconditionally (abort, supersede, or
          // timeout) — not just for timeouts — because an aborted/superseded
          // search that never drains would otherwise leave `this.drain`
          // unresolved with no timer of any kind, wedging every later queued
          // search forever. See DRAIN_GRACE_MS.
          graceTimeoutId = setTimeout(() => {
            unsubscribe();
            // This search's own `bestmove` is now presumed permanently lost.
            // Whatever `bestmove` line arrives next belongs to it, not to
            // whoever ends up listening by then — see `owedBestmoves`.
            this.owedBestmoves++;
            if (this.pending === handle) this.pending = null;
            // Only release busy/drain if nothing *later* already claimed
            // them — a stale grace timer must never clobber a different,
            // live search's serialization state.
            if (this.drain === ownDrain) {
              this.busy = false;
              this.drain = null;
            }
            releaseDrain?.();
          }, DRAIN_GRACE_MS);

          if (timedOut) {
            // Notified only after the grace timer above is armed: a
            // listener that throws must not be able to skip arming it and
            // reintroduce the deadlock. Escalating immediately (rather than
            // waiting on the grace period) is exactly the "no bestmove ever
            // arrived" case onError's docstring promises, letting a
            // consumer like useAnalysis flip to a degraded state right away.
            this.errorListeners.forEach((cb) => {
              try {
                cb(reason);
              } catch {
                // A misbehaving listener must not prevent other listeners
                // from running, and must never be able to undo the timer
                // arming above.
              }
            });
          }
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

      const cancel = () => settle(new DOMException('Analysis aborted', 'AbortError'));

      // A fatal, non-abort failure: the transport itself died. Unlike
      // `cancel()` or a timeout, there is no `bestmove` left to drain — the
      // transport is presumed dead — so this always fully releases the
      // busy/drain state.
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

      const clearGraceTimer = () => clearTimeout(graceTimeoutId);

      const handle: PendingSearch = { cancel, fail, clearGraceTimer };

      // Arming (and re-arming) is only ever done once `go` has actually been
      // sent — see the comment on `timeoutId` above. By the time this fires,
      // `started` is always true, so `settle` always takes the "stay
      // subscribed and drain" branch rather than the full release.
      const armTimeout = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(
          () => settle(new Error(`analyze() timed out after ${ANALYZE_TIMEOUT_MS}ms with no bestmove`), true),
          ANALYZE_TIMEOUT_MS,
        );
      };

      if (signal?.aborted) {
        cancel();
        return;
      }

      this.pending = handle;
      signal?.addEventListener('abort', onAbort, { once: true });

      const start = () => {
        if (cancelled) return;
        started = true;
        armTimeout();

        ownDrain = this.drain = new Promise<void>((res) => {
          releaseDrain = res;
        });

        unsubscribe = this.transport.onLine((line) => {
          if (line.startsWith('bestmove')) {
            if (this.owedBestmoves > 0) {
              // Belongs to a search that a grace timer already force-
              // released; whoever is listening now must not mistake it for
              // their own.
              this.owedBestmoves--;
              return;
            }

            const wasCancelled = cancelled;
            unsubscribe();
            clearGuards();
            if (this.pending === handle) this.pending = null;
            this.busy = false;
            this.drain = null;
            releaseDrain?.();
            if (!wasCancelled) resolve(buildResult());
            return;
          }

          if (cancelled) return;

          const info = parseInfoLine(line);
          if (!info) return;

          // Liveness, not progress — the engine is still responding, so
          // refresh the budget rather than reject a search that's merely
          // slow (even one wedged re-emitting the same depth stays alive).
          armTimeout();

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
    // `cancel()` no-ops if this search already settled once (e.g. an
    // earlier timeout/abort) and is now only waiting out its grace timer —
    // clear that explicitly, otherwise it fires later against a disposed
    // engine and keeps this search's whole closure alive until then. Also
    // clears whatever `cancel()` just armed above, since nothing left in
    // this method needs a grace-forced release: busy/drain are reset below.
    this.pending?.clearGraceTimer();
    this.pending = null;
    this.busy = false;
    this.unsubscribeTransportError();
    this.drain = null;
    this.transport.terminate();
  }
}
