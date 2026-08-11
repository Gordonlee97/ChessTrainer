import { Chess } from 'chess.js';

/**
 * Whose turn it is, in the vocabulary the lesson schema uses ('white' /
 * 'black') rather than chess.js's 'w' / 'b'.
 *
 * This exists so nothing has to infer whose move it is by counting plies. A
 * segment may declare a `startFen` where it is Black to move, and a segment
 * may override its lesson's `side`, so index parity is wrong in exactly the
 * cases that matter.
 */
export function sideToMove(fen: string): 'white' | 'black' {
  return new Chess(fen).turn() === 'w' ? 'white' : 'black';
}
