import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  play: vi.fn(),
  rate: vi.fn(),
  once: vi.fn(),
}));

vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate, once: mocks.once })),
}));

import { SoundManager } from './SoundManager';

describe('SoundManager', () => {
  beforeEach(() => {
    mocks.play.mockClear();
    mocks.rate.mockClear();
  });

  it('plays the requested sound', () => {
    new SoundManager().play('move');
    expect(mocks.play).toHaveBeenCalledTimes(1);
  });

  it('varies button click pitch within +/- 2 semitones', () => {
    const manager = new SoundManager();
    for (let i = 0; i < 40; i += 1) manager.play('buttonPress');

    const rates = mocks.rate.mock.calls.map(([value]) => value as number);
    expect(rates.length).toBe(40);
    // 2 semitones is a factor of 2^(2/12) either way.
    const min = 2 ** (-2 / 12);
    const max = 2 ** (2 / 12);
    for (const value of rates) {
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    }
    expect(new Set(rates).size).toBeGreaterThan(1); // actually varying
  });

  it('does not vary pitch for non-button sounds', () => {
    new SoundManager().play('move');
    expect(mocks.rate).not.toHaveBeenCalled();
  });

  it('plays nothing while muted', () => {
    const manager = new SoundManager();
    manager.setMuted(true);
    manager.play('move');
    expect(mocks.play).not.toHaveBeenCalled();
    expect(manager.muted).toBe(true);
  });
});
