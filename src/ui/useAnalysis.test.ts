import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sharedEvalCache } from '../engine/evalCache';
import { useTreeStore } from '../tree/store';
import { resetSharedEngineForTests } from './sharedEngine';
import { formatScore, TARGET_DEPTH, useAnalysis } from './useAnalysis';

// vi.mock calls are hoisted above imports by vitest, so this replaces the
// worker transport before useAnalysis.ts's module body runs, without
// needing a real Worker. `fake` is created via vi.hoisted so it exists
// before the mock factory below executes.
const fake = vi.hoisted(() => {
  const listeners = new Set<(line: string) => void>();
  const errorListeners = new Set<(reason: unknown) => void>();
  const sent: string[] = [];
  const shouldThrow = { value: false };
  // When set, simulates a real engine that instantly replies to `go depth`
  // with an empty bestmove — what Stockfish does on a checkmate/stalemate
  // position (Fix 1's regression scenario).
  const autoRespondEmpty = { value: false };
  // Counts createWorkerTransport() factory calls — i.e. how many "workers"
  // have been spawned. Fix 4's regression test asserts this stays at 1
  // across multiple concurrent useAnalysis() call sites.
  const createCount = { value: 0 };
  const emitLine = (line: string) => {
    [...listeners].forEach((cb) => cb(line));
  };
  return {
    listeners,
    errorListeners,
    sent,
    shouldThrow,
    autoRespondEmpty,
    createCount,
    send: (cmd: string) => {
      sent.push(cmd);
      if (autoRespondEmpty.value && cmd.startsWith('go depth')) {
        queueMicrotask(() => emitLine('bestmove (none)'));
      }
    },
    onLine: (cb: (line: string) => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onError: (cb: (reason: unknown) => void) => {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },
    terminate: () => {
      listeners.clear();
      errorListeners.clear();
    },
    emit: emitLine,
    /** Simulates the transport's asynchronous fatal-error event (Fix 2). */
    emitError: (reason: unknown) => {
      [...errorListeners].forEach((cb) => cb(reason));
    },
    reset: () => {
      listeners.clear();
      errorListeners.clear();
      sent.length = 0;
      shouldThrow.value = false;
      autoRespondEmpty.value = false;
      createCount.value = 0;
    },
  };
});

vi.mock('../engine/stockfishWorker', () => ({
  createWorkerTransport: () => {
    fake.createCount.value += 1;
    if (fake.shouldThrow.value) throw new Error('worker unavailable');
    return fake;
  },
}));

/** Flushes pending microtasks (and one macrotask tick) without a real delay. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

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

  it('formats a mate score of -0 (Black is mated) as favoring White, matching EvalBar', () => {
    // (raw UCI mate * sideToMoveSign) yields -0 when Black to move is mated
    // — this already renders correctly today (M0, no minus), but is covered
    // here as a pin so a future change to the sign logic can't regress it.
    expect(formatScore({ san: 'Qh4', cp: null, mate: -0, pv: ['Qh4'] })).toBe('M0');
  });

  it('formats a mate score of +0 (White is mated) as favoring Black, matching EvalBar', () => {
    // (raw UCI mate * sideToMoveSign) yields plain +0 when White to move is
    // mated. `mate < 0` is false for +0 too, so the current ternary's `else`
    // branch renders this the same as -0 (`M0`, no minus — as though White
    // were winning) instead of `-M0`. EvalBar's matesInWhiteFavor already
    // distinguishes +0 from -0 via Object.is; formatScore must agree.
    expect(formatScore({ san: 'Kg1', cp: null, mate: 0, pv: ['Kg1'] })).toBe('-M0');
  });
});

describe('useAnalysis stale-result guard', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
    fake.reset();
    resetSharedEngineForTests();
    // sharedEvalCache is module-level state that otherwise leaks between
    // tests in this file — see Task 3's brief.
    sharedEvalCache.clear();
  });

  it('renders a result for the node that requested it', async () => {
    const { result, unmount } = renderHook(() => useAnalysis());

    expect(fake.sent).toContain(`go depth ${TARGET_DEPTH}`);

    await act(async () => {
      // Resolve at TARGET_DEPTH so the cached eval satisfies the "already
      // deep enough" check on a later render, matching a realistic completed
      // search (the effect itself no longer re-triggers on cacheEval writes
      // regardless of depth — see Fix 1).
      fake.emit(`info depth ${TARGET_DEPTH} multipv 1 score cp 42 pv e2e4`);
      fake.emit('bestmove e2e4');
      await flush();
    });

    expect(result.current.result?.lines[0]?.cp).toBe(42);
    expect(result.current.status).toBe('idle');

    unmount();
  });

  it("never renders an abandoned node's streamed result or final score as the newly selected node's", async () => {
    // Node B ('root/e4') must exist before we navigate to it. playMove()
    // auto-selects it, so re-select root ('A') afterward to start from a
    // known state.
    const nodeB = useTreeStore.getState().playMove('e4');
    expect(nodeB).not.toBeNull();
    useTreeStore.getState().selectNode('root');

    const { result, unmount } = renderHook(() => useAnalysis());

    // Confirm analysis started for A (root) before navigating away.
    expect(fake.sent).toContain(`go depth ${TARGET_DEPTH}`);

    // Navigate to B, then — within the same synchronous tick, before React
    // has run the analysis effect's cleanup (which aborts A's search) —
    // deliver A's streamed info line and its bestmove. This reproduces the
    // real race: useTreeStore.getState().tree.selectedId already reflects B
    // by the time these callbacks run, even though A's AbortController
    // hasn't fired yet and Engine hasn't cancelled A's search internally.
    // Only the hook's own requestedFor/getState() guard can catch this.
    act(() => {
      useTreeStore.getState().selectNode(nodeB as string);
      fake.emit('info depth 5 multipv 1 score cp 999 pv e2e4');
      fake.emit('bestmove e2e4');
    });

    await act(async () => {
      await flush();
    });

    const renderedStaleScore = result.current.result?.lines.some((line) => line.cp === 999) ?? false;
    expect(renderedStaleScore).toBe(false);

    unmount();
  });

  it('does not mark the engine unavailable when a search is merely aborted by navigation', async () => {
    const nodeB = useTreeStore.getState().playMove('e4');
    useTreeStore.getState().selectNode('root');

    const { result, unmount } = renderHook(() => useAnalysis());

    await act(async () => {
      useTreeStore.getState().selectNode(nodeB as string);
      await flush();
    });

    expect(result.current.status).not.toBe('unavailable');

    unmount();
  });

  // This covers only the defensive fallback around Engine construction
  // itself (e.g. a malformed transport factory throwing synchronously). It
  // is not representative of a real broken engine: `new Worker(url)` never
  // throws synchronously when the script 404s or fails to compile — that
  // fires the asynchronous `error` event instead, covered by the test below.
  it('sets status to unavailable if constructing the engine throws synchronously', () => {
    fake.shouldThrow.value = true;

    const { result, unmount } = renderHook(() => useAnalysis());

    expect(result.current.status).toBe('unavailable');

    unmount();
  });

  it('sets status to unavailable when the transport reports a fatal error asynchronously (e.g. a missing worker script)', async () => {
    const { result, unmount } = renderHook(() => useAnalysis());

    expect(result.current.status).toBe('analyzing');

    await act(async () => {
      fake.emitError(new Error('worker script 404'));
      await flush();
    });

    expect(result.current.status).toBe('unavailable');

    unmount();
  });

  it('sets status to unavailable on a transport error even when no search is in flight (node already fully cached)', async () => {
    // No analyze() call is issued for an already-cached, deep-enough node —
    // so this can only be caught by a direct subscription to the engine's
    // error signal, not by an analyze() promise rejection.
    useTreeStore.getState().cacheEval('root', {
      depth: TARGET_DEPTH,
      lines: [{ san: 'e4', cp: 10, mate: null, pv: ['e4'] }],
    });

    const { result, unmount } = renderHook(() => useAnalysis());
    expect(result.current.status).toBe('idle');

    await act(async () => {
      fake.emitError(new Error('wasm failed to instantiate'));
      await flush();
    });

    expect(result.current.status).toBe('unavailable');

    unmount();
  });

  it('sends exactly one go command when a search resolves with an empty, depth-0 result (checkmate/stalemate)', async () => {
    // Fix 1 regression: caching an eval replaces the node object, changing
    // `node.eval`'s identity. If the analysis effect depends on `node.eval`,
    // that re-triggers the effect — and on a mate/stalemate position (which
    // resolves instantly with { depth: 0, lines: [] }), each re-trigger caches
    // another depth-0 result, re-triggering again: an unbounded loop between
    // React and the worker. This asserts the loop cannot start, by having the
    // fake transport behave like a real engine on a mate position — replying
    // to every `go depth` with an immediate empty bestmove — and checking
    // that only one such command is ever sent.
    fake.autoRespondEmpty.value = true;

    const { result, unmount } = renderHook(() => useAnalysis());

    expect(fake.sent).toContain(`go depth ${TARGET_DEPTH}`);

    await act(async () => {
      await flush();
      await flush();
      await flush();
    });

    const goCommands = fake.sent.filter((cmd) => cmd.startsWith('go depth'));
    expect(goCommands).toHaveLength(1);
    expect(result.current.result).toEqual({ depth: 0, lines: [] });
    expect(result.current.status).toBe('idle');

    unmount();
  });

  it('resets status to idle when navigating to a fully cached node while a previous search is in flight', async () => {
    const nodeB = useTreeStore.getState().playMove('e4');
    expect(nodeB).not.toBeNull();
    useTreeStore.getState().cacheEval(nodeB as string, {
      depth: TARGET_DEPTH,
      lines: [{ san: 'e5', cp: 10, mate: null, pv: ['e5'] }],
    });
    useTreeStore.getState().selectNode('root');

    const { result, unmount } = renderHook(() => useAnalysis());

    // Root's search is in flight (no bestmove delivered yet).
    expect(result.current.status).toBe('analyzing');

    act(() => {
      useTreeStore.getState().selectNode(nodeB as string);
    });

    // B is already cached at TARGET_DEPTH, so the effect takes its early
    // return — status must not be left stuck at 'analyzing' from root's
    // still-outstanding search.
    expect(result.current.status).toBe('idle');

    unmount();
  });
});

describe('useAnalysis shared engine (Fix 4)', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
    fake.reset();
    resetSharedEngineForTests();
    // sharedEvalCache is module-level state that otherwise leaks between
    // tests in this file — see Task 3's brief.
    sharedEvalCache.clear();
  });

  it('shares a single Engine (and worker transport) across multiple concurrent call sites', () => {
    // Plan 2 adds a second consumer (the compare drawer) of this same hook.
    // Each hook call site constructing its own Engine would spawn its own
    // 7MB Stockfish worker running its own search — two workers competing
    // for one core.
    const first = renderHook(() => useAnalysis());
    const second = renderHook(() => useAnalysis());

    expect(fake.createCount.value).toBe(1);

    first.unmount();
    second.unmount();
  });

  it('does not tear down the shared engine when one consumer unmounts while another is still mounted', async () => {
    const first = renderHook(() => useAnalysis());
    // Both hooks analyze the same (only) selected node through the one
    // shared Engine, so second's analyze() call supersedes first's — the
    // engine serializes searches regardless of which consumer issued them.
    // First's stale, cancelled search must still drain (its own bestmove)
    // before second's own commands are sent.
    const second = renderHook(() => useAnalysis());

    first.unmount();

    // If first's unmount had disposed the shared engine (instead of merely
    // aborting its own AbortController), the transport would be terminated
    // here and none of the following would ever resolve.
    await act(async () => {
      fake.emit('bestmove e2e4'); // drains first's superseded search
      await flush();
    });

    await act(async () => {
      fake.emit(`info depth ${TARGET_DEPTH} multipv 1 score cp 5 pv e2e4`);
      fake.emit('bestmove e2e4'); // resolves second's own search
      await flush();
    });

    expect(second.result.current.status).toBe('idle');
    expect(second.result.current.result?.lines[0]?.cp).toBe(5);

    second.unmount();
  });

  it('retry replaces the shared engine (new transport) and resumes analysis for the current node', async () => {
    const { result, unmount } = renderHook(() => useAnalysis());
    expect(fake.createCount.value).toBe(1);

    await act(async () => {
      fake.emitError(new Error('worker died'));
      await flush();
    });
    expect(result.current.status).toBe('unavailable');

    act(() => {
      result.current.retry();
    });

    expect(fake.createCount.value).toBe(2);
    expect(result.current.status).toBe('analyzing');

    unmount();
  });
});

describe('transposition reuse', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
    fake.reset();
    resetSharedEngineForTests();
    sharedEvalCache.clear();
  });

  it('serves a previously analysed position from the FEN cache without a fresh search', () => {
    // Root's FEN (tree.ts's START_FEN) pre-seeded at TARGET_DEPTH, as if this
    // exact position had already been analysed under a different node id — a
    // transposition. The hook must surface that result immediately and must
    // not issue a `go depth` command for a position it already has at depth.
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    sharedEvalCache.set(fen, {
      depth: TARGET_DEPTH,
      lines: [{ san: 'Nf3', cp: 31, mate: null, pv: ['Nf3'] }],
    });

    const { result, unmount } = renderHook(() => useAnalysis());

    expect(result.current.result?.lines[0]?.san).toBe('Nf3');
    expect(result.current.status).toBe('idle');

    const goCommands = fake.sent.filter((cmd) => cmd.startsWith('go depth'));
    expect(goCommands).toHaveLength(0);

    unmount();
  });
});
