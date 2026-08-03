import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTreeStore } from '../tree/store';
import { createTree } from '../tree/tree';
import { sounds } from '../sound';
import { CandidateRail } from './CandidateRail';

const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

const analysis = vi.hoisted(() => ({ value: { result: null, status: 'idle', retry: () => {} } as never }));
vi.mock('./useAnalysis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useAnalysis')>()),
  useAnalysis: () => analysis.value,
}));

describe('CandidateRail', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
    analysis.value = { result: null, status: 'idle', retry: () => {} } as never;
    mocks.play.mockClear();
    sounds.setMuted(false);
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

  it('plays a move sound when a candidate is clicked, the same way dragging does', async () => {
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    await userEvent.click(screen.getByRole('button', { name: /e4/ }));
    expect(mocks.play).toHaveBeenCalledTimes(1);
  });

  it('honors the shared sound manager mute flag when a candidate is clicked', async () => {
    sounds.setMuted(true);
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    await userEvent.click(screen.getByRole('button', { name: /e4/ }));
    expect(mocks.play).not.toHaveBeenCalled();
  });

  it('does not warn about duplicate React keys when two lines share the same first move', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    analysis.value = {
      status: 'idle',
      result: {
        depth: 16,
        lines: [
          { san: 'Nf3', cp: 31, mate: null, pv: ['Nf3', 'Nf6'] },
          { san: 'Nf3', cp: 20, mate: null, pv: ['Nf3', 'd5'] },
        ],
      },
    } as never;

    render(<CandidateRail />);

    const duplicateKeyWarning = errorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('same key')),
    );
    expect(duplicateKeyWarning).toBe(false);
    errorSpy.mockRestore();
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

  it('gives the retry button the shared .btn class so it keeps the focus ring and reduced-motion feedback', () => {
    analysis.value = { result: null, status: 'unavailable', retry: () => {} } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /retry/i })).toHaveClass('btn');
  });

  it('gives candidate rows the shared .btn class so they keep the focus ring and reduced-motion feedback', () => {
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /e4/ })).toHaveClass('btn');
  });

  it('shows a thinking state while analysing with no result yet', () => {
    analysis.value = { result: null, status: 'analyzing' } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('status')).toHaveTextContent(/thinking/i);
  });

  it('shows a checkmate message instead of "Thinking…" once analysis finishes with zero moves on a mated position', () => {
    // Fool's Mate: 1. f3 e5 2. g4 Qh4# — White is checkmated.
    useTreeStore.getState().playMove('f3');
    useTreeStore.getState().playMove('e5');
    useTreeStore.getState().playMove('g4');
    useTreeStore.getState().playMove('Qh4');

    analysis.value = { status: 'idle', result: { depth: 0, lines: [] }, retry: () => {} } as never;
    render(<CandidateRail />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/checkmate/i);
    expect(status).not.toHaveTextContent(/thinking/i);
  });

  it('shows a stalemate message instead of "Thinking…" once analysis finishes with zero moves on a stalemated position', () => {
    const STALEMATE_FEN = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    useTreeStore.setState({ tree: createTree(STALEMATE_FEN) });

    analysis.value = { status: 'idle', result: { depth: 0, lines: [] }, retry: () => {} } as never;
    render(<CandidateRail />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/stalemate/i);
    expect(status).not.toHaveTextContent(/thinking/i);
  });

  it('still shows the thinking state when analysis is genuinely still running with no lines yet', () => {
    analysis.value = { status: 'analyzing', result: { depth: 5, lines: [] }, retry: () => {} } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('status')).toHaveTextContent(/thinking/i);
  });

  it('shows a neutral "no candidates" message, not a false checkmate/stalemate claim, when a finished analysis has zero lines on a position that still has legal moves', () => {
    // The start position plainly has legal moves — a finished analysis with
    // zero lines here means every PV was filtered as illegal (or bestmove
    // arrived before any pv-bearing info), not that the game is over.
    analysis.value = { status: 'idle', result: { depth: 12, lines: [] }, retry: () => {} } as never;
    render(<CandidateRail />);

    const status = screen.getByRole('status');
    expect(status).not.toHaveTextContent(/checkmate/i);
    expect(status).not.toHaveTextContent(/stalemate/i);
    expect(status).not.toHaveTextContent(/thinking/i);
    expect(status).toHaveTextContent(/no candidate moves available/i);
  });
});
