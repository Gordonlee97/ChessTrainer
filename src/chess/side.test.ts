import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { sideToMove } from './side';

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
