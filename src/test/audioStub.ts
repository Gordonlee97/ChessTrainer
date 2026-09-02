import { vi } from 'vitest';

/**
 * A counting stand-in for Web Audio, for component tests that need to know
 * whether a sound actually came out.
 *
 * jsdom implements no Web Audio, so without this every sound is a silent
 * no-op and a test asserting "muted produces nothing" passes against a
 * component that never had sound wired at all. Counting nodes is what makes
 * the muted and unmuted cases distinguishable.
 *
 * `gains` is the useful counter: every voice in every recipe builds exactly
 * one gain node, so any sound at all pushes it above zero, and it keeps
 * counting after the shared manager's one AudioContext already exists —
 * unlike context creation, which happens once per process.
 */
export interface AudioStub {
  /** Gain nodes built since the last `reset()` — non-zero means sound played. */
  readonly gains: number;
  reset(): void;
}

export function installAudioStub(): AudioStub {
  const state = { gains: 0 };

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
      resume() {
        return Promise.resolve();
      }
      createGain() {
        state.gains += 1;
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
      createBuffer(_channels: number, length: number) {
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

  return {
    get gains() {
      return state.gains;
    },
    reset() {
      state.gains = 0;
    },
  };
}
