import { describe, expect, it } from 'vitest';
import { buildContext, describeMove, explainMove } from './explain';
import type { Reason, Rule } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const reason = (weight: number, text: string): Reason => ({
  tag: 'center',
  polarity: 'good',
  weight,
  text,
});

describe('buildContext', () => {
  it('derives the after-position and the move squares from SAN', () => {
    const ctx = buildContext(START, 'e4', null, null);
    expect(ctx.from).toBe('e2');
    expect(ctx.to).toBe('e4');
    expect(ctx.mover).toBe('w');
    expect(ctx.after).toContain(' b ');
    expect(ctx.loss).toBeNull();
  });

  it('computes loss when both lines are supplied', () => {
    const best = { san: 'e4', cp: 30, mate: null, pv: ['e4'] };
    const played = { san: 'a3', cp: -70, mate: null, pv: ['a3'] };
    expect(buildContext(START, 'a3', best, played).loss).toBe(100);
  });

  it('throws on an illegal move', () => {
    expect(() => buildContext(START, 'e5', null, null)).toThrow(/illegal/i);
  });
});

describe('explainMove', () => {
  it('orders reasons by weight, descending', () => {
    const rules: Rule[] = [
      () => reason(10, 'low'),
      () => reason(90, 'high'),
      () => reason(50, 'middle'),
    ];
    expect(explainMove(buildContext(START, 'e4', null, null), rules).map((r) => r.text)).toEqual([
      'high',
      'middle',
      'low',
    ]);
  });

  it('flattens rules that return several reasons', () => {
    const rules: Rule[] = [() => [reason(10, 'a'), reason(20, 'b')]];
    expect(explainMove(buildContext(START, 'e4', null, null), rules)).toHaveLength(2);
  });

  it('drops rules that return null', () => {
    const rules: Rule[] = [() => null, () => reason(5, 'only')];
    expect(explainMove(buildContext(START, 'e4', null, null), rules)).toHaveLength(1);
  });

  it('never lets one rule throwing lose the other reasons', () => {
    const rules: Rule[] = [
      () => {
        throw new Error('rule blew up');
      },
      () => reason(5, 'survivor'),
    ];
    const reasons = explainMove(buildContext(START, 'e4', null, null), rules);
    expect(reasons.map((r) => r.text)).toEqual(['survivor']);
  });
});

describe('describeMove', () => {
  it('joins the top reasons into prose', () => {
    const rules: Rule[] = [() => reason(90, 'Takes the centre.'), () => reason(10, 'Frees the bishop.')];
    expect(describeMove(buildContext(START, 'e4', null, null), 2, rules)).toBe(
      'Takes the centre. Frees the bishop.',
    );
  });

  it('respects the maximum reason count', () => {
    const rules: Rule[] = [
      () => reason(90, 'One.'),
      () => reason(80, 'Two.'),
      () => reason(70, 'Three.'),
    ];
    expect(describeMove(buildContext(START, 'e4', null, null), 2, rules)).toBe('One. Two.');
  });

  it('returns an empty string when no rule fires', () => {
    expect(describeMove(buildContext(START, 'e4', null, null), 2, [])).toBe('');
  });
});
