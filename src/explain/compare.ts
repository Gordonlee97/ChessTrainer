import { Chess, type Color } from 'chess.js';
import { extractFeatures, type PositionFeatures } from '../chess/features';
import type { PvLine } from '../engine/types';
import { toCentipawns } from './quality';

/**
 * Below this gap the two lines are treated as equal and the verdict leads with
 * structure instead of numbers. Telling a beginner that +0.31 beats +0.28 would
 * teach them something false — the spec calls this out explicitly.
 */
export const PRACTICALLY_EQUAL_CP = 30;

const DEFAULT_PLIES = 8;

export interface LineSummary {
  san: string;
  endFen: string;
  /**
   * How many plies of the principal variation `endFen` actually reflects.
   * At most the ply limit, and below it when the PV is shorter or stops at an
   * illegal move. The drawer captions the mini-board with this, so it must be
   * the count that was played rather than the PV's length.
   */
  plies: number;
  scoreCp: number;
  pros: string[];
  cons: string[];
}

export interface Comparison {
  a: LineSummary;
  b: LineSummary;
  practicallyEqual: boolean;
  verdict: string;
}

/**
 * Plays a principal variation out, stopping at the ply limit or the first
 * illegal move. Reports how many plies it managed, which can be below the cap.
 */
function walk(baseFen: string, pv: string[], plies: number): { fen: string; played: number } {
  const chess = new Chess(baseFen);
  let played = 0;
  for (const san of pv.slice(0, plies)) {
    try {
      chess.move(san);
    } catch {
      break;
    }
    played += 1;
  }
  return { fen: chess.fen(), played };
}

function summarise(
  line: PvLine,
  baseFen: string,
  baseFeatures: PositionFeatures,
  mover: Color,
  plies: number,
): LineSummary {
  const { fen: endFen, played } = walk(baseFen, line.pv, plies);
  const end = extractFeatures(endFen);
  const pros: string[] = [];
  const cons: string[] = [];

  const developed = end.developedMinors[mover] - baseFeatures.developedMinors[mover];
  if (developed > 0) pros.push(`Develops ${developed} more piece${developed === 1 ? '' : 's'}`);

  const centre = end.centerControl[mover] - baseFeatures.centerControl[mover];
  if (centre > 0) pros.push('Holds more of the centre');
  if (centre < 0) cons.push('Concedes centre control');

  if (end.castled[mover] && !baseFeatures.castled[mover]) pros.push('Gets the king castled');

  const doubled = end.pawnStructure.doubled[mover] - baseFeatures.pawnStructure.doubled[mover];
  if (doubled > 0) cons.push('Leaves a doubled pawn');

  if (end.pawnStructure.passed[mover].length > baseFeatures.pawnStructure.passed[mover].length) {
    pros.push('Creates a passed pawn');
  }

  if (end.hanging[mover].length > 0) cons.push('Leaves a piece loose at the end of the line');

  // Every line needs something said about it, even a quiet one.
  if (pros.length === 0 && cons.length === 0) pros.push('Keeps the position balanced and flexible');

  return { san: line.san, endFen, plies: played, scoreCp: toCentipawns(line), pros, cons };
}

function buildVerdict(a: LineSummary, b: LineSummary, mover: Color): {
  practicallyEqual: boolean;
  verdict: string;
} {
  const gap = Math.abs(a.scoreCp - b.scoreCp);

  if (gap < PRACTICALLY_EQUAL_CP) {
    const contrast = a.pros[0] ?? a.cons[0] ?? 'a different structure';
    const otherContrast = b.pros[0] ?? b.cons[0] ?? 'a different structure';
    return {
      practicallyEqual: true,
      verdict:
        `Practically equal — the real difference is character, not evaluation. ` +
        `${a.san} ${contrast.toLowerCase()}; ${b.san} ${otherContrast.toLowerCase()}. ` +
        `Pick the one whose plan you would rather play.`,
    };
  }

  // scoreCp is always White-relative (positive favors White), regardless of
  // whose turn it is. So "better" flips with the mover: White wants the
  // higher score, Black wants the lower one. Collapsing this to a plain
  // `a.scoreCp > b.scoreCp` would silently recommend Black's worse line
  // whenever it is Black to move.
  const aIsBetter = mover === 'w' ? a.scoreCp > b.scoreCp : a.scoreCp < b.scoreCp;
  const better = aIsBetter ? a : b;
  const worse = aIsBetter ? b : a;

  return {
    practicallyEqual: false,
    verdict:
      `${better.san} is clearly stronger here — about ${(gap / 100).toFixed(2)} ` +
      `better than ${worse.san}. That gap is real, not noise.`,
  };
}

export function compareLines(
  baseFen: string,
  a: PvLine,
  b: PvLine,
  plies: number = DEFAULT_PLIES,
): Comparison {
  const mover = new Chess(baseFen).turn();
  const baseFeatures = extractFeatures(baseFen);

  const summaryA = summarise(a, baseFen, baseFeatures, mover, plies);
  const summaryB = summarise(b, baseFen, baseFeatures, mover, plies);
  const { practicallyEqual, verdict } = buildVerdict(summaryA, summaryB, mover);

  return { a: summaryA, b: summaryB, practicallyEqual, verdict };
}
