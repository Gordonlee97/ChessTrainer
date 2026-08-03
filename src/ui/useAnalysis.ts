import { useEffect, useRef, useState } from 'react';
import { Engine } from '../engine/engine';
import { createWorkerTransport } from '../engine/stockfishWorker';
import type { EvalResult, PvLine } from '../engine/types';
import { useSelectedNode, useTreeStore } from '../tree/store';

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
      // Cleanups run in declaration order (verified empirically against
      // React 19, not reverse order as an earlier report claimed), so this
      // disposal always runs *before* the analysis effect's below
      // `controller.abort()`. Safety against a leaked in-flight search here
      // depends on `Engine.dispose()` itself cancelling any pending search
      // before terminating the transport — not on abort-then-dispose order.
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

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
      return;
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

    return () => controller.abort();
    // node.eval is deliberately excluded — see the comment at the top of this
    // effect. node.fen is 1:1 with node.id and included only for clarity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, node.fen, cacheEval]);

  return { result, status };
}
