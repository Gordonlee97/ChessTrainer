import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors Board.test.tsx: react-chessboard renders a full drag-and-drop
// board (including its own aria-live "status" region) that jsdom cannot
// usefully exercise and that collides with this file's own status region.
// The keyboard path lives entirely on our wrapper <div>, not on Chessboard,
// so a stub is faithful to what these tests actually drive.
vi.mock('react-chessboard', () => ({
  Chessboard: () => null,
}));

// Mirrors Board.test.tsx: no sound files are committed, and real Howler
// hitting jsdom's unimplemented HTMLMediaElement logs errors unrelated to
// the keyboard behaviour under test.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { Board } from './Board';
import { useTreeStore } from '../tree/store';

// Position after 1.e4, derived by replaying through chess.js.
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

function boardRegion() {
  return screen.getByRole('application', { name: /chess board/i });
}

describe('Board keyboard navigation', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
  });

  it('announces the square the cursor moves to', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(boardRegion());
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('status')).toHaveTextContent('e3, empty');
  });

  it('plays a legal move and advances the tree', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(boardRegion());
    // Cursor starts on e2. Pick up, walk to e4, place.
    await user.keyboard('{Enter}{ArrowUp}{ArrowUp}{Enter}');
    expect(useTreeStore.getState().tree.nodes[
      useTreeStore.getState().tree.selectedId
    ].fen).toBe(AFTER_E4);
  });

  // e2->e5 is illegal from the start position (verified via chess.js).
  it('refuses an illegal move, announces it, and plays nothing', async () => {
    const user = userEvent.setup();
    const before = useTreeStore.getState().tree.selectedId;
    const user2 = user;
    render(<Board />);
    await user2.click(boardRegion());
    await user2.keyboard('{Enter}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent(
      'e2 to e5 is not a legal move',
    );
    expect(useTreeStore.getState().tree.selectedId).toBe(before);
  });

  it('Escape puts a picked-up piece down', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(boardRegion());
    await user.keyboard('{Enter}{Escape}');
    expect(screen.getByRole('status')).toHaveTextContent('put down');
  });
});
