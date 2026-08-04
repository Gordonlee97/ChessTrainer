import { describe, expect, it } from 'vitest';
import { parseInfoLine } from './parseInfo';

describe('parseInfoLine', () => {
  it('parses a centipawn info line', () => {
    const line =
      'info depth 18 seldepth 24 multipv 1 score cp 31 nodes 1000 nps 500 time 200 pv e2e4 e7e5 g1f3';
    expect(parseInfoLine(line)).toEqual({
      depth: 18,
      multipv: 1,
      cp: 31,
      mate: null,
      pv: ['e2e4', 'e7e5', 'g1f3'],
    });
  });

  it('parses a mate info line', () => {
    const line = 'info depth 12 multipv 2 score mate -3 pv h5f7 e8f7';
    expect(parseInfoLine(line)).toEqual({
      depth: 12,
      multipv: 2,
      cp: null,
      mate: -3,
      pv: ['h5f7', 'e8f7'],
    });
  });

  it('defaults multipv to 1 when absent', () => {
    const line = 'info depth 5 score cp 10 pv d2d4';
    expect(parseInfoLine(line)?.multipv).toBe(1);
  });

  it('ignores lines with no principal variation', () => {
    expect(parseInfoLine('info depth 1 currmove e2e4 currmovenumber 1')).toBeNull();
    expect(parseInfoLine('bestmove e2e4 ponder e7e5')).toBeNull();
    expect(parseInfoLine('readyok')).toBeNull();
  });

  it('handles promotion moves in the pv', () => {
    expect(parseInfoLine('info depth 9 score cp 900 pv a7a8q b8a8')?.pv).toEqual([
      'a7a8q',
      'b8a8',
    ]);
  });
});
