import { useEffect, useRef, useState } from 'react';
import { useActiveLesson, useLessonStore } from '../lesson/store';
import { useSelectedNode } from '../tree/store';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** How long the check stays on screen before retiring itself. */
const CORRECT_MARK_MS = 900;

/** The correct mark, tracked locally so it can be hidden the instant the
 * player leaves the node it landed on — see the component doc. */
interface CorrectMark {
  atNodeId: string;
  key: number;
}

/**
 * A brief mark centred over the board: a check for an accepted checkpoint
 * answer, a cross for a rejected one. Decorative and purely visual — the
 * same information is already read out by `CheckpointPanel`'s `role="status"`
 * text, hence `aria-hidden`.
 *
 * Both events are read directly from the lesson store rather than inferred
 * from a transition in derived state. An earlier version of this component
 * inferred "correct" from the pending checkpoint's id changing across a
 * render — which also changes on *pure navigation* (stepping back to an
 * earlier position derives a different pending checkpoint there too), firing
 * a false check mark for a move the player never made. `lastAcceptance` (see
 * `lesson/store.ts`) exists precisely so this component has something true to
 * read instead of something to guess from.
 *
 * The two kinds are not symmetric, because what they represent isn't:
 *
 * - The cross mirrors `CheckpointPanel`'s "Try again" text exactly — visible
 *   for as long as `lastRejection` is unresolved *at the current node*, which
 *   is a standing fact about that position (the player really did get it
 *   wrong there and hasn't fixed it), so it is fine for it to reappear if the
 *   player leaves and comes back without solving it.
 * - The check has no such standing-fact reading — nothing else treats
 *   "correct" as an ongoing state of a position, only as a moment. So unlike
 *   the store's `lastRejection`, `lastAcceptance` is never cleared on success
 *   or navigation (nothing needs it to be), which means this component has to
 *   supply the "moment, not a fact" behaviour itself: `lastAcceptance` is
 *   read by object identity, not just `atNodeId` — `noteAcceptance` creates a
 *   fresh object every call, so only the render immediately after a genuine
 *   call counts as fresh — *and* the check is actively hidden as soon as the
 *   current node stops being the one it landed on, rather than lingering
 *   until some future event happens to replace it. Without both halves,
 *   stepping away and back (e.g. via the moves table) resurrects a check mark
 *   for an answer that was not just given.
 *
 * The check also retires itself on a timer. Leaving it to the node change
 * alone made it depend on autoplay for its cleanup: mid-lesson the opponent's
 * reply moved the node 700ms later and took the mark with it, but wherever
 * autoplay does not run — the last player move of a segment, and every move
 * of a theme lesson — nothing ever cleared it and the "brief" mark became
 * permanent. The cross needs no timer: it is tied to `lastRejection` at this
 * node, so answering correctly clears it (`Board` calls `clearRejection`) and
 * answering wrongly again replaces it.
 */
export function MoveFeedback() {
  const activeLesson = useActiveLesson();
  const node = useSelectedNode();
  const lastRejection = useLessonStore((store) => store.lastRejection);
  const lastAcceptance = useLessonStore((store) => store.lastAcceptance);

  const wrongHere = lastRejection?.atNodeId === node.id;
  const wrongSequence = useRef(0);
  const seenRejection = useRef(lastRejection);
  useEffect(() => {
    if (lastRejection !== seenRejection.current) wrongSequence.current += 1;
    seenRejection.current = lastRejection;
  }, [lastRejection]);

  const [correctMark, setCorrectMark] = useState<CorrectMark | null>(null);
  const correctSequence = useRef(0);
  const seenAcceptance = useRef(lastAcceptance);

  useEffect(() => {
    const freshAcceptance =
      lastAcceptance !== null &&
      lastAcceptance !== seenAcceptance.current &&
      lastAcceptance.atNodeId === node.id;

    if (freshAcceptance) {
      correctSequence.current += 1;
      setCorrectMark({ atNodeId: node.id, key: correctSequence.current });
    } else {
      // Hide as soon as the current node stops matching where the mark's
      // acceptance landed — this is what stops a later revisit (with no
      // fresh acceptance) from turning it back on via `correctHere` below.
      setCorrectMark((current) => (current && current.atNodeId !== node.id ? null : current));
    }

    seenAcceptance.current = lastAcceptance;
  }, [node.id, lastAcceptance]);

  /**
   * Retire the check after a beat. Keyed on the mark's own sequence number so
   * a replacement mark restarts the clock rather than inheriting the previous
   * one's remaining time, and cleared on unmount so a pending timeout can
   * never hide a mark that has just appeared.
   *
   * This runs under `prefers-reduced-motion` too: that setting suppresses the
   * animation, not the feedback, and a mark that never leaves is a worse
   * outcome than one that leaves without animating.
   */
  useEffect(() => {
    if (!correctMark) return;
    const timer = setTimeout(() => setCorrectMark(null), CORRECT_MARK_MS);
    return () => clearTimeout(timer);
  }, [correctMark?.key]);

  if (!activeLesson) return null;

  const correctHere = correctMark !== null && correctMark.atNodeId === node.id;
  if (!wrongHere && !correctHere) return null;

  // A wrong answer at the same node a past correct one landed on (two
  // checkpoints back to back, the second missed) shows the current problem,
  // not a stale celebration — same priority CheckpointPanel's own text gives
  // the unresolved attempt.
  const kind = wrongHere ? 'wrong' : 'correct';
  const key = wrongHere ? wrongSequence.current : correctMark!.key;

  return (
    <div className="move-feedback" aria-hidden="true">
      <span
        key={key}
        className={
          prefersReducedMotion
            ? `move-feedback-mark move-feedback-mark--${kind} move-feedback-mark--static`
            : `move-feedback-mark move-feedback-mark--${kind}`
        }
      >
        {kind === 'correct' ? '✓' : '✕'}
      </span>
    </div>
  );
}
