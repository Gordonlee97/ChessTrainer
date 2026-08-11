import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiniBoard } from './MiniBoard';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('MiniBoard', () => {
  it('draws every piece on the board', () => {
    render(<MiniBoard fen={START} label="Start position" />);
    const board = screen.getByRole('img', { name: 'Start position' });

    expect(board.querySelectorAll('[data-piece]')).toHaveLength(32);
    expect(board.querySelectorAll('[data-piece="wP"]')).toHaveLength(8);
    expect(board.querySelectorAll('[data-piece="bP"]')).toHaveLength(8);
    // Every occupied square renders artwork, not an empty box.
    expect(board.querySelectorAll('[data-piece] svg')).toHaveLength(32);
  });

  /**
   * The armies are distinguished by piece code, which is what a test can see.
   * Visually they are separated by `fill` — a real limitation the component's
   * own comment records, shared with the main board.
   */
  it('marks a white piece as White even where the black one shares its shape', () => {
    render(<MiniBoard fen="7k/8/8/8/8/8/4K3/6N1 w - - 0 1" label="White knight" />);
    const board = screen.getByRole('img', { name: 'White knight' });

    expect(board.querySelectorAll('[data-piece="wN"]')).toHaveLength(1);
    expect(board.querySelectorAll('[data-piece="bN"]')).toHaveLength(0);
    expect(board.querySelectorAll('[data-piece="wK"]')).toHaveLength(1);
    expect(board.querySelectorAll('[data-piece="bK"]')).toHaveLength(1);
  });

  it('leaves empty squares empty', () => {
    render(<MiniBoard fen="7k/8/8/8/8/8/4K3/6N1 w - - 0 1" label="Sparse position" />);
    const board = screen.getByRole('img', { name: 'Sparse position' });

    expect(board.children).toHaveLength(64);
    expect(board.querySelectorAll('[data-piece]')).toHaveLength(3);
  });

  it('labels itself for assistive technology', () => {
    render(<MiniBoard fen={START} label="Position after the e4 line" />);
    expect(screen.getByRole('img', { name: 'Position after the e4 line' })).toBeInTheDocument();
  });
});
