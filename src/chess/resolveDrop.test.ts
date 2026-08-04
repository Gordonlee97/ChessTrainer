import { describe, expect, it } from 'vitest';
import { resolveDrop, resolveSan } from './resolveDrop';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// 1.e4 d5 — white's pawn can capture on d5
const BEFORE_NORMAL_CAPTURE = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
// Lone rook on a1 can check the black king down the open a-file, no capture involved
const BEFORE_CHECK = '4k3/8/8/8/8/8/8/R3K3 w - - 0 1';
// White pawn one step from promoting; black king placed off e8's rank/file/diagonals
// so the resulting queen does not also give check.
const BEFORE_PROMOTION = '8/4P3/8/8/8/8/1k6/4K3 w - - 0 1';
// 1.e4 e6 2.e5 d5 — white's e5 pawn can capture d5 en passant on d6.
const BEFORE_EN_PASSANT = 'rnbqkbnr/ppp2ppp/4p3/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';

describe('resolveDrop', () => {
  it('resolves a quiet move', () => {
    const result = resolveDrop(START, 'e2', 'e4');
    expect(result).toEqual({ san: 'e4', sound: 'quiet' });
  });

  it('resolves a capture', () => {
    const result = resolveDrop(BEFORE_NORMAL_CAPTURE, 'e4', 'd5');
    expect(result).toEqual({ san: 'exd5', sound: 'capture' });
  });

  it('resolves a move that gives check', () => {
    const result = resolveDrop(BEFORE_CHECK, 'a1', 'a8');
    expect(result).toEqual({ san: 'Ra8+', sound: 'check' });
  });

  it('returns null for an illegal move', () => {
    // e2 pawn cannot jump over its own rank restriction to e5 in one hop from
    // the start position (that square is only reachable in two moves).
    expect(resolveDrop(START, 'e2', 'e5')).toBeNull();
  });

  it('auto-promotes to a queen and treats a non-checking promotion as quiet', () => {
    const result = resolveDrop(BEFORE_PROMOTION, 'e7', 'e8');
    expect(result).toEqual({ san: 'e8=Q', sound: 'quiet' });
  });

  // Regression case: chess.js's own `Move.isCapture()` only checks the CAPTURE
  // flag and returns false for en passant (which sets only EP_CAPTURE), even
  // though a pawn is genuinely captured and the SAN correctly shows 'x'. A
  // naive `san.includes('x')` check gets this right by accident; a "verbose
  // data" check that uses `isCapture()` instead of `captured` gets it wrong.
  // This pins the implementation to `captured`, the field that agrees with
  // the SAN in every case, including this one.
  it('treats en passant as a capture even though chess.js Move.isCapture() would say otherwise', () => {
    const result = resolveDrop(BEFORE_EN_PASSANT, 'e5', 'd6');
    expect(result).toEqual({ san: 'exd6', sound: 'capture' });
  });
});

describe('resolveSan', () => {
  // resolveSan lets a SAN-only caller (the candidate rail, whose MultiPV
  // lines carry SAN but no from/to squares) share the exact same
  // capture/check classification resolveDrop uses, instead of duplicating it.
  it('resolves a quiet move', () => {
    expect(resolveSan(START, 'e4')).toEqual({ san: 'e4', sound: 'quiet' });
  });

  it('resolves a capture', () => {
    expect(resolveSan(BEFORE_NORMAL_CAPTURE, 'exd5')).toEqual({ san: 'exd5', sound: 'capture' });
  });

  it('resolves a move that gives check', () => {
    expect(resolveSan(BEFORE_CHECK, 'Ra8+')).toEqual({ san: 'Ra8+', sound: 'check' });
  });

  it('resolves en passant as a capture', () => {
    expect(resolveSan(BEFORE_EN_PASSANT, 'exd6')).toEqual({ san: 'exd6', sound: 'capture' });
  });

  it('returns null for an illegal SAN', () => {
    expect(resolveSan(START, 'e5')).toBeNull();
  });
});
