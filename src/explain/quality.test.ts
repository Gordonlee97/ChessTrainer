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
});
