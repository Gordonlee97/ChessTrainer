import { useEffect } from 'react';
import { resolveSan } from '../chess/resolveDrop';
import { useActiveLesson, useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { sounds } from '../sound';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';
import { Button } from './Button';

export function LessonRail() {
  const active = useActiveLesson();
  const hintsShown = useLessonStore((store) => store.hintsShown);
  const stopLesson = useLessonStore((store) => store.stopLesson);
  const nextSegment = useLessonStore((store) => store.nextSegment);
  const playMove = useTreeStore((store) => store.playMove);
  const selectNode = useTreeStore((store) => store.selectNode);
  const tree = useTreeStore((store) => store.tree);
  const noteAttempt = useProgressStore((store) => store.noteAttempt);
  const noteLessonComplete = useProgressStore((store) => store.noteLessonComplete);
  // `tree` is already selected above; reusing `tree.selectedId` rather than
  // adding a second `useTreeStore` subscription for the same underlying data.
  const selectedId = tree.selectedId;

  /**
   * Records checkpoint outcomes and lesson completion. This runs on every
   * render, deliberately: `useActiveLesson()` recomputes from the tree and
   * returns a fresh object each time, so `active` never has stable identity
   * and no dependency array can prevent re-runs. The dedupe key inside the
   * store — `${lessonId}:${checkpointId}:${nodeId}` — is what makes that
   * safe; a different wrong move is a different tree node, so each genuine
   * attempt still records exactly once. Do not "fix" this by memoising
   * `active`: a memo keyed on anything stable would go stale against the
   * tree, which is precisely the bug this design avoids.
   */
  useEffect(() => {
    if (!active) return;
    const { lesson, segment, state, attemptedCheckpoint, attemptedGrade, hasNextSegment } = active;

    // A graded attempt: the player answered, and it may or may not have been
    // accepted. `deriveLessonState` decides on/off-script by string equality
    // against the single canonical `san`, so a correct answer from a
    // multi-entry `accept` list still lands here — `attemptedGrade.kind`
    // is what tells the two apart.
    if (attemptedCheckpoint && attemptedGrade) {
      noteAttempt(
        lesson.id,
        attemptedCheckpoint.id,
        {
          solved: attemptedGrade.kind === 'correct',
          hintsUsed: hintsShown[attemptedCheckpoint.id] ?? 0,
        },
        `${lesson.id}:${attemptedCheckpoint.id}:${selectedId}`,
      );
      return;
    }

    // Solved: the path walked past a checkpoint-bearing move while on script.
    if (!state.offScript && state.ply > 0) {
      const passed = segment.moves[state.ply - 1]?.checkpoint;
      if (passed) {
        noteAttempt(
          lesson.id,
          passed.id,
          { solved: true, hintsUsed: hintsShown[passed.id] ?? 0 },
          `${lesson.id}:${passed.id}:${selectedId}`,
        );
      }
    }

    if (state.complete && !state.offScript && !hasNextSegment) {
      // `noteLessonComplete` dedupes internally because this effect re-runs
      // on every render while the lesson sits complete (see the comment
      // above) — the sound needs the same guard, checked before the call, or
      // it would replay on every one of those re-renders.
      const alreadyComplete = useProgressStore.getState().progress.lessons[lesson.id]?.completedAt;
      noteLessonComplete(lesson.id);
      if (!alreadyComplete) sounds.play('lessonComplete');
    }
  }, [active, hintsShown, selectedId, noteAttempt, noteLessonComplete]);

  if (!active) return null;
  const { lesson, segment, state, attemptedGrade, hasNextSegment } = active;

  /** The note attached to the move the lesson has just walked past. */
  const lastNote = !state.offScript && state.ply > 0 ? segment.moves[state.ply - 1]?.note : undefined;

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

  /**
   * Plays the lesson's next move with the same sound a drag or a candidate
   * click would make, rather than the generic button press — the board is
   * moving, so it should sound like the board moving.
   */
  function playNextMove(san: string) {
    const fen = tree.nodes[tree.selectedId].fen;
    const resolved = resolveSan(fen, san);
    const played = playMove(san);
    if (played && resolved) {
      sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound);
    }
  }

  return (
    <section aria-label="Lesson" className="lesson-rail">
      <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>{lesson.title}</h2>

      {state.ply === 0 && segment.intro && (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{segment.intro}</p>
      )}

      {/*
        The note belongs to the move just played, so it renders whenever the
        path is on the line past ply 0 — including when the next move carries
        a checkpoint (the note is usually what justifies the question) and
        when the line has finished (otherwise every lesson drops its last
        note).
      */}
      {lastNote && <p style={{ fontSize: 13 }}>{lastNote}</p>}

      {state.complete && !state.offScript && (
        <>
          <p style={{ fontSize: 14, fontWeight: 800 }}>
            {hasNextSegment ? 'That part is done — nicely played.' : 'Lesson complete — nicely done.'}
          </p>
          {hasNextSegment && <Button onClick={nextSegment}>Next part</Button>}
        </>
      )}

      {state.offScript && (
        <>
          {attemptedGrade?.kind === 'near-miss' ? (
            <p role="status" style={{ fontSize: 13 }}>
              {attemptedGrade.reply}
            </p>
          ) : attemptedGrade?.kind === 'wrong' ? (
            <p role="status" style={{ fontSize: 13 }}>
              Not this time — take a hint, or use Return to the lesson to go back and try again.
            </p>
          ) : (
            <p style={{ fontSize: 13 }}>
              You have stepped off the lesson line. Explore as long as you like — the lesson waits.
            </p>
          )}
          <Button variant="ghost" onClick={returnToLesson}>
            Return to the lesson
          </Button>
        </>
      )}

      {!state.offScript && !state.complete && !state.pendingCheckpoint && state.nextMove && (
        <Button onClick={() => playNextMove(state.nextMove!.san)} sound={false}>
          Play the next move
        </Button>
      )}

      <Button variant="ghost" onClick={stopLesson}>
        Leave lesson
      </Button>
    </section>
  );
}
