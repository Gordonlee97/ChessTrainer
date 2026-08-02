import { describe, expect, it } from 'vitest';
import { createWorkerTransport } from './stockfishWorker';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const canRunWorkers = typeof Worker !== 'undefined';

describe.skipIf(!canRunWorkers)('stockfish worker smoke test', () => {
  it('returns a bestmove for the starting position', async () => {
    const transport = createWorkerTransport();
    const bestmove = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('engine timed out')), 20_000);
      const unsubscribe = transport.onLine((line) => {
        if (line.startsWith('bestmove')) {
          clearTimeout(timer);
          unsubscribe();
          resolve(line);
        }
      });
      transport.send('uci');
      transport.send('isready');
      transport.send(`position fen ${START_FEN}`);
      transport.send('go depth 10');
    });

    expect(bestmove).toMatch(/^bestmove [a-h][1-8][a-h][1-8]/);
    transport.terminate();
  }, 30_000);
});
