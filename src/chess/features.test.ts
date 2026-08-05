import { describe, expect, it } from 'vitest';
import { extractFeatures } from './features';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// 1.e4 e5 — the earliest point either side actually attacks a center square
const OPEN_CENTER = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
// 1.e4 e5 2.Nf3 Nc6 3.Bc4 — the Italian
const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
// White has castled kingside
const CASTLED = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4';
// Black bishop on b4 is attacked by a3 pawn and undefended
const HANGING = 'rnbqk1nr/pppp1ppp/8/4p3/1b2P3/P4N2/1PPP1PPP/RNBQKB1R b KQkq - 0 3';

describe('extractFeatures', () => {
  it('counts equal material and no development at the start', () => {
    const f = extractFeatures(START);
    expect(f.material).toEqual({ w: 39, b: 39 });
    expect(f.developedMinors).toEqual({ w: 0, b: 0 });
    expect(f.castled).toEqual({ w: false, b: false });
    expect(f.pawnStructure.islands).toEqual({ w: 1, b: 1 });
  });

  it('counts center control from both sides', () => {
    // At the true starting position no piece actually attacks d4/e4/d5/e5 yet
    // (chess.js's attackers() reports real attacks, not reachable squares),
    // so centerControl is 0-0 there. Use the position after 1.e4 e5, the
    // earliest point either side attacks a center square, to assert a
    // meaningful symmetric, nonzero contest.
    const f = extractFeatures(OPEN_CENTER);
    expect(f.centerControl.w).toBe(f.centerControl.b);
    expect(f.centerControl.w).toBeGreaterThan(0);
  });

  it('counts developed minor pieces in the Italian', () => {
    const f = extractFeatures(ITALIAN);
    expect(f.developedMinors.w).toBe(2); // Nf3 and Bc4
    expect(f.developedMinors.b).toBe(1); // Nc6
  });

  it('detects a castled king', () => {
    expect(extractFeatures(CASTLED).castled).toEqual({ w: true, b: false });
  });

  it('reports an undefended attacked piece as hanging', () => {
    const f = extractFeatures(HANGING);
    expect(f.hanging.b).toContain('b4');
    expect(f.hanging.w).toEqual([]);
  });

  it('reports mobility for both sides', () => {
    const f = extractFeatures(START);
    expect(f.mobility.w).toBe(20);
    expect(f.mobility.b).toBe(20);
  });
});
