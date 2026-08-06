import type { Checkpoint, LessonMove, Segment } from '../content/schema';

export interface LessonState {
  /** How many of the lesson's moves the path followed before diverging (or in full). */
  ply: number;
  /** True once the path has left the authored line. Not an error — see the spec. */
  offScript: boolean;
  /** The move the lesson wants next, or null when the line is finished. */
  nextMove: LessonMove | null;
  /** Set when `nextMove` carries a checkpoint, so the UI can ask instead of tell. */
  pendingCheckpoint: Checkpoint | null;
  /** True once every authored move has been followed. */
  complete: boolean;
}

/**
 * Works out where in a lesson a path of played moves puts you.
 *
 * The runner deliberately stores nothing: the game tree is the source of truth
 * for position, and this re-derives from it. That is why branching off a lesson
 * and returning needs no special handling — the path changes and the answer
 * changes with it.
 */
export function deriveLessonState(segment: Segment, pathSan: string[]): LessonState {
  let ply = 0;
  while (ply < pathSan.length && ply < segment.moves.length && pathSan[ply] === segment.moves[ply].san) {
    ply += 1;
  }

  const offScript = ply < pathSan.length;
  const complete = ply === segment.moves.length;
  const nextMove = complete ? null : segment.moves[ply];

  return {
    ply,
    offScript,
    nextMove,
    // While off script the lesson is not asking for anything — the player is exploring.
    pendingCheckpoint: !offScript && nextMove?.checkpoint ? nextMove.checkpoint : null,
    complete,
  };
}
