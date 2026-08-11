import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Clicking a lesson plays the shared buttonPress sound; without this mock,
// jsdom logs real HTMLMediaElement "not implemented" errors from howler on
// every click, which is exactly the kind of noise the project's "test
// output must be pristine" rule treats as a failure. Same pattern as
// Button.test.tsx, CandidateRail.test.tsx, and CompareDrawer.test.tsx.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { LessonPicker } from './LessonPicker';

describe('LessonPicker', () => {
  beforeEach(() => {
    useLessonStore.getState().stopLesson();
    localStorage.clear();
    useProgressStore.getState().reset();
  });

  it('lists every lesson', () => {
    render(<LessonPicker />);
    expect(screen.getByRole('button', { name: /the italian game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /london system/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forks and pins/i })).toBeInTheDocument();
  });

  it('shows each lesson summary, which is what the field exists for', () => {
    render(<LessonPicker />);
    expect(screen.getByText(/the most natural opening in chess/i)).toBeInTheDocument();
    expect(screen.getByText(/two of the sharpest tactics in chess/i)).toBeInTheDocument();
  });

  it('keeps the button named by its title alone, so the summary is not read out as the control', () => {
    render(<LessonPicker />);
    expect(
      screen.getByRole('button', { name: /^the italian game$/i }),
    ).toBeInTheDocument();
  });

  it('separates openings from themes', () => {
    render(<LessonPicker />);
    expect(screen.getByRole('heading', { name: /openings/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ideas/i })).toBeInTheDocument();
  });

  it('starts the lesson that was clicked', async () => {
    render(<LessonPicker />);
    await userEvent.click(screen.getByRole('button', { name: /the italian game/i }));
    expect(useLessonStore.getState().lessonId).toBe('italian-game');
  });

  it('renders nothing once a lesson is running', () => {
    useLessonStore.getState().startLesson('italian-game');
    const { container } = render(<LessonPicker />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing for a lesson never started', () => {
    useProgressStore.getState().reset();
    render(<LessonPicker />);
    // Deliberately specific: lesson summaries are free to contain the word
    // "checkpoint", so match the progress line's actual shape instead.
    expect(screen.queryByText(/\d+ of \d+ checkpoints/i)).not.toBeInTheDocument();
  });

  it('shows how many checkpoints are solved once some are', () => {
    useProgressStore.getState().reset();
    useProgressStore
      .getState()
      .noteAttempt('italian-game', 'italian-open-with-e4', { solved: true, hintsUsed: 0 }, 'k');
    render(<LessonPicker />);
    expect(screen.getByText(/1 of 3 checkpoints/i)).toBeInTheDocument();
  });

  it('marks a completed lesson as done in text, not colour alone', () => {
    useProgressStore.getState().reset();
    useProgressStore.getState().noteLessonComplete('london-system');
    render(<LessonPicker />);
    expect(screen.getByText(/done/i)).toBeInTheDocument();
  });
});
