import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTreeStore } from '../tree/store';
import { formatScore, TARGET_DEPTH, useAnalysis } from './useAnalysis';

// vi.mock calls are hoisted above imports by vitest, so this replaces the
// worker transport before useAnalysis.ts's module body runs, without
// needing a real Worker. `fake` is created via vi.hoisted so it exists
// before the mock factory below executes.
const fake = vi.hoisted(() => {
  const listeners = new Set<(line: string) => void>();
  const sent: string[] = [];
  const shouldThrow = { value: false };
  return {
    listeners,
    sent,
    shouldThrow,
    send: (cmd: string) => {
      sent.push(cmd);
    },
    onLine: (cb: (line: string) => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    terminate: () => {
      listeners.clear();
    },
    emit: (line: string) => {
      [...listeners].forEach((cb) => cb(line));
    },
    reset: () => {
      listeners.clear();
      sent.length = 0;
      shouldThrow.value = false;
    },
  };
});

vi.mock('../engine/stockfishWorker', () => ({
  createWorkerTransport: () => {
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
});

describe('useAnalysis stale-result guard', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
    fake.reset();
  });

  it('renders a result for the node that requested it', async () => {
    const { result, unmount } = renderHook(() => useAnalysis());

    expect(fake.sent).toContain(`go depth ${TARGET_DEPTH}`);

    await act(async () => {
      // Depth must reach TARGET_DEPTH so cacheEval's stored eval satisfies
      // the effect's own `node.eval.depth >= TARGET_DEPTH` guard — otherwise
      // caching this result re-triggers the effect (since node.eval changes
      // reference) and it immediately kicks off a second, unresolved
      // analyze() call, flipping status back to 'analyzing'.
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

  it('sets status to unavailable when the engine transport fails to initialize', () => {
    fake.shouldThrow.value = true;

    const { result, unmount } = renderHook(() => useAnalysis());

    expect(result.current.status).toBe('unavailable');

    unmount();
  });
});
