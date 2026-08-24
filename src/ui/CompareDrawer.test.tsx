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

// 1.e4 e5 2.Nf3, Black to move — reached by replaying through chess.js
// (`new Chess().move('e4').move('e5').move('Nf3').fen()`) rather than
// hand-written, per CLAUDE.md. Exercises formatMoveList's Black-to-move
// branch, which every other fixture in this file skips by starting at the
// initial position.
const BLACK_TO_MOVE = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const blackNc6: PvLine = { san: 'Nc6', cp: 20, mate: null, pv: ['Nc6', 'Bc4', 'Nf6'] };
const blackD5: PvLine = { san: 'd5', cp: 15, mate: null, pv: ['d5'] };

// One line develops a single minor over its walk, the other two — the same
// discriminating fixture `compare.test.ts` uses for "development is the one
// row that differs". Verified there against `measureLine` directly.
const oneMinor: PvLine = { san: 'Nf3', cp: 20, mate: null, pv: ['Nf3', 'd5', 'd4', 'Nf6'] };
const twoMinors: PvLine = {
  san: 'e4',
  cp: 31,
  mate: null,
  pv: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
};

describe('CompareDrawer', () => {
  it('names both lines being compared', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    const dialog = screen.getByRole('region');

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

  it('captions the mini-board with the moves actually walked, not the length of the PV', () => {
    // The comparison walks at most 8 plies. Captioning the board with
    // line.pv.length ("after 26 plies", as observed in the browser) asserts
    // something false about the picture next to it.
    //
    // Counted in moves in the UI — this panel is aimed at a beginner, and it
    // was the only place "ply" appeared with nothing to explain it. 8 plies
    // walked reads as 4 moves; the 12-ply PV must not leak through as 6.
    const long: PvLine = {
      san: 'e4',
      cp: 31,
      mate: null,
      pv: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'],
    };
    render(<CompareDrawer a={long} b={b} baseFen={START} onClose={vi.fn()} />);
    const dialog = screen.getByRole('region');

    expect(dialog).toHaveTextContent(/4 moves later/i);
    expect(dialog).not.toHaveTextContent(/6 moves/i);
    expect(dialog).not.toHaveTextContent(/pl(y|ies)/i); // the jargon is gone
  });

  it('does not caption an unwalked line as "0 moves later"', () => {
    // An empty PV means the walk played nothing, so the mini-board *is* the
    // current position. Claiming a distance of zero reads as a distance.
    const unwalked: PvLine = { san: 'e4', cp: 31, mate: null, pv: [] };
    render(<CompareDrawer a={unwalked} b={b} baseFen={START} onClose={vi.fn()} />);

    const dialog = screen.getByRole('region');
    expect(dialog).toHaveTextContent(/at the current position/i);
    expect(dialog).not.toHaveTextContent(/0 moves/i);
  });

  it('does not claim the engine score belongs to the position on the mini-board', () => {
    // The score is for the whole principal variation; the board is a
    // truncated snapshot of it. "+0.31 after 8 plies" reads as one claim
    // about one position, and is wrong.
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    const dialog = screen.getByRole('region');

    expect(dialog).not.toHaveTextContent(/\+0\.31 after/i);
    expect(dialog).toHaveTextContent(/whole line/i);
  });

  it('lists pros and cons for each line', () => {
    // Pros/cons are authored-only since the compare-contrast-vocabulary
    // change (src/explain/compare.ts) — the five-row grid Task 4 adds is
    // what always renders now; a comparison with nothing authored renders
    // no pros/cons list at all. Supplying authored content for both lines
    // keeps this test exercising the render path it was written for.
    render(
      <CompareDrawer
        a={a}
        b={b}
        baseFen={START}
        onClose={vi.fn()}
        authored={{
          a: { pros: ['A pro'], cons: ['A con'] },
          b: { pros: ['B pro'], cons: ['B con'] },
        }}
      />,
    );
    expect(screen.getAllByRole('list').length).toBeGreaterThanOrEqual(2);
  });

  it('renders all five contrast row labels, in order', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    const dialog = screen.getByRole('region');
    const labels = ['Centre', 'Development', 'King safety', 'Tempo', 'Open or closed'];
    const found = labels.map((label) => within(dialog).getByText(label));

    for (let i = 1; i < found.length; i += 1) {
      // DOCUMENT_POSITION_FOLLOWING means found[i] comes after found[i - 1].
      const position = found[i - 1].compareDocumentPosition(found[i]);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('marks a differing row by more than colour', () => {
    render(<CompareDrawer a={oneMinor} b={twoMinors} baseFen={START} onClose={vi.fn()} />);
    const dialog = screen.getByRole('region');

    const differingRow = within(dialog).getByText('Development').closest('[data-differs]');
    expect(differingRow).toHaveAttribute('data-differs', 'true');
    expect(differingRow).toHaveTextContent('≠');

    const equalRow = within(dialog).getByText('Centre').closest('[data-differs]');
    expect(equalRow).toHaveAttribute('data-differs', 'false');
    expect(equalRow).not.toHaveTextContent('≠');
  });

  it('shows the walked moves, starting with the candidate\'s own SAN', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    const dialog = screen.getByRole('region');
    expect(dialog).toHaveTextContent('1.e4 e5 2.Nf3');
    expect(dialog).toHaveTextContent('1.d4 d5 2.Nf3');
  });

  it('numbers the walked moves from a Black-to-move base position with "N...", not "N."', () => {
    // A comparison opened from a Black-to-move position — common whenever a
    // checkpoint or candidate rail sits after White's move — hits
    // formatMoveList's other branch: the first SAN is Black's, so it must
    // render "2...Nc6", never "2.Nc6" (which would misread as White's move).
    render(
      <CompareDrawer a={blackNc6} b={blackD5} baseFen={BLACK_TO_MOVE} onClose={vi.fn()} />,
    );
    const dialog = screen.getByRole('region');
    expect(dialog).toHaveTextContent('2...Nc6 3.Bc4 Nf6');
    expect(dialog).toHaveTextContent('2...d5');
    expect(dialog).not.toHaveTextContent('2.Nc6');
  });

  it('renders authored prose alongside the rows, not instead of them', () => {
    render(
      <CompareDrawer
        a={a}
        b={b}
        baseFen={START}
        onClose={vi.fn()}
        authored={{ a: { pros: ['Opens lines at once'], cons: [] } }}
      />,
    );
    const dialog = screen.getByRole('region');
    expect(within(dialog).getByText('Opens lines at once')).toBeInTheDocument();
    expect(within(dialog).getByText('Centre')).toBeInTheDocument();
    expect(within(dialog).getByText('Development')).toBeInTheDocument();
  });

  it('names the differing row in the footer when exactly one differs', () => {
    render(<CompareDrawer a={oneMinor} b={twoMinors} baseFen={START} onClose={vi.fn()} />);
    expect(screen.getByTestId('verdict')).toHaveTextContent('One real difference: development.');
  });

  it('closes when the close button is pressed', async () => {
    const onClose = vi.fn();
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is announced as a region, findable by its accessible name', () => {
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />);
    expect(screen.getByRole('region')).toHaveAccessibleName(/compare/i);
  });

  it('renders authored pros when the lesson supplies them', () => {
    render(
      <CompareDrawer
        a={a}
        b={b}
        baseFen={START}
        onClose={vi.fn()}
        authored={{ a: { pros: ['Authored pro'], cons: ['Authored con'] } }}
      />,
    );
    expect(screen.getByText('Authored pro')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CompareDrawer a={a} b={b} baseFen={START} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('returns focus to whatever was focused when it opened', async () => {
    render(<button type="button">opener</button>);
    const opener = screen.getByRole('button', { name: 'opener' });
    opener.focus();
    const view = render(
      <CompareDrawer a={a} b={b} baseFen={START} onClose={vi.fn()} />,
    );
    expect(opener).not.toHaveFocus();
    view.unmount();
    expect(opener).toHaveFocus();
  });
});
