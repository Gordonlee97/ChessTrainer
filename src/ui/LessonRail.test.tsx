import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';
import { LessonRail } from './LessonRail';

const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

describe('LessonRail', () => {
  beforeEach(() => {
    useLessonStore.getState().stopLesson();
    useTreeStore.getState().reset();
    mocks.play.mockClear();
  });

  it('renders nothing when no lesson is running', () => {
    const { container } = render(<LessonRail />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the lesson title and intro when started', () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<LessonRail />);
    expect(screen.getByRole('heading', { name: /italian game/i })).toBeInTheDocument();
  });

  it('asks for the move at a checkpoint instead of naming it', () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<LessonRail />);
    // The Italian's first move is itself a checkpoint.
    expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
    expect(screen.queryByText(/play e4\./i)).not.toBeInTheDocument();
  });

  it('reveals hints one at a time, in order', async () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<LessonRail />);

    await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    expect(screen.getByText(/central pawn moves/i)).toBeInTheDocument();
    expect(screen.queryByText(/play e4\./i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    expect(screen.getByText(/play e4\./i)).toBeInTheDocument();
  });

  it('stops offering hints once they are exhausted', async () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<LessonRail />);
    for (let i = 0; i < 3; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    }
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('advances the line when the player asks for the next move', async () => {
    useLessonStore.getState().startLesson('london-system');
    render(<LessonRail />);
    // The London's first move is not a checkpoint, so the rail offers to play it.
    await userEvent.click(screen.getByRole('button', { name: /play the next move/i }));
    expect(useTreeStore.getState().tree.selectedId).toContain('d4');
  });

  it('offers a way back when the player has gone off script', () => {
    useLessonStore.getState().startLesson('london-system');
    useTreeStore.getState().playMove('h4');
    render(<LessonRail />);
    expect(screen.getByRole('button', { name: /return to the lesson/i })).toBeInTheDocument();
  });

  it('does not treat going off script as an error', () => {
    useLessonStore.getState().startLesson('london-system');
    useTreeStore.getState().playMove('h4');
    render(<LessonRail />);
    expect(screen.queryByText(/wrong|incorrect|error/i)).not.toBeInTheDocument();
  });

  it('says so when the lesson is finished', () => {
    useLessonStore.getState().startLesson('london-system');
    const store = useTreeStore.getState();
    for (const san of [
      'd4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3',
      'O-O', 'Bd3', 'c5', 'c3', 'Nc6', 'Nbd2', 'b6', 'O-O',
    ]) {
      store.playMove(san);
    }
    render(<LessonRail />);
    expect(screen.getByText(/finished|complete/i)).toBeInTheDocument();
  });
});
