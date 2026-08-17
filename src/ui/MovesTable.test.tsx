import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors Board.test.tsx: react-chessboard renders a full drag-and-drop
// board that jsdom cannot usefully exercise (no real layout, so its own
// move-animation code throws), and Howler logs noise onto a missing
// HTMLMediaElement. Neither is relevant to whether an arrow key reaches the
// tree, so both are stubbed here the same way, only for the one test below
// that renders the full `<App />`.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));
vi.mock('react-chessboard', () => ({
  Chessboard: () => null,
}));

import { App } from '../App';
import { MovesTable } from './MovesTable';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';

function playLine(...sans: string[]) {
  act(() => {
    for (const san of sans) useTreeStore.getState().playMove(san);
  });
}

describe('MovesTable', () => {
  beforeEach(() => {
    act(() => useTreeStore.getState().reset());
  });

  it('lists the moves with their numbers', () => {
    playLine('e4', 'e5', 'Nf3');
    render(<MovesTable />);

    expect(screen.getByRole('button', { name: 'e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nf3' })).toBeInTheDocument();
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
  });

  it('selects the node when a move is clicked', async () => {
    const user = userEvent.setup();
    playLine('e4', 'e5', 'Nf3');
    render(<MovesTable />);

    await user.click(screen.getByRole('button', { name: 'e4' }));

    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');
  });

  it('marks the selected move for assistive technology, not by colour alone', () => {
    playLine('e4', 'e5');
    render(<MovesTable />);

    expect(screen.getByRole('button', { name: 'e5' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'e4' })).not.toHaveAttribute('aria-current');
  });

  it('walks the line with first, previous, next and last', async () => {
    const user = userEvent.setup();
    playLine('e4', 'e5', 'Nf3');
    render(<MovesTable />);

    await user.click(screen.getByRole('button', { name: /first/i }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root');

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');

    await user.click(screen.getByRole('button', { name: /last/i }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4/e5/Nf3');

    await user.click(screen.getByRole('button', { name: /previous/i }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4/e5');
  });

  it('disables the controls that would step off either end', async () => {
    playLine('e4');
    render(<MovesTable />);

    // At the tip: forward is exhausted, backward is not.
    expect(screen.getByRole('button', { name: /last/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /first/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeEnabled();

    act(() => useTreeStore.getState().selectNode('root'));
    expect(screen.getByRole('button', { name: /first/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
  });

  it('shows the empty line without crashing and disables everything', () => {
    render(<MovesTable />);

    expect(screen.getByRole('button', { name: /first/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /last/i })).toBeDisabled();
  });

  it('renders the white cell elision when the line begins with black', () => {
    act(() => {
      useTreeStore.getState().reset('rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2');
      useTreeStore.getState().playMove('Nc6');
    });
    render(<MovesTable />);

    const elision = screen.getByText('…');
    expect(elision).toBeInTheDocument();
    expect(elision).toHaveClass('moves-table-elision');
    expect(screen.getByRole('button', { name: 'Nc6' })).toBeInTheDocument();
  });

  it('walks the line with arrow keys when the table has focus', async () => {
    const user = userEvent.setup();
    playLine('e4', 'e5', 'Nf3');
    render(<MovesTable />);

    const table = screen.getByRole('region', { name: 'Moves' });
    table.focus();
    expect(table).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4/e5');

    await user.keyboard('{ArrowLeft}');
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');

    await user.keyboard('{ArrowRight}');
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4/e5');
  });

  it('prevents the default arrow-key scroll while the table has focus', () => {
    playLine('e4', 'e5', 'Nf3');
    render(<MovesTable />);

    const table = screen.getByRole('region', { name: 'Moves' });
    table.focus();

    const event = fireEvent.keyDown(table, { key: 'ArrowLeft' });
    // fireEvent.keyDown returns false when a handler called preventDefault().
    expect(event).toBe(false);
  });

  it('does not steer past either end of the line with arrow keys', async () => {
    const user = userEvent.setup();
    playLine('e4');
    render(<MovesTable />);

    const table = screen.getByRole('region', { name: 'Moves' });
    table.focus();

    await user.keyboard('{ArrowRight}');
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');

    await user.keyboard('{ArrowLeft}');
    expect(useTreeStore.getState().tree.selectedId).toBe('root');

    await user.keyboard('{ArrowLeft}');
    expect(useTreeStore.getState().tree.selectedId).toBe('root');
  });

  it('leaves the tree alone when the board has focus, even though the table could still step forward', async () => {
    const user = userEvent.setup();
    act(() => useLessonStore.getState().stopLesson());
    render(<App />);

    act(() => {
      useTreeStore.getState().playMove('e4');
      useTreeStore.getState().playMove('e5');
      useTreeStore.getState().selectNode('root/e4'); // not at the end — forward is still possible
    });

    const before = useTreeStore.getState().tree.selectedId;
    expect(before).toBe('root/e4');
    const board = screen.getByRole('application');
    board.focus();
    expect(board).toHaveFocus();

    await user.keyboard('{ArrowRight}');

    expect(useTreeStore.getState().tree.selectedId).toBe(before);
  });
});
