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

  describe('grading an attempted checkpoint answer', () => {
    // The Italian's first move is a checkpoint (accept: ['e4']) with d4 and
    // Nf3 authored as near misses — the natural fixture for this.
    it('shows the authored reply for a near-miss move, not the generic line', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('d4');
      render(<LessonRail />);
      expect(
        screen.getByText(/that is the Queen's Gambit family/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/not this time/i)).not.toBeInTheDocument();
    });

    it('shows the generic non-punishing line for a move that is neither accepted nor a near miss', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('a3');
      render(<LessonRail />);
      expect(screen.getByText(/not this time/i)).toBeInTheDocument();
      expect(
        screen.queryByText(/that is the Queen's Gambit family/i),
      ).not.toBeInTheDocument();
    });

    it('advances the lesson and shows no grade at all for an accepted move', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('e4');
      render(<LessonRail />);
      expect(screen.queryByText(/not this time/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/that is the Queen's Gambit family/i),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/which pawn move claims the centre/i),
      ).not.toBeInTheDocument();
    });

    it('shows the ordinary exploring text, not a grade, when diverging at a ply with no checkpoint', () => {
      useLessonStore.getState().startLesson('italian-game');
      // e4 is accepted; e5 (Black's reply) carries no checkpoint, so playing
      // something else there is exploring, not a graded attempt.
      useTreeStore.getState().playMove('e4');
      useTreeStore.getState().playMove('c5');
      render(<LessonRail />);
      expect(screen.getByText(/explore as long as you like/i)).toBeInTheDocument();
      expect(screen.queryByText(/not this time/i)).not.toBeInTheDocument();
    });

    it('does not treat a wrong checkpoint answer as an error', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('a3');
      render(<LessonRail />);
      expect(screen.queryByText(/wrong|incorrect|error/i)).not.toBeInTheDocument();
    });
  });
});
