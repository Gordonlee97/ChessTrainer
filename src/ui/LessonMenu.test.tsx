import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Clicking a lesson plays the shared buttonPress sound; without this mock,
// jsdom logs real HTMLMediaElement "not implemented" errors from howler on
// every click, which is exactly the kind of noise the project's "test
// output must be pristine" rule treats as a failure. Same pattern as
// Button.test.tsx, CandidateRail.test.tsx and CompareDrawer.test.tsx.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { LessonMenu } from './LessonMenu';

describe('LessonMenu', () => {
  beforeEach(() => {
    act(() => useLessonStore.getState().stopLesson());
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
    expect(screen.getByText(/1 of 3 checkpoints/i)).toBeInTheDocument();
  });

  it('marks a completed lesson as done in text, not colour alone', async () => {
    useProgressStore.getState().noteLessonComplete('london-system');
    const user = userEvent.setup();
    render(<LessonMenu />);
    await user.click(screen.getByRole('button', { name: /lessons/i }));
    expect(screen.getByText(/done/i)).toBeInTheDocument();
  });
});
