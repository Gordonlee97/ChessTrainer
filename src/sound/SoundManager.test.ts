import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundManager } from './SoundManager';

/**
 * jsdom implements no Web Audio at all, so `AudioContext` is genuinely absent
 * here unless a test installs one. That absence is itself the most important
 * case: a browser without Web Audio, or one that refuses to create a context,
 * must leave the app fully usable and silent — `CLAUDE.md`'s "sound is
 * optional by construction" rule.
 */
type Ctx = { created: number; resumed: number; state: AudioContextState };

function installAudioContext(state: AudioContextState = 'running'): Ctx {
  const record: Ctx = { created: 0, resumed: 0, state };

  class FakeAudioContext {
    currentTime = 0;
    sampleRate = 48000;
    destination = {};
    get state() {
      return record.state;
    }
    constructor() {
      record.created += 1;
    }
    resume() {
      record.resumed += 1;
      record.state = 'running';
      return Promise.resolve();
    }
    createGain() {
      return { gain: audioParam(), connect: () => undefined };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: audioParam(),
        connect: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      };
    }
    createBiquadFilter() {
      return { type: 'lowpass', frequency: audioParam(), connect: () => undefined };
    }
    createBuffer(_c: number, length: number) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createBufferSource() {
      return {
        buffer: null,
        connect: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      };
    }
  }

  const audioParam = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  });

  vi.stubGlobal('AudioContext', FakeAudioContext);
  return record;
}

describe('SoundManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates one AudioContext and reuses it across plays', () => {
    const ctx = installAudioContext();
    const manager = new SoundManager();

    manager.play('move');
    manager.play('capture');
    manager.play('move');

    expect(ctx.created).toBe(1);
  });

  it('creates no AudioContext until something is actually played', () => {
    const ctx = installAudioContext();
    new SoundManager();
    expect(ctx.created).toBe(0);
  });

  /**
   * Browsers start an AudioContext suspended until a user gesture. Without
   * this, the app is silent until some unrelated later click happens to
   * resume it — a bug that looks like "sound doesn't work" and reproduces
   * only on a fresh page load.
   */
  it('resumes a context the browser suspended until a gesture', () => {
    const ctx = installAudioContext('suspended');
    new SoundManager().play('move');
    expect(ctx.resumed).toBe(1);
  });

  it('does not resume a context that is already running', () => {
    const ctx = installAudioContext('running');
    new SoundManager().play('move');
    expect(ctx.resumed).toBe(0);
  });

  it('stays silent and unbroken where Web Audio does not exist', () => {
    // No stub installed: this is jsdom's real state, and a browser old enough
    // to lack AudioContext behaves identically.
    const manager = new SoundManager();
    expect(() => manager.play('move')).not.toThrow();
  });

  it('never throws when constructing a context fails', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('blocked by policy');
        }
      },
    );
    const manager = new SoundManager();
    expect(() => manager.play('move')).not.toThrow();
    // And it must not retry forever on every later play.
    expect(() => manager.play('move')).not.toThrow();
  });

  it('creates no AudioContext at all while muted', () => {
    const ctx = installAudioContext();
    const manager = new SoundManager();
    manager.setMuted(true);
    manager.play('move');

    expect(ctx.created).toBe(0);
    expect(manager.muted).toBe(true);
  });

  it('starts muted when that was stored', () => {
    localStorage.setItem('chesstrainer.muted', 'true');
    expect(new SoundManager().muted).toBe(true);
  });

  it('persists a mute change', () => {
    const manager = new SoundManager();
    manager.setMuted(true);
    expect(localStorage.getItem('chesstrainer.muted')).toBe('true');
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

  it('varies button-press pitch across repeats, and only for that sound', () => {
    installAudioContext();
    const manager = new SoundManager();

    const pitches: number[] = [];
    const spy = vi
      .spyOn(manager as unknown as { pitchFor(name: string): number }, 'pitchFor')
      .mockImplementation(function (this: unknown, name: string) {
        const value = (
          SoundManager.prototype as unknown as { pitchFor(n: string): number }
        ).pitchFor.call(this, name);
        pitches.push(value);
        return value;
      });

    for (let i = 0; i < 40; i += 1) manager.play('buttonPress');
    manager.play('move');
    spy.mockRestore();

    const varied = pitches.slice(0, 40);
    expect(new Set(varied).size).toBeGreaterThan(1);
    // Two semitones either way.
    for (const p of varied) {
      expect(p).toBeGreaterThanOrEqual(2 ** (-2 / 12));
      expect(p).toBeLessThanOrEqual(2 ** (2 / 12));
    }
    expect(pitches[40]).toBe(1); // 'move' is never pitch-shifted
  });
});
