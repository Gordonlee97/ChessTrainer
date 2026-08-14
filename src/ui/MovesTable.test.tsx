import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MovesTable } from './MovesTable';
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
});
