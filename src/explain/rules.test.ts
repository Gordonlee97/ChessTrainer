import { describe, expect, it } from 'vitest';
import { buildContext, explainMove } from './explain';
import { ALL_RULES } from './rules';
import type { ReasonTag } from './types';

function tagsFor(fen: string, san: string): ReasonTag[] {
  return explainMove(buildContext(fen, san, null, null), ALL_RULES).map((r) => r.tag);
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// White to move, can castle kingside
const CAN_CASTLE = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5';
// Knight c3 plays Nd5, which attacks b6 and f6 at once — the queen and the rook
const FORK_AVAILABLE = '4k3/8/1q3r2/8/8/2N5/8/4K3 w - - 0 1';
// Bishop f1 plays Bb5 along the f1-b5 diagonal, pinning the c6 knight to the e8 king
const PIN_AVAILABLE = '4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1';
// Rook d1 can take the undefended black rook on d5, or step to d4 where that
// same black rook attacks it and nothing defends it
const FREE_ROOK = '4k3/8/8/3r4/8/8/8/3RK3 w - - 0 1';
// White pawns e4 and d2; exd5 puts a second white pawn on the d-file
const DOUBLES_PAWNS = '4k3/8/8/3p4/4P3/8/3P4/4K3 w - - 0 1';
// White pawn d7 captures the black rook on e8 and promotes to a queen —
// gains both the pawn-to-queen swing and the captured rook in one move
const PROMOTION_CAPTURE = '4r3/3P4/1k6/8/8/8/8/K7 w - - 0 1';

describe('rule set', () => {
  it('credits a move that grabs the centre', () => {
    expect(tagsFor(START, 'e4')).toContain('center');
  });

  it('credits developing a minor piece', () => {
    expect(tagsFor(START, 'Nf3')).toContain('development');
  });

  it('separates occupying a central square from merely pressuring one', () => {
    // 1.e4 puts a pawn on a central square. 1.Nf3 only attacks two of them
    // — a real but lesser claim, and the one that used to make every
    // sensible first move read as "stakes a claim in the centre".
    expect(tagsFor(START, 'e4')).toContain('center');
    expect(tagsFor(START, 'e4')).not.toContain('center-pressure');

    expect(tagsFor(START, 'Nf3')).toContain('center-pressure');
    expect(tagsFor(START, 'Nf3')).not.toContain('center');
  });

  it('gives e4 and Nf3 different top-ranked reasons', () => {
    // The defect this rule set was shipped with: centerControl counts
    // attackers, so a developing knight scored 2 (weight 50) and outranked
    // development (45). Measured from the start position, e4, d4, Nf3, Nc3,
    // c4 and e3 all led with the same sentence.
    const top = (san: string) => explainMove(buildContext(START, san, null, null), ALL_RULES)[0];

    expect(top('e4').tag).toBe('center');
    expect(top('Nf3').tag).toBe('development');
    expect(top('e4').text).not.toBe(top('Nf3').text);
  });

  it('leads with development for every knight move out of the start position', () => {
    for (const san of ['Nf3', 'Nc3', 'Nh3', 'Na3']) {
      const top = explainMove(buildContext(START, san, null, null), ALL_RULES)[0];
      expect(top?.tag, `${san} should lead with development`).toBe('development');
    }
  });

  it('credits castling as king safety', () => {
    expect(tagsFor(CAN_CASTLE, 'O-O')).toContain('king-safety');
  });

  it('credits winning material', () => {
    expect(tagsFor(FREE_ROOK, 'Rxd5')).toContain('material');
  });

  it('names a fork', () => {
    expect(tagsFor(FORK_AVAILABLE, 'Nd5')).toContain('fork');
  });

  it('names a pin', () => {
    expect(tagsFor(PIN_AVAILABLE, 'Bb5')).toContain('pin');
  });

  it('warns when a move leaves a piece hanging', () => {
    // The rook steps to a square attacked by the black rook and defended by nothing.
    expect(tagsFor(FREE_ROOK, 'Rd4')).toContain('hanging');
  });

  it('flags a move that doubles our own pawns', () => {
    expect(tagsFor(DOUBLES_PAWNS, 'exd5')).toContain('pawn-structure');
  });

  it('credits a check as a tempo gain', () => {
    const tags = tagsFor('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'Ra8+');
    expect(tags).toContain('tempo');
  });

  it('produces every reason as a complete sentence', () => {
    const reasons = explainMove(buildContext(START, 'e4', null, null), ALL_RULES);
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason.text).toMatch(/^[A-Z].*[.!]$/);
      expect(reason.weight).toBeGreaterThan(0);
      expect(reason.weight).toBeLessThanOrEqual(100);
    }
  });

  it('caps the material weight at 100 even on a promotion-capture', () => {
    const reasons = explainMove(buildContext(PROMOTION_CAPTURE, 'dxe8=Q', null, null), ALL_RULES);
    const material = reasons.find((r) => r.tag === 'material');
    expect(material).toBeDefined();
    expect(material!.weight).toBeLessThanOrEqual(100);
  });

  it('says nothing about tactics that are not there', () => {
    const tags = tagsFor(START, 'a3');
    expect(tags).not.toContain('fork');
    expect(tags).not.toContain('pin');
    expect(tags).not.toContain('material');
  });
});
