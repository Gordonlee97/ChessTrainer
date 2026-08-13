import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLessonAutoplay } from './useLessonAutoplay';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';

// jsdom has no real <audio> element, so playing a Howl for real logs
// "not implemented" noise to stderr (see LessonRail.test.tsx, which mocks
// the same module for the same reason). The autoplayed move itself is what
// these tests assert on, not the sound, so a stub is enough.
vi.mock('../sound', () => ({
  sounds: { play: vi.fn(), setMuted: vi.fn(), muted: false },
}));

function Harness() {
  useLessonAutoplay();
  return <div data-testid="ok" />;
}

const path = () =>
  pathTo(useTreeStore.getState().tree, useTreeStore.getState().tree.selectedId)
    .slice(1)
    .map((n) => n.move!.san);

describe('useLessonAutoplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => {
      useLessonStore.getState().stopLesson();
      useTreeStore.getState().reset();
    });
  });
  afterEach(() => vi.useRealTimers());

  it('plays the opponent reply after the player answers', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => {
      useTreeStore.getState().playMove('e4');
    }); // the player's answer
    expect(path()).toEqual(['e4']); // nothing yet
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(path()).toEqual(['e4', 'e5']); // Black replied
  });

  it('does not move while the player is being asked', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(path()).toEqual([]); // White to move: the player's
  });

  // The rule that stops the lesson fighting a player who looks back.
  //
  // The node selected here matters: it must be a position where it is the
  // *opponent's* turn (so guard 3, the side-to-move check, does not already
  // block on its own) that also already has a child (so guard 4, the
  // tip-of-line check, is the only thing standing in the way). In this line
  // that is the node after 'e4' — Black to move, and 'e5' is already its
  // child. The root fails both conditions at once (White to move there is
  // always the player's turn in this lesson), which is why selecting it
  // could not tell guard 3 and guard 4 apart.
  it('does not move when the selection is not the tip of the line', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => {
      useTreeStore.getState().playMove('e4');
    });
    act(() => {
      vi.advanceTimersByTime(700);
    }); // now at e4 e5
    // pathTo returns root-first; index 1 is the node after 'e4', found by
    // walking the path rather than by constructing an id string, so the
    // test does not couple itself to the tree's id format.
    const afterE4 = pathTo(useTreeStore.getState().tree, useTreeStore.getState().tree.selectedId)[1].id;
    act(() => {
      useTreeStore.getState().selectNode(afterE4);
    }); // step back to review, but only as far as the position after 'e4'
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(useTreeStore.getState().tree.selectedId).toBe(afterE4); // still there
  });

  it('does nothing when no lesson is running', () => {
    render(<Harness />);
    act(() => {
      useTreeStore.getState().playMove('e4');
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(path()).toEqual(['e4']);
  });

  /**
   * Theme lessons pace themselves with "Play the next move" so the player
   * reads each note before advancing. Autoplay would take that away, and the
   * spec says twice that theme lessons are unchanged.
   *
   * The other guards do not cover this: a theme lesson has a `side` and
   * alternating moves like any other, so at this point every one of them is
   * satisfied and only `kind` distinguishes the two cases.
   */
  it('never plays for a theme lesson, however long it waits', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('theme-development-and-tempo'));
    act(() => {
      useTreeStore.getState().playMove('e4');
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(path()).toEqual(['e4']);
  });
});
