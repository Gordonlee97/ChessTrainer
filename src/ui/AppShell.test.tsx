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
});
