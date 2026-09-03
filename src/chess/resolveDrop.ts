import { Chess, type Move } from 'chess.js';

export type SoundCategory = 'quiet' | 'capture' | 'check' | 'checkmate';

export interface DropResolution {
  /** Standard Algebraic Notation of the resolved move. */
  san: string;
  /** Which sound category applies to this move. */
  sound: SoundCategory;
}

/**
 * Decides the sound category for a move already applied to `chess`.
 *
 * This is the one place that classifies capture/check, shared by resolveDrop
 * (drag-and-drop, which has from/to squares) and resolveSan (the candidate
 * rail, which only has SAN) so the classification logic is never duplicated.
 *
 * This checks `move.captured` (was a piece actually captured), not
 * `move.isCapture()` — chess.js's `isCapture()` only tests the CAPTURE flag
 * and reports `false` for en passant captures, which set only the
 * EP_CAPTURE flag, even though a pawn was genuinely captured and the SAN
 * correctly shows an 'x'. `captured` is set in both cases, so it is the
 * reliable signal. Check is tested on the *resulting* position via
 * `chess.isCheck()` after the move has been applied.
 *
 * Order matters, and checkmate is why. chess.js reports a mating move as
 * `isCheck()` too — mate *is* a check the opponent cannot answer — so testing
 * check first swallows every checkmate into the check sound, which is exactly
 * what this function did until 2026-09-02. A mating move is also frequently a
 * capture (Scholar's mate ends `Qxf7#`, which is all three at once), so
 * checkmate has to be tested ahead of both, not just ahead of check.
 */
function classifySound(chess: Chess, move: Move): SoundCategory {
  if (chess.isCheckmate()) return 'checkmate';
  return chess.isCheck() ? 'check' : move.captured ? 'capture' : 'quiet';
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
 */
export function resolveDrop(fen: string, from: string, to: string): DropResolution | null {
  const chess = new Chess(fen);

  let move;
  try {
    move = chess.move({ from, to, promotion: 'q' });
  } catch {
    return null;
  }

  return { san: move.san, sound: classifySound(chess, move) };
}

/**
 * Resolves a move given in SAN (rather than from/to squares) against a FEN
 * position — used by the candidate rail, whose MultiPV lines carry SAN but
 * no squares. Returns `null` when `san` is not a legal move in `fen`.
 */
export function resolveSan(fen: string, san: string): DropResolution | null {
  const chess = new Chess(fen);

  let move;
  try {
    move = chess.move(san);
  } catch {
    return null;
  }

  return { san: move.san, sound: classifySound(chess, move) };
}
