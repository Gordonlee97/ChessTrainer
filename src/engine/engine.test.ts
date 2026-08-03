import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYZE_TIMEOUT_MS, Engine } from './engine';
import type { UciTransport } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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
});
