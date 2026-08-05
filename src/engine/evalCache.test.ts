import { describe, expect, it } from 'vitest';
import { EvalCache } from './evalCache';
import type { EvalResult } from './types';

const at = (depth: number): EvalResult => ({
  depth,
  lines: [{ san: 'e4', cp: 30, mate: null, pv: ['e4'] }],
});

const FEN_A = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_B = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

// The Queen's Gambit transposition, verified with chess.js: 1.Nf3 d5 2.d4 Nf6
// 3.c4 and 1.d4 d5 2.c4 Nf6 3.Nf3 reach the same position by different move
// orders, and differ only in the halfmove clock (0 vs 2).
const QGD_VIA_NF3 = 'rnbqkb1r/ppp1pppp/5n2/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq - 0 3';
const QGD_VIA_D4 = 'rnbqkb1r/ppp1pppp/5n2/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq - 2 3';

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

  it('overwrites an entry when a result arrives at the same depth', () => {
    // Equal depth is not a regression, so it must not be rejected: the
    // second result is the more recent read of the same position, and
    // rejecting it would also strand the entry at its old LRU position.
    const cache = new EvalCache();
    cache.set(FEN_A, at(20));
    cache.set(FEN_A, {
      depth: 20,
      lines: [{ san: 'd4', cp: 12, mate: null, pv: ['d4'] }],
    });
    expect(cache.get(FEN_A)?.lines[0]?.san).toBe('d4');
    expect(cache.size).toBe(1);
  });

  it('treats two move orders that reach the same position as one entry', () => {
    // The halfmove clock and the fullmove number are not part of a
    // position's identity for analysis purposes, so keying on the whole FEN
    // makes a genuine transposition miss — the exact case an openings
    // trainer walks into on move three.
    const cache = new EvalCache();
    cache.set(QGD_VIA_NF3, at(20));

    expect(cache.get(QGD_VIA_D4)?.depth).toBe(20);
    expect(cache.size).toBe(1);
  });

  it('still separates positions that differ in castling rights or en passant', () => {
    // Those two fields *are* part of the position, so they stay in the key.
    const cache = new EvalCache();
    const withRights = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const withoutRights = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
    cache.set(withRights, at(20));

    expect(cache.get(withoutRights)).toBeUndefined();
    expect(cache.get(withRights)?.depth).toBe(20);
  });

  it('clears every entry', () => {
    const cache = new EvalCache();
    cache.set(FEN_A, at(12));
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
