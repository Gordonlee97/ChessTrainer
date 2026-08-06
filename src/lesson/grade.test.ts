import { describe, expect, it } from 'vitest';
import type { Checkpoint } from '../content/schema';
import { gradeMove } from './grade';

const checkpoint: Checkpoint = {
  id: 'cp',
  prompt: 'Develop the bishop.',
  accept: ['Bc4'],
  hints: ['Aim at f7.'],
  nearMiss: { Bb5: 'That is the Ruy Lopez — also good, but not this lesson.' },
};

describe('gradeMove', () => {
  it('accepts an accepted move', () => {
    expect(gradeMove(checkpoint, 'Bc4')).toEqual({ kind: 'correct' });
  });

  it('returns the authored reply for a near miss', () => {
    expect(gradeMove(checkpoint, 'Bb5')).toEqual({
      kind: 'near-miss',
      reply: 'That is the Ruy Lopez — also good, but not this lesson.',
    });
  });

  it('falls back to a plain wrong for anything else', () => {
    expect(gradeMove(checkpoint, 'h3')).toEqual({ kind: 'wrong' });
  });

  it('accepts any of several accepted moves', () => {
    const many: Checkpoint = { ...checkpoint, accept: ['Bc4', 'Bb5'] };
    expect(gradeMove(many, 'Bb5').kind).toBe('correct');
  });

  it('prefers acceptance over a near miss when a move is listed in both', () => {
    // Content should not do this, and a test in Task 2 forbids it — but if it
    // happens, being told you are right beats being corrected.
    const conflicting: Checkpoint = { ...checkpoint, accept: ['Bc4', 'Bb5'] };
    expect(gradeMove(conflicting, 'Bb5').kind).toBe('correct');
  });

  it('handles a checkpoint with no nearMiss map', () => {
    const bare: Checkpoint = { id: 'c', prompt: 'p', accept: ['e4'], hints: ['h'] };
    expect(gradeMove(bare, 'd4')).toEqual({ kind: 'wrong' });
  });
});
