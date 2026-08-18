import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors Board.test.tsx: no sound files are committed, and real Howler
// hitting jsdom's unimplemented HTMLMediaElement logs errors unrelated to
// the keyboard behaviour under test.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

// react-chessboard renders a full drag-and-drop board (including its own
// aria-live "status" region, which collides with this file's own status
// region) that jsdom cannot usefully exercise. Capture the `options` object
// Board hands it instead, the same way Board.test.tsx does — this also lets
// the squareStyles-merge test inspect exactly what Board computed, rather
// than discarding every prop the way a bare `() => null` stub would.
const chessboardOptions = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('react-chessboard', () => ({
  Chessboard: (props: { options: Record<string, unknown> }) => {
    chessboardOptions.current = props.options;
    return null;
  },
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
    render(<Board />);
    await user.click(boardRegion());
    await user.keyboard('{Enter}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent(
      'e2 to e5 is not a legal move',
    );
    expect(useTreeStore.getState().tree.selectedId).toBe(before);

    // The guard's actual job: `picked` must survive an illegal drop so the
    // player can retry, rather than the square silently becoming a fresh
    // pick-up target. Re-attempting the same illegal drop must announce the
    // same illegal-move message again — if `picked` had been wrongly
    // cleared, this second Enter would instead treat e5 as an (empty)
    // pick-up target and announce "e5, empty — nothing to pick up".
    await user.keyboard('{Enter}');
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

  /**
   * The cursor ring is a keyboard affordance, so it must not be painted on a
   * board nobody has focused. It used to be: `cursor` initialises to 'e2' and
   * the ring was drawn unconditionally, so a purple mark sat on e2 from the
   * first paint, stayed after the pawn moved away, and could not be dismissed
   * by any interaction. Reported from the running app on 2026-08-17.
   *
   * Asserting on `squareStyles` rather than on the DOM because the ring is
   * drawn by react-chessboard from the options Board hands it, and the board
   * itself is stubbed here.
   */
  it('draws no cursor ring until the board is focused, and drops it again on blur', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Board />
        <button type="button">elsewhere</button>
      </>,
    );

    const before = chessboardOptions.current?.squareStyles as Record<string, unknown>;
    expect(before).toEqual({}); // nothing at all, not merely no ring on e2

    await user.click(boardRegion());
    const whileFocused = chessboardOptions.current?.squareStyles as
      | Record<string, { boxShadow?: string }>
      | undefined;
    expect(whileFocused?.e2?.boxShadow).toContain('var(--secondary)');

    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    const afterBlur = chessboardOptions.current?.squareStyles as Record<string, unknown>;
    expect(afterBlur).toEqual({});
  });

  it('merges the last-move highlight with cursor feedback in squareStyles', async () => {
    const user = userEvent.setup();
    render(<Board />);
    await user.click(boardRegion());
    // Pick up e2, walk to e4, place — this sets the last-move highlight on
    // e2/e4. Then walk the cursor off to e3, a square neither endpoint of
    // the last move, so the two style sources can't be conflated.
    await user.keyboard('{Enter}{ArrowUp}{ArrowUp}{Enter}{ArrowDown}');

    const squareStyles = chessboardOptions.current?.squareStyles as
      | Record<string, { background?: string; boxShadow?: string }>
      | undefined;

    // Last-move highlight: both endpoints of the move that was just played.
    expect(squareStyles?.e2?.background).toContain('var(--board-highlight)');
    expect(squareStyles?.e4?.background).toContain('var(--board-highlight)');
    // Cursor feedback: the square the cursor now sits on, distinct from the
    // last-move squares, proving neither style source replaced the other.
    expect(squareStyles?.e3?.boxShadow).toContain('var(--secondary)');
  });
});
