import { Chess } from 'chess.js';
import { defaultPieces } from 'react-chessboard';

/**
 * Draws the same piece artwork the main board does.
 *
 * This used to render Unicode glyphs, which had one real advantage — the white
 * and black sets are different characters, so the two armies stayed
 * distinguishable under `forced-colors`, where the OS overrides `color` and
 * `textShadow`. It also looked wrong: the glyphs sat small inside their squares
 * and White's outline characters (♙♘♗) read as unfinished next to Black's
 * filled ones.
 *
 * `defaultPieces` is exactly what `Board.tsx` renders, so the drawer now
 * matches the board it is describing. The trade is that react-chessboard's
 * white and black pieces share a path and differ by `fill`, so under
 * `forced-colors` they can flatten together. That is **already true of the
 * main board** — this makes the mini-boards no worse than the primary surface
 * rather than better than it, which is the right place for a secondary view to
 * sit. Recorded in `Known Issues.md`.
 *
 * `data-piece` carries the piece code (`wP`, `bN`) so the two armies stay
 * assertable in tests now that there is no text content to match on.
 */
export function MiniBoard({ fen, label }: { fen: string; label: string }) {
  const board = new Chess(fen).board();

  return (
    <div
      role="img"
      aria-label={label}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        // Rows must be declared too. Without this they are auto-sized by
        // content, and since each square holds an SVG rather than a line of
        // text, the intrinsic heights differ from row to row and the board
        // renders visibly warped. The glyph version got away with it because
        // every row was the same line of text.
        gridTemplateRows: 'repeat(8, 1fr)',
        aspectRatio: '1',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 3px 0 #e0c3a3',
      }}
    >
      {board.flatMap((row, rankIndex) =>
        row.map((cell, fileIndex) => {
          const code = cell ? `${cell.color}${cell.type.toUpperCase()}` : null;
          const Piece = code ? defaultPieces[code] : undefined;

          return (
            <div
              key={`${rankIndex}-${fileIndex}`}
              data-piece={code ?? undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  (rankIndex + fileIndex) % 2 === 0 ? 'var(--board-light)' : 'var(--board-dark)',
              }}
            >
              {Piece ? <Piece /> : null}
            </div>
          );
        }),
      )}
    </div>
  );
}
