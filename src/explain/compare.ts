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
  /**
   * The line's mate distance, White-relative, or null. Carried through so the
   * verdict can name the mate rather than format `MATE_SCORE - |mate|` as a
   * centipawn gap.
   */
  mate: number | null;
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

  return {
    san: line.san,
    endFen,
    plies: played,
    scoreCp: toCentipawns(line),
    mate: line.mate,
    pros,
    cons,
  };
}

interface Verdict {
  practicallyEqual: boolean;
  verdict: string;
}

/**
 * A line's mate, read from the moving side's point of view.
 *
 * Mate scores are White-relative above the UCI layer, and +0 and -0 are
 * opposite outcomes there: +0 means the side to move is already mated, -0 that
 * the opponent is. Object.is is the same test `formatScore` and `EvalBar` use —
 * `0 > 0` and `-0 > 0` are both false.
 */
function mateFor(
  summary: LineSummary,
  mover: Color,
): { distance: number; favoursMover: boolean } | null {
  if (summary.mate === null) return null;
  const favoursWhite = summary.mate > 0 || Object.is(summary.mate, -0);
  return { distance: Math.abs(summary.mate), favoursMover: favoursWhite === (mover === 'w') };
}

/**
 * The verdict for a comparison where at least one line ends in mate, or null
 * when neither does.
 *
 * This runs *before* the centipawn logic, not inside its decisive branch,
 * because both paths through that logic get mate wrong. `toCentipawns` returns
 * roughly ±100000 for a mate, so the decisive branch renders "about 998.00
 * better than" — and two mating lines are only `|mateA| - |mateB|` centipawns
 * apart, so the equality threshold swallows them and calls a mate in 1 and a
 * mate in 12 practically equal.
 */
function mateVerdict(a: LineSummary, b: LineSummary, mover: Color): Verdict | null {
  const mateA = mateFor(a, mover);
  const mateB = mateFor(b, mover);
  if (!mateA && !mateB) return null;

  // Both lines mate for the mover: the only question is which is faster.
  if (mateA?.favoursMover && mateB?.favoursMover) {
    if (mateA.distance === mateB.distance) {
      return {
        practicallyEqual: true,
        verdict:
          `Both lines force mate in ${mateA.distance}. Either one wins — ` +
          `play whichever you can see to the end.`,
      };
    }
    const aIsFaster = mateA.distance < mateB.distance;
    const [fast, slow] = aIsFaster ? [a, b] : [b, a];
    const [fastIn, slowIn] = aIsFaster
      ? [mateA.distance, mateB.distance]
      : [mateB.distance, mateA.distance];
    return {
      practicallyEqual: false,
      verdict:
        `Both lines force mate, but ${fast.san} is quicker — mate in ${fastIn} ` +
        `against ${slow.san}'s mate in ${slowIn}.`,
    };
  }

  // Exactly one line mates for the mover. Nothing outranks that.
  if (mateA?.favoursMover || mateB?.favoursMover) {
    const aWins = Boolean(mateA?.favoursMover);
    const [winner, other] = aWins ? [a, b] : [b, a];
    const winningMate = (aWins ? mateA : mateB)!;
    const otherMate = aWins ? mateB : mateA;
    const tail = otherMate
      ? ` ${other.san} is mated in ${otherMate.distance} instead.`
      : ` ${other.san} does not force mate.`;
    return {
      practicallyEqual: false,
      verdict: `${winner.san} forces mate in ${winningMate.distance} — that ends the game.${tail}`,
    };
  }

  // No mate for the mover, so any mate here is against them.
  if (mateA && mateB) {
    if (mateA.distance === mateB.distance) {
      return {
        practicallyEqual: true,
        verdict:
          `Both lines end in mate against you in ${mateA.distance}. ` +
          `Neither one saves the game — look for a different move.`,
      };
    }
    const aLastsLonger = mateA.distance > mateB.distance;
    const [longer, shorter] = aLastsLonger ? [a, b] : [b, a];
    const [longIn, shortIn] = aLastsLonger
      ? [mateA.distance, mateB.distance]
      : [mateB.distance, mateA.distance];
    return {
      practicallyEqual: false,
      verdict:
        `Both lines end in mate against you. ${longer.san} holds out ${longIn} moves ` +
        `to ${shorter.san}'s ${shortIn}, but neither one saves the game.`,
    };
  }

  const losing = mateA ? a : b;
  const survivor = mateA ? b : a;
  const losingMate = (mateA ?? mateB)!;
  return {
    practicallyEqual: false,
    verdict:
      `${survivor.san} is clearly stronger — ${losing.san} runs into ` +
      `mate in ${losingMate.distance}.`,
  };
}

function buildVerdict(a: LineSummary, b: LineSummary, mover: Color): Verdict {
  const decidedByMate = mateVerdict(a, b, mover);
  if (decidedByMate) return decidedByMate;

  const gap = Math.abs(a.scoreCp - b.scoreCp);

  if (gap < PRACTICALLY_EQUAL_CP) {
    const contrast = a.pros[0] ?? a.cons[0] ?? 'a different structure';
    const otherContrast = b.pros[0] ?? b.cons[0] ?? 'a different structure';

    // Over a realistic 8-ply opening the two lines routinely produce the same
    // leading pro — both develop two pieces, both take centre ground — and
    // the sentence below then claimed a difference of character while stating
    // none: "e4 develops 1 more piece; d4 develops 1 more piece." Picking the
    // first pro the other line lacks does not help either, because the whole
    // pros list is often identical. Saying so plainly is the honest answer.
    //
    // A richer contrast vocabulary — pawn structure, open versus closed,
    // which minor came out — is what would actually separate these lines. It
    // is real design work and belongs to a later plan; see the vault's
    // Known Issues.
    if (contrast === otherContrast) {
      return {
        practicallyEqual: true,
        verdict:
          `Practically equal — and both lines lead with the same idea: ` +
          `${contrast.toLowerCase()}. There is nothing to separate them here, ` +
          `so choose on feel and play the one you understand better.`,
      };
    }

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
      `${better.san} is clearly stronger here — about ${(gap / 100).toFixed(2)} pawns ` +
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
