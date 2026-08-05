import type { Color } from 'chess.js';
import type { PvLine } from '../engine/types';

export type QualityBand = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/** Mate is scored beyond any material advantage, discounted by distance. */
export const MATE_SCORE = 100000;

const BANDS: { maxLoss: number; band: QualityBand; label: string }[] = [
  { maxLoss: 20, band: 'best', label: 'Best move' },
  { maxLoss: 50, band: 'good', label: 'Good move' },
  { maxLoss: 100, band: 'inaccuracy', label: 'Inaccuracy' },
  { maxLoss: 250, band: 'mistake', label: 'Mistake' },
  { maxLoss: Infinity, band: 'blunder', label: 'Blunder' },
];

/**
 * Collapses a line's score to a single White-relative number so two lines can
 * be compared. Mate lines sort above every centipawn score, and a mate in 1
 * outranks a mate in 5.
 *
 * A mate score of exactly 0 is distinguished by its sign bit: +0 means the side
 * to move is already mated (worst for White), -0 means the opponent is already
 * mated (best for White). Object.is is required because `0 > 0` and `-0 > 0`
 * both evaluate to false.
 */
export function toCentipawns(line: PvLine): number {
  if (line.mate !== null) {
    const magnitude = MATE_SCORE - Math.abs(line.mate);
    return line.mate > 0 || Object.is(line.mate, -0) ? magnitude : -magnitude;
  }
  return line.cp ?? 0;
}

/**
 * How much the played move gave up against the best available one, in
 * centipawns, never negative.
 *
 * Scores are White-relative, so the direction of "worse" depends on who moved:
 * White wants the score high, Black wants it low. Subtracting unconditionally
 * would invert every judgement for Black.
 */
export function centipawnLoss(best: PvLine, played: PvLine, mover: Color): number {
  const bestScore = toCentipawns(best);
  const playedScore = toCentipawns(played);
  const loss = mover === 'w' ? bestScore - playedScore : playedScore - bestScore;
  return Math.max(0, loss);
}

export function classifyMove(
  best: PvLine,
  played: PvLine,
  mover: Color,
): { band: QualityBand; loss: number; label: string } {
  const loss = centipawnLoss(best, played, mover);
  // Non-null assertion is safe: loss is finite and non-negative, so it will always match a band.
  const match = BANDS.find((entry) => loss <= entry.maxLoss)!;
  return { band: match.band, loss, label: match.label };
}
