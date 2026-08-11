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
  it('does not move when the selection is not the tip of the line', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => {
      useTreeStore.getState().playMove('e4');
    });
    act(() => {
      vi.advanceTimersByTime(700);
    }); // now at e4 e5
    const root = useTreeStore.getState().tree.rootId;
    act(() => {
      useTreeStore.getState().selectNode(root);
    }); // step back to the start
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(useTreeStore.getState().tree.selectedId).toBe(root); // still there
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
});
