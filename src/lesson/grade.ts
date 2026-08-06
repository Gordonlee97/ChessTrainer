import type { Checkpoint } from '../content/schema';

export type Grade =
  | { kind: 'correct' }
  | { kind: 'near-miss'; reply: string }
  | { kind: 'wrong' };

/**
 * Judges a played move against a checkpoint.
 *
 * Acceptance is checked first: if content ever lists a move as both accepted
 * and a near miss, being told you are right beats being corrected.
 */
export function gradeMove(checkpoint: Checkpoint, san: string): Grade {
  if (checkpoint.accept.includes(san)) return { kind: 'correct' };

  const reply = checkpoint.nearMiss?.[san];
  if (reply) return { kind: 'near-miss', reply };

  return { kind: 'wrong' };
}
