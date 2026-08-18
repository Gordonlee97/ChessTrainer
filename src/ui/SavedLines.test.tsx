import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Clicking a Button plays the shared buttonPress sound; without this mock,
// jsdom logs real HTMLMediaElement "not implemented" errors from howler on
// every click, which is exactly the kind of noise the project's "test
// output must be pristine" rule treats as a failure. Same pattern as
// Button.test.tsx, CandidateRail.test.tsx, and LessonMenu.test.tsx.
const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
import { LessonRail } from './LessonRail';
import { SavedLines } from './SavedLines';

/** Save the current line under `name`, through the real Save → form → submit path. */
async function saveAs(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: /^save$/i }));
  const input = screen.getByLabelText(/name this line/i);
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole('button', { name: /save line/i }));
}

describe('SavedLines', () => {
  beforeEach(() => {
    localStorage.clear();
    useProgressStore.getState().reset();
    useTreeStore.getState().reset();
    useLessonStore.getState().stopLesson();
  });

  it('cannot save before a move has been played', () => {
    render(<SavedLines />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('saves the current line under the name the player gives it', async () => {
    const user = userEvent.setup();
    act(() => {
      useTreeStore.getState().playMove('e4');
      useTreeStore.getState().playMove('e5');
    });
    render(<SavedLines />);

    await saveAs(user, 'Open game');

    const [line] = useProgressStore.getState().progress.savedLines;
    expect(line.name).toBe('Open game');
    expect(line.pgn).toContain('e4');
  });

  it('does not save when the naming form is cancelled', async () => {
    const user = userEvent.setup();
    act(() => useTreeStore.getState().playMove('e4'));
    render(<SavedLines />);

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(useProgressStore.getState().progress.savedLines).toHaveLength(0);
    expect(screen.queryByLabelText(/name this line/i)).not.toBeInTheDocument();
  });

  /**
   * The reason the list became a disclosure: it used to render inline and grow
   * without bound, pushing everything below it down the rail.
   */
  it('keeps the list behind Open rather than rendering it inline', async () => {
    const user = userEvent.setup();
    act(() => useTreeStore.getState().playMove('e4'));
    render(<SavedLines />);
    await saveAs(user, 'Kept back');

    expect(screen.queryByRole('button', { name: 'Kept back' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^open$/i }));
    expect(screen.getByRole('button', { name: 'Kept back' })).toBeInTheDocument();
  });

  it('reopens a saved line from the list', async () => {
    const user = userEvent.setup();
    act(() => {
      useTreeStore.getState().playMove('e4');
      useTreeStore.getState().playMove('e5');
    });
    render(<SavedLines />);
    await saveAs(user, 'Open game');

    act(() => useTreeStore.getState().reset());
    expect(useTreeStore.getState().tree.selectedId).toBe(useTreeStore.getState().tree.rootId);

    await user.click(screen.getByRole('button', { name: /^open$/i }));
    await user.click(screen.getByRole('button', { name: 'Open game' }));

    expect(useTreeStore.getState().tree.selectedId).toContain('e5');
  });

  it('deletes a line from its own row, named for the line it removes', async () => {
    const user = userEvent.setup();
    act(() => useTreeStore.getState().playMove('e4'));
    render(<SavedLines />);
    await saveAs(user, 'Doomed');

    await user.click(screen.getByRole('button', { name: /^open$/i }));
    await user.click(screen.getByRole('button', { name: 'Delete Doomed' }));

    expect(useProgressStore.getState().progress.savedLines).toHaveLength(0);
  });

  /**
   * Found in the 2026-08-17 whole-branch review. A count-based default collides
   * after a delete — save three, remove the second, and the next save offers
   * "Line 3" again. Names exist to tell two saves apart.
   */
  it('does not offer a default name that is already taken', async () => {
    const user = userEvent.setup();
    act(() => useTreeStore.getState().playMove('e4'));
    render(<SavedLines />);

    await saveAs(user, 'Line 1');
    await saveAs(user, 'Line 2');
    await saveAs(user, 'Line 3');

    const second = useProgressStore
      .getState()
      .progress.savedLines.find((line) => line.name === 'Line 2')!;
    act(() => useProgressStore.getState().dropLine(second.id));

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.getByLabelText(/name this line/i)).toHaveValue('Line 4');
  });

  it('stops a running lesson when a saved line is opened', async () => {
    const user = userEvent.setup();
    // Save "e4" from the starting position before any lesson runs.
    act(() => useTreeStore.getState().playMove('e4'));
    render(<SavedLines />);
    await saveAs(user, 'Just e4');
    act(() => useTreeStore.getState().reset());

    // Now start the Italian, whose first checkpoint's accepted move is also
    // "e4" — the saved line follows the running lesson's script exactly.
    act(() => useLessonStore.getState().startLesson('italian-game'));
    render(<LessonRail />);

    await user.click(screen.getByRole('button', { name: /^open$/i }));
    await user.click(screen.getByRole('button', { name: 'Just e4' }));

    expect(useLessonStore.getState().lessonId).toBeNull();
    expect(
      useProgressStore.getState().progress.lessons['italian-game']?.checkpoints[
        'italian-open-with-e4'
      ],
    ).toBeUndefined();
  });
});
