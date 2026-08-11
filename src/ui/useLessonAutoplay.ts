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

    // Only at the tip of the line, so stepping back with Breadcrumb to
    // review a position doesn't get dragged forward again.
    if (selectedNode.childIds.length !== 0) return;

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
