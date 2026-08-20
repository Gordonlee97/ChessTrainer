import { describe, expect, it } from 'vitest';
import type { PvLine } from '../engine/types';
import { compareLines } from './compare';

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

// One line develops a single minor over its walk, the other two — the
// discriminating fixture used throughout this file for "the rows genuinely
// differ". Values verified against `measureLine` directly before being
// encoded here: development 1 vs 2, every other row equal.
const oneMinor: PvLine = { san: 'Nf3', cp: 20, mate: null, pv: ['Nf3', 'd5', 'd4', 'Nf6'] };
const twoMinors: PvLine = {
  san: 'e4',
  cp: 31,
  mate: null,
  pv: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'],
};

describe('compareLines', () => {
  it('summarises both lines with their final positions', () => {
    const result = compareLines(START, italian, scotch);
    expect(result.a.san).toBe('e4');
    expect(result.b.san).toBe('d4');
    expect(result.a.endFen).not.toBe(START);
    expect(result.b.endFen).not.toBe(result.a.endFen);
  });

  it('calls it practically equal when no row differs', () => {
    // Formerly keyed to a sub-30-centipawn gap (PRACTICALLY_EQUAL_CP); the
    // Italian and the Scotch here happen to also be a 3cp gap, but that is
    // no longer what the assertion is about — see the decoupling test below.
    const result = compareLines(START, italian, scotch);
    expect(result.practicallyEqual).toBe(true);
    expect(result.verdict).toMatch(/practically equal/i);
  });

  it('practicallyEqual tracks row differences, not the centipawn gap', () => {
    // oneMinor vs twoMinors: an 11cp gap, well inside the old 30cp
    // threshold, yet development differs — practicallyEqual is now false.
    expect(compareLines(START, oneMinor, twoMinors).practicallyEqual).toBe(false);

    // The Italian against an identical walk with a huge score gap: the two
    // lines reach the same position, so every row measures equal and
    // practicallyEqual stays true no matter how large the gap is.
    const hugeGapSamePosition: PvLine = { ...italian, cp: 900 };
    expect(compareLines(START, italian, hugeGapSamePosition).practicallyEqual).toBe(true);
  });

  it('names the five-row parity plainly when nothing differs', () => {
    // Formerly: "does not claim a difference of character when both lines
    // lead with the same idea" — a defect in the old pros-collision logic
    // that this design removes rather than patches. The row-based footer
    // cannot make the old false claim because it only ever names rows that
    // actually differ.
    const result = compareLines(START, italian, scotch);
    expect(result.rows).toHaveLength(5);
    expect(result.rows.every((row) => row.equal)).toBe(true);
    expect(result.verdict).toBe(
      'Practically equal — these do the same five things, equally well. ' +
        'Pick the one you would rather play.',
    );
  });

  it('names the one row that differs', () => {
    const result = compareLines(START, oneMinor, twoMinors);
    expect(result.practicallyEqual).toBe(false);
    expect(result.rows.filter((row) => !row.equal).map((row) => row.id)).toEqual(['development']);
    expect(result.verdict).toBe('One real difference: development.');
  });

  it('names every row that differs when more than one does', () => {
    // Formerly "gives the decisive gap a unit" (asserted "3.72 pawns" in the
    // verdict). That behaviour is gone by design: the footer no longer
    // formats the centipawn gap at all, in either direction — see the next
    // test. What replaces it is naming every differing row, not just one.
    const result = compareLines(START, winning, scotch);
    expect(result.rows.filter((row) => !row.equal).map((row) => row.id)).toEqual([
      'development',
      'tempo',
    ]);
    expect(result.verdict).toBe('Two real differences: development and tempo.');
  });

  it('never puts a centipawn gap or a pawn unit in the footer', () => {
    // Regression guard for the removal above: the engine score keeps its
    // own separate line in the UI (formatScore, rendered in CompareDrawer)
    // and must not leak into this footer as "X pawns better".
    const result = compareLines(START, winning, scotch);
    expect(result.verdict).not.toMatch(/pawns/i);
    expect(result.verdict).not.toMatch(/\d/);
  });

  it('names the mate distance rather than formatting a mate score as pawns', () => {
    // toCentipawns returns ~100000 for a mate, so a centipawn-gap footer
    // would have rendered "about 998.00 better than".
    const forcedMate: PvLine = { san: 'e4', cp: null, mate: 3, pv: ['e4', 'e5', 'Qh5'] };
    const result = compareLines(START, forcedMate, scotch);

    expect(result.practicallyEqual).toBe(false);
    expect(result.verdict).toMatch(/mate in 3/i);
    expect(result.verdict).not.toMatch(/\d{3}\.\d\d/);
    expect(result.verdict).not.toMatch(/pawns/i);
  });

  it('produces the mate verdict rather than a row footer — regression guard for the early-out', () => {
    // buildVerdict's mate check must run and return *before* the row-based
    // footer below it. If that early-out is bypassed or reordered, this
    // mate-in-3 line would instead be described by whichever of the five
    // rows differ, e.g. "One real difference: development." — a materially
    // false description of a line that ends the game.
    const forcedMate: PvLine = { san: 'e4', cp: null, mate: 3, pv: ['e4', 'e5', 'Qh5'] };
    const result = compareLines(START, forcedMate, scotch);

    expect(result.verdict).toMatch(/mate in 3/i);
    expect(result.verdict).not.toMatch(/real difference/i);
  });

  it('separates two mating lines by speed, not by a centipawn gap', () => {
    // MATE_SCORE - |mate| puts every pair of mates within a few centipawns
    // of each other, so a centipawn-gap footer would otherwise swallow them.
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

  it('does not call it practically equal when a row differs', () => {
    // Formerly "does not call a decisive gap equal" — the decisiveness used
    // to come from the 372cp gap; it now comes from development and tempo
    // both differing (see "names every row that differs" above), and the
    // gap itself no longer has any bearing on practicallyEqual.
    const result = compareLines(START, winning, scotch);
    expect(result.practicallyEqual).toBe(false);
    expect(result.verdict).not.toMatch(/practically equal/i);
  });

  it('produces five rows for both lines regardless of how quiet the position is', () => {
    // Formerly "produces at least one pro or con per line" — pros/cons are
    // authored-only now (see the authored-contrast tests below), so "every
    // line gets something said about it, even a quiet one" is guaranteed by
    // the five fixed rows instead, which render whether or not they differ.
    const result = compareLines(START, italian, scotch);
    expect(result.rows).toHaveLength(5);
    expect(result.a.pros).toEqual([]);
    expect(result.a.cons).toEqual([]);
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

  it('records the SANs actually played as moves, stopping at the same illegal move as plies', () => {
    const broken: PvLine = { san: 'e4', cp: 20, mate: null, pv: ['e4', 'e5', 'e4'] };
    const result = compareLines(START, broken, scotch);

    expect(result.a.moves).toEqual(['e4', 'e5']);
    expect(result.a.moves).toHaveLength(result.a.plies);
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

  it('records exactly the moves the ply cap allowed, matching plies in length', () => {
    const long: PvLine = {
      san: 'e4',
      cp: 31,
      mate: null,
      pv: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'],
    };
    const result = compareLines(START, long, scotch);

    expect(result.a.moves).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6']);
    expect(result.a.moves).toHaveLength(result.a.plies);
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

  it('measures rows correctly when Black is the mover, without naming a "better" line', () => {
    // Formerly "names the line with the lower White-relative score as
    // better when Black is to move" — that test exercised a White-relative
    // score comparison in buildVerdict which no longer exists: the footer
    // never ranks by score, only by which rows differ. What still matters
    // is that measureLine received the right mover, and that scoreCp itself
    // stays a plain, unflipped pass-through of the engine's own number.
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
    expect(result.a.scoreCp).toBe(-300);
    expect(result.practicallyEqual).toBe(false);
    expect(result.rows.filter((row) => !row.equal).map((row) => row.id)).toEqual([
      'centre',
      'development',
    ]);
    expect(result.verdict).toBe('Two real differences: centre and development.');
    expect(result.verdict).not.toMatch(/clearly stronger/i);
    expect(result.verdict).not.toMatch(/pawns/i);
  });
});

describe('authored contrast', () => {
  const authored = {
    a: { pros: ['Opens lines at once'], cons: ['Releases the central tension'] },
    b: { pros: ['Keeps a bind on the centre'], cons: ['Slower to get going'] },
  };

  it('appends authored pros and cons — there is no derived content left to replace', () => {
    // Formerly "prefers authored pros and cons over the computed ones".
    // There is no longer a computed list to prefer over: pros/cons are
    // empty until authored content appends to them.
    const result = compareLines(START, italian, scotch, 8, authored);
    expect(result.a.pros).toEqual(['Opens lines at once']);
    expect(result.a.cons).toEqual(['Releases the central tension']);
    expect(result.b.pros).toEqual(['Keeps a bind on the centre']);
  });

  it('leaves pros and cons empty for a line with no authored entry', () => {
    // Formerly "falls back to computed contrast for a line with no authored
    // entry" — there is no fallback left to fall back to; the row values
    // for that line are unaffected either way (they never came from pros).
    const result = compareLines(START, italian, scotch, 8, { a: authored.a });
    expect(result.a.pros).toEqual(['Opens lines at once']);
    expect(result.b.pros).toEqual([]);
    expect(result.b.cons).toEqual([]);
    expect(result.rows).toHaveLength(5);
  });

  it('keeps the five rows and the footer alongside authored prose, not instead of it', () => {
    // The spec's core claim for this task: authored content stacks beneath
    // the grid rather than replacing it.
    const result = compareLines(START, italian, scotch, 8, authored);
    expect(result.rows).toHaveLength(5);
    expect(result.a.pros).toEqual(['Opens lines at once']);
    expect(result.b.pros).toEqual(['Keeps a bind on the centre']);
    expect(result.verdict.length).toBeGreaterThan(0);
  });

  it('keeps authored prose out of the footer — it renders separately, beneath the grid', () => {
    // Formerly "uses the authored contrast in the verdict": the old footer
    // quoted a line's leading pro when scores were close, so authored text
    // used to leak into the verdict. The row-based footer never reads
    // pros/cons at all, so that can no longer happen.
    const result = compareLines(START, italian, scotch, 8, authored);
    expect(result.verdict).not.toMatch(/opens lines at once/i);
    expect(result.verdict).not.toMatch(/keeps a bind on the centre/i);
  });

  it('behaves exactly as before when nothing is authored', () => {
    expect(compareLines(START, italian, scotch, 8)).toEqual(compareLines(START, italian, scotch));
  });
});
