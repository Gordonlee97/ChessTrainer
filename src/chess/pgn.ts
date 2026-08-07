import { Chess } from 'chess.js';

const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*']);
const MOVE_NUMBER = /^\d+\.(\.\.)?$/;

/**
 * Strips headers, move numbers, comments and the result token out of PGN
 * text, leaving the raw sequence of SAN tokens in play order.
 */
function extractSanTokens(pgn: string): string[] {
  const withoutHeaders = pgn.replace(/^\s*\[[^\]]*\]\s*$/gm, '');
  const withoutComments = withoutHeaders.replace(/\{[^}]*\}/g, '');
  return withoutComments
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !RESULT_TOKENS.has(token) && !MOVE_NUMBER.test(token));
}

/**
 * Renders a line as PGN movetext.
 *
 * The starting position is kept by the caller (`SavedLine.startFen`) rather
 * than relied upon as a `SetUp`/`FEN` header. chess.js does write that
 * header into `pgn()` output for a non-standard start, and that's harmless
 * on the write side — see `pgnToSans` for why reading never consults it.
 */
export function lineToPgn(startFen: string, sans: string[]): string {
  const chess = new Chess(startFen);
  for (const san of sans) {
    try {
      chess.move(san);
    } catch {
      throw new Error(`Illegal move "${san}" while writing PGN from ${startFen}`);
    }
  }
  return chess.pgn();
}

/**
 * Reads a line back, replaying the movetext ourselves from `startFen`
 * rather than delegating position-setting to `Chess.loadPgn`.
 *
 * Verified against the installed chess.js (1.4.0): `loadPgn` derives its
 * replay position entirely from the PGN's own embedded `SetUp`/`FEN` header
 * (or the standard start when the header is absent) and never consults the
 * FEN the `Chess` instance was constructed with — confirmed by swapping the
 * reading instance's starting FEN and observing `loadPgn`'s output was
 * unchanged either way. Delegating to it would make the `startFen`
 * parameter here inert, which is exactly the failure mode `SavedLine`
 * keeping `startFen` as its own field is meant to avoid.
 *
 * So instead: SAN tokens are extracted from the movetext directly and
 * played one at a time into a `Chess` seeded with `startFen`. Any header
 * chess.js wrote into the PGN text is never parsed and has no effect.
 * Replay stops at the first token that will not apply — including the
 * first token of unreadable input — rather than throwing, returning
 * whatever prefix of the line played legally (`[]` when nothing did).
 */
export function pgnToSans(pgn: string, startFen: string): string[] {
  try {
    const chess = new Chess(startFen);
    const sans: string[] = [];
    for (const token of extractSanTokens(pgn)) {
      let move;
      try {
        move = chess.move(token);
      } catch {
        break;
      }
      sans.push(move.san);
    }
    return sans;
  } catch {
    return [];
  }
}
