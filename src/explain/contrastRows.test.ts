import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { buildContrastRows, measureLine, type LineValues } from './contrastRows';

/** Replays SANs so no FEN in this file is hand-written. */
function fenAfter(...sans: string[]): string {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return chess.fen();
}

/** The Italian at 8 plies — the quiet case where little differs. */
const ITALIAN = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6'];
/** The Scotch at 8 plies — the discriminating case: a central pawn is traded. */
const SCOTCH = ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6'];

describe('measureLine', () => {
  it('counts the mover\'s central pawns, not both sides', () => {
    // After the Italian both sides hold one central pawn; the mover is White.
    expect(measureLine(fenAfter(...ITALIAN), 'w').centre).toBe(1);
  });

  it('notices when the opponent\'s central pawn has been traded off', () => {
    // Black's e-pawn captured on d4, so White holds the only central pawn.
    expect(measureLine(fenAfter(...SCOTCH), 'w').centre).toBe(1);
    expect(measureLine(fenAfter(...SCOTCH), 'b').centre).toBe(0);
  });

  it('counts developed minors for the mover alone', () => {
    expect(measureLine(fenAfter(...ITALIAN), 'w').development).toBe(2);
  });

  it('reports tempo as the difference between the two sides', () => {
    // White has two minors out, Black three, so White is a move behind.
    expect(measureLine(fenAfter(...ITALIAN), 'w').tempo).toBe(-1);
    expect(measureLine(fenAfter(...ITALIAN), 'b').tempo).toBe(1);
  });

  it('reports king safety as false before anyone castles', () => {
    // Castling lands at ply 9-11 in real openings, so 8 plies is always false.
    expect(measureLine(fenAfter(...ITALIAN), 'w').kingSafety).toBe(false);
  });

  it('bands character by pawns traded, not by raw count', () => {
    expect(measureLine(fenAfter(...ITALIAN), 'w').character).toBe(0); // 16 pawns, none traded
    expect(measureLine(fenAfter(...SCOTCH), 'w').character).toBe(1); // 14 pawns, two traded
  });

  /**
   * The band is what the row compares, so two different pawn counts inside one
   * band must measure identically. 15 and 14 pawns are 1 and 2 traded — both
   * band 1. Tested here rather than on `buildContrastRows`, which only ever
   * sees a band and so cannot exercise the collapse at all.
   */
  it('collapses different pawn counts within one band to the same value', () => {
    const oneTraded = fenAfter('e4', 'd5', 'exd5');       // 15 pawns
    const twoTraded = fenAfter('e4', 'd5', 'exd5', 'Qxd5'); // 15 pawns, a piece taken
    expect(measureLine(oneTraded, 'w').character).toBe(1);
    expect(measureLine(twoTraded, 'w').character).toBe(1);
    expect(measureLine(fenAfter(...SCOTCH), 'w').character).toBe(1); // 14 pawns
  });

  it('bands character as open once three or more pawns have been traded', () => {
    // e4 e6 d4 d5 exd5 exd5 c4 dxc4: an Exchange French followed by a second
    // central trade. Verified via chess.js: 13 pawns remain (16 - 3 traded),
    // which is above the "opening up" band's ceiling of two.
    const openLine = fenAfter('e4', 'e6', 'd4', 'd5', 'exd5', 'exd5', 'c4', 'dxc4');
    expect(measureLine(openLine, 'w').character).toBe(2);
  });
});

describe('buildContrastRows', () => {
  const quiet: LineValues = {
    centre: 1, development: 2, kingSafety: false, tempo: 0, character: 0,
  };

  it('returns the five rows in a fixed order every time', () => {
    const ids = buildContrastRows(quiet, quiet).map((row) => row.id);
    expect(ids).toEqual(['centre', 'development', 'kingSafety', 'tempo', 'character']);
  });

  it('marks every row equal when the two lines measure the same', () => {
    expect(buildContrastRows(quiet, quiet).every((row) => row.equal)).toBe(true);
  });

  it('marks only the row that differs', () => {
    const faster = { ...quiet, development: 3 };
    const rows = buildContrastRows(quiet, faster);

    expect(rows.filter((row) => !row.equal).map((row) => row.id)).toEqual(['development']);
  });

  /**
   * Every fixture elsewhere in this file sets `kingSafety: false` on both
   * sides, so the "Castled" text branch and a differing king-safety row
   * never actually run without this. Task 1's measurements show this is a
   * live path — one candidate castled by ply 8 where the other did not, in
   * 1 of 6 real comparisons.
   */
  it('marks kingSafety as differing when one line has castled and the other has not', () => {
    const castled: LineValues = { ...quiet, kingSafety: true };
    const row = buildContrastRows(quiet, castled).find((r) => r.id === 'kingSafety')!;

    expect(row.equal).toBe(false);
    expect(row.aText.length).toBeGreaterThan(0);
    expect(row.bText.length).toBeGreaterThan(0);
  });

  /**
   * Equality is decided on the measured value, never on the rendered words.
   * `e4` and `d4` both count one central pawn, so that row is a match even
   * though a renderer might name different squares.
   */
  it('treats equal values as equal however they read', () => {
    const [centre] = buildContrastRows(quiet, quiet);
    expect(centre.equal).toBe(true);
    expect(centre.gloss.length).toBeGreaterThan(0);
  });

  it('never puts a raw pawn count in anything a player reads', () => {
    const open: LineValues = { ...quiet, character: 2 };
    const row = buildContrastRows(quiet, open).find((r) => r.id === 'character')!;
    for (const text of [row.label, row.aText, row.bText, row.gloss]) {
      expect(text).not.toMatch(/\b(1[0-9]|2[0-9]|3[0-2])\b/); // no 10-32
    }
  });

  it('labels the character row in plain words, not jargon', () => {
    const row = buildContrastRows(quiet, quiet).find((r) => r.id === 'character')!;
    expect(row.label).toBe('Open or closed');
  });

  it('gives every row a non-empty label, texts and gloss', () => {
    for (const row of buildContrastRows(quiet, { ...quiet, tempo: 2 })) {
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.aText.length).toBeGreaterThan(0);
      expect(row.bText.length).toBeGreaterThan(0);
      expect(row.gloss.length).toBeGreaterThan(0);
    }
  });
});
