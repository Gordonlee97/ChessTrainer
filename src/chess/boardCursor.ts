import { Chess } from 'chess.js';

const FILES = 'abcdefgh';

export type CursorKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/** Board-space deltas from White's point of view: [file, rank]. */
const DELTAS: Record<CursorKey, [number, number]> = {
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/**
 * Moves the cursor one square in the direction the player pressed, as seen
 * on screen.
 *
 * `orientation` is not decoration. The board flips for a lesson played as
 * Black — `Board.tsx` derives it from the active lesson's segment, and it can
 * change mid-lesson — and when it is flipped, screen-up is board-down. A
 * cursor that ignores this is correct for every White lesson and wrong for
 * every Black one.
 *
 * Movement clamps at the edge rather than wrapping: wrapping from h-file to
 * a-file reads as the cursor teleporting.
 */
export function moveCursor(
  square: string,
  key: CursorKey,
  orientation: 'white' | 'black',
): string {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  if (file < 0 || Number.isNaN(rank) || rank < 0 || rank > 7) return square;

  const [df, dr] = DELTAS[key];
  const sign = orientation === 'black' ? -1 : 1;

  const nextFile = Math.min(7, Math.max(0, file + df * sign));
  const nextRank = Math.min(7, Math.max(0, rank + dr * sign));

  return `${FILES[nextFile]}${nextRank + 1}`;
}

const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/**
 * A square and its occupant, phrased for a screen reader: "e2, white pawn".
 * Colour is spelled out rather than implied, because the spec forbids
 * signalling anything by colour alone.
 */
export function describeSquare(fen: string, square: string): string {
  const piece = new Chess(fen).get(square as never);
  if (!piece) return `${square}, empty`;
  return `${square}, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}`;
}
