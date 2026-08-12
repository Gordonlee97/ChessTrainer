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

// A synthetic lesson whose checkpoint accepts two different moves. No
// authored lesson has a multi-entry `accept` today, so this is the only way
// to exercise it: deriveLessonState decides on/off-script by string equality
// against the single canonical `san`, so answering with the *other* accepted
// move is off-script even though gradeMove correctly calls it correct.
const multiAcceptLesson = vi.hoisted(() => ({
  id: 'multi-accept-test',
  title: 'Multi-Accept Test',
  kind: 'opening' as const,
  side: 'white' as const,
  summary: 'A synthetic lesson for testing a multi-entry accept list.',
  tags: [],
  segments: [
    {
      startFen: null,
      moves: [
        {
          san: 'e4',
          checkpoint: {
            id: 'multi-accept-cp',
            prompt: 'Play a central pawn move.',
            accept: ['e4', 'Nf3'],
            hints: ['Central pawn moves open lines.'],
          },
        },
      ],
    },
  ],
}));
vi.mock('../content/lessons/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/lessons/index')>();
  return {
    ...actual,
    ALL_LESSONS: [...actual.ALL_LESSONS, multiAcceptLesson],
    lessonById: (id: string) =>
      id === multiAcceptLesson.id ? multiAcceptLesson : actual.lessonById(id),
  };
});

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

  // "Play the next move" is a theme-lesson affordance only (see the
  // "opening lessons" describe block below) — theme-control-the-centre's
  // first move (e4) carries no checkpoint, the same shape london-system's
  // first move used to exercise here before opening lessons lost the button.
  it('advances the line when the player asks for the next move', async () => {
    useLessonStore.getState().startLesson('theme-control-the-centre');
    render(<LessonRail />);
    await userEvent.click(screen.getByRole('button', { name: /play the next move/i }));
    expect(useTreeStore.getState().tree.selectedId).toContain('e4');
  });

  it('plays the move sound for "Play the next move", not the generic button press', async () => {
    useLessonStore.getState().startLesson('theme-control-the-centre');
    render(<LessonRail />);
    await userEvent.click(screen.getByRole('button', { name: /play the next move/i }));
    expect(mocks.soundPlay).toHaveBeenCalledWith('move');
    expect(mocks.soundPlay).not.toHaveBeenCalledWith('buttonPress');
  });

  describe('opening lessons', () => {
    it('never offers "Play the next move", even when the next move carries no checkpoint', () => {
      // london-system's first move (d4) carries no checkpoint — exactly the
      // shape that would offer the button on a theme lesson.
      useLessonStore.getState().startLesson('london-system');
      render(<LessonRail />);
      expect(screen.queryByRole('button', { name: /play the next move/i })).not.toBeInTheDocument();
    });
  });

  describe('progress line', () => {
    it('reads "Move 0 of N" before any move is played, counting both sides', () => {
      useLessonStore.getState().startLesson('italian-game');
      render(<LessonRail />);
      expect(screen.getByText(/move 0 of \d+/i)).toBeInTheDocument();
    });

    it('advances by one for each move played, on either side', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('e4');
      useTreeStore.getState().playMove('e5');
      render(<LessonRail />);
      expect(screen.getByText(/move 2 of \d+/i)).toBeInTheDocument();
    });
  });

  it('puts "Leave lesson" outside the bordered explanation box, not inside it', () => {
    useLessonStore.getState().startLesson('italian-game');
    const { container } = render(<LessonRail />);
    const leaveButton = screen.getByRole('button', { name: /leave lesson/i });
    const box = container.querySelector('.lesson-rail');
    expect(box).not.toBeNull();
    expect(box?.contains(leaveButton)).toBe(false);
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

    // The reply names "hint" and "Return to the lesson", but only the latter
    // is a control this component renders — the Hint button and the question
    // it answers now live in CheckpointPanel, which CandidateRail mounts. So
    // the half of the invariant that spans both components ("the reply must
    // not name a control the player cannot see") is asserted where both are
    // on screen and the real mount gate runs: see "never names a hint the
    // player cannot take, even with the engine unavailable" in
    // CandidateRail.test.tsx. Deleting it from here without putting it there
    // is what let the whole-branch review's C1 through.
    it('names the return-to-lesson control in the not-this-time copy', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('a3');
      render(<LessonRail />);

      const reply = screen.getByText(/not this time/i);
      expect(reply).toHaveTextContent(/hint/i);
      expect(reply).toHaveTextContent(/return to the lesson/i);
      expect(screen.getByRole('button', { name: /return to the lesson/i })).toBeInTheDocument();
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

    it('records solved:true for a correct answer from a multi-entry accept list', () => {
      useProgressStore.getState().reset();
      useLessonStore.getState().startLesson('multi-accept-test');
      // "Nf3" is accepted but is not the checkpoint's canonical `san` ("e4"),
      // so deriveLessonState calls this off-script even though gradeMove
      // correctly grades it as correct.
      useTreeStore.getState().playMove('Nf3');
      render(<LessonRail />);

      const record =
        useProgressStore.getState().progress.lessons['multi-accept-test']
          ?.checkpoints['multi-accept-cp'];
      expect(record?.solved).toBe(true);
    });
  });
});
