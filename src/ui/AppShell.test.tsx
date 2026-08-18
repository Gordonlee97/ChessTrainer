import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../App';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';

describe('app shell', () => {
  beforeEach(() => {
    act(() => {
      useLessonStore.getState().stopLesson();
      useTreeStore.getState().reset();
    });
  });

  it('offers saved lines in the left rail and the lessons menu in the header when no lesson is running', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: /my lines/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lessons/i })).toBeInTheDocument();
  });

  // Saved lines must not be reachable mid-lesson: opening one resets the tree,
  // which could credit a checkpoint the player never answered.
  it('hides saved lines while a lesson is running', () => {
    render(<App />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    expect(screen.queryByRole('region', { name: /my lines/i })).toBeNull();
    expect(screen.getByRole('region', { name: /lesson/i })).toBeInTheDocument();
  });

  it('mounts the moves table in place of the old breadcrumb', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: 'Moves' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /move history/i })).toBeNull();
  });

  it('keeps the moves table mounted during a lesson, alongside the checkpoint gate', () => {
    render(<App />);
    act(() => useLessonStore.getState().startLesson('italian-game'));
    expect(screen.getByRole('region', { name: 'Moves' })).toBeInTheDocument();
  });

  /**
   * Reported from the running app on 2026-08-17: the move list slid up and
   * down the page every time a move was played. The cause was ordering, not
   * styling — the candidate rail sits in the same column and changes height
   * constantly while a search runs (the depth ticks, the explanation text
   * rewraps, the Compare button appears), and everything below it moves with
   * it. Anchoring the table to the top of the rail is what holds it still.
   *
   * jsdom performs no layout, so this cannot measure that the table stays
   * put — that was verified in a browser, where its `top` held at 85px across
   * four moves. What this *can* pin is the mechanism: the table must come
   * before the candidate rail in document order, inside the same rail.
   */
  it('puts the moves table above the candidate rail, so a search cannot push it around', () => {
    render(<App />);
    const table = screen.getByRole('region', { name: 'Moves' });
    const rail = table.parentElement!;

    // First child of the right rail, so nothing above it can change height and
    // shift it. Asserted as "is first" rather than "precedes the candidate
    // rail": without a Worker, jsdom's CandidateRail renders a "Thinking…"
    // status rather than its landmark, so there is no stable element to
    // compare against — but being first is the property that actually matters.
    expect(rail.classList.contains('app-rail-right')).toBe(true);
    expect(rail.firstElementChild).toBe(table);
  });
});
