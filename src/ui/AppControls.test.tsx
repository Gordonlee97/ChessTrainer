import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));

// AppControls uses the real `sounds` singleton (its toggle asserts on
// sounds.muted), but Button's own click sound must not reach a real Howl —
// jsdom has no audio backend and logs "not implemented" for every play/load
// call, which is exactly the warning noise this suite must stay free of.
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { sounds } from '../sound';
import { useTreeStore } from '../tree/store';
import { AppControls } from './AppControls';

describe('AppControls', () => {
  beforeEach(() => {
    localStorage.clear();
    useTreeStore.getState().reset();
    useLessonStore.getState().stopLesson();
    useProgressStore.getState().reset();
    sounds.setMuted(false);
  });

  it('clears the board back to the starting position', async () => {
    useTreeStore.getState().playMove('e4');
    render(<AppControls />);
    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    const tree = useTreeStore.getState().tree;
    expect(tree.selectedId).toBe(tree.rootId);
    expect(Object.keys(tree.nodes)).toHaveLength(1);
  });

  it('leaves any running lesson when a new game starts', async () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<AppControls />);
    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(useLessonStore.getState().lessonId).toBeNull();
  });

  it('toggles sound and says which state it is in', async () => {
    render(<AppControls />);
    const toggle = screen.getByRole('button', { name: /sound/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    expect(sounds.muted).toBe(true);
    expect(screen.getByRole('button', { name: /sound/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the muted state as text, not colour alone', async () => {
    render(<AppControls />);
    await userEvent.click(screen.getByRole('button', { name: /sound/i }));
    expect(screen.getByRole('button', { name: /sound off/i })).toBeInTheDocument();
  });

  it('requires a second click before clearing progress', async () => {
    useProgressStore.getState().noteAttempt('l', 'cp', { solved: true, hintsUsed: 0 }, 'k1');
    render(<AppControls />);

    await userEvent.click(screen.getByRole('button', { name: /clear progress/i }));
    expect(useProgressStore.getState().progress.lessons.l).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: /really clear/i }));
    expect(useProgressStore.getState().progress.lessons).toEqual({});
  });

  it('drops back to the unconfirmed label after clearing', async () => {
    render(<AppControls />);
    await userEvent.click(screen.getByRole('button', { name: /clear progress/i }));
    await userEvent.click(screen.getByRole('button', { name: /really clear/i }));
    expect(screen.getByRole('button', { name: /^clear progress$/i })).toBeInTheDocument();
  });
});
