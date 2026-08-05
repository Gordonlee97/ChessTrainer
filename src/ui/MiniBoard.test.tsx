import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiniBoard } from './MiniBoard';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('MiniBoard', () => {
  it('distinguishes the two armies by glyph, not by colour alone', () => {
    // The branch's own rule: success/failure — and here, side — is never
    // signalled by colour alone. Under Windows High Contrast (forced-colors)
    // both `color` and `textShadow` are overridden by the OS, so a board
    // that draws both armies with the black glyph set renders as thirty-two
    // identical pieces.
    render(<MiniBoard fen={START} label="Start position" />);
    const board = screen.getByRole('img', { name: 'Start position' });

    expect(board).toHaveTextContent('♙'); // white pawn
    expect(board).toHaveTextContent('♔'); // white king
    expect(board).toHaveTextContent('♟'); // black pawn
    expect(board).toHaveTextContent('♚'); // black king
  });

  it('draws a white piece with the white glyph even where the black one differs only in fill', () => {
    // The only knight on the board is White's, so the black knight glyph
    // must not appear anywhere.
    render(<MiniBoard fen="7k/8/8/8/8/8/4K3/6N1 w - - 0 1" label="White knight" />);
    const board = screen.getByRole('img', { name: 'White knight' });

    expect(board).toHaveTextContent('♘');
    expect(board).not.toHaveTextContent('♞');
  });

  it('labels itself for assistive technology', () => {
    render(<MiniBoard fen={START} label="Position after the e4 line" />);
    expect(screen.getByRole('img', { name: 'Position after the e4 line' })).toBeInTheDocument();
  });
});
