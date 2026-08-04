import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTreeStore } from '../tree/store';
import { Breadcrumb } from './Breadcrumb';

describe('Breadcrumb', () => {
  beforeEach(() => useTreeStore.getState().reset());

  it('shows the start crumb alone at the root', () => {
    render(<Breadcrumb />);
    expect(screen.getByRole('button', { name: 'start' })).toBeInTheDocument();
  });

  it('shows a crumb per move played', () => {
    useTreeStore.getState().playMove('e4');
    useTreeStore.getState().playMove('e5');
    render(<Breadcrumb />);
    expect(screen.getByRole('button', { name: 'e4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'e5' })).toBeInTheDocument();
  });

  it('navigates back when an earlier crumb is clicked', async () => {
    useTreeStore.getState().playMove('e4');
    useTreeStore.getState().playMove('e5');
    render(<Breadcrumb />);

    await userEvent.click(screen.getByRole('button', { name: 'e4' }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');
  });
});
