import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Clicking a Button plays the shared buttonPress sound; without this mock,
// jsdom logs real HTMLMediaElement "not implemented" errors from howler on
// every click, which is exactly the kind of noise the project's "test
// output must be pristine" rule treats as a failure. Same pattern as
// Button.test.tsx, CandidateRail.test.tsx, and LessonPicker.test.tsx.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
import { SavedLines } from './SavedLines';

describe('SavedLines', () => {
  beforeEach(() => {
    localStorage.clear();
    useProgressStore.getState().reset();
    useTreeStore.getState().reset();
  });

  it('offers no save when no moves have been played', () => {
    render(<SavedLines />);
    expect(screen.queryByRole('button', { name: /save this line/i })).not.toBeInTheDocument();
  });

  it('saves the current line under a default name', async () => {
    useTreeStore.getState().playMove('e4');
    useTreeStore.getState().playMove('e5');
    render(<SavedLines />);

    await userEvent.click(screen.getByRole('button', { name: /save this line/i }));
    expect(useProgressStore.getState().progress.savedLines).toHaveLength(1);
    expect(useProgressStore.getState().progress.savedLines[0].pgn).toContain('e4');
  });

  it('lists a saved line and reopens it', async () => {
    useTreeStore.getState().playMove('e4');
    useTreeStore.getState().playMove('e5');
    render(<SavedLines />);
    await userEvent.click(screen.getByRole('button', { name: /save this line/i }));

    act(() => useTreeStore.getState().reset());
    expect(useTreeStore.getState().tree.selectedId).toBe(useTreeStore.getState().tree.rootId);

    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(useTreeStore.getState().tree.selectedId).toContain('e5');
  });

  it('deletes a saved line', async () => {
    useTreeStore.getState().playMove('e4');
    render(<SavedLines />);
    await userEvent.click(screen.getByRole('button', { name: /save this line/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(useProgressStore.getState().progress.savedLines).toHaveLength(0);
  });
});
