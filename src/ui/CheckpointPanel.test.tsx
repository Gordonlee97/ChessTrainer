import { act } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CheckpointPanel } from './CheckpointPanel';
import { LessonRail } from './LessonRail';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';

// The Hint button plays the shared buttonPress sound; jsdom has no real
// HTMLMediaElement, so an unmocked Howl throws "not implemented" noise into
// every run that clicks it. Other UI test files mock 'howler' for the same
// reason.
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: vi.fn(), rate: vi.fn() })),
}));

/**
 * Drives a real lesson to a checkpoint rather than mocking the store — the
 * point of these tests is that two components agree about the same derived
 * state, and a mock would let each fake it independently.
 *
 * The Italian Game's very first move carries a checkpoint
 * ('italian-open-with-e4', accept: ['e4']), so no moves need playing: the
 * lesson is at a pending checkpoint the moment it starts. Verified by
 * reading src/content/lessons/italian-game.ts.
 */
function startAtCheckpoint() {
  act(() => {
    useTreeStore.getState().reset();
    useLessonStore.getState().startLesson('italian-game');
  });
}

/**
 * The panel takes the rail's analysis as props rather than running a second
 * search of its own, so these tests hand it the state every assertion below
 * is indifferent to: no lines, engine idle. The question and the hint ladder
 * must read the same whatever the engine is doing — `CandidateRail.test.tsx`
 * covers the unavailable and analyzing cases through the real mount gate.
 */
const noAnalysis = { result: null, status: 'idle' as const, onRetry: () => {} };

describe('checkpoint panel', () => {
  // Guards the whole file: if content changes so that e4 no longer carries a
  // checkpoint, every test below would pass vacuously against an empty
  // render. That is the exact failure mode Lessons.md §2 records six times.
  it('is genuinely at a pending checkpoint', () => {
    startAtCheckpoint();
    render(<CheckpointPanel {...noAnalysis} />);
    expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
  });

  it('reveals hints one at a time', async () => {
    const user = userEvent.setup();
    startAtCheckpoint();
    render(<CheckpointPanel {...noAnalysis} />);
    expect(screen.queryByText(/central pawn moves are the ones/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: /hint/i }));
    expect(screen.getByText(/central pawn moves are the ones/i)).toBeInTheDocument();
    // The second hint stays hidden until asked for.
    expect(screen.queryByText(/pawn in front of your king/i)).toBeNull();
  });

  it('still tells the player why the engine lines are hidden', () => {
    startAtCheckpoint();
    render(<CheckpointPanel {...noAnalysis} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      /hidden while the lesson is asking/i,
    );
  });

  // The shared surface. If both render hints, the player sees them twice.
  it('LessonRail drops its hint block while a checkpoint is pending', () => {
    startAtCheckpoint();
    render(<LessonRail />);
    expect(screen.queryByRole('button', { name: /^hint$/i })).toBeNull();
    // But it keeps its own controls — this must not delete the whole rail.
    expect(screen.getByRole('button', { name: /leave lesson/i })).toBeInTheDocument();
  });

  // Moved from LessonRail.test.tsx: the hint ladder used to be LessonRail's,
  // and these tests asserted on it there. They render <CheckpointPanel />
  // now, unmodified apart from that.
  describe('the hint ladder (moved from LessonRail)', () => {
    it('asks for the move at a checkpoint instead of naming it', () => {
      startAtCheckpoint();
      render(<CheckpointPanel {...noAnalysis} />);
      // The Italian's first move is itself a checkpoint.
      expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
      expect(screen.queryByText(/play e4\./i)).not.toBeInTheDocument();
    });

    it('reveals hints one at a time, in order', async () => {
      startAtCheckpoint();
      render(<CheckpointPanel {...noAnalysis} />);

      await userEvent.click(screen.getByRole('button', { name: /hint/i }));
      expect(screen.getByText(/central pawn moves/i)).toBeInTheDocument();
      expect(screen.queryByText(/play e4\./i)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /hint/i }));
      await userEvent.click(screen.getByRole('button', { name: /hint/i }));
      expect(screen.getByText(/play e4\./i)).toBeInTheDocument();
    });

    it('stops offering hints once they are exhausted', async () => {
      startAtCheckpoint();
      render(<CheckpointPanel {...noAnalysis} />);
      for (let i = 0; i < 3; i += 1) {
        await userEvent.click(screen.getByRole('button', { name: /hint/i }));
      }
      expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    });

    it('starts the next checkpoint with no hints showing and the Hint button back', async () => {
      startAtCheckpoint();
      const { rerender } = render(<CheckpointPanel {...noAnalysis} />);

      // Spend every hint at the first checkpoint (e4)...
      for (let i = 0; i < 3; i += 1) {
        await userEvent.click(screen.getByRole('button', { name: /hint/i }));
      }
      expect(screen.getByText(/play e4\./i)).toBeInTheDocument();

      // ...then walk to the second one (Bc4).
      act(() => {
        for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) useTreeStore.getState().playMove(san);
      });
      rerender(<CheckpointPanel {...noAnalysis} />);

      expect(screen.getByText(/most aggressive square/i)).toBeInTheDocument();
      expect(screen.queryByText(/the bishop belongs on c4\./i)).not.toBeInTheDocument();
      expect(screen.queryByText(/aim at the weakest point/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hint/i })).toBeInTheDocument();
    });

    it('keeps the question and the hint control on screen while an attempt is being graded', async () => {
      startAtCheckpoint();
      useTreeStore.getState().playMove('a3');
      render(<CheckpointPanel {...noAnalysis} />);

      // The reply (rendered by LessonRail) talks about taking a hint, so the
      // question it answers and the Hint button both have to still be here.
      expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /hint/i }));
      expect(screen.getByText(/central pawn moves/i)).toBeInTheDocument();
    });

    it('keeps the question up after a near miss too', () => {
      startAtCheckpoint();
      useTreeStore.getState().playMove('d4');
      render(<CheckpointPanel {...noAnalysis} />);
      expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^hint$/i })).toBeInTheDocument();
    });
  });
});
