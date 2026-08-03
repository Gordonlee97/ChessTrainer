import { describe, expect, it } from 'vitest';
import { formatScore } from './useAnalysis';

describe('formatScore', () => {
  it('formats a positive centipawn score with a sign', () => {
    expect(formatScore({ san: 'e4', cp: 31, mate: null, pv: ['e4'] })).toBe('+0.31');
  });

  it('formats a negative centipawn score', () => {
    expect(formatScore({ san: 'e4', cp: -145, mate: null, pv: ['e4'] })).toBe('-1.45');
  });

  it('formats an even score', () => {
    expect(formatScore({ san: 'e4', cp: 0, mate: null, pv: ['e4'] })).toBe('0.00');
  });

  it('formats mate scores', () => {
    expect(formatScore({ san: 'Qh7', cp: null, mate: 3, pv: ['Qh7'] })).toBe('M3');
    expect(formatScore({ san: 'Kg1', cp: null, mate: -2, pv: ['Kg1'] })).toBe('-M2');
  });
});
