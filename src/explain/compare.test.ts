import { describe, expect, it } from 'vitest';
import type { PvLine } from '../engine/types';
import { compareLines, PRACTICALLY_EQUAL_CP } from './compare';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const italian: PvLine = {
  san: 'e4',
  cp: 31,
  mate: null,
  pv: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
};
const scotch: PvLine = {
  san: 'd4',
  cp: 28,
  mate: null,
  pv: ['d4', 'd5', 'Nf3', 'Nf6', 'Bf4'],
};
const winning: PvLine = { san: 'e4', cp: 400, mate: null, pv: ['e4', 'e5'] };

describe('compareLines', () => {
  it('summarises both lines with their final positions', () => {
    const result = compareLines(START, italian, scotch);
    expect(result.a.san).toBe('e4');
    expect(result.b.san).toBe('d4');
    expect(result.a.endFen).not.toBe(START);
    expect(result.b.endFen).not.toBe(result.a.endFen);
  });

  it('calls a sub-30-centipawn gap practically equal', () => {
    const result = compareLines(START, italian, scotch);
    expect(result.practicallyEqual).toBe(true);
    expect(result.verdict).toMatch(/practically equal/i);
    expect(result.verdict).toMatch(/character/i);
  });

  it('does not call a decisive gap equal', () => {
    const result = compareLines(START, winning, scotch);
    expect(result.practicallyEqual).toBe(false);
    expect(result.verdict).not.toMatch(/practically equal/i);
  });

  it('names the better line when the gap is real', () => {
    expect(compareLines(START, winning, scotch).verdict).toContain('e4');
  });

  it('uses the documented equality threshold', () => {
    expect(PRACTICALLY_EQUAL_CP).toBe(30);
  });

  it('produces at least one pro or con per line', () => {
    const result = compareLines(START, italian, scotch);
    expect(result.a.pros.length + result.a.cons.length).toBeGreaterThan(0);
    expect(result.b.pros.length + result.b.cons.length).toBeGreaterThan(0);
  });

  it('stops walking a principal variation at an illegal move', () => {
    const broken: PvLine = { san: 'e4', cp: 20, mate: null, pv: ['e4', 'e5', 'e4'] };
    expect(() => compareLines(START, broken, scotch)).not.toThrow();
  });

  it('respects the ply limit', () => {
    const short = compareLines(START, italian, scotch, 2);
    const long = compareLines(START, italian, scotch, 5);
    expect(short.a.endFen).not.toBe(long.a.endFen);
  });
});
