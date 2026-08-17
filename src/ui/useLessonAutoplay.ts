import { useEffect } from 'react';
import { resolveSan } from '../chess/resolveDrop';
import { sideToMove } from '../chess/side';
import { useActiveLesson, useLessonStore } from '../lesson/store';
import { sounds } from '../sound';
import { useTreeStore } from '../tree/store';

/** How long to wait before the opponent's reply appears on the board. */
const AUTOPLAY_DELAY_MS = 700;

/**
 * Plays the opponent's reply automatically once the player has answered.
 *
 * Renders nothing — this is a behaviour hook, called once from `App`.
 *
 * `useActiveLesson()` re-derives from the game tree on every call and never
 * has stable identity, so it cannot sit in a dependency array (see the long
 * comment on `LessonRail`'s recording effect, which explains the same
 * constraint). The fix used there — put `active` in the deps and rely on a
 * store-side dedupe key — does not work for a *timer*: re-running the effect
 * on every render would clear and restart the 700ms wait indefinitely. So
 * this effect is keyed on primitives only (`lessonId`, `segmentIndex`,
 * `selectedId`) and reads `active` from the render closure inside the effect
 * body — correct because React always runs the effect function from the same
 * render that produced the deps triggering it, so `active` is exactly as
 * fresh as the primitives that fired the effect.
 */
export function useLessonAutoplay(): void {
  const active = useActiveLesson();
  const lessonId = useLessonStore((store) => store.lessonId);
  const segmentIndex = useLessonStore((store) => store.segmentIndex);
  const selectedId = useTreeStore((store) => store.tree.selectedId);

  useEffect(() => {
    if (!active) return;
    const { lesson, segment, state } = active;

    // Openings only. A theme lesson attaches a note to every move and paces
    // itself with "Play the next move", so the player reads before advancing;
    // autoplay would replace their note with the opponent's 700ms later,
    // whether or not they had finished. The spec says twice that theme
    // lessons are unchanged, and this is the guard that keeps that true —
    // every other surface gates on `kind === 'opening'` (CandidateRail's
    // hand-off to CheckpointPanel, LessonRail's button) and this one was
    // written before that question had been asked.
    if (lesson.kind !== 'opening') return;

    // Only when the line has a move left to give and the path hasn't left it
    // — off-script means the player is exploring, not answering.
    if (state.complete || state.offScript || !state.nextMove) return;

    const tree = useTreeStore.getState().tree;
    const selectedNode = tree.nodes[tree.selectedId];

    // Only the side that is not the player's moves itself. Never inferred
    // from "this move has no checkpoint" -- the content is still half
    // written, and that inference would play the player's own moves for them.
    const playerSide = segment.side ?? lesson.side;
    if (sideToMove(selectedNode.fen) === playerSide) return;

    // Only when the player got here by *playing* a move, so stepping back
    // with the moves table to review a position doesn't get dragged forward
    // again.
    //
    // This was a tip-of-the-line check (`childIds.length !== 0`) until
    // 2026-08-13. That stood in for the same idea and got the review case
    // right, but it also caught a case it was never meant to: replaying a move
    // the player had already played. `insertMove` reuses the node, so the
    // arrival node already had the opponent's reply as a child and looked
    // exactly like a position being reviewed — autoplay declined, and since it
    // was then not the player's turn, `CheckpointPanel` had nothing to render
    // either. The lesson stopped dead with a blank rail. `lastPlayedId` (see
    // `tree/store.ts`) records the transition rather than inferring it from
    // the destination, which is what the two cases actually differ in.
    //
    // That fix alone regressed with the moves table's `next`/`last` controls,
    // which reach a position with `selectNode` — clearing `lastPlayedId` even
    // when a reply is still owed there. So the rule is a union, not a
    // replacement: fire when the player moved here *or* when the node is a
    // genuine tip with no child at all. Restoring the old tip-of-the-line
    // check as the second half is safe this time, because it is only ever
    // reached after the arrival-by-move check has already failed — a node
    // stepped back to for review always has a child (it is, by definition,
    // not the end of the line), so the review case stays protected by the
    // first half being false and this half also being false there.
    const arrivedByMove = useTreeStore.getState().lastPlayedId === selectedNode.id;
    const childlessTip = selectedNode.childIds.length === 0;
    if (!arrivedByMove && !childlessTip) return;

    const san = state.nextMove.san;
    const timer = setTimeout(() => {
      // Reused verbatim from LessonRail.playNextMove: resolve the SAN for
      // its sound category before playing it, so autoplay sounds exactly
      // like a manual "Play the next move" click would.
      const currentTree = useTreeStore.getState().tree;
      const fen = currentTree.nodes[currentTree.selectedId].fen;
      const resolved = resolveSan(fen, san);
      const played = useTreeStore.getState().playMove(san);
      if (played && resolved) {
        sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound);
      }
    }, AUTOPLAY_DELAY_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `active` is
    // deliberately excluded; see the function-level comment.
  }, [lessonId, segmentIndex, selectedId]);
}
