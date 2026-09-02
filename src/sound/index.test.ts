import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sounds } from './index';

/**
 * Counts contexts rather than plays: the shared manager creates exactly one
 * AudioContext, lazily, and only when something actually sounds. That makes
 * "did anything play?" observable without reaching inside the manager.
 */
function installAudioContext(): { created: number } {
  const record = { created: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  });

  vi.stubGlobal(
    'AudioContext',
    class {
      currentTime = 0;
      sampleRate = 48000;
      destination = {};
      state: AudioContextState = 'running';
      constructor() {
        record.created += 1;
      }
      resume() {
        return Promise.resolve();
      }
      createGain() {
        return { gain: param(), connect: () => undefined };
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: param(),
          connect: () => undefined,
          start: () => undefined,
          stop: () => undefined,
        };
      }
      createBiquadFilter() {
        return { type: 'lowpass', frequency: param(), connect: () => undefined };
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
    },
  );

  return record;
}

describe('shared sound manager', () => {
  beforeEach(() => {
    sounds.setMuted(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sounds.setMuted(false);
    localStorage.clear();
  });

  it('is a single instance every consumer imports', async () => {
    // A second import of the same specifier must resolve to the same module
    // instance (guaranteed by the ES module cache), giving every consumer —
    // Button, Board, CandidateRail — one shared mute flag instead of each
    // holding its own SoundManager.
    const again = await import('./index');
    expect(again.sounds).toBe(sounds);
  });

  /**
   * Both halves matter. Asserting only that a muted manager stays quiet would
   * pass against a manager that is quiet always — which is exactly what this
   * file asserted before the move to synthesis, when it checked a mock of a
   * library the code no longer imported.
   */
  it('honors a single mute toggle for every consumer', () => {
    const muted = installAudioContext();
    sounds.setMuted(true);
    sounds.play('move');
    expect(muted.created).toBe(0);

    vi.unstubAllGlobals();
    const unmuted = installAudioContext();
    sounds.setMuted(false);
    sounds.play('move');
    expect(unmuted.created).toBe(1);
  });
});
