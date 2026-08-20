import { Chess, type Color } from 'chess.js';
import type { PvLine } from '../engine/types';
import { buildContrastRows, measureLine, type ContrastRow, type LineValues } from './contrastRows';
import { toCentipawns } from './quality';

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
  /** The SANs actually walked, so the drawer can show how the position arose. */
  moves: string[];
  scoreCp: number;
  /**
   * The line's mate distance, White-relative, or null. Carried through so the
   * verdict can name the mate rather than format `MATE_SCORE - |mate|` as a
   * centipawn gap.
   */
  mate: number | null;
  /** How this line measures on the five fixed rows, from the mover's side. */
  values: LineValues;
  /** Authored prose only. Empty unless a lesson supplied it. */
  pros: string[];
  cons: string[];
}

export interface Comparison {
  a: LineSummary;
  b: LineSummary;
  rows: ContrastRow[];
  /** True when no row differs. */
  practicallyEqual: boolean;
  /** The footer sentence. */
  verdict: string;
}

export interface AuthoredContrast {
  pros: string[];
  cons: string[];
}

export interface AuthoredContrastPair {
  a?: AuthoredContrast;
  b?: AuthoredContrast;
}

/**
 * Authored content is a human's account of the line, appended beneath the
 * five rows rather than replacing anything — there is no derived prose left
 * to replace. See docs/superpowers/specs/2026-08-20-compare-contrast-vocabulary-design.md
 * section 3.6.
 */
function applyAuthored(summary: LineSummary, authored?: AuthoredContrast): LineSummary {
  if (!authored) return summary;
  return {
    ...summary,
    pros: [...summary.pros, ...authored.pros],
    cons: [...summary.cons, ...authored.cons],
  };
}

/**
 * Plays a principal variation out, stopping at the ply limit or the first
 * illegal move. Reports how many plies it managed, which can be below the
 * cap, and the SANs it actually played.
 */
function walk(baseFen: string, pv: string[], plies: number): { fen: string; moves: string[] } {
  const chess = new Chess(baseFen);
  const moves: string[] = [];
  for (const san of pv.slice(0, plies)) {
    try {
      chess.move(san);
    } catch {
      break;
    }
    moves.push(san);
  }
  return { fen: chess.fen(), moves };
}

function summarise(line: PvLine, baseFen: string, mover: Color, plies: number): LineSummary {
  const { fen: endFen, moves } = walk(baseFen, line.pv, plies);

  return {
    san: line.san,
    endFen,
    plies: moves.length,
    moves,
    scoreCp: toCentipawns(line),
    mate: line.mate,
    values: measureLine(endFen, mover),
    pros: [],
    cons: [],
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
 * This runs *before* the row-based footer, not inside it, because a mate
 * outranks structure: a line forcing mate in 3 must be described as mating,
 * not as "one real difference: development."
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

const DIFFERENCE_COUNT_WORDS: Record<number, string> = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' };

/** "development", "development and tempo", "centre, development and tempo". */
function listRowLabels(rows: ContrastRow[]): string {
  const names = rows.map((row) => row.label.toLowerCase());
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The footer. Replaces the old centipawn-gap verdict — see
 * docs/superpowers/specs/2026-08-20-compare-contrast-vocabulary-design.md
 * section 3.3 for why: two strong candidates routinely score alike, and
 * comparing scores told the reader nothing a good line doesn't already do.
 * The footer instead names whichever of the five fixed rows actually differ.
 */
function buildVerdict(a: LineSummary, b: LineSummary, mover: Color, rows: ContrastRow[]): Verdict {
  const decidedByMate = mateVerdict(a, b, mover);
  if (decidedByMate) return decidedByMate;

  const differing = rows.filter((row) => !row.equal);

  if (differing.length === 0) {
    return {
      practicallyEqual: true,
      verdict:
        'Practically equal — these do the same five things, equally well. ' +
        'Pick the one you would rather play.',
    };
  }

  if (differing.length === 1) {
    return {
      practicallyEqual: false,
      verdict: `One real difference: ${differing[0].label.toLowerCase()}.`,
    };
  }

  return {
    practicallyEqual: false,
    verdict: `${DIFFERENCE_COUNT_WORDS[differing.length]} real differences: ${listRowLabels(differing)}.`,
  };
}

export function compareLines(
  baseFen: string,
  a: PvLine,
  b: PvLine,
  plies: number = DEFAULT_PLIES,
  authored?: AuthoredContrastPair,
): Comparison {
  const mover = new Chess(baseFen).turn();

  const summaryA = applyAuthored(summarise(a, baseFen, mover, plies), authored?.a);
  const summaryB = applyAuthored(summarise(b, baseFen, mover, plies), authored?.b);
  const rows = buildContrastRows(summaryA.values, summaryB.values);
  const { practicallyEqual, verdict } = buildVerdict(summaryA, summaryB, mover, rows);

  return { a: summaryA, b: summaryB, rows, practicallyEqual, verdict };
}
