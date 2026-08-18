import { render } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors Board.keyboard.test.tsx: no sound files are committed, and real
// Howler hitting jsdom's unimplemented HTMLMediaElement logs errors unrelated
// to the behaviour under test.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

// react-chessboard owns the actual squares, and jsdom cannot click them
// meaningfully — so capture the `options` object Board hands it and drive
// `onSquareClick` directly. That is the same function a real click calls; what
// is not covered here is react-chessboard's own click-to-handler wiring, which
// the browser pass checks.
const chessboardOptions = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('react-chessboard', () => ({
  Chessboard: (props: { options: Record<string, unknown> }) => {
    chessboardOptions.current = props.options;
    return null;
  },
}));

import { Board } from './Board';
import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';

const clickSquare = (square: string) =>
  act(() => {
    (chessboardOptions.current?.onSquareClick as (a: { square: string }) => void)({ square });
  });

const styles = () =>
  (chessboardOptions.current?.squareStyles ?? {}) as Record<
    string,
    { backgroundImage?: string; backgroundColor?: string }
  >;

const dotted = () =>
  Object.entries(styles())
    .filter(([, style]) => style.backgroundImage)
    .map(([square]) => square)
    .sort();

describe('Board click-to-move', () => {
  beforeEach(() => {
    localStorage.clear();
    useProgressStore.getState().reset();
    act(() => {
      useLessonStore.getState().stopLesson();
      useTreeStore.getState().reset();
    });
    mocks.play.mockClear();
  });

  it('shows nothing until a piece is selected', () => {
    render(<Board />);
    expect(dotted()).toEqual([]);
  });

  it('marks every square the selected piece can reach', () => {
    render(<Board />);
    clickSquare('g1'); // the king's knight
    expect(dotted()).toEqual(['f3', 'h3']);
  });

  it('ignores a click on an empty square or an unmovable piece', () => {
    render(<Board />);
    clickSquare('e4'); // empty
    expect(dotted()).toEqual([]);
    clickSquare('a1'); // rook with nowhere to go
    expect(dotted()).toEqual([]);
    clickSquare('e7'); // Black's pawn; it is White to move
    expect(dotted()).toEqual([]);
  });

  it('plays the move when a marked square is clicked', () => {
    render(<Board />);
    clickSquare('e2');
    clickSquare('e4');

    expect(useTreeStore.getState().tree.selectedId).toContain('e4');
    expect(dotted()).toEqual([]); // selection cleared
  });

  it('clears the selection when the same square is clicked twice', () => {
    render(<Board />);
    clickSquare('g1');
    expect(dotted()).not.toEqual([]);
    clickSquare('g1');
    expect(dotted()).toEqual([]);
  });

  it('switches selection when another of your own movable pieces is clicked', () => {
    render(<Board />);
    clickSquare('g1');
    clickSquare('b1'); // the other knight, not a square g1 can reach

    expect(dotted()).toEqual(['a3', 'c3']);
    expect(useTreeStore.getState().tree.selectedId).toBe(useTreeStore.getState().tree.rootId);
  });

  it('puts the piece down when an unreachable empty square is clicked', () => {
    render(<Board />);
    clickSquare('g1');
    clickSquare('a5'); // empty, and not a knight move

    expect(dotted()).toEqual([]);
    expect(useTreeStore.getState().tree.selectedId).toBe(useTreeStore.getState().tree.rootId);
  });

  /**
   * Found in the 2026-08-17 whole-branch review. The dots are drawn from
   * `picked`, but the cursor ring is drawn from `keyboardCursor` — so a piece
   * picked up with the keyboard and then abandoned by clicking away left its
   * destinations painted on a board with no cursor on it. Worse, the surviving
   * `picked` made the player's next click a move-or-reselect rather than a
   * fresh selection.
   */
  it('drops the selection and its dots when focus leaves the board', () => {
    render(<Board />);
    const board = document.querySelector('[role="application"]') as HTMLElement;

    clickSquare('e2');
    expect(dotted()).not.toEqual([]);

    // relatedTarget outside the board — focus genuinely left.
    act(() => {
      board.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
      );
    });
    expect(dotted()).toEqual([]);
  });

  /**
   * The regression the fix above first caused, and the reason its containment
   * check exists. `focusout` bubbles, and react-chessboard renders squares as
   * focusable elements, so clicking a square fires it on the wrapper too — with
   * `relatedTarget` still inside the board. An unguarded handler cleared the
   * selection before the click that should have used it, and the move silently
   * did not happen.
   *
   * jsdom cannot reproduce that on its own, because these tests call
   * `onSquareClick` directly and never dispatch real focus. So the focusout is
   * dispatched explicitly here, shaped the way the browser was measured to
   * shape it.
   */
  it('keeps the selection when focus moves within the board', () => {
    render(<Board />);
    const board = document.querySelector('[role="application"]') as HTMLElement;

    clickSquare('e2');
    act(() => {
      board.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: board }),
      );
    });

    expect(dotted()).not.toEqual([]); // still held
    clickSquare('e4');
    expect(useTreeStore.getState().tree.selectedId).toContain('e4');
  });

  /**
   * The reason clicking goes through `attemptMove` rather than playing the
   * move itself. A click must be graded exactly as a drag or a keyboard place
   * is — otherwise clicking would be a way to walk through a lesson without
   * answering it.
   */
  it('is graded by a running lesson, and a wrong answer reaches no node', () => {
    render(<Board />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    const before = useTreeStore.getState().tree;

    clickSquare('d2');
    clickSquare('d4'); // legal, but the Italian asks for e4

    expect(useTreeStore.getState().tree).toBe(before); // no node added
    expect(useLessonStore.getState().lastRejection?.san).toBe('d4');
    // Still held, so the player can try another square without reselecting.
    expect(dotted()).not.toEqual([]);
  });

  it('accepts the right answer during a lesson', () => {
    render(<Board />);
    act(() => useLessonStore.getState().startLesson('italian-game'));

    clickSquare('e2');
    clickSquare('e4');

    expect(useTreeStore.getState().tree.selectedId).toContain('e4');
    expect(useLessonStore.getState().lastAcceptance?.san).toBe('e4');
  });

  /**
   * A capture is drawn as a ring rather than a dot, so the two are
   * distinguishable; assert on the shape of the gradient rather than merely
   * that *some* image is set.
   */
  it('draws a capture differently from a quiet move', () => {
    render(<Board />);
    act(() => {
      useTreeStore.getState().playMove('e4');
      useTreeStore.getState().playMove('d5');
    });
    clickSquare('e4');

    expect(styles().d5?.backgroundImage).toContain('transparent 52%'); // ring
    expect(styles().e5?.backgroundImage).toContain('19%'); // dot
  });
});
