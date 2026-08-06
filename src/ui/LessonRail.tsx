import { useActiveLesson, useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';
import { Button } from './Button';

export function LessonRail() {
  const active = useActiveLesson();
  const hintsShown = useLessonStore((store) => store.hintsShown);
  const lastGrade = useLessonStore((store) => store.lastGrade);
  const revealHint = useLessonStore((store) => store.revealHint);
  const stopLesson = useLessonStore((store) => store.stopLesson);
  const playMove = useTreeStore((store) => store.playMove);
  const selectNode = useTreeStore((store) => store.selectNode);
  const tree = useTreeStore((store) => store.tree);

  if (!active) return null;
  const { lesson, segment, state } = active;

  /**
   * Select the last node still on the lesson's line. `state.ply` counts the
   * moves that matched, and `pathTo` includes the root at index 0, so the node
   * after `ply` matching moves sits at index `ply`. The branch the player
   * explored stays in the tree — this only moves the selection.
   */
  function returnToLesson() {
    const path = pathTo(tree, tree.selectedId);
    const target = path[Math.min(state.ply, path.length - 1)];
    selectNode(target.id);
  }

  return (
    <section aria-label="Lesson" className="lesson-rail">
      <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>{lesson.title}</h2>

      {state.ply === 0 && segment.intro && (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{segment.intro}</p>
      )}

      {state.complete && !state.offScript && (
        <p style={{ fontSize: 14, fontWeight: 800 }}>Lesson complete — nicely done.</p>
      )}

      {state.offScript && (
        <>
          <p style={{ fontSize: 13 }}>
            You have stepped off the lesson line. Explore as long as you like — the lesson waits.
          </p>
          <Button variant="ghost" onClick={returnToLesson}>
            Return to the lesson
          </Button>
        </>
      )}

      {!state.offScript && state.pendingCheckpoint && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 700 }}>{state.pendingCheckpoint.prompt}</p>

          <ol style={{ fontSize: 13, paddingLeft: 18 }}>
            {state.pendingCheckpoint.hints.slice(0, hintsShown).map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ol>

          {hintsShown < state.pendingCheckpoint.hints.length && (
            <Button variant="ghost" onClick={revealHint}>
              Hint
            </Button>
          )}

          {lastGrade?.kind === 'near-miss' && (
            <p role="status" style={{ fontSize: 13 }}>
              {lastGrade.reply}
            </p>
          )}
          {lastGrade?.kind === 'wrong' && (
            <p role="status" style={{ fontSize: 13 }}>
              Not this time — try another move, or take a hint.
            </p>
          )}
        </div>
      )}

      {!state.offScript && !state.complete && !state.pendingCheckpoint && state.nextMove && (
        <>
          {state.ply > 0 && segment.moves[state.ply - 1]?.note && (
            <p style={{ fontSize: 13 }}>{segment.moves[state.ply - 1].note}</p>
          )}
          <Button onClick={() => playMove(state.nextMove!.san)}>Play the next move</Button>
        </>
      )}

      <Button variant="ghost" onClick={stopLesson}>
        Leave lesson
      </Button>
    </section>
  );
}
