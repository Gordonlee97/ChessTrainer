import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

// Clicking a lesson plays the shared buttonPress sound; without this mock,

import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
import { LessonMenu } from './LessonMenu';
import { LessonRail } from './LessonRail';

describe('LessonMenu', () => {
  beforeEach(() => {
    act(() => useLessonStore.getState().stopLesson());
    useTreeStore.getState().reset();
    localStorage.clear();
    useProgressStore.getState().reset();
  });

  it('hides the list until it is opened', () => {
    render(<LessonMenu />);
    expect(screen.queryByRole('button', { name: /the italian game/i })).toBeNull();
    expect(screen.getByRole('button', { name: /lessons/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('starts a lesson and closes', async () => {
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    await user.click(screen.getByRole('button', { name: /the italian game/i }));
    expect(useLessonStore.getState().lessonId).toBe('italian-game');
    expect(screen.queryByRole('button', { name: /the italian game/i })).toBeNull();
  });

  it('closes on Escape without starting anything', async () => {
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: /the italian game/i })).toBeNull();
    expect(useLessonStore.getState().lessonId).toBeNull();
  });

  it('returns focus to the trigger button on Escape', async () => {
    const user = userEvent.setup();
    render(<LessonMenu />);
    const trigger = screen.getByRole('button', { name: /lessons/i });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });

  it('closes on a click outside the panel', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <LessonMenu />
        <button type="button">Outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    expect(screen.getByRole('button', { name: /the italian game/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('button', { name: /the italian game/i })).toBeNull();
  });

  it('lists every lesson, grouped as openings and ideas', async () => {
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    expect(screen.getByRole('button', { name: /the italian game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /london system/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forks and pins/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /openings/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ideas/i })).toBeInTheDocument();
  });

  it('shows each lesson summary, which is what the field exists for', async () => {
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    expect(screen.getByText(/the most natural opening in chess/i)).toBeInTheDocument();
    expect(screen.getByText(/two of the sharpest tactics in chess/i)).toBeInTheDocument();
  });

  it('keeps a lesson button named by its title alone, so the summary is not read out as the control', async () => {
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    expect(screen.getByRole('button', { name: /^the italian game$/i })).toBeInTheDocument();
  });

  it('shows nothing for a lesson never started', async () => {
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    // Deliberately specific: lesson summaries are free to contain the word
    // "checkpoint", so match the progress line's actual shape instead.
    expect(screen.queryByText(/\d+ of \d+ checkpoints/i)).not.toBeInTheDocument();
  });

  it('shows how many checkpoints are solved once some are', async () => {
    useProgressStore
      .getState()
      .noteAttempt('italian-game', 'italian-open-with-e4', { solved: true, hintsUsed: 0 }, 'k');
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    expect(screen.getByText(/1 of 9 checkpoints/i)).toBeInTheDocument();
  });

  it('marks a completed lesson as done in text, not colour alone', async () => {
    useProgressStore.getState().noteLessonComplete('london-system');
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    expect(screen.getByText(/done/i)).toBeInTheDocument();
  });

  describe('switching lessons mid-lesson', () => {
    // The dropped LessonPicker invariant was "the list is unreachable while
    // a lesson runs" — no longer true by design (see the coordinator's
    // review: startLesson reseeds rather than replays, so switching is safe,
    // and a header menu that becomes unreachable mid-lesson would be
    // strange). This is the invariant that replaced it: switching is clean.
    it('reseeds the tree and leaves checkpoint credit exactly where it belongs when a different lesson is chosen mid-lesson', async () => {
      // Set up state before the first render, same as LessonRail.test.tsx's
      // recording tests: LessonRail's recording effect fires on mount, so by
      // the time we render, the Italian's opening checkpoint is credited.
      // (The effect only checks the move just passed — `segment.moves[ply -
      // 1]` — so this stops at one move rather than also playing Black's
      // scripted e5, which would silently skip past the intermediate render
      // this test needs.) A hint and a rejection are also put in place
      // directly, so the assertions below on `hintsShown` and
      // `lastRejection` are checking a real clear, not two fields that were
      // already at their empty default.
      useLessonStore.getState().startLesson('italian-game');
      useLessonStore.getState().revealHint('italian-open-with-e4');
      useLessonStore
        .getState()
        .noteRejection('d4', { kind: 'wrong' }, useTreeStore.getState().tree.selectedId);
      useTreeStore.getState().playMove('e4'); // the Italian's opening checkpoint, answered correctly

      const user = userEvent.setup();
      render(
        <>
          <LessonMenu />
          <LessonRail />
        </>,
      );

      expect(
        useProgressStore.getState().progress.lessons['italian-game']?.checkpoints[
          'italian-open-with-e4'
        ]?.solved,
      ).toBe(true);
      // Confirms the hint and rejection set up above actually landed, so the
      // "cleared" assertions after the switch are checking a real clear.
      expect(useLessonStore.getState().hintsShown).toEqual({ 'italian-open-with-e4': 1 });
      expect(useLessonStore.getState().lastRejection).not.toBeNull();

      await user.click(screen.getByRole('button', { name: /lessons/i }));
      await user.click(screen.getByRole('button', { name: /london system/i }));

      expect(useLessonStore.getState().lessonId).toBe('london-system');
      expect(useLessonStore.getState().segmentIndex).toBe(0);
      expect(useLessonStore.getState().hintsShown).toEqual({});
      expect(useLessonStore.getState().lastRejection).toBeNull();

      // `startLesson` reseeds the tree from the new lesson's segment rather
      // than replaying moves onto the old one (the way SavedLines.open does)
      // — the tree the Italian's e4/e5 built is gone entirely, not merely
      // deselected, so there is nothing left for London's own recording
      // effect to misread as an answer.
      const tree = useTreeStore.getState().tree;
      expect(Object.keys(tree.nodes)).toEqual([tree.rootId]);
      expect(tree.selectedId).toBe(tree.rootId);

      // The Italian's credit survives untouched, and none of it leaked onto
      // London: the two lessons' checkpoint ids never collide, so a leak
      // would show up as London crediting a checkpoint id that isn't its own.
      expect(
        useProgressStore.getState().progress.lessons['italian-game']?.checkpoints[
          'italian-open-with-e4'
        ]?.solved,
      ).toBe(true);
      expect(useProgressStore.getState().progress.lessons['london-system']).toBeUndefined();
    });
  });
});
