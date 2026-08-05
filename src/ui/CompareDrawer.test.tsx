import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PvLine } from '../engine/types';

// The Close button plays the shared buttonPress sound; without this mock,
// jsdom logs real HTMLMediaElement "not implemented" errors from howler on
// every click, which is exactly the kind of noise the project's "test
// output must be pristine" rule treats as a failure. Same pattern as
// Button.test.tsx and CandidateRail.test.tsx.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { CompareDrawer } from './CompareDrawer';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const a: PvLine = { san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5', 'Nf3'] };
const b: PvLine = { san: 'd4', cp: 28, mate: null, pv: ['d4', 'd5', 'Nf3'] };

describe('CompareDrawer', () => {
  it('names both lines being compared', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');

    // The drawer's own <h2> ("Compare e4 and d4") and each LinePanel's <h3>
    // (its bare SAN) both legitimately contain "e4"/"d4" — querying by level
    // scopes each assertion to the right element instead of loosening the
    // markup to avoid the overlap.
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Compare e4 and d4',
    );

    const panelHeadings = within(dialog).getAllByRole('heading', { level: 3 });
    expect(panelHeadings).toHaveLength(2);
    expect(panelHeadings[0]).toHaveTextContent('e4');
    expect(panelHeadings[1]).toHaveTextContent('d4');
  });

  it('shows the calibrated verdict for two near-equal lines', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    expect(screen.getByTestId('verdict')).toHaveTextContent(/practically equal/i);
  });

  it('captions the mini-board with the plies actually walked, not the length of the PV', () => {
    // The comparison walks at most 8 plies. Captioning the board with
    // line.pv.length ("after 26 plies", as observed in the browser) asserts
    // something false about the picture next to it.
    const long: PvLine = {
      san: 'e4',
      cp: 31,
      mate: null,
      pv: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'],
    };
    render(<CompareDrawer a={long} b={b} baseFen={START} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');

    expect(dialog).toHaveTextContent(/after 8 plies/i);
    expect(dialog).not.toHaveTextContent(/12 plies/i);
  });

  it('does not claim the engine score belongs to the position on the mini-board', () => {
    // The score is for the whole principal variation; the board is a
    // truncated snapshot of it. "+0.31 after 8 plies" reads as one claim
    // about one position, and is wrong.
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');

    expect(dialog).not.toHaveTextContent(/\+0\.31 after/i);
    expect(dialog).toHaveTextContent(/whole line/i);
  });

  it('lists pros and cons for each line', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    expect(screen.getAllByRole('list').length).toBeGreaterThanOrEqual(2);
  });

  it('closes when the close button is pressed', async () => {
    const onClose = vi.fn();
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is announced as a dialog', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/compare/i);
  });
});
