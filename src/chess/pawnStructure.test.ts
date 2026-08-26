import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { extractPawnStructure, pawnsRemaining } from './pawnStructure';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White pawns a2 b2 g2 h2 — two groups, no black pawns
const TWO_ISLANDS = '4k3/8/8/8/8/8/PP4PP/4K3 w - - 0 1';
// White pawns a2 a3 — doubled, and isolated (no b-file pawn)
const DOUBLED_ISOLATED = '4k3/8/8/8/8/P7/P7/4K3 w - - 0 1';
// Lone white e4 pawn, no black pawns at all
const PASSED = '4k3/8/8/8/4P3/8/8/4K3 w - - 0 1';
// Black d7 pawn sits ahead on an adjacent file, so e4 is not passed
const BLOCKED = '4k3/3p4/8/8/4P3/8/8/4K3 w - - 0 1';

describe('extractPawnStructure', () => {
  it('reports one island per side and nothing else at the start', () => {
    const s = extractPawnStructure(START);
    expect(s.islands).toEqual({ w: 1, b: 1 });
    expect(s.doubled).toEqual({ w: 0, b: 0 });
    expect(s.isolated).toEqual({ w: [], b: [] });
    expect(s.passed).toEqual({ w: [], b: [] });
  });

  it('counts pawn islands as contiguous occupied files', () => {
    expect(extractPawnStructure(TWO_ISLANDS).islands.w).toBe(2);
  });

  it('counts a doubled pawn once, not twice', () => {
    expect(extractPawnStructure(DOUBLED_ISOLATED).doubled.w).toBe(1);
  });

  it('reports both pawns of an unsupported file as isolated', () => {
    const s = extractPawnStructure(DOUBLED_ISOLATED);
    expect(s.isolated.w.sort()).toEqual(['a2', 'a3']);
  });

  it('reports a pawn with no enemy pawn ahead or adjacent as passed', () => {
    expect(extractPawnStructure(PASSED).passed.w).toEqual(['e4']);
  });

  it('does not report a pawn blocked by an adjacent-file enemy pawn as passed', () => {
    const s = extractPawnStructure(BLOCKED);
    expect(s.passed.w).toEqual([]);
    // Symmetric: the white e4 pawn is adjacent-and-ahead of black's d7
    expect(s.passed.b).toEqual([]);
  });

  it('treats a position with no pawns as zero islands', () => {
    expect(extractPawnStructure('4k3/8/8/8/8/8/8/4K3 w - - 0 1').islands).toEqual({ w: 0, b: 0 });
  });
});

describe('pawnsRemaining', () => {
  it('counts sixteen pawns at the start position', () => {
    expect(pawnsRemaining(new Chess().fen())).toBe(16);
  });

  it('counts fifteen pawns after one is captured', () => {
    // e4 d5 exd5 captures Black's d-pawn only, so one pawn leaves the board.
    const chess = new Chess();
    for (const san of ['e4', 'd5', 'exd5']) chess.move(san);
    expect(pawnsRemaining(chess.fen())).toBe(15);
  });
});
