import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { sideToMove, moveNumber } from './side';

describe('sideToMove', () => {
  it('reads the side to move from a position', () => {
    const chess = new Chess();
    expect(sideToMove(chess.fen())).toBe('white');
    chess.move('e4');
    expect(sideToMove(chess.fen())).toBe('black');
    chess.move('e5');
    expect(sideToMove(chess.fen())).toBe('white');
  });
});

describe('moveNumber', () => {
  it('returns 1 for the start position', () => {
    const chess = new Chess();
    expect(moveNumber(chess.fen())).toBe(1);
  });

  it('returns 1 after White\'s first move', () => {
    const chess = new Chess();
    chess.move('e4');
    expect(moveNumber(chess.fen())).toBe(1);
  });

  it('returns the move number from the FEN for Black-to-move positions', () => {
    const blackToMove = 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2';
    expect(moveNumber(blackToMove)).toBe(2);
  });
});
