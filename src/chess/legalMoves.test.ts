import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { legalDestinations } from './legalMoves';
import { START_FEN } from '../tree/tree';

/** Replays SANs so no FEN in this file is hand-written. */
function fenAfter(...sans: string[]): string {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

describe('legalDestinations', () => {
  it('gives a knight its two opening squares', () => {
    // f3 and h3 only: e2 is the knight's third geometric square and is
    // occupied by White's own pawn, which is the point of asking chess.js
    // rather than reasoning about how a knight moves.
    const squares = legalDestinations(START_FEN, 'g1').map((move) => move.to).sort();
    expect(squares).toEqual(['f3', 'h3']);
  });

  it('returns nothing for an empty square', () => {
    expect(legalDestinations(START_FEN, 'e4')).toEqual([]);
  });

  it('returns nothing for a piece that has nowhere to go', () => {
    expect(legalDestinations(START_FEN, 'a1')).toEqual([]); // rook, boxed in
  });

  it("returns nothing for the side that is not to move", () => {
    // Black's knight is perfectly mobile, but it is White's turn.
    expect(legalDestinations(START_FEN, 'g8')).toEqual([]);
  });

  it('marks a capture as one, and a quiet move as not', () => {
    // 1. e4 d5 — White's e-pawn may take on d5 or push to e5.
    const fen = fenAfter('e4', 'd5');
    const found = legalDestinations(fen, 'e4');

    expect(found.find((move) => move.to === 'd5')?.captures).toBe(true);
    expect(found.find((move) => move.to === 'e5')?.captures).toBe(false);
  });

  /**
   * En passant is the case a "is there a piece on the target square?" check
   * gets wrong: the captured pawn is not on the square being moved to.
   */
  it('marks en passant as a capture even though the target square is empty', () => {
    const fen = fenAfter('e4', 'a6', 'e5', 'd5');
    const found = legalDestinations(fen, 'e5');
    const enPassant = found.find((move) => move.to === 'd6');

    expect(enPassant).toBeDefined();
    expect(enPassant!.captures).toBe(true);
    expect(new Chess(fen).get('d6')).toBeFalsy(); // nothing standing there
  });

  /**
   * Legality has to come from chess.js rather than from piece geometry: this
   * knight is pinned against its own king and may not move at all, though a
   * naive "where can a knight reach" answer would list eight squares.
   */
  it('omits moves that would expose the king', () => {
    // 1. e4 d5 2. Ne2 pins nothing; instead build a real pin on the d-file.
    const fen = fenAfter('e4', 'd5', 'Nf3', 'Bg4', 'Bb5+', 'Nd7');
    // The d7 knight is pinned by the b5 bishop against the e8 king.
    expect(legalDestinations(fen, 'd7')).toEqual([]);
  });

  it('returns nothing rather than throwing for a malformed FEN', () => {
    expect(legalDestinations('not a fen', 'e2')).toEqual([]);
  });
});
