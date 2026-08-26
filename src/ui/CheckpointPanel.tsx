import { useEffect, useMemo, useState } from 'react';
import type { Alternative } from '../content/schema';
import type { EvalResult } from '../engine/types';
import type { AuthoredContrastPair } from '../explain/compare';
import { askingCheckpoint, useActiveLesson, useLessonStore } from '../lesson/store';
import { sounds } from '../sound';
import { useSelectedNode } from '../tree/store';
import { Button } from './Button';
import { CompareDrawer } from './CompareDrawer';
import { EngineUnavailableNotice } from './EngineUnavailableNotice';
import type { AnalysisStatus } from './useAnalysis';

/**
 * The authored pros and cons for a pair of moves, or undefined when the
 * lesson has nothing to say about either — in which case the drawer renders
 * its five contrast rows with no authored prose alongside them. Pros/cons
 * are authored-only since the compare-contrast-vocabulary change;
 * `compareLines` no longer derives a heuristic fallback for them.
 */
function authoredContrastFor(
  alternatives: Alternative[] | undefined,
  aSan: string,
  bSan: string,
): AuthoredContrastPair | undefined {
  if (!alternatives) return undefined;
  const find = (san: string) => alternatives.find((entry) => entry.san === san);
  const a = find(aSan);
  const b = find(bSan);
  if (!a && !b) return undefined;
  return {
    a: a ? { pros: a.pros, cons: a.cons } : undefined,
    b: b ? { pros: b.pros, cons: b.cons } : undefined,
  };
}

interface CheckpointPanelProps {
  /**
   * The analysis `CandidateRail` already has. Passed down rather than fetched
   * with a second `useAnalysis()`: two hooks on the same FEN meant two
   * `go depth 20` searches per checkpoint, the second aborting the first —
   * against this project's "one search, three lines" rule, and straight
   * through the engine's abort/drain path for nothing.
   *
   * Null whenever the engine has nothing to offer (unavailable, or a search
   * that has not produced a line yet). That must cost the player the
   * comparison and nothing else.
   */
  result: EvalResult | null;
  status: AnalysisStatus;
  onRetry: () => void;
}

/**
 * What the candidate rail shows in its place while a lesson checkpoint is
 * being asked — pending, or under grading after an off-book answer (see
 * `askingCheckpoint`): why the engine lines are not there, the hint ladder
 * for the question being asked, and — when the lesson's alternatives and the
 * analysis together make one available — a comparison drawn from authored
 * content rather than the engine's own ordering. Renders nothing when no
 * checkpoint is being asked.
 *
 * The prompt and the hint ladder never depend on the engine. This panel is
 * mounted above `CandidateRail`'s engine-status returns precisely so that a
 * dead or still-thinking engine cannot make a lesson unanswerable.
 */
export function CheckpointPanel({ result, status, onRetry }: CheckpointPanelProps) {
  const activeLesson = useActiveLesson();
  const hintsShown = useLessonStore((store) => store.hintsShown);
  const revealHint = useLessonStore((store) => store.revealHint);
  const lastRejection = useLessonStore((store) => store.lastRejection);
  const node = useSelectedNode();
  const [comparing, setComparing] = useState(false);

  /**
   * The rejection to report, scoped to the node it happened at — the same
   * guard `lastRejection.atNodeId` exists for (see `lesson/store.ts`): a
   * stale attempt from a position the player has since left must not follow
   * them here.
   */
  const rejectionHere =
    lastRejection && lastRejection.atNodeId === node.id ? lastRejection : null;

  // Without this, leaving the drawer open and navigating to a position with
  // fewer than 2 candidates (which unmounts it) and then back to one with 2+
  // silently reopens it with no click — a comparison the player never asked
  // for, attached to whatever position they've now landed on.
  useEffect(() => {
    setComparing(false);
  }, [node.id]);

  const alternatives = activeLesson?.state.nextMove?.alternatives;

  /**
   * The question currently in front of the player — see `askingCheckpoint`
   * for why this isn't just `state.pendingCheckpoint`. `CandidateRail` calls
   * the same function to decide whether to mount this component at all; if
   * the two ever used different derivations again, one of them would gate on
   * a checkpoint the other didn't think existed.
   */
  const asking = askingCheckpoint(activeLesson);
  const revealed = asking ? (hintsShown[asking.id] ?? 0) : 0;

  /**
   * The comparison offered while a checkpoint is being asked (pending or
   * under grading — see `asking` above).
   *
   * Every move in the corpus that carries `alternatives` is also a
   * checkpoint, so without this the authored contrast was unreachable: the
   * rail hides itself at a checkpoint, and stepping off the line to un-hide
   * it moves the position past the move the alternatives belong to.
   *
   * The constraint is that the engine must not leak the answer, not that
   * comparison is forbidden — so the pair here is chosen from the authored
   * alternatives found among the lines, never from the engine's ordering,
   * and any line the checkpoint would accept is excluded (`checkpoint.accept`
   * — regression-tested in CheckpointPanel.test.tsx: an alternative whose SAN
   * is also an accepted answer must never appear in the pair). What the
   * player sees is two moves the lesson itself wanted contrasted, neither of
   * which is the answer.
   */
  const checkpointComparison = useMemo(() => {
    if (!asking || !alternatives || !result) return null;
    const eligible = result.lines.filter(
      (line) => alternatives.some((entry) => entry.san === line.san) && !asking.accept.includes(line.san),
    );
    if (eligible.length < 2) return null;
    const [a, b] = eligible;
    return { a, b, authored: authoredContrastFor(alternatives, a.san, b.san) };
  }, [asking, alternatives, result]);

  if (!asking) return null;

  return (
    <section aria-label="Candidate moves">
      {/*
        With the engine down there are no suggestions to hide, and the rail's
        own notice is unreachable while this panel stands in its place — so
        the retry comes along rather than being stranded behind the question.
      */}
      {status === 'unavailable' ? (
        <EngineUnavailableNotice onRetry={onRetry} />
      ) : (
        <p
          role="status"
          style={{
            padding: 12,
            margin: 0,
            borderRadius: 'var(--radius)',
            border: '2px solid var(--border)',
            fontSize: 13,
          }}
        >
          Engine suggestions are hidden while the lesson is asking you for a move.
          {rejectionHere && (
            <>
              {' '}
              {rejectionHere.grade.kind === 'near-miss' ? rejectionHere.grade.reply : 'Try again.'}
            </>
          )}
        </p>
      )}
      <div>
        <p style={{ fontSize: 14, fontWeight: 700 }}>{asking.prompt}</p>

        <ol style={{ fontSize: 13, paddingLeft: 18 }}>
          {asking.hints.slice(0, revealed).map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ol>

        {revealed < asking.hints.length && (
          <Button
            variant="ghost"
            sound={false}
            onClick={() => {
              revealHint(asking.id);
              sounds.play('hint');
            }}
          >
            Hint
          </Button>
        )}
      </div>
      {checkpointComparison && (
        <>
          <Button
            variant="secondary"
            style={{ width: '100%', marginTop: 8 }}
            onClick={() => setComparing((open) => !open)}
          >
            {comparing
              ? 'Hide comparison'
              : `Compare ${checkpointComparison.a.san} and ${checkpointComparison.b.san}`}
          </Button>
          {comparing && (
            <CompareDrawer
              a={checkpointComparison.a}
              b={checkpointComparison.b}
              baseFen={node.fen}
              onClose={() => setComparing(false)}
              authored={checkpointComparison.authored}
            />
          )}
        </>
      )}
    </section>
  );
}
