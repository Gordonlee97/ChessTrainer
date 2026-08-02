import { describe, expect, it, vi } from 'vitest';
import { Engine } from './engine';
import type { UciTransport } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** A scriptable stand-in for the Stockfish worker. */
function createFakeTransport() {
  const listeners = new Set<(line: string) => void>();
  const sent: string[] = [];
  const transport: UciTransport = {
    send: (cmd) => {
      sent.push(cmd);
    },
    onLine: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    terminate: () => listeners.clear(),
  };
  return {
    transport,
    sent,
    emit: (line: string) => listeners.forEach((cb) => cb(line)),
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
