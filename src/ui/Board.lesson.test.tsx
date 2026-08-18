import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors Board.keyboard.test.tsx: no sound files are committed, and real
// Howler hitting jsdom's unimplemented HTMLMediaElement logs errors unrelated
// to the rejection behaviour under test.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

// react-chessboard renders a full drag-and-drop board that jsdom cannot
// usefully exercise. Capture the `options` object Board hands it instead —
// the prop-capturing form, not a bare `() => null` stub, so squareStyles
// stays inspectable.
const chessboardOptions = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('react-chessboard', () => ({
  Chessboard: (props: { options: Record<string, unknown> }) => {
    chessboardOptions.current = props.options;
    return null;
  },
}));

import { Board } from './Board';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';

const nodeCount = () => Object.keys(useTreeStore.getState().tree.nodes).length;

type PieceDrop = (args: { sourceSquare: string; targetSquare: string | null }) => boolean;

describe('Board during a lesson', () => {
  beforeEach(() => {
    act(() => {
      useLessonStore.getState().stopLesson();
      useTreeStore.getState().reset();
      useLessonStore.getState().startLesson('italian-game');
    });
  });

  it('refuses a wrong answer and adds no node to the tree', async () => {
    const before = nodeCount();
    render(<Board />);
    const board = screen.getByRole('application', { name: /chess board/i });
    act(() => board.focus());
    // Cursor starts on e2. Pick up, go up one, place: e3 — legal, but not the answer.
    // Each key gets its own `act` call: batching all three dispatches inside
    // one `act` callback fires them against the same pre-update `cursor`/
    // `picked` closure, since React does not re-render between synchronous
    // dispatchEvent calls issued within a single act — only the first key
    // would take effect otherwise.
    for (const key of ['Enter', 'ArrowUp', 'Enter']) {
      await act(async () => {
        board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    }
    expect(nodeCount()).toBe(before);
    expect(useLessonStore.getState().lastRejection?.san).toBe('e3');
  });

  it('accepts the right answer and plays it', async () => {
    render(<Board />);
    const board = screen.getByRole('application', { name: /chess board/i });
    act(() => board.focus());
    for (const key of ['Enter', 'ArrowUp', 'ArrowUp', 'Enter']) {
      await act(async () => {
        board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    }
    const tree = useTreeStore.getState().tree;
    expect(tree.nodes[tree.selectedId].move?.san).toBe('e4');
    expect(useLessonStore.getState().lastRejection).toBeNull();
  });

  // Nothing else exercises the write side of this seam: MoveFeedback.test.tsx
  // drives lastAcceptance directly (the right way to unit-test that
  // component), which means it structurally cannot see whether Board.tsx
  // ever calls noteAcceptance at all. Proven live: commenting out both
  // Board.tsx call sites and running the full suite left it green — this is
  // the only test that would catch that.
  it('records the accepted answer at the node the move landed on', async () => {
    render(<Board />);
    const board = screen.getByRole('application', { name: /chess board/i });
    act(() => board.focus());
    for (const key of ['Enter', 'ArrowUp', 'ArrowUp', 'Enter']) {
      await act(async () => {
        board.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });
    }
    const tree = useTreeStore.getState().tree;
    // atNodeId must be where the move landed (selected id *after* the move),
    // not the node it was played from — see lastAcceptance's doc in
    // lesson/store.ts for why the two records differ on this.
    expect(useLessonStore.getState().lastAcceptance).toEqual({
      san: 'e4',
      atNodeId: tree.selectedId,
    });
  });

  // Deferred in Task 4's review: only the keyboard path was exercised, and
  // the two branches are structurally identical by inspection only, not by
  // test. The prop-capturing mock makes this cheap — no drag simulation
  // needed, just calling the captured handler the same way Board.test.tsx
  // already does for onPieceDrag.
  it('refuses a wrong answer dropped on the board and adds no node to the tree', () => {
    const before = nodeCount();
    render(<Board />);
    const onPieceDrop = chessboardOptions.current?.onPieceDrop as PieceDrop;
    const result = onPieceDrop({ sourceSquare: 'e2', targetSquare: 'e3' });
    expect(result).toBe(false); // react-chessboard returns the piece to its source square
    expect(nodeCount()).toBe(before);
    expect(useLessonStore.getState().lastRejection?.san).toBe('e3');
  });
});
