import { useCallback, useEffect, useState } from 'react';
import type { Engine } from '../engine/engine';
import type { EvalResult, PvLine } from '../engine/types';
import { useSelectedNode, useTreeStore } from '../tree/store';
import { getSharedEngine, hasSharedEngineFailed, restartSharedEngine } from './sharedEngine';

// Task 2's spike measured the real engine at this depth: ~975ms from the
// start position, ~700ms in a middlegame — comfortably inside the
// interactive budget. (Brief called for 16; raised to 20 per that finding.)
export const TARGET_DEPTH = 20;
export const MULTI_PV = 3;

export type AnalysisStatus = 'idle' | 'analyzing' | 'unavailable';

/** Renders a score from the side-to-move's perspective, e.g. "+0.31" or "M3". */
export function formatScore(line: PvLine): string {
  if (line.mate !== null) return line.mate < 0 ? `-M${Math.abs(line.mate)}` : `M${line.mate}`;
  const pawns = (line.cp ?? 0) / 100;
  if (pawns === 0) return '0.00';
  return `${pawns > 0 ? '+' : '-'}${Math.abs(pawns).toFixed(2)}`;
}

export function useAnalysis(): { result: EvalResult | null; status: AnalysisStatus; retry: () => void } {
  const node = useSelectedNode();
  const cacheEval = useTreeStore((state) => state.cacheEval);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [result, setResult] = useState<EvalResult | null>(node.eval ?? null);
  // Bumped by retry() to re-run this effect against the freshly recreated
  // shared engine, resuming analysis for the currently selected node.
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => {
    restartSharedEngine();
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    // Every useAnalysis() call site shares one Engine (and one Stockfish
    // worker) — see sharedEngine.ts. It is never disposed here: another
    // consumer (Plan 2's compare drawer) may still be using it. The worker
    // dies with the page; this hook only ever aborts its own in-flight
    // search below.
    let engine: Engine;
    try {
      engine = getSharedEngine();
    } catch {
      setStatus('unavailable');
      return;
    }

    // Engine.onError() only notifies listeners registered before it fires.
    // If the shared engine already failed before this hook mounted (e.g. a
    // second consumer mounting after the first learned of the failure),
    // that first check catches it; the subscription below catches a failure
    // that happens later.
    if (hasSharedEngineFailed()) {
      setStatus('unavailable');
      return;
    }

    const unsubscribeError = engine.onError(() => setStatus('unavailable'));

    // Read the cached eval from the store directly rather than through
    // `node.eval`. This effect must not depend on `node.eval`: caching a
    // result replaces the node object (changing `node.eval`'s identity), and
    // if that were a dependency it would re-run this effect on every cache
    // write. On a checkmate/stalemate position the engine resolves instantly
    // with { depth: 0, lines: [] } — below TARGET_DEPTH — so that re-trigger
    // would immediately kick off another search, cache another depth-0
    // result, and loop forever between React and the worker (Fix 1).
    const cached = useTreeStore.getState().tree.nodes[node.id]?.eval ?? null;

    // Show any cached result immediately so navigating back is instant.
    setResult(cached);
    if (cached && cached.depth >= TARGET_DEPTH) {
      // A search for a previously-selected node may still be in flight; its
      // `.then`/`.catch` is guarded by the requestedFor check below, but
      // `status` itself is set eagerly on that node's effect run and must be
      // reset here, or navigating to an already-cached node while another
      // search is outstanding leaves status stuck at 'analyzing' forever.
      setStatus('idle');
      return unsubscribeError;
    }

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

    return () => {
      unsubscribeError();
      controller.abort();
    };
    // node.eval is deliberately excluded — see the comment at the top of this
    // effect. node.fen is 1:1 with node.id and included only for clarity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.fen, cacheEval, retryToken]);

  return { result, status, retry };
}
