import { Chess, type Color } from 'chess.js';
import { CENTER_SQUARES, extractFeatures } from '../chess/features';
import { pawnsRemaining } from '../chess/pawnStructure';

export type ContrastRowId = 'centre' | 'development' | 'kingSafety' | 'tempo' | 'character';

/** What one walked line measures to, from the mover's point of view. */
export interface LineValues {
  /** Mover's pawns standing on d4/e4/d5/e5. */
  centre: number;
  /** Mover's knights and bishops off their home squares. */
  development: number;
  /** Whether the mover has castled. */
  kingSafety: boolean;
  /** Mover's developed minors minus the opponent's. May be negative. */
  tempo: number;
  /** Pawns traded so far, banded: 0 = closed, 1 = opening up, 2 = open. */
  character: 0 | 1 | 2;
}

export interface ContrastRow {
  id: ContrastRowId;
  /** The heading a player reads. */
  label: string;
  /** How line A reads on this row. */
  aText: string;
  /** How line B reads on this row. */
  bText: string;
  /** True when the two lines measure the same on this row. */
  equal: boolean;
  /** One short sentence explaining the row for this pair. */
  gloss: string;
}

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/**
 * A chessboard holds 16 pawns. Traded is what has left the board since the
 * start, banded coarsely because the exact count is not something a beginner
 * panel should ever show: 0 traded reads as closed, 1-2 as opening up, 3 or
 * more as open.
 */
function bandCharacter(fen: string): 0 | 1 | 2 {
  const traded = 16 - pawnsRemaining(fen);
  if (traded === 0) return 0;
  if (traded <= 2) return 1;
  return 2;
}

/**
 * The Centre row means pawns actually standing on d4/e4/d5/e5, not
 * `PositionFeatures.centerControl` — that field counts attackers on those
 * squares, a different and looser claim. So this inspects the board directly
 * rather than reading `extractFeatures`, the same distinction `rules.ts`
 * draws between `centerOccupationRule` and `centerPressureRule`.
 */
function countCentrePawns(chess: Chess, mover: Color): number {
  let count = 0;
  for (const square of CENTER_SQUARES) {
    const piece = chess.get(square);
    if (piece && piece.type === 'p' && piece.color === mover) count += 1;
  }
  return count;
}

/** What one walked line measures to, from the mover's point of view. */
export function measureLine(endFen: string, mover: Color): LineValues {
  const chess = new Chess(endFen);
  const features = extractFeatures(endFen);
  const opponent = other(mover);

  return {
    centre: countCentrePawns(chess, mover),
    development: features.developedMinors[mover],
    kingSafety: features.castled[mover],
    tempo: features.developedMinors[mover] - features.developedMinors[opponent],
    character: bandCharacter(endFen),
  };
}

const CENTRE_WORDS: Record<number, string> = {
  0: 'No central pawns',
  1: 'One central pawn',
};

function centreText(value: number): string {
  return CENTRE_WORDS[value] ?? `${value} central pawns`;
}

function developmentText(value: number): string {
  return `${value} minor${value === 1 ? '' : 's'} developed`;
}

function kingSafetyText(value: boolean): string {
  return value ? 'Castled' : 'Not castled';
}

function tempoText(value: number): string {
  if (value === 0) return 'Even development';
  const verb = value > 0 ? 'Ahead' : 'Behind';
  const magnitude = Math.abs(value);
  return `${verb} by ${magnitude} move${magnitude === 1 ? '' : 's'}`;
}

const CHARACTER_WORDS: Record<0 | 1 | 2, string> = {
  0: 'Closed',
  1: 'Opening up',
  2: 'Open',
};

function characterText(value: 0 | 1 | 2): string {
  return CHARACTER_WORDS[value];
}

function centreGloss(a: number, b: number): string {
  if (a === b) return 'A pawn planted on d4, e4, d5 or e5 holds space both sides want.';
  return 'The side with more pawns on d4, e4, d5 or e5 holds more of the board\'s most valuable ground.';
}

function developmentGloss(a: number, b: number): string {
  if (a === b) return 'This counts knights and bishops that have left their starting squares.';
  return 'The side with more minor pieces out is closer to being ready to attack or defend.';
}

/**
 * This row reads "Not castled" in nearly every early comparison, so an
 * uninformative gloss would make it noise on every row it renders. It always
 * teaches when castling normally happens rather than only restating the row —
 * including the two less common cases where one or both lines have already
 * castled, so the "usually comes around move five" claim never contradicts
 * what the row itself just showed.
 */
function kingSafetyGloss(a: boolean, b: boolean): string {
  if (a && b) return 'Both kings have already reached safety by castling.';
  if (a || b) {
    return 'One king has already castled to safety; the other has not — castling usually comes around move five.';
  }
  return 'Neither king is safe yet — castling usually comes around move five.';
}

/**
 * Deliberately avoids leaning on the word "tempo" as its own explanation —
 * this panel is aimed at beginners, and plain words win ties.
 */
function tempoGloss(): string {
  return 'Being a move ahead in development means getting pieces into the game faster than the opponent.';
}

function characterGloss(a: 0 | 1 | 2, b: 0 | 1 | 2): string {
  if (a === b) return 'Open positions favour active pieces; closed ones favour long-term plans.';
  return 'One line keeps more pawns on the board than the other, which changes what kind of position results.';
}

/** Builds one row, applying a `toText` formatter to each side's raw value. */
function row<T>(
  id: ContrastRowId,
  label: string,
  aValue: T,
  bValue: T,
  toText: (value: T) => string,
  gloss: string,
): ContrastRow {
  return {
    id,
    label,
    aText: toText(aValue),
    bText: toText(bValue),
    equal: aValue === bValue,
    gloss,
  };
}

export function buildContrastRows(a: LineValues, b: LineValues): ContrastRow[] {
  return [
    row('centre', 'Centre', a.centre, b.centre, centreText, centreGloss(a.centre, b.centre)),
    row(
      'development',
      'Development',
      a.development,
      b.development,
      developmentText,
      developmentGloss(a.development, b.development),
    ),
    row(
      'kingSafety',
      'King safety',
      a.kingSafety,
      b.kingSafety,
      kingSafetyText,
      kingSafetyGloss(a.kingSafety, b.kingSafety),
    ),
    row('tempo', 'Tempo', a.tempo, b.tempo, tempoText, tempoGloss()),
    row(
      'character',
      'Open or closed',
      a.character,
      b.character,
      characterText,
      characterGloss(a.character, b.character),
    ),
  ];
}
