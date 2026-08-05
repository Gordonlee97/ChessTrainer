import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { PIECE_VALUES } from './features';

const FILES = 'abcdefgh';

export interface Fork {
  forker: Square;
  targets: Square[];
}

export interface Pin {
  pinner: Square;
  pinned: Square;
  against: Square;
}

const DIAGONALS: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const ORTHOGONALS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function directionsFor(piece: PieceSymbol): [number, number][] {
  if (piece === 'b') return DIAGONALS;
  if (piece === 'r') return ORTHOGONALS;
  if (piece === 'q') return [...DIAGONALS, ...ORTHOGONALS];
  return [];
}

function toSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}` as Square;
}

function enemyOf(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/**
 * Reports a fork created by the piece standing on `from`: two or more enemy
 * pieces it attacks that are either worth more than it or left undefended.
 * Returns null when there is no piece there, or fewer than two such targets.
 */
export function findFork(fen: string, from: Square): Fork | null {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece) return null;

  const enemy = enemyOf(piece.color);
  const forkerValue = PIECE_VALUES[piece.type];

  const targets = chess
    .board()
    .flat()
    .filter((cell) => cell !== null && cell.color === enemy)
    .map((cell) => cell!)
    .filter((cell) => chess.attackers(cell.square, piece.color).includes(from))
    .filter((cell) => {
      // A king is always worth attacking; otherwise the target must be worth
      // more than the forker, or be undefended.
      if (cell.type === 'k') return true;
      const defended = chess.attackers(cell.square, enemy).length > 0;
      return PIECE_VALUES[cell.type] > forkerValue || !defended;
    })
    .map((cell) => cell.square);

  return targets.length >= 2 ? { forker: from, targets: targets.sort() } : null;
}

/**
 * Reports a pin created by the sliding piece on `from`: the first enemy piece
 * along one of its rays, with the enemy king directly behind it on that same
 * ray. Returns null for non-sliding pieces and empty squares.
 */
export function findPin(fen: string, from: Square): Pin | null {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece) return null;

  const directions = directionsFor(piece.type);
  if (directions.length === 0) return null;

  const enemy = enemyOf(piece.color);
  const startFile = FILES.indexOf(from[0]);
  const startRank = Number(from[1]);

  for (const [df, dr] of directions) {
    let pinned: Square | null = null;

    for (let step = 1; step <= 7; step += 1) {
      const square = toSquare(startFile + df * step, startRank + dr * step);
      if (!square) break;

      const occupant = chess.get(square);
      if (!occupant) continue;

      if (pinned === null) {
        // First piece along the ray must be a non-king enemy to be pinnable.
        if (occupant.color !== enemy || occupant.type === 'k') break;
        pinned = square;
        continue;
      }

      // Second piece along the ray decides whether that was a pin.
      if (occupant.color === enemy && occupant.type === 'k') {
        return { pinner: from, pinned, against: square };
      }
      break;
    }
  }

  return null;
}
