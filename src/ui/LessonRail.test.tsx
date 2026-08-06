import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
import { LessonRail } from './LessonRail';

const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn(), soundPlay: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));
// The shared sound manager is spied on by name rather than by counting Howl
// plays: the point of the "play the next move" assertion below is *which*
// sound fires, and the manager caches one Howl per name for the life of the
// process, so a call count cannot tell them apart.
vi.mock('../sound', () => ({
  sounds: { play: mocks.soundPlay, setMuted: vi.fn(), muted: false },
}));

describe('LessonRail', () => {
  beforeEach(() => {
    useLessonStore.getState().stopLesson();
    useTreeStore.getState().reset();
    mocks.play.mockClear();
    mocks.soundPlay.mockClear();
    // The recording effect now writes real localStorage on every render, and
    // node ids are deterministic (`root/d4`), so without this, an attempt
    // written by one test is indistinguishable from the same attempt in the
    // next and leaks across tests via `useProgressStore`'s reset(), which
    // reloads from storage rather than to empty progress.
    localStorage.clear();
    useProgressStore.getState().reset();
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

  it('plays the move sound for "Play the next move", not the generic button press', async () => {
    useLessonStore.getState().startLesson('london-system');
    render(<LessonRail />);
    await userEvent.click(screen.getByRole('button', { name: /play the next move/i }));
    expect(mocks.soundPlay).toHaveBeenCalledWith('move');
    expect(mocks.soundPlay).not.toHaveBeenCalledWith('buttonPress');
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

  describe('hints are counted per checkpoint', () => {
    it('starts the next checkpoint with no hints showing and the Hint button back', async () => {
      useLessonStore.getState().startLesson('italian-game');
      const { rerender } = render(<LessonRail />);

      // Spend every hint at the first checkpoint (e4)...
      for (let i = 0; i < 3; i += 1) {
        await userEvent.click(screen.getByRole('button', { name: /hint/i }));
      }
      expect(screen.getByText(/play e4\./i)).toBeInTheDocument();

      // ...then walk to the second one (Bc4).
      for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) useTreeStore.getState().playMove(san);
      rerender(<LessonRail />);

      expect(screen.getByText(/most aggressive square/i)).toBeInTheDocument();
      expect(screen.queryByText(/the bishop belongs on c4\./i)).not.toBeInTheDocument();
      expect(screen.queryByText(/aim at the weakest point/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hint/i })).toBeInTheDocument();
    });
  });

  describe('notes', () => {
    it('shows the note of the move just played even when the next move carries a checkpoint', () => {
      // black-vs-e4's first move has a note and its second move is a
      // checkpoint — the note that justifies the question being asked.
      useLessonStore.getState().startLesson('black-vs-e4');
      useTreeStore.getState().playMove('e4');
      render(<LessonRail />);
      expect(screen.getByText(/most natural first move in chess/i)).toBeInTheDocument();
    });

    it('shows the final note when the line is complete', () => {
      useLessonStore.getState().startLesson('london-system');
      const store = useTreeStore.getState();
      for (const san of [
        'd4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3',
        'O-O', 'Bd3', 'c5', 'c3', 'Nc6', 'Nbd2', 'b6', 'O-O',
      ]) {
        store.playMove(san);
      }
      render(<LessonRail />);
      // The last authored note must not vanish just because the line ended.
      expect(screen.getByText(/you castle last/i)).toBeInTheDocument();
    });
  });

  describe('moving between segments', () => {
    it('offers the next part once a segment with another after it is finished', async () => {
      useLessonStore.getState().startLesson('theme-control-the-centre');
      const store = useTreeStore.getState();
      for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'd4']) store.playMove(san);
      render(<LessonRail />);

      await userEvent.click(screen.getByRole('button', { name: /next part/i }));
      expect(useLessonStore.getState().segmentIndex).toBe(1);
    });

    it('says the lesson is complete, with no next part, on the final segment', () => {
      useLessonStore.getState().startLesson('theme-control-the-centre');
      useLessonStore.getState().nextSegment();
      const store = useTreeStore.getState();
      for (const san of ['d3', 'Bc5', 'c3']) store.playMove(san);
      render(<LessonRail />);

      expect(screen.getByText(/lesson complete/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /next part/i })).not.toBeInTheDocument();
    });
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

    it('keeps the question and the hint control on screen while an attempt is being graded', async () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('a3');
      render(<LessonRail />);

      // The reply talks about taking a hint, so the question it answers and
      // the Hint button both have to still be there.
      expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /hint/i }));
      expect(screen.getByText(/central pawn moves/i)).toBeInTheDocument();
    });

    it('names only controls that are on screen in the not-this-time copy', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('a3');
      render(<LessonRail />);

      const reply = screen.getByText(/not this time/i);
      expect(reply).toHaveTextContent(/hint/i);
      expect(reply).toHaveTextContent(/return to the lesson/i);
      expect(screen.getByRole('button', { name: /^hint$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /return to the lesson/i })).toBeInTheDocument();
    });

    it('keeps the question up after a near miss too', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('d4');
      render(<LessonRail />);
      expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^hint$/i })).toBeInTheDocument();
    });

    it('does not treat a wrong checkpoint answer as an error', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('a3');
      render(<LessonRail />);
      expect(screen.queryByText(/wrong|incorrect|error/i)).not.toBeInTheDocument();
    });
  });

  describe('recording progress', () => {
    it('records a wrong answer against the checkpoint', () => {
      useProgressStore.getState().reset();
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('d4');
      render(<LessonRail />);

      const record =
        useProgressStore.getState().progress.lessons['italian-game']
          ?.checkpoints['italian-open-with-e4'];
      expect(record?.attempts).toBe(1);
      expect(record?.solved).toBe(false);
    });

    it('records a solved checkpoint with the hints it took', () => {
      useProgressStore.getState().reset();
      useLessonStore.getState().startLesson('italian-game');
      useLessonStore.getState().revealHint('italian-open-with-e4');
      useTreeStore.getState().playMove('e4');
      render(<LessonRail />);

      const record =
        useProgressStore.getState().progress.lessons['italian-game']
          ?.checkpoints['italian-open-with-e4'];
      expect(record?.solved).toBe(true);
      expect(record?.hintsUsed).toBe(1);
    });

    it('does not double-count a re-render of the same attempt', () => {
      useProgressStore.getState().reset();
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('d4');
      const { rerender } = render(<LessonRail />);
      rerender(<LessonRail />);
      rerender(<LessonRail />);

      expect(
        useProgressStore.getState().progress.lessons['italian-game']
          .checkpoints['italian-open-with-e4'].attempts,
      ).toBe(1);
    });
  });
});
