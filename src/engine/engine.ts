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

export class Engine {
  private busy = false;

  constructor(private readonly transport: UciTransport) {
    this.transport.send('uci');
    this.transport.send('isready');
  }

  /**
   * Runs a MultiPV search. Only one search may be in flight; callers are
   * expected to abort the previous one before starting another.
   */
  analyze(request: AnalyzeRequest): Promise<EvalResult> {
    const { fen, depth, multiPV, onUpdate, signal } = request;

    return new Promise<EvalResult>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Analysis aborted', 'AbortError'));
        return;
      }

      const bySlot = new Map<number, RawInfo>();
      let deepest = 0;

      const buildResult = (): EvalResult => {
        const lines: PvLine[] = [...bySlot.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, info]) => {
            const pv = pvToSan(fen, info.pv);
            return { san: pv[0] ?? '', cp: info.cp, mate: info.mate, pv };
          })
          .filter((line) => line.san.length > 0);
        return { depth: deepest, lines };
      };

      const finish = (settle: () => void) => {
        unsubscribe();
        signal?.removeEventListener('abort', onAbort);
        this.busy = false;
        settle();
      };

      const onAbort = () => {
        this.transport.send('stop');
        finish(() => reject(new DOMException('Analysis aborted', 'AbortError')));
      };

      const unsubscribe = this.transport.onLine((line) => {
        if (line.startsWith('bestmove')) {
          finish(() => resolve(buildResult()));
          return;
        }

        const info = parseInfoLine(line);
        if (!info) return;

        const existing = bySlot.get(info.multipv);
        if (existing && existing.depth > info.depth) return;

        bySlot.set(info.multipv, info);
        deepest = Math.max(deepest, info.depth);
        onUpdate?.(buildResult());
      });

      signal?.addEventListener('abort', onAbort, { once: true });

      this.busy = true;
      this.transport.send('stop');
      this.transport.send(`setoption name MultiPV value ${multiPV}`);
      this.transport.send(`position fen ${fen}`);
      this.transport.send(`go depth ${depth}`);
    });
  }

  get isBusy(): boolean {
    return this.busy;
  }

  stop(): void {
    this.transport.send('stop');
  }

  dispose(): void {
    this.transport.terminate();
  }
}
