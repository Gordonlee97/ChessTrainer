import { act } from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoveFeedback } from './MoveFeedback';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';

// Unlike CheckpointPanel.test.tsx and LessonRail.test.tsx, no '../sound'
// mock is needed here: MoveFeedback plays no sounds itself, and neither do
// its dependencies (lesson/store.ts, tree/store.ts) — nothing in this file's
// render tree ever touches the sound manager.

/**
 * The Italian's first move is itself a checkpoint ('italian-open-with-e4',
 * accept: ['e4']), so starting the lesson lands directly at a pending
 * checkpoint with no moves needed. Verified in CheckpointPanel.test.tsx's
 * `startAtCheckpoint` and by reading src/content/lessons/italian-game.ts.
 */
function startAtCheckpoint() {
  act(() => {
    useTreeStore.getState().reset();
    useLessonStore.getState().startLesson('italian-game');
  });
}

describe('MoveFeedback', () => {
  beforeEach(() => {
    act(() => {
      useLessonStore.getState().stopLesson();
      useTreeStore.getState().reset();
    });
  });

  it('renders nothing outside a lesson', () => {
    const { container } = render(<MoveFeedback />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing at a fresh checkpoint with no attempt yet', () => {
    startAtCheckpoint();
    const { container } = render(<MoveFeedback />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a decorative mark when the current node holds a rejection', () => {
    startAtCheckpoint();
    const { container, rerender } = render(<MoveFeedback />);
    act(() =>
      useLessonStore.getState().noteRejection(
        'e3',
        { kind: 'wrong' },
        useTreeStore.getState().tree.selectedId,
      ),
    );
    rerender(<MoveFeedback />);
    const mark = container.querySelector('.move-feedback');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark?.querySelector('.move-feedback-mark--wrong')).not.toBeNull();
  });

  it('ignores a rejection recorded at a different node', () => {
    startAtCheckpoint();
    const { container, rerender } = render(<MoveFeedback />);
    act(() => useLessonStore.getState().noteRejection('e3', { kind: 'wrong' }, 'some-other-node'));
    rerender(<MoveFeedback />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a correct mark when the store records an accepted answer at the current node', () => {
    startAtCheckpoint();
    const { container, rerender } = render(<MoveFeedback />);
    // Mirrors exactly what Board.tsx does on an accepted answer: clear any
    // rejection, play the move, then record the acceptance at the node the
    // move landed on (the value playMove returns) — not the node it was
    // played from.
    act(() => {
      useLessonStore.getState().clearRejection();
      const landedOn = useTreeStore.getState().playMove('e4')!;
      useLessonStore.getState().noteAcceptance('e4', landedOn);
    });
    rerender(<MoveFeedback />);
    expect(container.querySelector('.move-feedback-mark--correct')).not.toBeNull();
  });

  // Regression test for a bug caught in review: MoveFeedback used to infer
  // "correct" from the pending checkpoint's id changing across a render,
  // which also happens on pure backward navigation — stepping back derives a
  // *different* pending checkpoint there, satisfying the same condition a
  // genuine answer would. Promoted from the reviewer's scratch repro.
  it('does not show a correct mark for stepping backward to an earlier position', () => {
    startAtCheckpoint();
    const rootId = useTreeStore.getState().tree.selectedId;
    // MoveFeedback is mounted once, permanently, at the app root — always
    // before any lesson interaction happens in real use. Rendering before
    // the accepting move (rather than after) matches that: mounting after
    // the fact would make the accepted state look like the component's own
    // starting baseline instead of a fresh event, which is not a case that
    // can occur outside a test.
    const { container, rerender } = render(<MoveFeedback />);

    // Solve the first checkpoint and continue to the tip, where the second
    // checkpoint ('italian-bishop-to-c4') is now pending.
    act(() => {
      const landedOn = useTreeStore.getState().playMove('e4')!;
      useLessonStore.getState().noteAcceptance('e4', landedOn);
    });
    rerender(<MoveFeedback />);
    expect(container.querySelector('.move-feedback-mark--correct')).not.toBeNull(); // forward: true

    act(() => {
      useTreeStore.getState().playMove('e5');
      useTreeStore.getState().playMove('Nf3');
      useTreeStore.getState().playMove('Nc6');
    });
    rerender(<MoveFeedback />);

    // Step backward to the root, exactly what clicking an early moves-table
    // row does — no answer was given here, just now or ever.
    act(() => useTreeStore.getState().selectNode(rootId));
    rerender(<MoveFeedback />);
    expect(container.querySelector('.move-feedback-mark--correct')).toBeNull(); // afterStepBack: false
  });

  it('hides the correct mark on leaving its node, and does not resurrect it on revisiting', () => {
    startAtCheckpoint();
    const { container, rerender } = render(<MoveFeedback />);
    let landedOn = '';
    act(() => {
      landedOn = useTreeStore.getState().playMove('e4')!;
      useLessonStore.getState().noteAcceptance('e4', landedOn);
    });
    rerender(<MoveFeedback />);
    expect(container.querySelector('.move-feedback-mark--correct')).not.toBeNull();

    act(() => useTreeStore.getState().playMove('e5'));
    rerender(<MoveFeedback />);
    // Left the node the mark belongs to — it must go with it, not linger
    // until some future event happens to replace it.
    expect(container.querySelector('.move-feedback-mark--correct')).toBeNull();

    // Back to the node the (only) acceptance ever landed on, with no fresh
    // answer given — lastAcceptance is unchanged, so this must not be read
    // as "just answered again."
    act(() => useTreeStore.getState().selectNode(landedOn));
    rerender(<MoveFeedback />);
    expect(container.querySelector('.move-feedback-mark--correct')).toBeNull();
  });

  it('does not show a mark for ordinary navigation with no checkpoint pending', () => {
    startAtCheckpoint();
    // Play through the only checkpoint first so nothing is pending.
    act(() => {
      useTreeStore.getState().playMove('e4');
    });
    const { container, rerender } = render(<MoveFeedback />);
    act(() => {
      useTreeStore.getState().playMove('e5');
    });
    rerender(<MoveFeedback />);
    expect(container.querySelector('.move-feedback-mark--correct')).toBeNull();
  });

  /**
   * The check is a moment, not a standing fact, and the spec's word is
   * "brief". Before this, it was retired only by a node change - which
   * autoplay supplied mid-lesson but nothing supplied at the end of a
   * segment or in a theme lesson, so it stayed on screen indefinitely.
   */
  describe('retiring the marks', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('retires the check on its own, with no node change to do it', () => {
      startAtCheckpoint();
      const landedOn = useTreeStore.getState().tree.selectedId;
      const view = render(<MoveFeedback />);
      act(() => useLessonStore.getState().noteAcceptance('e4', landedOn));
      expect(view.container.textContent).toContain('✓');

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(view.container.textContent).not.toContain('✓');
    });

    // The cross is the other half of the asymmetry: it is a standing fact
    // about an unanswered position, so it waits for the player's next
    // attempt rather than for a clock.
    it('keeps the cross past the check window, and clears it on a correct answer', () => {
      startAtCheckpoint();
      const at = useTreeStore.getState().tree.selectedId;
      const view = render(<MoveFeedback />);
      act(() => useLessonStore.getState().noteRejection('e3', { kind: 'wrong' }, at));
      expect(view.container.textContent).toContain('✕');

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(view.container.textContent).toContain('✕');

      // Board calls clearRejection when an answer is accepted.
      act(() => useLessonStore.getState().clearRejection());
      expect(view.container.textContent).not.toContain('✕');
    });
  });
});
