import { describe, expect, it } from 'vitest';
import { describeSquare, moveCursor } from './boardCursor';

// Derived by replaying through chess.js, not written by hand.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('moveCursor', () => {
  it('moves up the board from White\'s point of view', () => {
    expect(moveCursor('e2', 'ArrowUp', 'white')).toBe('e3');
    expect(moveCursor('e2', 'ArrowDown', 'white')).toBe('e1');
    expect(moveCursor('e2', 'ArrowLeft', 'white')).toBe('d2');
    expect(moveCursor('e2', 'ArrowRight', 'white')).toBe('f2');
  });

  // The bug this whole test file exists for. Every lesson played as Black
  // flips the board, and a cursor that ignores it is wrong on every one.
  it('inverts every direction when the board is flipped for Black', () => {
    expect(moveCursor('e2', 'ArrowUp', 'black')).toBe('e1');
    expect(moveCursor('e2', 'ArrowDown', 'black')).toBe('e3');
    expect(moveCursor('e2', 'ArrowLeft', 'black')).toBe('f2');
    expect(moveCursor('e2', 'ArrowRight', 'black')).toBe('d2');
  });

  it('stops at the edge rather than wrapping', () => {
    expect(moveCursor('a1', 'ArrowDown', 'white')).toBe('a1');
    expect(moveCursor('a1', 'ArrowLeft', 'white')).toBe('a1');
    expect(moveCursor('h8', 'ArrowUp', 'white')).toBe('h8');
    expect(moveCursor('h8', 'ArrowRight', 'white')).toBe('h8');
    // Flipped, the edges swap ends.
    expect(moveCursor('a1', 'ArrowUp', 'black')).toBe('a1');
    expect(moveCursor('h8', 'ArrowDown', 'black')).toBe('h8');
  });
});

describe('describeSquare', () => {
  it('names the piece on an occupied square', () => {
    expect(describeSquare(START, 'e2')).toBe('e2, white pawn');
    expect(describeSquare(START, 'a1')).toBe('a1, white rook');
    expect(describeSquare(START, 'd8')).toBe('d8, black queen');
    expect(describeSquare(START, 'e1')).toBe('e1, white king');
  });

  it('says empty when nothing is there', () => {
    expect(describeSquare(START, 'e4')).toBe('e4, empty');
  });
});
