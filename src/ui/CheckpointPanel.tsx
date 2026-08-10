import { useEffect, useMemo, useState } from 'react';
import type { Alternative } from '../content/schema';
import type { AuthoredContrastPair } from '../explain/compare';
import { useActiveLesson, useLessonStore } from '../lesson/store';
import { useSelectedNode } from '../tree/store';
import { Button } from './Button';
import { CompareDrawer } from './CompareDrawer';
import { useAnalysis } from './useAnalysis';

/**
 * The authored pros and cons for a pair of moves, or undefined when the
 * lesson has nothing to say about either — in which case `compareLines`
 * falls back to its own heuristic summary.
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

/**
 * What the candidate rail shows in its place while a lesson checkpoint is
 * pending: the notice that engine suggestions are hidden, the hint ladder for
 * the question being asked, and — when the lesson's alternatives make one
 * available — a comparison drawn from authored content rather than the
 * engine's own ordering.
 */
export function CheckpointPanel() {
  const activeLesson = useActiveLesson();
  const hintsShown = useLessonStore((store) => store.hintsShown);
  const revealHint = useLessonStore((store) => store.revealHint);
  const { result } = useAnalysis();
  const node = useSelectedNode();
  const [comparing, setComparing] = useState(false);

  // Without this, leaving the drawer open and navigating to a position with
  // fewer than 2 candidates (which unmounts it) and then back to one with 2+
  // silently reopens it with no click — a comparison the player never asked
  // for, attached to whatever position they've now landed on.
  useEffect(() => {
    setComparing(false);
  }, [node.id]);

  const alternatives = activeLesson?.state.nextMove?.alternatives;

  /**
   * The comparison offered while a checkpoint is pending.
   *
   * Every move in the corpus that carries `alternatives` is also a
   * checkpoint, so without this the authored contrast was unreachable: the
   * rail hides itself at a checkpoint, and stepping off the line to un-hide
   * it moves the position past the move the alternatives belong to.
   *
   * The constraint is that the engine must not leak the answer, not that
   * comparison is forbidden — so the pair here is chosen from the authored
   * alternatives found among the lines, never from the engine's ordering,
   * and any line the checkpoint would accept is excluded. What the player
   * sees is two moves the lesson itself wanted contrasted, neither of which
   * is the answer.
   */
  const checkpointComparison = useMemo(() => {
    const checkpoint = activeLesson?.state.pendingCheckpoint;
    if (!checkpoint || !alternatives || !result) return null;
    const eligible = result.lines.filter(
      (line) =>
        alternatives.some((entry) => entry.san === line.san) && !checkpoint.accept.includes(line.san),
    );
    if (eligible.length < 2) return null;
    const [a, b] = eligible;
    return { a, b, authored: authoredContrastFor(alternatives, a.san, b.san) };
  }, [activeLesson, alternatives, result]);

  /**
   * The question currently in front of the player. Normally the pending
   * checkpoint; while an answer is being graded `pendingCheckpoint` is null
   * (the path has left the line), but the question — and the hints for it —
   * must stay on screen, because the reply beside them talks about taking a
   * hint.
   */
  const asking = activeLesson?.state.pendingCheckpoint ?? activeLesson?.attemptedCheckpoint;
  const revealed = asking ? (hintsShown[asking.id] ?? 0) : 0;

  return (
    <section aria-label="Candidate moves">
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
      </p>
      {asking && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 700 }}>{asking.prompt}</p>

          <ol style={{ fontSize: 13, paddingLeft: 18 }}>
            {asking.hints.slice(0, revealed).map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ol>

          {revealed < asking.hints.length && (
            <Button variant="ghost" onClick={() => revealHint(asking.id)}>
              Hint
            </Button>
          )}
        </div>
      )}
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
