import { describe, expect, it } from 'vitest';
import { RECIPES, playVoices, type Voice } from './synth';
import { SOUND_NAMES, type SoundName } from './sounds';

const ALL_NAMES: readonly SoundName[] = SOUND_NAMES;

/**
 * A recording stand-in for AudioContext. jsdom has no Web Audio at all, so
 * there is nothing to spy on — this fake is the only way to assert what the
 * synth *would* schedule, and it doubles as proof that the real code path
 * touches nothing beyond the handful of methods implemented here.
 */
function fakeContext() {
  const created = { oscillators: 0, gains: 0, buffers: 0, filters: 0 };
  const scheduled: { freq: number; at: number }[] = [];
  const stops: number[] = [];

  const param = (onSet?: (value: number, at: number) => void) => ({
    value: 0,
    setValueAtTime(value: number, at: number) {
      onSet?.(value, at);
      return this;
    },
    linearRampToValueAtTime(value: number, at: number) {
      onSet?.(value, at);
      return this;
    },
    exponentialRampToValueAtTime(value: number, at: number) {
      // The real API throws on a zero or negative target. Enforcing it here
      // is the point: a recipe that ramps to silence with the exponential
      // form is a runtime crash in a browser and a silent pass otherwise.
      if (value <= 0) throw new RangeError('exponential ramp to non-positive value');
      onSet?.(value, at);
      return this;
    },
  });

  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    state: 'running' as AudioContextState,
    destination: {},
    resume: () => Promise.resolve(),
    createOscillator() {
      created.oscillators += 1;
      return {
        type: 'sine' as OscillatorType,
        frequency: param((value, at) => scheduled.push({ freq: value, at })),
        connect: () => undefined,
        start: () => undefined,
        stop: (at: number) => stops.push(at),
      };
    },
    createGain() {
      created.gains += 1;
      return { gain: param(), connect: () => undefined };
    },
    createBiquadFilter() {
      created.filters += 1;
      return { type: 'lowpass' as BiquadFilterType, frequency: param(), connect: () => undefined };
    },
    createBuffer(_channels: number, length: number, _rate: number) {
      created.buffers += 1;
      return { getChannelData: () => new Float32Array(length) };
    },
    createBufferSource() {
      return {
        buffer: null,
        connect: () => undefined,
        start: () => undefined,
        stop: (at: number) => stops.push(at),
      };
    },
  };

  return { ctx: ctx as unknown as AudioContext, created, scheduled, stops };
}

const tones = (voices: Voice[]) => voices.filter((v) => v.kind === 'tone');

describe('RECIPES', () => {
  it('defines a recipe for every wired sound', () => {
    for (const name of ALL_NAMES) {
      expect(RECIPES[name], `missing recipe: ${name}`).toBeDefined();
      expect(RECIPES[name].length).toBeGreaterThan(0);
    }
  });

  it('keeps every frequency inside human hearing', () => {
    for (const name of ALL_NAMES) {
      for (const voice of tones(RECIPES[name])) {
        expect(voice.from, `${name}`).toBeGreaterThan(20);
        expect(voice.from, `${name}`).toBeLessThan(20000);
        if (voice.to !== undefined) {
          expect(voice.to, `${name}`).toBeGreaterThan(20);
          expect(voice.to, `${name}`).toBeLessThan(20000);
        }
      }
    }
  });

  /**
   * These are UI sounds fired on every click and every move. One that outlasts
   * the interaction stacks on the next one and turns into a drone — the
   * failure this bound exists to prevent.
   */
  it('keeps every sound short enough to fire repeatedly', () => {
    for (const name of ALL_NAMES) {
      const end = Math.max(...RECIPES[name].map((v) => v.start + v.duration));
      expect(end, `${name} runs ${end}s`).toBeLessThanOrEqual(1.2);
    }
  });

  it('never asks for a silent exponential ramp', () => {
    for (const name of ALL_NAMES) {
      for (const voice of RECIPES[name]) {
        expect(voice.gain, `${name}`).toBeGreaterThan(0);
      }
    }
  });

  // The README describes each sound's character; these three are the ones
  // whose character is a *direction*, so a recipe can contradict its own brief
  // while still producing sound. Asserting the direction is what catches that.
  it('rises for the sounds the brief calls rising', () => {
    for (const name of ['check', 'correct', 'lessonComplete'] as SoundName[]) {
      const pitches = tones(RECIPES[name]).map((v) => v.to ?? v.from);
      expect(pitches.length, `${name}`).toBeGreaterThan(1);
      const rises = pitches.slice(1).every((p, i) => p > pitches[i]);
      expect(rises, `${name} should rise: ${pitches.join(' -> ')}`).toBe(true);
    }
  });

  it('descends for the sound the brief calls descending', () => {
    const [first] = tones(RECIPES.incorrect);
    expect(first.to).toBeDefined();
    expect(first.to!).toBeLessThan(first.from);
  });

  it('makes a capture heavier than a quiet move', () => {
    const lowest = (name: SoundName) => Math.min(...tones(RECIPES[name]).map((v) => v.from));
    expect(lowest('capture')).toBeLessThan(lowest('move'));
  });
});

describe('playVoices', () => {
  it('creates one oscillator per tone voice', () => {
    const { ctx, created } = fakeContext();
    playVoices(ctx, RECIPES.correct, 1);
    expect(created.oscillators).toBe(tones(RECIPES.correct).length);
  });

  it('schedules every voice relative to the context clock, never in the past', () => {
    const { ctx, scheduled } = fakeContext();
    (ctx as unknown as { currentTime: number }).currentTime = 12.5;
    playVoices(ctx, RECIPES.check, 1);
    for (const s of scheduled) expect(s.at).toBeGreaterThanOrEqual(12.5);
  });

  it('stops every source it starts', () => {
    const { ctx, created, stops } = fakeContext();
    playVoices(ctx, RECIPES.capture, 1);
    expect(stops.length).toBe(created.oscillators + RECIPES.capture.filter((v) => v.kind === 'noise').length);
  });

  /**
   * The multiplier is how `buttonPress` avoids sounding mechanical on repeat.
   * It has to reach the frequencies, not merely be accepted.
   */
  it('applies the pitch multiplier to every scheduled frequency', () => {
    const plain = fakeContext();
    playVoices(plain.ctx, RECIPES.buttonPress, 1);
    const raised = fakeContext();
    playVoices(raised.ctx, RECIPES.buttonPress, 2);

    expect(raised.scheduled.length).toBe(plain.scheduled.length);
    expect(raised.scheduled.length).toBeGreaterThan(0);
    for (const [i, s] of raised.scheduled.entries()) {
      expect(s.freq).toBeCloseTo(plain.scheduled[i].freq * 2, 5);
    }
  });

  it('plays every recipe without throwing', () => {
    for (const name of ALL_NAMES) {
      const { ctx } = fakeContext();
      expect(() => playVoices(ctx, RECIPES[name], 1), `${name}`).not.toThrow();
    }
  });
});
