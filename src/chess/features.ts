import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

export const CENTER_SQUARES: Square[] = ['d4', 'e4', 'd5', 'e5'];

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const HOME_MINORS: Record<Color, Square[]> = {
  w: ['b1', 'g1', 'c1', 'f1'],
  b: ['b8', 'g8', 'c8', 'f8'],
};

/** Squares a king occupies only as the result of castling, in practice. */
const CASTLED_KING_SQUARES: Record<Color, Square[]> = {
  w: ['g1', 'c1'],
  b: ['g8', 'c8'],
};

const COLORS: Color[] = ['w', 'b'];

export interface PositionFeatures {
  /** Number of attacks each side exerts on the four central squares. */
  centerControl: Record<Color, number>;
  /** Knights and bishops no longer on their home squares. */
  developedMinors: Record<Color, number>;
  /**
   * Whether each king sits on a castled square. This is an approximation — a
   * king that walked to g1 counts as castled — which is acceptable for a
   * heuristic explainer and keeps the check cheap.
   */
  castled: Record<Color, boolean>;
  /** Summed piece values, kings excluded. */
  material: Record<Color, number>;
  /**
   * Legal move count per side. `null` when the count cannot be determined —
   * flipping the side to move can produce an illegal position (for example
   * when the other king is already in check). Rules that read mobility must
   * skip when it is null.
   */
  mobility: Record<Color, number | null>;
  /** Squares holding a piece that is attacked and undefended. */
  hanging: Record<Color, Square[]>;
}

function occupiedSquares(chess: Chess): { square: Square; type: PieceSymbol; color: Color }[] {
  return chess
    .board()
    .flat()
    .filter((cell): cell is { square: Square; type: PieceSymbol; color: Color } => cell !== null);
}

/** Rebuilds the FEN with the side to move flipped, so we can count the other side's moves. */
function mobilityFor(fen: string, color: Color): number | null {
  const parts = fen.split(' ');
  if (parts[1] === color) return new Chess(fen).moves().length;
  parts[1] = color;
  parts[3] = '-'; // an en-passant square is only valid for the original mover
  try {
    return new Chess(parts.join(' ')).moves().length;
  } catch {
    return null;
  }
}

export function extractFeatures(fen: string): PositionFeatures {
  const chess = new Chess(fen);
  const pieces = occupiedSquares(chess);

  const centerControl = { w: 0, b: 0 } as Record<Color, number>;
  const developedMinors = { w: 0, b: 0 } as Record<Color, number>;
  const castled = { w: false, b: false } as Record<Color, boolean>;
  const material = { w: 0, b: 0 } as Record<Color, number>;
  const mobility = { w: null, b: null } as Record<Color, number | null>;
  const hanging = { w: [], b: [] } as Record<Color, Square[]>;

  for (const color of COLORS) {
    for (const square of CENTER_SQUARES) {
      centerControl[color] += chess.attackers(square, color).length;
    }
    mobility[color] = mobilityFor(fen, color);
  }

  for (const { square, type, color } of pieces) {
    material[color] += PIECE_VALUES[type];

    if ((type === 'n' || type === 'b') && !HOME_MINORS[color].includes(square)) {
      developedMinors[color] += 1;
    }

    if (type === 'k' && CASTLED_KING_SQUARES[color].includes(square)) {
      castled[color] = true;
    }

    if (type !== 'k') {
      const enemy: Color = color === 'w' ? 'b' : 'w';
      const attacked = chess.attackers(square, enemy).length > 0;
      const defended = chess.attackers(square, color).length > 0;
      if (attacked && !defended) hanging[color].push(square);
    }
  }

  return { centerControl, developedMinors, castled, material, mobility, hanging };
}
