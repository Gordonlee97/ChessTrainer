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
  });

  it('does not claim a difference of character when both lines lead with the same idea', () => {
    // Observed verbatim in the browser: "Practically equal — the real
    // difference is character, not evaluation. e4 develops 1 more piece; d4
    // develops 1 more piece." The sentence asserts a difference and then
    // states none. Over a realistic 8-ply opening the two lines routinely
    // produce the identical leading pro, so "pick the first pro the other
    // doesn't have" cannot rescue it either — the honest move is to say so.
    const result = compareLines(START, italian, scotch);

    expect(result.a.pros[0]).toBe(result.b.pros[0]);
    expect(result.verdict).toMatch(/same idea/i);
    expect(result.verdict).not.toMatch(/difference is character/i);
  });

  it('still contrasts the two lines when they genuinely differ', () => {
    // A develops one minor over its line; B develops two.
    const oneMinor: PvLine = { san: 'Nf3', cp: 20, mate: null, pv: ['Nf3', 'd5', 'd4', 'Nf6'] };
    const twoMinors: PvLine = {
      san: 'e4',
      cp: 31,
      mate: null,
      pv: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
    };
    const result = compareLines(START, oneMinor, twoMinors);

    expect(result.practicallyEqual).toBe(true);
    expect(result.a.pros[0]).not.toBe(result.b.pros[0]);
    expect(result.verdict).toMatch(/character/i);
    expect(result.verdict).not.toMatch(/same idea/i);
  });

  it('gives the decisive gap a unit', () => {
    // "about 0.45 better than d4" leaves the reader to guess at pawns.
    const verdict = compareLines(START, winning, scotch).verdict;
    expect(verdict).toMatch(/3\.72 pawns/);
  });

  it('names the mate distance rather than formatting a mate score as pawns', () => {
    // toCentipawns returns ~100000 for a mate, so the decisive branch's
    // (gap / 100).toFixed(2) rendered "about 998.00 better than".
    const forcedMate: PvLine = { san: 'e4', cp: null, mate: 3, pv: ['e4', 'e5', 'Qh5'] };
    const result = compareLines(START, forcedMate, scotch);

    expect(result.practicallyEqual).toBe(false);
    expect(result.verdict).toMatch(/mate in 3/i);
    expect(result.verdict).not.toMatch(/\d{3}\.\d\d/);
    expect(result.verdict).not.toMatch(/pawns/i);
  });

  it('separates two mating lines by speed, not by a centipawn gap', () => {
    // MATE_SCORE - |mate| puts every pair of mates within a few centipawns
    // of each other, so the equality threshold would otherwise swallow them.
    const fast: PvLine = { san: 'Qh5', cp: null, mate: 1, pv: ['Qh5'] };
    const slow: PvLine = { san: 'Qf3', cp: null, mate: 4, pv: ['Qf3'] };
    const result = compareLines(START, fast, slow);

    expect(result.verdict).toMatch(/mate in 1/i);
    expect(result.verdict).toMatch(/mate in 4/i);
    expect(result.verdict).not.toMatch(/practically equal/i);
  });

  it('says plainly when the mover is getting mated in the line', () => {
    // A mate score that favours White while Black is to move means Black is
    // the one being mated — the verdict must not read as a win.
    const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const mated: PvLine = { san: 'g5', cp: null, mate: 2, pv: ['g5'] };
    const survives: PvLine = { san: 'e5', cp: 30, mate: null, pv: ['e5'] };
    const result = compareLines(AFTER_E4, mated, survives);

    expect(result.practicallyEqual).toBe(false);
    expect(result.verdict).toContain('e5');
    expect(result.verdict).toMatch(/mate in 2/i);
    expect(result.verdict).not.toMatch(/g5 forces mate/i);
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
    // The third ply repeats e4, which is not legal after 1.e4 e5. Asserting
    // only that this does not throw would pass even if the walk silently
    // skipped the bad move and played on, so pin the end position and the
    // ply count it reports.
    const broken: PvLine = { san: 'e4', cp: 20, mate: null, pv: ['e4', 'e5', 'e4'] };
    const result = compareLines(START, broken, scotch);

    expect(result.a.plies).toBe(2);
    expect(result.a.endFen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  });

  it('reports the plies it actually walked, not the length of the principal variation', () => {
    // The drawer captions the mini-board with this number, so it has to be
    // the count that was played, not the PV's length: this PV is 12 plies
    // and the default cap is 8.
    const long: PvLine = {
      san: 'e4',
      cp: 31,
      mate: null,
      pv: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'],
    };
    const result = compareLines(START, long, scotch);

    expect(result.a.plies).toBe(8);
    expect(result.a.endFen).toBe('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5');
  });

  it('reports fewer plies than the cap when the principal variation is shorter', () => {
    // italian's PV is 5 plies; the default cap is 8.
    expect(compareLines(START, italian, scotch).a.plies).toBe(5);
  });

  it('respects the ply limit', () => {
    const short = compareLines(START, italian, scotch, 2);
    const long = compareLines(START, italian, scotch, 5);
    expect(short.a.endFen).not.toBe(long.a.endFen);
  });

  it('names the line with the lower White-relative score as better when Black is to move', () => {
    // After 1.e4, Black to move. Scores are White-relative, so -300 (good for
    // Black) is the stronger line for the mover here, even though +50 is the
    // larger number.
    const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const strongForBlack: PvLine = {
      san: 'e5',
      cp: -300,
      mate: null,
      pv: ['e5', 'Nf3', 'Nc6', 'Bb5'],
    };
    const weakForBlack: PvLine = {
      san: 'c5',
      cp: 50,
      mate: null,
      pv: ['c5', 'Nf3', 'd6', 'd4'],
    };

    const result = compareLines(AFTER_E4, strongForBlack, weakForBlack);
    expect(result.practicallyEqual).toBe(false);
    expect(result.verdict).toContain('e5');
    expect(result.verdict).not.toContain('c5 is clearly stronger');
  });
});

describe('authored contrast', () => {
  const authored = {
    a: { pros: ['Opens lines at once'], cons: ['Releases the central tension'] },
    b: { pros: ['Keeps a bind on the centre'], cons: ['Slower to get going'] },
  };

  it('prefers authored pros and cons over the computed ones', () => {
    const result = compareLines(START, italian, scotch, 8, authored);
    expect(result.a.pros).toEqual(['Opens lines at once']);
    expect(result.a.cons).toEqual(['Releases the central tension']);
    expect(result.b.pros).toEqual(['Keeps a bind on the centre']);
  });

  it('falls back to computed contrast for a line with no authored entry', () => {
    const result = compareLines(START, italian, scotch, 8, { a: authored.a });
    expect(result.a.pros).toEqual(['Opens lines at once']);
    expect(result.b.pros.length).toBeGreaterThan(0);
    expect(result.b.pros).not.toEqual(authored.b.pros);
  });

  it('uses the authored contrast in the verdict', () => {
    const result = compareLines(START, italian, scotch, 8, authored);
    expect(result.verdict).toMatch(/opens lines at once/i);
    expect(result.verdict).toMatch(/keeps a bind on the centre/i);
  });

  it('behaves exactly as before when nothing is authored', () => {
    expect(compareLines(START, italian, scotch, 8)).toEqual(compareLines(START, italian, scotch));
  });
});
