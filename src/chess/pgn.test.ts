import { describe, expect, it } from 'vitest';
import { lineToPgn, pgnToSans } from './pgn';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

describe('lineToPgn', () => {
  it('writes a line from the standard start', () => {
    expect(lineToPgn(START, ['e4', 'e5', 'Nf3'])).toContain('e4');
  });

  it('round-trips through pgnToSans', () => {
    const sans = ['e4', 'e5', 'Nf3', 'Nc6'];
    expect(pgnToSans(lineToPgn(START, sans), START)).toEqual(sans);
  });

  it('round-trips a line that starts from a custom position', () => {
    const sans = ['Nf3', 'Nc6', 'Bc4'];
    expect(pgnToSans(lineToPgn(AFTER_E4_E5, sans), AFTER_E4_E5)).toEqual(sans);
  });

  it('produces an empty movetext for an empty line', () => {
    expect(pgnToSans(lineToPgn(START, []), START)).toEqual([]);
  });

  it('throws on a move that is illegal in the line', () => {
    expect(() => lineToPgn(START, ['e4', 'e4'])).toThrow(/illegal/i);
  });

  it('returns an empty list rather than throwing on unreadable pgn', () => {
    expect(pgnToSans('this is not pgn at all', START)).toEqual([]);
  });
});
