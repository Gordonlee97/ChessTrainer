import { Chess } from 'chess.js';

export type SoundCategory = 'quiet' | 'capture' | 'check';

export interface DropResolution {
  /** Standard Algebraic Notation of the resolved move. */
  san: string;
  /** Which sound category applies to this move. */
  sound: SoundCategory;
}

/**
 * Resolves a drag-and-drop move attempt against a FEN position.
 *
 * Returns `null` when `from` -> `to` is not a legal move in `fen`.
 *
 * Promotions always resolve to a queen. This app has no promotion picker, so
 * under-promotion is unreachable via drag and drop; auto-queen is the
 * deliberate, documented behavior here rather than an incidental
 * `promotion: 'q'` buried in a UI closure.
 *
 * The sound category is decided from chess.js's verbose move data, not by
 * string-matching the SAN. Specifically this checks `move.captured` (was a
 * piece actually captured), not `move.isCapture()` — chess.js's
 * `isCapture()` only tests the CAPTURE flag and reports `false` for en
 * passant captures, which set only the EP_CAPTURE flag, even though a pawn
 * was genuinely captured and the SAN correctly shows an 'x'. `captured` is
 * set in both cases, so it is the reliable signal. Check is tested on the
 * *resulting* position via `chess.isCheck()` after the move has been applied.
 */
export function resolveDrop(fen: string, from: string, to: string): DropResolution | null {
  const chess = new Chess(fen);

  let move;
  try {
    move = chess.move({ from, to, promotion: 'q' });
  } catch {
    return null;
  }

  const sound: SoundCategory = chess.isCheck() ? 'check' : move.captured ? 'capture' : 'quiet';

  return { san: move.san, sound };
}
