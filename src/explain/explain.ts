import { Chess } from 'chess.js';
import { extractFeatures } from '../chess/features';
import type { PvLine } from '../engine/types';
import { centipawnLoss } from './quality';
import { ALL_RULES } from './rules';
import type { MoveContext, Reason, Rule } from './types';

/**
 * Assembles everything the rules need from a position and a move in SAN.
 *
 * `bestLine` and `playedLine` are optional: off-book positions still get
 * explained, they just carry no centipawn loss.
 */
export function buildContext(
  before: string,
  san: string,
  bestLine: PvLine | null,
  playedLine: PvLine | null,
): MoveContext {
  const chess = new Chess(before);
  const mover = chess.turn();

  let move;
  try {
    move = chess.move(san);
  } catch {
    throw new Error(`Illegal move "${san}" in position ${before}`);
  }

  return {
    before,
    after: chess.fen(),
    san: move.san,
    from: move.from,
    to: move.to,
    mover,
    featuresBefore: extractFeatures(before),
    featuresAfter: extractFeatures(chess.fen()),
    loss: bestLine && playedLine ? centipawnLoss(bestLine, playedLine, mover) : null,
  };
}

/**
 * Runs every rule and returns their reasons ranked by weight.
 *
 * A rule that throws is skipped rather than allowed to take the whole
 * explanation down with it — a missing reason degrades the prose, an exception
 * would blank the panel.
 */
export function explainMove(ctx: MoveContext, rules: Rule[] = ALL_RULES): Reason[] {
  const reasons: Reason[] = [];

  for (const rule of rules) {
    let produced: Reason | Reason[] | null;
    try {
      produced = rule(ctx);
    } catch {
      continue;
    }
    if (!produced) continue;
    if (Array.isArray(produced)) reasons.push(...produced);
    else reasons.push(produced);
  }

  return reasons.sort((a, b) => b.weight - a.weight);
}

export function describeMove(ctx: MoveContext, max = 2, rules: Rule[] = ALL_RULES): string {
  return explainMove(ctx, rules)
    .slice(0, max)
    .map((reason) => reason.text)
    .join(' ');
}

export { ALL_RULES };
