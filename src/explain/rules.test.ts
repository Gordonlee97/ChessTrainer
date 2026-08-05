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

describe('rule set', () => {
  it('credits a move that grabs the centre', () => {
    expect(tagsFor(START, 'e4')).toContain('center');
  });

  it('credits developing a minor piece', () => {
    expect(tagsFor(START, 'Nf3')).toContain('development');
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

  it('says nothing about tactics that are not there', () => {
    const tags = tagsFor(START, 'a3');
    expect(tags).not.toContain('fork');
    expect(tags).not.toContain('pin');
    expect(tags).not.toContain('material');
  });
});
