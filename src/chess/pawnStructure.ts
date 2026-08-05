import { Chess, type Color, type Square } from 'chess.js';

const FILES = 'abcdefgh';
const COLORS: Color[] = ['w', 'b'];

export interface PawnStructure {
  /** Pawns beyond the first on any file, summed. Two pawns on a file counts 1. */
  doubled: Record<Color, number>;
  /** Pawns with no friendly pawn on either adjacent file. */
  isolated: Record<Color, Square[]>;
  /** Pawns with no enemy pawn ahead of them on their own or an adjacent file. */
  passed: Record<Color, Square[]>;
  /** Contiguous runs of files holding at least one pawn. */
  islands: Record<Color, number>;
}

interface PawnPos {
  square: Square;
  file: number; // 0 = a
  rank: number; // 1..8
}

function pawnsOf(chess: Chess, color: Color): PawnPos[] {
  return chess
    .board()
    .flat()
    .filter((cell) => cell !== null && cell.type === 'p' && cell.color === color)
    .map((cell) => {
      const square = cell!.square;
      return { square, file: FILES.indexOf(square[0]), rank: Number(square[1]) };
    });
}

function countIslands(pawns: PawnPos[]): number {
  const files = [...new Set(pawns.map((p) => p.file))].sort((a, b) => a - b);
  let islands = 0;
  for (let i = 0; i < files.length; i += 1) {
    if (i === 0 || files[i] !== files[i - 1] + 1) islands += 1;
  }
  return islands;
}

function countDoubled(pawns: PawnPos[]): number {
  const perFile = new Map<number, number>();
  for (const p of pawns) perFile.set(p.file, (perFile.get(p.file) ?? 0) + 1);
  let doubled = 0;
  for (const count of perFile.values()) doubled += count - 1;
  return doubled;
}

/** A pawn is passed when no enemy pawn stands ahead of it on its own or an adjacent file. */
function isPassed(pawn: PawnPos, color: Color, enemyPawns: PawnPos[]): boolean {
  return !enemyPawns.some((enemy) => {
    if (Math.abs(enemy.file - pawn.file) > 1) return false;
    return color === 'w' ? enemy.rank > pawn.rank : enemy.rank < pawn.rank;
  });
}

export function extractPawnStructure(fen: string): PawnStructure {
  const chess = new Chess(fen);
  const byColor = { w: pawnsOf(chess, 'w'), b: pawnsOf(chess, 'b') };

  const doubled = { w: 0, b: 0 } as Record<Color, number>;
  const isolated = { w: [], b: [] } as Record<Color, Square[]>;
  const passed = { w: [], b: [] } as Record<Color, Square[]>;
  const islands = { w: 0, b: 0 } as Record<Color, number>;

  for (const color of COLORS) {
    const own = byColor[color];
    const enemy = byColor[color === 'w' ? 'b' : 'w'];
    const ownFiles = new Set(own.map((p) => p.file));

    doubled[color] = countDoubled(own);
    islands[color] = countIslands(own);

    for (const pawn of own) {
      if (!ownFiles.has(pawn.file - 1) && !ownFiles.has(pawn.file + 1)) {
        isolated[color].push(pawn.square);
      }
      if (isPassed(pawn, color, enemy)) passed[color].push(pawn.square);
    }

    isolated[color].sort();
    passed[color].sort();
  }

  return { doubled, isolated, passed, islands };
}
