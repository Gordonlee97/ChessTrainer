import { describe, expect, it } from 'vitest';
import { EvalCache } from './evalCache';
import type { EvalResult } from './types';

const at = (depth: number): EvalResult => ({
  depth,
  lines: [{ san: 'e4', cp: 30, mate: null, pv: ['e4'] }],
});

const FEN_A = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_B = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

describe('EvalCache', () => {
  it('returns undefined for an unseen position', () => {
    expect(new EvalCache().get(FEN_A)).toBeUndefined();
  });

  it('stores and returns a result by FEN', () => {
    const cache = new EvalCache();
    cache.set(FEN_A, at(12));
    expect(cache.get(FEN_A)?.depth).toBe(12);
  });

  it('replaces a shallower result with a deeper one', () => {
    const cache = new EvalCache();
    cache.set(FEN_A, at(12));
    cache.set(FEN_A, at(20));
    expect(cache.get(FEN_A)?.depth).toBe(20);
    expect(cache.size).toBe(1);
  });

  it('keeps the deeper result when a shallower one arrives late', () => {
    const cache = new EvalCache();
    cache.set(FEN_A, at(20));
    cache.set(FEN_A, at(8));
    expect(cache.get(FEN_A)?.depth).toBe(20);
  });

  it('evicts the least recently used entry past the bound', () => {
    const cache = new EvalCache(2);
    cache.set(FEN_A, at(12));
    cache.set(FEN_B, at(12));
    cache.get(FEN_A);                      // refreshes A, making B least recent
    cache.set('third-fen', at(12));
    expect(cache.size).toBe(2);
    expect(cache.get(FEN_A)).toBeDefined();
    expect(cache.get(FEN_B)).toBeUndefined();
  });

  it('clears every entry', () => {
    const cache = new EvalCache();
    cache.set(FEN_A, at(12));
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
