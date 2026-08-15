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

  /**
   * The case this plan's `next`/`last` controls create. Navigating *forward*
   * to a tip that never received its reply is not reviewing — the reply is
   * still owed — but the arrival was a `selectNode`, so `lastPlayedId` is
   * null and the arrival-by-move rule alone declines.
   *
   * The tree is left in exactly that state here: the player answers, and the
   * pending reply is cancelled by navigating away before the 700ms elapses.
   */
  it('plays a reply still owed at a childless tip, even when reached by navigating', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => {
      useTreeStore.getState().playMove('e4');
    });

    const afterE4 = useTreeStore.getState().tree.selectedId;
    const root = pathTo(useTreeStore.getState().tree, afterE4)[0].id;

    // Navigate away before the reply lands: the effect's cleanup clears the
    // armed timer, so the tip keeps no child.
    act(() => {
      useTreeStore.getState().selectNode(root);
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // `path()` reads the *current* selection, and that's root now — it can't
    // speak to whether the tip picked up a child. Check the tip directly: no
    // child means the pending reply really was cancelled, not just delayed.
    expect(useTreeStore.getState().tree.nodes[afterE4].childIds).toEqual([]);

    // Now walk forward to the tip the way `last` will.
    act(() => {
      useTreeStore.getState().selectNode(afterE4);
    });
    expect(useTreeStore.getState().lastPlayedId).toBeNull(); // arrived by navigation
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(path()).toEqual(['e4', 'e5']);
  });

  /**
   * The counterpart to the guard above, and the defect it originally caused.
   *
   * Stepping back and *replaying* a move is not the same act as stepping back
   * to look: the player has answered again and is owed the opponent's reply.
   * `insertMove` reuses the node when the same move is replayed from the same
   * parent, so the node arrived at already carries the opponent's reply as a
   * child — which the tip-of-line guard read as "the player is reviewing" and
   * declined. The reply never came, the checkpoint panel had nothing to show
   * (it is not the player's turn), and the lesson could not advance at all.
   *
   * Observed in the browser on 2026-08-13, at `start` → `e4` → back to
   * `start` → `e4`: the right-hand rail went blank and stayed blank.
   */
  it('plays the reply again when the player replays a move they already played', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    act(() => {
      useTreeStore.getState().playMove('e4');
    });
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(path()).toEqual(['e4', 'e5']); // the first pass, for contrast

    const root = pathTo(useTreeStore.getState().tree, useTreeStore.getState().tree.selectedId)[0].id;
    act(() => {
      useTreeStore.getState().selectNode(root);
    }); // step back to the start …
    act(() => {
      useTreeStore.getState().playMove('e4');
    }); // … and answer the same question again
    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(path()).toEqual(['e4', 'e5']); // Black replied a second time
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
   * `black-vs-e4` is `side: 'black'` with a single segment and no `startFen`
   * override, so the root itself is White to move — the opponent's move, not
   * the player's. Every other opening lesson in the corpus is White-side, so
   * the root is always the player's turn there and guard 3 (side-to-move)
   * blocks before guard 4 (childless tip) is ever reached. Here the root is a
   * childless tip *and* the opponent's turn from the moment the lesson
   * starts, so autoplay fires immediately — the player never plays White's
   * first move themselves. This is correct per spec §2 (the opponent's moves
   * are the ones with no checkpoint, played automatically), but it is a case
   * the tip-of-line guard has to cover on its own, with no side-to-move check
   * to fall back on. Mutation-checked: removing the `childlessTip` half of
   * the guard in `useLessonAutoplay.ts` makes this test fail.
   */
  it('auto-plays the opening move in a Black-side opening lesson, with no player move first', () => {
    render(<Harness />);
    act(() => useLessonStore.getState().startLesson('black-vs-e4'));
    expect(path()).toEqual([]); // nothing played yet
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(path()).toEqual(['e4']); // White's opening move, played for the player
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
