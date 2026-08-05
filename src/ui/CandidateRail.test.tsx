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
    // Anchored to the start of the accessible name: a candidate row's SAN
    // always leads its text content, but with two lines present the rail
    // also renders a "Compare e4 and d4" button, which an unanchored /e4/ or
    // /d4/ would match too.
    expect(screen.getByRole('button', { name: /^e4/ })).toHaveTextContent('+0.31');
    expect(screen.getByRole('button', { name: /^d4/ })).toHaveTextContent('+0.28');
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

  it('does not set an inline boxShadow on candidate rows, so :active can collapse the shared --btn-shadow lip on press', () => {
    // An inline boxShadow style outranks both .btn's base rule and its
    // :active rule, so --btn-shadow is never actually read and the press
    // reads as a slide (row moves down, shadow stays put) instead of a
    // collapse. --btn-shadow itself must still drive the shadow.
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;
    render(<CandidateRail />);
    const button = screen.getByRole('button', { name: /e4/ });
    expect(button.style.boxShadow).toBe('');
    expect(button.style.getPropertyValue('--btn-shadow')).toBe('var(--primary)');
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

  it('gives two candidates genuinely different ideas, not the same sentence twice', () => {
    // This used to assert only /centre|center/i on one row, which passed no
    // matter what — the centre rule fired on every sensible opening move, so
    // e4, d4, Nf3, Nc3, c4 and e3 all read "stakes a claim in the centre".
    // The rail's whole purpose is that two candidates are described
    // differently, so that is what is asserted.
    analysis.value = {
      status: 'idle',
      result: {
        depth: 20,
        lines: [
          { san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5'] },
          { san: 'Nf3', cp: 28, mate: null, pv: ['Nf3', 'd5'] },
        ],
      },
    } as never;

    render(<CandidateRail />);
    const e4Row = screen.getByRole('button', { name: /^e4/ });
    const nf3Row = screen.getByRole('button', { name: /^Nf3/ });

    // e4 puts a pawn in the centre; Nf3 develops and only pressures it.
    expect(e4Row).toHaveTextContent(/pawn in the centre/i);
    expect(nf3Row).not.toHaveTextContent(/pawn in the centre/i);
    expect(nf3Row).toHaveTextContent(/brings a new piece into the game/i);
    expect(e4Row).not.toHaveTextContent(/brings a new piece into the game/i);
  });

  it('shows the top two reasons under a candidate, not just the first', () => {
    // Spec §7 renders "the top two or three by weight" as prose, and
    // describeMove's own default is 2. One sentence per candidate is what
    // makes every row read the same; 1.e4 has a second thing worth saying
    // (it opens lines for the queen and the light-squared bishop).
    analysis.value = {
      status: 'idle',
      result: {
        depth: 20,
        lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5'] }],
      },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /e4/ })).toHaveTextContent(/opens lines/i);
  });

  it('withholds quality badges and ideas while the search is still running', () => {
    // classifyMove compares one line against another, which only means
    // something at equal depth. Stockfish emits multipv 1,2,3 per iteration,
    // so mid-search there is always a render where lines[0] is a full
    // iteration deeper than lines[1..2] — and the lower candidates flash
    // through "Mistake"/"Blunder" before settling. The rail must not show a
    // band it cannot yet stand behind.
    analysis.value = {
      status: 'analyzing',
      result: {
        depth: 20,
        lines: [
          { san: 'e4', cp: 30, mate: null, pv: ['e4'] },
          { san: 'a3', cp: -80, mate: null, pv: ['a3'] },
        ],
      },
    } as never;

    render(<CandidateRail />);

    expect(screen.getByRole('button', { name: /^e4/ })).toBeInTheDocument();
    expect(screen.queryByText('Mistake')).not.toBeInTheDocument();
    expect(screen.queryByText('Best move')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^e4/ })).not.toHaveTextContent(/centre|center/i);
  });

  it('shows a quality badge relative to the best move', () => {
    analysis.value = {
      status: 'idle',
      result: {
        depth: 20,
        lines: [
          { san: 'e4', cp: 30, mate: null, pv: ['e4'] },
          { san: 'a3', cp: -80, mate: null, pv: ['a3'] },
        ],
      },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByText('Best move')).toBeInTheDocument();
    // 110cp worse than the best move lands in the "mistake" band.
    expect(screen.getByText('Mistake')).toBeInTheDocument();
  });

  it('still renders the candidate when the explainer cannot describe it', () => {
    // A move the rules have nothing to say about must not blank the row.
    analysis.value = {
      status: 'idle',
      result: { depth: 20, lines: [{ san: 'a3', cp: 5, mate: null, pv: ['a3'] }] },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /a3/ })).toBeInTheDocument();
  });
});
