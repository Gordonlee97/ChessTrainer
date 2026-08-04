import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYZE_TIMEOUT_MS, DRAIN_GRACE_MS, Engine } from './engine';
import type { UciTransport } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// After 1. e4 — Black to move.
const BLACK_TO_MOVE = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

/** A scriptable stand-in for the Stockfish worker. */
function createFakeTransport() {
  const listeners = new Set<(line: string) => void>();
  const errorListeners = new Set<(reason: unknown) => void>();
  const sent: string[] = [];
  const transport: UciTransport = {
    send: (cmd) => {
      sent.push(cmd);
    },
    onLine: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onError: (cb) => {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },
    terminate: () => {
      listeners.clear();
      errorListeners.clear();
    },
  };
  return {
    transport,
    sent,
    emit: (line: string) => listeners.forEach((cb) => cb(line)),
    fail: (reason: unknown) => errorListeners.forEach((cb) => cb(reason)),
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

    // The abort armed a real (non-fake-timer) grace timer since this search
    // had already started — dispose() so it doesn't leak into later tests.
    engine.dispose();
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

/** Flushes pending microtasks (and one macrotask tick) without a real delay. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Engine lifecycle', () => {
  it('rejects the in-flight analyze() promise when disposed mid-search (Finding 1)', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    expect(engine.isBusy).toBe(true);

    let settled = false;
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    engine.dispose();
    await flush();

    // Without the fix, dispose() only terminates the transport (which clears
    // listeners), so the bestmove that would have resolved this promise can
    // never arrive and the promise is left pending forever.
    expect(settled).toBe(true);
    await expect(promise).rejects.toThrow(/aborted/i);
    expect(engine.isBusy).toBe(false);
  });

  it("does not let a stopped search's bestmove resolve the next search (Finding 2)", async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);
    const controllerA = new AbortController();

    // Step 1: search A is in flight; the caller aborts it. The abort handler
    // sends `stop`, unsubscribes A's listener, and rejects A's promise.
    const promiseA = engine.analyze({
      fen: START,
      depth: 12,
      multiPV: 1,
      signal: controllerA.signal,
    });
    controllerA.abort();
    await expect(promiseA).rejects.toThrow(/aborted/i);

    // Step 2: the caller immediately starts search B.
    const promiseB = engine.analyze({ fen: START, depth: 12, multiPV: 1 });

    // Step 3: the engine, responding to step 1's `stop`, now emits a
    // `bestmove` belonging to search A.
    fake.emit('bestmove e2e4');

    // Step 4 (the bug): B's listener would receive it and resolve B
    // immediately with an empty result, before B has produced anything.
    let bSettled = false;
    promiseB.then(() => {
      bSettled = true;
    });
    await flush();
    expect(bSettled).toBe(false);

    // B's own search now genuinely completes.
    fake.emit('info depth 12 multipv 1 score cp 40 pv d2d4 d7d5');
    fake.emit('bestmove d2d4');
    const resultB = await promiseB;

    expect(resultB.lines[0].san).toBe('d4');
  });

  it('rejects a search aborted before it ever sends commands, without deadlocking a later search', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);
    const controllerA = new AbortController();
    const controllerB = new AbortController();

    // A starts a real engine search, then gets aborted (drains later).
    const promiseA = engine.analyze({
      fen: START,
      depth: 12,
      multiPV: 1,
      signal: controllerA.signal,
    });
    controllerA.abort();

    // B is queued behind A's drain, then aborted before it ever sends its
    // own `position`/`go` — it must still reject, not hang.
    const promiseB = engine.analyze({
      fen: START,
      depth: 12,
      multiPV: 1,
      signal: controllerB.signal,
    });
    controllerB.abort();

    // Finding 1 regression: B never started (it was still queued behind
    // A's drain), so its cancel() never sent any commands of its own. But
    // A's search is still outstanding — the engine still owes A a
    // `bestmove` — so isBusy must stay true here, not go stale.
    expect(engine.isBusy).toBe(true);

    await expect(promiseA).rejects.toThrow(/aborted/i);
    await expect(promiseB).rejects.toThrow(/aborted/i);

    // C must still wait for A's real (belated) bestmove to drain, not
    // resolve early just because B short-circuited.
    const promiseC = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    fake.emit('bestmove e2e4'); // A's belated bestmove

    let cSettled = false;
    promiseC.then(() => {
      cSettled = true;
    });
    await flush();
    expect(cSettled).toBe(false);

    fake.emit('info depth 12 multipv 1 score cp 5 pv g1f3');
    fake.emit('bestmove g1f3');
    const resultC = await promiseC;
    expect(resultC.lines[0].san).toBe('Nf3');
  });

  it('auto-aborts a running search when a new one is started with no AbortSignal on either call', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    // Neither call ever touches an AbortSignal — this is the headline
    // `this.pending?.cancel()` path (engine.ts:58), not the
    // already-cancelled-so-it's-a-no-op path every other test exercises.
    const promiseA = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    const promiseB = engine.analyze({ fen: START, depth: 12, multiPV: 1 });

    // A is superseded synchronously by B and must reject.
    await expect(promiseA).rejects.toThrow(/aborted/i);

    // B must not send its own `position`/`go` until A's stale `bestmove`
    // has drained from the engine — only A's `go` has been sent so far.
    const goCommands = () => fake.sent.filter((cmd) => cmd.startsWith('go depth'));
    expect(goCommands()).toHaveLength(1);

    let bSettled = false;
    promiseB.then(() => {
      bSettled = true;
    });

    // A's belated `bestmove` arrives, in response to the `stop` sent when
    // it was superseded.
    fake.emit('bestmove e2e4');
    await flush();

    // That stale bestmove must not resolve B, and B's own commands should
    // now have been sent (queued behind A's drain, released once it
    // completed).
    expect(bSettled).toBe(false);
    expect(goCommands()).toHaveLength(2);

    // B's own search now genuinely completes, with its own result.
    fake.emit('info depth 12 multipv 1 score cp 40 pv d2d4 d7d5');
    fake.emit('bestmove d2d4');
    const resultB = await promiseB;

    expect(resultB.lines[0].san).toBe('d4');
  });
});

describe('Engine transport failure (Fix 2)', () => {
  it('rejects the in-flight search and notifies onError listeners when the transport reports a fatal error', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);
    const onError = vi.fn();
    engine.onError(onError);

    const promise = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    expect(engine.isBusy).toBe(true);

    fake.fail(new Error('worker script 404'));

    await expect(promise).rejects.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(engine.isBusy).toBe(false);
  });

  it('notifies onError listeners even with no search in flight', () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);
    const onError = vi.fn();
    engine.onError(onError);

    fake.fail(new Error('wasm failed to instantiate'));

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('still notifies later onError listeners when an earlier one throws', () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);
    const throwingListener = vi.fn(() => {
      throw new Error('listener boom');
    });
    const laterListener = vi.fn();
    // Registration order matters: Set iteration order is insertion order, so
    // the throwing listener runs first.
    engine.onError(throwingListener);
    engine.onError(laterListener);

    fake.fail(new Error('worker script 404'));

    expect(throwingListener).toHaveBeenCalledTimes(1);
    expect(laterListener).toHaveBeenCalledTimes(1);
  });
});

describe('Engine wall-clock timeout (Fix 2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a search that never receives a bestmove within ANALYZE_TIMEOUT_MS', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: START, depth: 20, multiPV: 3 });
    const assertion = expect(promise).rejects.toThrow(/timed out|timeout/i);

    await vi.advanceTimersByTimeAsync(ANALYZE_TIMEOUT_MS);
    await assertion;

    // The engine still owes this search a `bestmove` (a `stop` was sent, but
    // nothing has drained yet) — isBusy must stay true, exactly like an
    // aborted-but-started search. Contract change from wave 2: the timeout
    // used to fully release busy/drain immediately, which is the same bug
    // Fix 1 (wave 3) closes for the stale-bestmove race.
    expect(engine.isBusy).toBe(true);

    // Once the stale bestmove actually drains, busy correctly clears.
    fake.emit('bestmove e2e4');
    expect(engine.isBusy).toBe(false);
  });

  it('does not time out a search that resolves well within the budget', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    fake.emit('info depth 12 multipv 1 score cp 31 pv e2e4');
    fake.emit('bestmove e2e4');

    await vi.advanceTimersByTimeAsync(ANALYZE_TIMEOUT_MS);
    const result = await promise;

    expect(result.lines[0].san).toBe('e4');
  });

  it('does not let a late bestmove from a timed-out search resolve the next search (Fix 1, wave 3)', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promiseA = engine.analyze({ fen: START, depth: 20, multiPV: 3 });
    // Attach the rejection assertion before advancing timers (not after) so
    // there is no window where the timeout fires and rejects promiseA with
    // no handler attached yet.
    const assertionA = expect(promiseA).rejects.toThrow(/timed out|timeout/i);
    await vi.advanceTimersByTimeAsync(ANALYZE_TIMEOUT_MS);
    await assertionA;

    // A's stale bestmove has not drained yet, so B queues behind it rather
    // than sending its own position/go immediately.
    const promiseB = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    expect(fake.sent.filter((cmd) => cmd.startsWith('go depth')).length).toBe(1);

    // A's belated bestmove arrives — this must drain A, not resolve B.
    fake.emit('bestmove e2e4');

    let bSettled = false;
    promiseB.then(() => {
      bSettled = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(bSettled).toBe(false);
    expect(fake.sent.filter((cmd) => cmd.startsWith('go depth')).length).toBe(2);

    fake.emit('info depth 12 multipv 1 score cp 40 pv d2d4 d7d5');
    fake.emit('bestmove d2d4');
    const resultB = await promiseB;

    expect(resultB.lines[0].san).toBe('d4');
  });

  it('does not count time queued behind another search against the timeout (Fix 1, wave 3)', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    // A occupies the engine and will be superseded without ever resolving.
    const promiseA = engine.analyze({ fen: START, depth: 20, multiPV: 3 });
    promiseA.catch(() => {});

    // B is queued behind A's drain immediately (A hasn't sent bestmove yet).
    const promiseB = engine.analyze({ fen: START, depth: 12, multiPV: 1 });

    // A's belated bestmove drains well within the grace window, so B is
    // released by the genuine drain rather than by the grace timer forcing
    // it. (Wave 5: grace is now armed on every started settle, not just
    // timeouts, so A's supersede here already armed one — if B's release
    // were left to depend on it, B would start at DRAIN_GRACE_MS instead of
    // whenever A's own bestmove happens to arrive, which is what this test
    // used to assume when only timeouts armed a grace timer.)
    await vi.advanceTimersByTimeAsync(DRAIN_GRACE_MS - 100);
    fake.emit('bestmove e2e4');
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.sent.filter((cmd) => cmd.startsWith('go depth')).length).toBe(2);

    // Nearly a full timeout budget elapses again, measured from when B
    // actually started (not from when analyze() was first called). If queue
    // time counted against B's budget, B would already have timed out by now.
    await vi.advanceTimersByTimeAsync(ANALYZE_TIMEOUT_MS - 100);

    let bSettled = false;
    promiseB.then(
      () => {
        bSettled = true;
      },
      () => {
        bSettled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(bSettled).toBe(false);

    fake.emit('info depth 12 multipv 1 score cp 1 pv d2d4');
    fake.emit('bestmove d2d4');
    const resultB = await promiseB;
    expect(resultB.lines[0].san).toBe('d4');
  });
});

describe('Engine timeout against a genuinely dead engine (Fix A, wave 4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not hang a later analyze() forever when a timed-out search never drains (grace period releases it)', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promiseA = engine.analyze({ fen: START, depth: 20, multiPV: 3 });
    const assertionA = expect(promiseA).rejects.toThrow(/timed out|timeout/i);
    await vi.advanceTimersByTimeAsync(ANALYZE_TIMEOUT_MS);
    await assertionA;

    // B queues behind A's drain — the engine never answers `stop`, so
    // without a bound on the drain this would hang forever (the bug).
    const promiseB = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    expect(fake.sent.filter((cmd) => cmd.startsWith('go depth')).length).toBe(1);

    // The engine never responds. The grace period must eventually release
    // the drain anyway, letting B send its own commands.
    await vi.advanceTimersByTimeAsync(DRAIN_GRACE_MS);
    expect(fake.sent.filter((cmd) => cmd.startsWith('go depth')).length).toBe(2);

    // A's own bestmove is presumed permanently lost the moment grace
    // force-releases it (wave 5 swallow counter): whatever bestmove arrives
    // first afterward is swallowed as A's stale answer potentially finally
    // showing up, rather than mistaken for B's — B needs its own, second
    // bestmove to actually resolve. This is the same race the DRAIN_GRACE_MS
    // docstring used to document as an accepted trade-off; the swallow
    // counter closes it instead of accepting it.
    fake.emit('bestmove e2e4');
    let bSettled = false;
    promiseB.then(
      () => {
        bSettled = true;
      },
      () => {
        bSettled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(bSettled).toBe(false);

    // A later search (C) must not queue forever either — confirms the
    // engine's busy/drain bookkeeping was actually released, not just B's
    // own commands sent through some other path.
    fake.emit('info depth 12 multipv 1 score cp 5 pv g1f3');
    fake.emit('bestmove g1f3');
    const resultB = await promiseB;
    expect(resultB.lines[0].san).toBe('Nf3');

    const promiseC = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    fake.emit('info depth 12 multipv 1 score cp 1 pv d2d4');
    fake.emit('bestmove d2d4');
    const resultC = await promiseC;
    expect(resultC.lines[0].san).toBe('d4');
  });

  it('notifies onError listeners when a search times out', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);
    const onError = vi.fn();
    engine.onError(onError);

    const promise = engine.analyze({ fen: START, depth: 20, multiPV: 3 });
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(ANALYZE_TIMEOUT_MS);

    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('Engine grace release for aborted/superseded searches (wave 5 fix)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles a queued search even when the preceding one was aborted (not timed out) and the engine never answers', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);
    const controllerA = new AbortController();

    const promiseA = engine.analyze({
      fen: START,
      depth: 20,
      multiPV: 3,
      signal: controllerA.signal,
    });
    controllerA.abort();
    await expect(promiseA).rejects.toThrow(/aborted/i);

    // The engine still owes A a bestmove — nothing has drained yet.
    expect(engine.isBusy).toBe(true);

    const promiseB = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    expect(fake.sent.filter((cmd) => cmd.startsWith('go depth')).length).toBe(1);

    // The engine never answers `stop` and never emits anything else at all.
    // Without a grace timer armed on abort/supersede (not just timeout),
    // this hangs forever — the deadlock the reviewer traced: a silently
    // dead engine plus one abort/supersede (exactly what useAnalysis does
    // on every node change) wedges every later search permanently, with no
    // timer of any kind to release it.
    await vi.advanceTimersByTimeAsync(DRAIN_GRACE_MS);

    expect(fake.sent.filter((cmd) => cmd.startsWith('go depth')).length).toBe(2);
    expect(engine.isBusy).toBe(true); // B now genuinely occupies the engine

    // The grace release already gave up on A's own bestmove ever arriving —
    // whatever bestmove shows up first is presumed to still be it, and is
    // swallowed rather than mistaken for B's (the same swallow-counter
    // mechanism exercised directly below). B needs its own, second bestmove
    // to actually resolve.
    fake.emit('bestmove e2e4');
    let bSettled = false;
    promiseB.then(
      () => {
        bSettled = true;
      },
      () => {
        bSettled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(bSettled).toBe(false);

    fake.emit('info depth 12 multipv 1 score cp 7 pv g1f3');
    fake.emit('bestmove g1f3');
    const resultB = await promiseB;
    expect(resultB.lines[0].san).toBe('Nf3');
    expect(engine.isBusy).toBe(false);
  });

  it('swallows a bestmove that arrives after a grace release instead of settling whoever is listening now', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promiseA = engine.analyze({ fen: START, depth: 20, multiPV: 3 });
    promiseA.catch(() => {});

    // B supersedes A — A is cancelled (not timed out) but already started,
    // so it stays subscribed to drain.
    const promiseB = engine.analyze({ fen: START, depth: 12, multiPV: 1 });

    // Grace releases B before A's stale bestmove ever shows up.
    await vi.advanceTimersByTimeAsync(DRAIN_GRACE_MS);
    expect(fake.sent.filter((cmd) => cmd.startsWith('go depth')).length).toBe(2);

    let bSettled = false;
    promiseB.then(
      () => {
        bSettled = true;
      },
      () => {
        bSettled = true;
      },
    );

    // A's stale bestmove finally arrives, long after the grace release,
    // while B is the one currently listening. It must be swallowed — not
    // mistaken for B's own answer.
    fake.emit('bestmove e2e4');
    await vi.advanceTimersByTimeAsync(0);
    expect(bSettled).toBe(false);

    // B's genuine bestmove still resolves B correctly.
    fake.emit('info depth 12 multipv 1 score cp 1 pv d2d4');
    fake.emit('bestmove d2d4');
    const resultB = await promiseB;
    expect(resultB.lines[0].san).toBe('d4');
  });
});

describe('Engine White-relative score normalization (Fix 5)', () => {
  it('leaves scores unchanged when White is to move', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: START, depth: 12, multiPV: 1 });
    fake.emit('info depth 12 multipv 1 score cp 31 pv e2e4');
    fake.emit('bestmove e2e4');
    const result = await promise;

    expect(result.lines[0].cp).toBe(31);
  });

  it('flips the sign of a cp score when Black is to move, so positive always favors White', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: BLACK_TO_MOVE, depth: 12, multiPV: 1 });
    // UCI reports this from the side to move (Black): +50 means Black is
    // ahead by half a pawn, i.e. White is actually behind.
    fake.emit('info depth 12 multipv 1 score cp 50 pv e7e5');
    fake.emit('bestmove e7e5');
    const result = await promise;

    expect(result.lines[0].cp).toBe(-50);
  });

  it('flips the sign of a mate score when Black is to move', async () => {
    const fake = createFakeTransport();
    const engine = new Engine(fake.transport);

    const promise = engine.analyze({ fen: BLACK_TO_MOVE, depth: 12, multiPV: 1 });
    fake.emit('info depth 12 multipv 1 score mate 3 pv e7e5');
    fake.emit('bestmove e7e5');
    const result = await promise;

    expect(result.lines[0].mate).toBe(-3);
  });
});
