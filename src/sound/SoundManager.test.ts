import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  play: vi.fn(),
  rate: vi.fn(),
}));

vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { Howl } from 'howler';
import { SoundManager } from './SoundManager';

const HowlMock = vi.mocked(Howl);

describe('SoundManager', () => {
  beforeEach(() => {
    mocks.play.mockClear();
    mocks.rate.mockClear();
    HowlMock.mockClear();
    localStorage.clear();
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

  it('does not construct a Howl at all while muted', () => {
    const manager = new SoundManager();
    manager.setMuted(true);
    manager.play('move');
    expect(HowlMock).not.toHaveBeenCalled();
  });

  it('stops calling play/rate on a sound whose file permanently failed to load', () => {
    const manager = new SoundManager();
    manager.play('buttonPress');
    expect(mocks.play).toHaveBeenCalledTimes(1);

    const onloaderror = HowlMock.mock.calls[0][0]?.onloaderror as () => void;
    expect(typeof onloaderror).toBe('function');
    onloaderror();

    mocks.play.mockClear();
    mocks.rate.mockClear();

    manager.play('buttonPress');
    manager.play('buttonPress');

    expect(mocks.play).not.toHaveBeenCalled();
    expect(mocks.rate).not.toHaveBeenCalled();
  });

  it('starts muted when that was stored', () => {
    localStorage.setItem('chesstrainer.muted', 'true');
    expect(new SoundManager().muted).toBe(true);
    localStorage.clear();
  });

  it('persists a mute change', () => {
    const manager = new SoundManager();
    manager.setMuted(true);
    expect(localStorage.getItem('chesstrainer.muted')).toBe('true');
    localStorage.clear();
  });

  it('still mutes when storage refuses to write', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('denied');
    };
    const manager = new SoundManager();
    expect(() => manager.setMuted(true)).not.toThrow();
    expect(manager.muted).toBe(true);
    Storage.prototype.setItem = original;
  });
});
