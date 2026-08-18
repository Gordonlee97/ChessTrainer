import { Chess, type Square } from 'chess.js';

export interface LegalDestination {
  to: Square;
  /** True when landing there takes a piece — including en passant. */
  captures: boolean;
}

/**
 * Every square the piece on `from` may legally move to, and whether each one
 * is a capture.
 *
 * Asked by the board so a player who selects a piece can see where it can go,
 * the way every other chess site shows it. Legality comes from chess.js rather
 * than from any rule written here: pins, checks and en passant are exactly the
 * cases a hand-rolled version gets wrong, and this project has a standing rule
 * against re-deriving chess it can ask a library for.
 *
 * Returns an empty array for an empty square, an opponent's piece, or a piece
 * with nowhere to go — the caller can treat "no destinations" as "not
 * selectable" without having to ask a second question first.
 *
 * `captures` is separate from `to` because the two are drawn differently: a
 * dot on an empty square, a ring around an occupied one. Callers that do not
 * care can ignore it.
 */
export function legalDestinations(fen: string, from: string): LegalDestination[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }

  // `verbose` is what carries the capture flag; the terse form is SAN strings,
  // which would have to be re-parsed to find the destination square.
  const moves = chess.moves({ square: from as Square, verbose: true });
  return moves.map((move) => ({
    to: move.to,
    // chess.js sets `captured` for en passant too, which is the case a
    // `board[to] !== null` check would miss.
    captures: move.captured !== undefined,
  }));
}
