import { Chess } from 'chess.js';

/**
 * Renders a line as PGN movetext.
 *
 * The starting position is kept by the caller (`SavedLine.startFen`) rather
 * than relied upon as a `SetUp`/`FEN` header: chess.js does write that header
 * into `pgn()` output for a non-standard start, but nothing here reads it
 * back out. `pgnToSans` is always given the same `startFen` explicitly, so
 * reading never depends on how a given chess.js version round-trips headers.
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

/** Reads a line back. Returns an empty list if the PGN cannot be understood. */
export function pgnToSans(pgn: string, startFen: string): string[] {
  const chess = new Chess(startFen);
  try {
    chess.loadPgn(pgn);
  } catch {
    return [];
  }
  return chess.history();
}
