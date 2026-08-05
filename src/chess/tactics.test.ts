import { describe, expect, it } from 'vitest';
import { findFork, findPin } from './tactics';

// A knight on d5 attacks b4 b6 c3 c7 e3 e7 f4 f6 — so it hits both the queen
// on b6 and the rook on f6.
const KNIGHT_FORK = '4k3/8/1q3r2/3N4/8/8/8/4K3 w - - 0 1';
// Same knight, only the f6 rook in range
const NO_FORK = '4k3/8/5r2/3N4/8/8/8/4K3 w - - 0 1';
// Bishop b5, knight c6, king e8 — one unbroken diagonal
const BISHOP_PIN = '4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1';
// The same board with Black to move: a pin is a fact about the position, not
// about whose turn it is
const PIN_BLACK_TO_MOVE = '4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1';
// Rook a1 pins the bishop a5 against the king a8 down the a-file
const ROOK_PIN = 'k7/8/8/b7/8/8/8/R3K3 w - - 0 1';

describe('findFork', () => {
  it('finds a knight forking two valuable pieces', () => {
    const fork = findFork(KNIGHT_FORK, 'd5');
    expect(fork).not.toBeNull();
    expect(fork!.forker).toBe('d5');
    expect(fork!.targets.sort()).toEqual(['b6', 'f6']);
  });

  it('returns null when only one enemy piece is attacked', () => {
    expect(findFork(NO_FORK, 'd5')).toBeNull();
  });

  it('returns null when the square is empty', () => {
    expect(findFork(NO_FORK, 'h8')).toBeNull();
  });
});

describe('findPin', () => {
  it('finds a bishop pinning a knight against the king', () => {
    const pin = findPin(BISHOP_PIN, 'b5');
    expect(pin).toEqual({ pinner: 'b5', pinned: 'c6', against: 'e8' });
  });

  it('finds a rook pin along a file', () => {
    const pin = findPin(ROOK_PIN, 'a1');
    expect(pin).toEqual({ pinner: 'a1', pinned: 'a5', against: 'a8' });
  });

  it('returns null for a knight, which cannot pin', () => {
    expect(findPin(KNIGHT_FORK, 'd5')).toBeNull();
  });

  it('returns null when the square is empty', () => {
    expect(findPin(BISHOP_PIN, 'h1')).toBeNull();
  });

  it('does not treat the side-to-move flag as relevant', () => {
    expect(findPin(PIN_BLACK_TO_MOVE, 'b5')).toEqual({
      pinner: 'b5',
      pinned: 'c6',
      against: 'e8',
    });
  });
});
