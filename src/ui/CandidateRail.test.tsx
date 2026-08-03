import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTreeStore } from '../tree/store';
import { CandidateRail } from './CandidateRail';

const analysis = vi.hoisted(() => ({ value: { result: null, status: 'idle', retry: () => {} } as never }));
vi.mock('./useAnalysis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useAnalysis')>()),
  useAnalysis: () => analysis.value,
}));

describe('CandidateRail', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
    analysis.value = { result: null, status: 'idle', retry: () => {} } as never;
  });

  it('lists candidate moves with their scores', () => {
    analysis.value = {
      status: 'idle',
      result: {
        depth: 16,
        lines: [
          { san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5'] },
          { san: 'd4', cp: 28, mate: null, pv: ['d4', 'd5'] },
        ],
      },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /e4/ })).toHaveTextContent('+0.31');
    expect(screen.getByRole('button', { name: /d4/ })).toHaveTextContent('+0.28');
  });

  it('plays the move when a candidate is clicked', async () => {
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    await userEvent.click(screen.getByRole('button', { name: /e4/ }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');
  });

  it('shows the degraded banner when the engine is unavailable', () => {
    analysis.value = { result: null, status: 'unavailable', retry: () => {} } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('status')).toHaveTextContent(/engine unavailable/i);
  });

  it('shows a retry button in the unavailable state and calls retry on click', async () => {
    const retry = vi.fn();
    analysis.value = { result: null, status: 'unavailable', retry } as never;
    render(<CandidateRail />);

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows a thinking state while analysing with no result yet', () => {
    analysis.value = { result: null, status: 'analyzing' } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('status')).toHaveTextContent(/thinking/i);
  });
});
