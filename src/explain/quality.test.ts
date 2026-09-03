import { describe, expect, it } from 'vitest';
import type { PvLine } from '../engine/types';
import { centipawnLoss, classifyMove, toCentipawns } from './quality';

const line = (cp: number | null, mate: number | null = null): PvLine => ({
  san: 'x',
  cp,
  mate,
  pv: ['x'],
});

describe('toCentipawns', () => {
  it('passes a centipawn score through', () => {
    expect(toCentipawns(line(31))).toBe(31);
  });

  it('maps mate for White to a large positive score', () => {
    expect(toCentipawns(line(null, 3))).toBeGreaterThan(90000);
  });

  it('maps mate against White to a large negative score', () => {
    expect(toCentipawns(line(null, -3))).toBeLessThan(-90000);
  });

  it('scores a faster mate higher than a slower one', () => {
    expect(toCentipawns(line(null, 1))).toBeGreaterThan(toCentipawns(line(null, 5)));
  });

  it('treats mate: +0 (White already mated) as worst case', () => {
    // Positive zero means White is already mated — worst for White.
    expect(toCentipawns(line(null, 0))).toBe(-100000);
  });

  it('treats mate: -0 (Black already mated) as best case', () => {
    // Negative zero means Black is already mated — best for White.
    // Explicitly construct -0 as 0 * -1 to ensure the value is -0.
    const negZero = 0 * -1;
    expect(Object.is(negZero, -0)).toBe(true); // Verify we have -0, not +0
    expect(toCentipawns(line(null, negZero))).toBe(100000);
  });
});

describe('centipawnLoss', () => {
  it('measures how far White fell below the best move', () => {
    expect(centipawnLoss(line(100), line(40), 'w')).toBe(60);
  });

  it('measures how far Black rose above the best move', () => {
    // White-relative: Black wants the score LOW. Best -100, played -40,
    // so Black gave up 60 centipawns.
    expect(centipawnLoss(line(-100), line(-40), 'b')).toBe(60);
  });

  it('never reports a negative loss', () => {
    expect(centipawnLoss(line(40), line(100), 'w')).toBe(0);
  });

  it('reports zero when the played move is the best move', () => {
    expect(centipawnLoss(line(31), line(31), 'w')).toBe(0);
  });
});

describe('classifyMove', () => {
  it.each([
    [0, 'best'],
    [20, 'best'],
    [21, 'good'],
    [50, 'good'],
    [51, 'inaccuracy'],
    [100, 'inaccuracy'],
    [101, 'mistake'],
    [250, 'mistake'],
    [251, 'blunder'],
  ])('classifies a loss of %i as %s', (loss, band) => {
    expect(classifyMove(line(0), line(-loss), 'w').band).toBe(band);
  });

  it('classifies from Black\'s perspective correctly', () => {
    // Black played a move that raised White's score by 300 — a blunder.
    expect(classifyMove(line(0), line(300), 'b').band).toBe('blunder');
  });

  it('gives a human label alongside the band', () => {
    expect(classifyMove(line(0), line(0), 'w').label).toBe('Best move');
  });

  /**
   * The rail classifies every candidate against the same best line, so at the
   * start position d4, e4 and Nf3 all landed inside the 20cp `best` band and
   * all three rendered "Best move" — three different moves each captioned as
   * the single best one. Only an exact tie keeps that caption now.
   */
  it('reserves "Best move" for a move that actually is the best', () => {
    // 10cp worse: still the `best` band, so still a fine move to play.
    const nearly = classifyMove(line(0), line(-10), 'w');
    expect(nearly.band).toBe('best');
    expect(nearly.label).toBe('Just as good');
  });

  it('still calls a genuine tie the best move', () => {
    // Two lines with identical scores are both best, and both may say so.
    expect(classifyMove(line(0), line(0), 'w').label).toBe('Best move');
    expect(classifyMove(line(50), line(50), 'w').label).toBe('Best move');
  });

  it('leaves every other band\'s label alone', () => {
    expect(classifyMove(line(0), line(-30), 'w').label).toBe('Good move');
    expect(classifyMove(line(0), line(-70), 'w').label).toBe('Inaccuracy');
    expect(classifyMove(line(0), line(-150), 'w').label).toBe('Mistake');
    expect(classifyMove(line(0), line(-300), 'w').label).toBe('Blunder');
  });
});
