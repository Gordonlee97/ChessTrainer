import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
import { createTree } from '../tree/tree';
import { sounds } from '../sound';
import { CandidateRail } from './CandidateRail';
import { LessonRail } from './LessonRail';

const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

// `calls` counts subscriptions to the analysis, which is the only way to see
// a duplicate search from jsdom — see the "one search" test below.
const analysis = vi.hoisted(() => ({
  value: { result: null, status: 'idle', retry: () => {} } as never,
  calls: 0,
}));
vi.mock('./useAnalysis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useAnalysis')>()),
  useAnalysis: () => {
    analysis.calls += 1;
    return analysis.value;
  },
}));

// A synthetic lesson whose checkpoint accepts one of its own authored
// alternatives — no lesson in the real corpus does this (an alternative is,
// by definition, a move the lesson didn't want), so it's the only way to
// exercise the exclusion directly rather than relying on it being vacuously
// true because the accepted answer was never an alternative to begin with.
const overlappingAcceptLesson = vi.hoisted(() => ({
  id: 'overlapping-accept-test',
  title: 'Overlapping Accept Test',
  kind: 'opening' as const,
  side: 'white' as const,
  summary: 'A synthetic lesson for testing the accept/alternatives overlap.',
  tags: [],
  segments: [
    {
      startFen: null,
      moves: [
        {
          san: 'e4',
          checkpoint: {
            id: 'overlap-cp',
            prompt: 'Play the best central pawn move.',
            accept: ['e4', 'd4'],
            hints: ['Central pawn moves open lines.'],
          },
          alternatives: [
            { san: 'd4', name: "Queen's Pawn", note: 'A real alternative first move.', pros: ['Solid'], cons: ['Different game'] },
            { san: 'c4', name: 'English', note: 'A flank opening.', pros: ['Flexible'], cons: ['Slower'] },
          ],
        },
      ],
    },
  ],
}));
vi.mock('../content/lessons/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/lessons/index')>();
  return {
    ...actual,
    ALL_LESSONS: [...actual.ALL_LESSONS, overlappingAcceptLesson],
    lessonById: (id: string) =>
      id === overlappingAcceptLesson.id ? overlappingAcceptLesson : actual.lessonById(id),
  };
});

describe('CandidateRail', () => {
  beforeEach(() => {
    useLessonStore.getState().stopLesson();
    useTreeStore.getState().reset();
    analysis.value = { result: null, status: 'idle', retry: () => {} } as never;
    analysis.calls = 0;
    mocks.play.mockClear();
    sounds.setMuted(false);
    // The composed tests below mount LessonRail, whose recording effect
    // writes real localStorage; node ids are deterministic, so an attempt
    // written by one test would otherwise leak into the next.
    localStorage.clear();
    useProgressStore.getState().reset();
  });

  it('lists candidate moves with their scores', () => {
    analysis.value = {
      status: 'idle',
      result: {
        depth: 16,
        lines: [
          { san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5'] },
          { san: 'd4', cp: 28, mate: null, pv: ['d4', 'd5'] },
        ],
      },
    } as never;

    render(<CandidateRail />);
    // Anchored to the start of the accessible name: a candidate row's SAN
    // always leads its text content, but with two lines present the rail
    // also renders a "Compare e4 and d4" button, which an unanchored /e4/ or
    // /d4/ would match too.
    expect(screen.getByRole('button', { name: /^e4/ })).toHaveTextContent('+0.31');
    expect(screen.getByRole('button', { name: /^d4/ })).toHaveTextContent('+0.28');
  });

  it('plays the move when a candidate is clicked', async () => {
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    await userEvent.click(screen.getByRole('button', { name: /e4/ }));
    expect(useTreeStore.getState().tree.selectedId).toBe('root/e4');
  });

  it('plays a move sound when a candidate is clicked, the same way dragging does', async () => {
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    await userEvent.click(screen.getByRole('button', { name: /e4/ }));
    expect(mocks.play).toHaveBeenCalledTimes(1);
  });

  it('honors the shared sound manager mute flag when a candidate is clicked', async () => {
    sounds.setMuted(true);
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    await userEvent.click(screen.getByRole('button', { name: /e4/ }));
    expect(mocks.play).not.toHaveBeenCalled();
  });

  it('does not warn about duplicate React keys when two lines share the same first move', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    analysis.value = {
      status: 'idle',
      result: {
        depth: 16,
        lines: [
          { san: 'Nf3', cp: 31, mate: null, pv: ['Nf3', 'Nf6'] },
          { san: 'Nf3', cp: 20, mate: null, pv: ['Nf3', 'd5'] },
        ],
      },
    } as never;

    render(<CandidateRail />);

    const duplicateKeyWarning = errorSpy.mock.calls.some((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('same key')),
    );
    expect(duplicateKeyWarning).toBe(false);
    errorSpy.mockRestore();
  });

  it('shows the degraded banner when the engine is unavailable', () => {
    analysis.value = { result: null, status: 'unavailable', retry: () => {} } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('status')).toHaveTextContent(/engine unavailable/i);
  });

  it('shows a retry button in the unavailable state and calls retry on click', async () => {
    const retry = vi.fn();
    analysis.value = { result: null, status: 'unavailable', retry } as never;
    render(<CandidateRail />);

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('gives the retry button the shared .btn class so it keeps the focus ring and reduced-motion feedback', () => {
    analysis.value = { result: null, status: 'unavailable', retry: () => {} } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /retry/i })).toHaveClass('btn');
  });

  it('gives candidate rows the shared .btn class so they keep the focus ring and reduced-motion feedback', () => {
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /e4/ })).toHaveClass('btn');
  });

  it('does not set an inline boxShadow on candidate rows, so :active can collapse the shared --btn-shadow lip on press', () => {
    // An inline boxShadow style outranks both .btn's base rule and its
    // :active rule, so --btn-shadow is never actually read and the press
    // reads as a slide (row moves down, shadow stays put) instead of a
    // collapse. --btn-shadow itself must still drive the shadow.
    analysis.value = {
      status: 'idle',
      result: { depth: 16, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;
    render(<CandidateRail />);
    const button = screen.getByRole('button', { name: /e4/ });
    expect(button.style.boxShadow).toBe('');
    expect(button.style.getPropertyValue('--btn-shadow')).toBe('var(--primary)');
  });

  it('shows a thinking state while analysing with no result yet', () => {
    analysis.value = { result: null, status: 'analyzing' } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('status')).toHaveTextContent(/thinking/i);
  });

  it('shows a checkmate message instead of "Thinking…" once analysis finishes with zero moves on a mated position', () => {
    // Fool's Mate: 1. f3 e5 2. g4 Qh4# — White is checkmated.
    useTreeStore.getState().playMove('f3');
    useTreeStore.getState().playMove('e5');
    useTreeStore.getState().playMove('g4');
    useTreeStore.getState().playMove('Qh4');

    analysis.value = { status: 'idle', result: { depth: 0, lines: [] }, retry: () => {} } as never;
    render(<CandidateRail />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/checkmate/i);
    expect(status).not.toHaveTextContent(/thinking/i);
  });

  it('shows a stalemate message instead of "Thinking…" once analysis finishes with zero moves on a stalemated position', () => {
    const STALEMATE_FEN = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    useTreeStore.setState({ tree: createTree(STALEMATE_FEN) });

    analysis.value = { status: 'idle', result: { depth: 0, lines: [] }, retry: () => {} } as never;
    render(<CandidateRail />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/stalemate/i);
    expect(status).not.toHaveTextContent(/thinking/i);
  });

  it('still shows the thinking state when analysis is genuinely still running with no lines yet', () => {
    analysis.value = { status: 'analyzing', result: { depth: 5, lines: [] }, retry: () => {} } as never;
    render(<CandidateRail />);
    expect(screen.getByRole('status')).toHaveTextContent(/thinking/i);
  });

  it('shows a neutral "no candidates" message, not a false checkmate/stalemate claim, when a finished analysis has zero lines on a position that still has legal moves', () => {
    // The start position plainly has legal moves — a finished analysis with
    // zero lines here means every PV was filtered as illegal (or bestmove
    // arrived before any pv-bearing info), not that the game is over.
    analysis.value = { status: 'idle', result: { depth: 12, lines: [] }, retry: () => {} } as never;
    render(<CandidateRail />);

    const status = screen.getByRole('status');
    expect(status).not.toHaveTextContent(/checkmate/i);
    expect(status).not.toHaveTextContent(/stalemate/i);
    expect(status).not.toHaveTextContent(/thinking/i);
    expect(status).toHaveTextContent(/no candidate moves available/i);
  });

  it('gives two candidates genuinely different ideas, not the same sentence twice', () => {
    // This used to assert only /centre|center/i on one row, which passed no
    // matter what — the centre rule fired on every sensible opening move, so
    // e4, d4, Nf3, Nc3, c4 and e3 all read "stakes a claim in the centre".
    // The rail's whole purpose is that two candidates are described
    // differently, so that is what is asserted.
    analysis.value = {
      status: 'idle',
      result: {
        depth: 20,
        lines: [
          { san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5'] },
          { san: 'Nf3', cp: 28, mate: null, pv: ['Nf3', 'd5'] },
        ],
      },
    } as never;

    render(<CandidateRail />);
    const e4Row = screen.getByRole('button', { name: /^e4/ });
    const nf3Row = screen.getByRole('button', { name: /^Nf3/ });

    // e4 puts a pawn in the centre; Nf3 develops and only pressures it.
    expect(e4Row).toHaveTextContent(/pawn in the centre/i);
    expect(nf3Row).not.toHaveTextContent(/pawn in the centre/i);
    expect(nf3Row).toHaveTextContent(/brings a new piece into the game/i);
    expect(e4Row).not.toHaveTextContent(/brings a new piece into the game/i);
  });

  it('shows the top two reasons under a candidate, not just the first', () => {
    // Spec §7 renders "the top two or three by weight" as prose, and
    // describeMove's own default is 2. One sentence per candidate is what
    // makes every row read the same; 1.e4 has a second thing worth saying
    // (it opens lines for the queen and the light-squared bishop).
    analysis.value = {
      status: 'idle',
      result: {
        depth: 20,
        lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4', 'e5'] }],
      },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /e4/ })).toHaveTextContent(/opens lines/i);
  });

  it('withholds quality badges and ideas while the search is still running', () => {
    // classifyMove compares one line against another, which only means
    // something at equal depth. Stockfish emits multipv 1,2,3 per iteration,
    // so mid-search there is always a render where lines[0] is a full
    // iteration deeper than lines[1..2] — and the lower candidates flash
    // through "Mistake"/"Blunder" before settling. The rail must not show a
    // band it cannot yet stand behind.
    analysis.value = {
      status: 'analyzing',
      result: {
        depth: 20,
        lines: [
          { san: 'e4', cp: 30, mate: null, pv: ['e4'] },
          { san: 'a3', cp: -80, mate: null, pv: ['a3'] },
        ],
      },
    } as never;

    render(<CandidateRail />);

    expect(screen.getByRole('button', { name: /^e4/ })).toBeInTheDocument();
    expect(screen.queryByText('Mistake')).not.toBeInTheDocument();
    expect(screen.queryByText('Best move')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^e4/ })).not.toHaveTextContent(/centre|center/i);
  });

  it('shows a quality badge relative to the best move', () => {
    analysis.value = {
      status: 'idle',
      result: {
        depth: 20,
        lines: [
          { san: 'e4', cp: 30, mate: null, pv: ['e4'] },
          { san: 'a3', cp: -80, mate: null, pv: ['a3'] },
        ],
      },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByText('Best move')).toBeInTheDocument();
    // 110cp worse than the best move lands in the "mistake" band.
    expect(screen.getByText('Mistake')).toBeInTheDocument();
  });

  it('still renders the candidate when the explainer cannot describe it', () => {
    // A move the rules have nothing to say about must not blank the row.
    analysis.value = {
      status: 'idle',
      result: { depth: 20, lines: [{ san: 'a3', cp: 5, mate: null, pv: ['a3'] }] },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /a3/ })).toBeInTheDocument();
  });

  describe('the authored comparison at a checkpoint', () => {
    // The Italian's Bc4 is the only move in the corpus carrying
    // `alternatives`, and it is also a checkpoint. Stockfish 18 at depth 18
    // ranks this position Bb5, d4, Bc4 — so the two authored alternatives are
    // in the lines, and neither of them is the answer.
    function atTheBishopCheckpoint() {
      useLessonStore.getState().startLesson('italian-game');
      for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) useTreeStore.getState().playMove(san);
      analysis.value = {
        status: 'idle',
        result: {
          depth: 18,
          lines: [
            { san: 'Bb5', cp: 42, mate: null, pv: ['Bb5', 'a6'] },
            { san: 'd4', cp: 36, mate: null, pv: ['d4', 'exd4'] },
            { san: 'Bc4', cp: 31, mate: null, pv: ['Bc4', 'Nf6'] },
          ],
        },
      } as never;
    }

    it('offers the comparison the lesson authored, over the alternatives rather than the engine ordering', async () => {
      atTheBishopCheckpoint();
      render(<CandidateRail />);

      await userEvent.click(screen.getByRole('button', { name: /compare bb5 and d4/i }));
      // Authored pros, not the heuristic ones compareLines would invent.
      // The verdict never quotes them (compare.test.ts asserts that
      // directly), so each renders exactly once.
      expect(screen.getByText(/applies long-term pressure/i)).toBeInTheDocument();
      expect(screen.getByText(/opens lines for your pieces straight away/i)).toBeInTheDocument();
    });

    it('still hides the candidate rows, the scores and the answer itself', () => {
      atTheBishopCheckpoint();
      render(<CandidateRail />);

      expect(screen.queryByRole('button', { name: /^Bb5/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^d4/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/\+0\.42/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Bc4/)).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/hidden while the lesson/i);
    });

    it('never offers a comparison that includes the accepted answer', () => {
      useLessonStore.getState().startLesson('italian-game');
      for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) useTreeStore.getState().playMove(san);
      // A shallower search that has Bc4 in it: Bc4 is authored nowhere, but
      // guard the ordering anyway — only one eligible line is left, so there
      // is nothing to compare.
      analysis.value = {
        status: 'idle',
        result: {
          depth: 8,
          lines: [
            { san: 'Bc4', cp: 40, mate: null, pv: ['Bc4'] },
            { san: 'Bb5', cp: 38, mate: null, pv: ['Bb5'] },
          ],
        },
      } as never;

      render(<CandidateRail />);
      expect(screen.queryByRole('button', { name: /compare/i })).not.toBeInTheDocument();
    });

    it('excludes an alternative whose SAN the checkpoint also accepts from the comparison pair', () => {
      // d4 is both an accepted answer and an authored alternative — the only
      // way to exercise the `!checkpoint.accept.includes(...)` clause, since
      // no lesson in the real corpus has that overlap. Without the clause,
      // eligible would be [d4, c4] and the button would read "Compare d4 and
      // c4", offering the accepted answer as one half of the comparison.
      useLessonStore.getState().startLesson('overlapping-accept-test');
      analysis.value = {
        status: 'idle',
        result: {
          depth: 18,
          lines: [
            { san: 'd4', cp: 40, mate: null, pv: ['d4'] },
            { san: 'c4', cp: 35, mate: null, pv: ['c4'] },
          ],
        },
      } as never;

      render(<CandidateRail />);
      expect(screen.queryByRole('button', { name: /compare/i })).not.toBeInTheDocument();
    });

    it('offers no comparison at a checkpoint whose move authored no alternatives', () => {
      // The Italian's opening checkpoint (e4) carries none.
      useLessonStore.getState().startLesson('italian-game');
      analysis.value = {
        status: 'idle',
        result: {
          depth: 18,
          lines: [
            { san: 'e4', cp: 31, mate: null, pv: ['e4'] },
            { san: 'd4', cp: 28, mate: null, pv: ['d4'] },
          ],
        },
      } as never;

      render(<CandidateRail />);
      expect(screen.queryByRole('button', { name: /compare/i })).not.toBeInTheDocument();
    });
  });

  it('hides engine suggestions for the whole of an opening lesson, not only while a checkpoint is pending', () => {
    // After answering the opening checkpoint correctly, the position sits at
    // ply 1 with nothing pending — Black's reply carries no checkpoint of its
    // own — exactly the opponent's-turn / auto-play window whose engine
    // suggestions must not flash on screen and hand over the next answer.
    useLessonStore.getState().startLesson('italian-game');
    useTreeStore.getState().playMove('e4');
    analysis.value = {
      status: 'idle',
      result: { depth: 20, lines: [{ san: 'e5', cp: -20, mate: null, pv: ['e5'] }] },
    } as never;

    render(<CandidateRail />);
    expect(screen.queryByRole('button', { name: /^e5/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('hides engine suggestions while a checkpoint is pending', () => {
    useLessonStore.getState().startLesson('italian-game');
    analysis.value = {
      status: 'idle',
      result: { depth: 20, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    expect(screen.queryByRole('button', { name: /^e4/ })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/hidden while the lesson/i);
  });

  it('keeps the hint control mounted, through CandidateRail itself, while a checkpoint answer is being graded', async () => {
    // Regression: CandidateRail used to gate CheckpointPanel on
    // state.pendingCheckpoint alone. pendingCheckpoint and attemptedCheckpoint
    // are mutually exclusive by construction, so the moment a wrong move goes
    // off-script, pendingCheckpoint goes null and this fell through to the
    // ordinary candidate list — CheckpointPanel, built to handle grading via
    // attemptedCheckpoint, never got mounted at all. Rendering through
    // CandidateRail's real mount gate (not CheckpointPanel directly) is the
    // point: CheckpointPanel.test.tsx alone could not have caught this.
    useLessonStore.getState().startLesson('italian-game');
    useTreeStore.getState().playMove('a3'); // wrong move at the e4 checkpoint
    analysis.value = {
      status: 'idle',
      result: { depth: 20, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    expect(screen.getByRole('button', { name: /^hint$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^e4/ })).not.toBeInTheDocument();
  });

  describe('a checkpoint does not depend on the engine', () => {
    // Regression (whole-branch review C1): CheckpointPanel is mounted only by
    // this component, and the mount gate used to sit *below* the unavailable
    // and thinking early returns. With no engine the lesson was unanswerable —
    // no prompt, no hints — while LessonRail's wrong-answer reply went on
    // naming a Hint control that was not on screen. The prompt and the hint
    // ladder are lesson content; they must not be gated on a search.
    it('asks the question and offers a hint while the engine is unavailable', () => {
      useLessonStore.getState().startLesson('italian-game');
      analysis.value = { result: null, status: 'unavailable', retry: () => {} } as never;

      render(<CandidateRail />);
      expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^hint$/i })).toBeInTheDocument();
    });

    it('asks the question and offers a hint while the first search is still running', () => {
      useLessonStore.getState().startLesson('italian-game');
      analysis.value = { result: null, status: 'analyzing', retry: () => {} } as never;

      render(<CandidateRail />);
      expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^hint$/i })).toBeInTheDocument();
      expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument();
    });

    it('keeps the retry affordance at a checkpoint when the engine is unavailable', async () => {
      const retry = vi.fn();
      useLessonStore.getState().startLesson('italian-game');
      analysis.value = { result: null, status: 'unavailable', retry } as never;

      render(<CandidateRail />);
      await userEvent.click(screen.getByRole('button', { name: /retry/i }));
      expect(retry).toHaveBeenCalledTimes(1);
    });

    it('drops the authored comparison, not the question, when there is no analysis to draw one from', () => {
      // The Bc4 checkpoint is the one that carries authored alternatives, so
      // it is the case where the comparison has something to lose.
      useLessonStore.getState().startLesson('italian-game');
      for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) useTreeStore.getState().playMove(san);
      analysis.value = { result: null, status: 'unavailable', retry: () => {} } as never;

      render(<CandidateRail />);
      expect(screen.getByText(/most aggressive square/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /compare/i })).not.toBeInTheDocument();
    });

    it('subscribes to the analysis once at a checkpoint, not twice', () => {
      // "One search, three lines." CheckpointPanel used to call useAnalysis()
      // itself, so reaching a checkpoint put two `go depth 20` searches on the
      // same FEN — the second aborting the first, straight through the
      // engine's abort/drain path — for one set of lines. The panel takes the
      // rail's `result` as a prop instead. The hook is mocked in every suite
      // that renders these components, so counting subscriptions is the only
      // place this is visible without a real worker.
      useLessonStore.getState().startLesson('italian-game');
      analysis.value = {
        status: 'idle',
        result: { depth: 20, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
        retry: () => {},
      } as never;
      analysis.calls = 0;

      render(<CandidateRail />);
      expect(analysis.calls).toBe(1);
    });

    // The invariant this branch already broke once (Task 5) and broke again
    // through a different gate: the reply must not name a control the player
    // cannot see. It spans two components, so it is asserted across both —
    // rendering CheckpointPanel directly would never exercise the mount gate,
    // which is exactly how C1 got through.
    it('never names a hint the player cannot take, even with the engine unavailable', () => {
      useLessonStore.getState().startLesson('italian-game');
      useTreeStore.getState().playMove('a3'); // wrong answer at the e4 checkpoint
      analysis.value = { result: null, status: 'unavailable', retry: () => {} } as never;

      render(
        <>
          <LessonRail />
          <CandidateRail />
        </>,
      );

      const reply = screen.getByText(/not this time/i);
      expect(reply).toHaveTextContent(/hint/i);
      expect(screen.getByRole('button', { name: /^hint$/i })).toBeInTheDocument();
    });
  });
});
