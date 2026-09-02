import type { SoundName } from './sounds';

/**
 * A single scheduled element of a sound. Recipes are plain data so the sound
 * *design* can be tested without any audio hardware — the direction of a rise,
 * the length of a click, the pitch of a capture against a quiet move are all
 * assertions against these objects, not against a rendered waveform.
 */
export interface ToneVoice {
  kind: 'tone';
  type: OscillatorType;
  /** Hz at the start of the voice. */
  from: number;
  /** Hz to glide to; omitted for a steady pitch. */
  to?: number;
  /** Seconds after the sound begins. */
  start: number;
  duration: number;
  /** Peak gain, 0-1 exclusive. Must be > 0: see `ramp` below. */
  gain: number;
}

export interface NoiseVoice {
  kind: 'noise';
  start: number;
  duration: number;
  gain: number;
  /** Optional band shaping; `to` sweeps the cutoff across the voice. */
  filter?: { type: BiquadFilterType; from: number; to?: number };
}

export type Voice = ToneVoice | NoiseVoice;

/** Just above silence. `exponentialRampToValueAtTime` throws on zero. */
const SILENT = 0.0001;

/**
 * Every sound the app plays, as data.
 *
 * The character of each one comes from `public/sounds/README.md`, which
 * described them for a sound designer before this project decided to
 * synthesise instead: a soft pop for a piece lifted, a rounded thunk for a
 * move, a heavier one with a crunch for a capture, a rising two-note for
 * check, and so on. The briefs turned out to be synthesis instructions
 * already.
 *
 * Frequencies are deliberately low and short. These fire on every click and
 * every move, so anything bright or long becomes irritating by the tenth
 * repetition — which is roughly ten seconds into using the app.
 */
export const RECIPES: Record<SoundName, Voice[]> = {
  // Soft pop — a small upward blip, like lifting something off a board.
  pickup: [
    { kind: 'tone', type: 'sine', from: 320, to: 440, start: 0, duration: 0.07, gain: 0.18 },
  ],

  // Rounded thunk — a low body with a tiny transient so it reads as contact
  // rather than as a tone.
  move: [
    { kind: 'tone', type: 'sine', from: 180, to: 120, start: 0, duration: 0.1, gain: 0.28 },
    { kind: 'noise', start: 0, duration: 0.03, gain: 0.1, filter: { type: 'lowpass', from: 1400 } },
  ],

  // Heavier thunk with a crunch — lower body, longer and brighter noise.
  capture: [
    { kind: 'tone', type: 'sine', from: 130, to: 70, start: 0, duration: 0.16, gain: 0.34 },
    { kind: 'noise', start: 0, duration: 0.09, gain: 0.22, filter: { type: 'bandpass', from: 2200, to: 700 } },
  ],

  // Rising two-note — an alert, not an alarm.
  check: [
    { kind: 'tone', type: 'triangle', from: 520, start: 0, duration: 0.1, gain: 0.2 },
    { kind: 'tone', type: 'triangle', from: 780, start: 0.09, duration: 0.14, gain: 0.2 },
  ],

  // Three-note rising chime — the reward, so it gets the cleanest waveform.
  correct: [
    { kind: 'tone', type: 'sine', from: 523.25, start: 0, duration: 0.12, gain: 0.22 }, // C5
    { kind: 'tone', type: 'sine', from: 659.25, start: 0.1, duration: 0.12, gain: 0.22 }, // E5
    { kind: 'tone', type: 'sine', from: 783.99, start: 0.2, duration: 0.22, gain: 0.24 }, // G5
  ],

  // Soft descending tone, deliberately not punishing — one note, gentle
  // waveform, no dissonance. A beginner hears this often and it must not
  // feel like a buzzer.
  incorrect: [
    { kind: 'tone', type: 'sine', from: 340, to: 240, start: 0, duration: 0.24, gain: 0.2 },
  ],

  // Paper slide — filtered noise sweeping down, no pitched content.
  hint: [
    { kind: 'noise', start: 0, duration: 0.18, gain: 0.12, filter: { type: 'bandpass', from: 3200, to: 900 } },
  ],

  // Whoosh — the same idea, longer and sweeping the other way.
  drawerOpen: [
    { kind: 'noise', start: 0, duration: 0.26, gain: 0.1, filter: { type: 'lowpass', from: 500, to: 4200 } },
  ],

  // Short fanfare — a major arpeggio, the only sound allowed to feel like an
  // event rather than a response.
  lessonComplete: [
    { kind: 'tone', type: 'triangle', from: 523.25, start: 0, duration: 0.14, gain: 0.2 }, // C5
    { kind: 'tone', type: 'triangle', from: 659.25, start: 0.12, duration: 0.14, gain: 0.2 }, // E5
    { kind: 'tone', type: 'triangle', from: 783.99, start: 0.24, duration: 0.14, gain: 0.2 }, // G5
    { kind: 'tone', type: 'triangle', from: 1046.5, start: 0.36, duration: 0.34, gain: 0.22 }, // C6
  ],

  // Short click — the most-fired sound in the app by a wide margin, so it is
  // the quietest and the shortest. Pitch variation is applied on top.
  buttonPress: [
    { kind: 'tone', type: 'sine', from: 900, to: 600, start: 0, duration: 0.035, gain: 0.1 },
    { kind: 'noise', start: 0, duration: 0.012, gain: 0.05, filter: { type: 'highpass', from: 2000 } },
  ],
};

/**
 * A percussive envelope: near-instant attack, exponential decay to silence.
 *
 * Exponential rather than linear because it is how physical objects decay, and
 * a linear fade on a 35ms click reads as a synthetic blip. The ramp target is
 * `SILENT` rather than 0 — `exponentialRampToValueAtTime` throws on a
 * non-positive value, which is a browser-only crash a jsdom test would never
 * catch.
 */
function envelope(gain: GainNode, at: number, duration: number, peak: number): void {
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.linearRampToValueAtTime(peak, at + Math.min(0.008, duration / 4));
  gain.gain.exponentialRampToValueAtTime(SILENT, at + duration);
}

function noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Realise a recipe on a live context.
 *
 * `pitch` multiplies every frequency, which is how `buttonPress` avoids
 * sounding mechanical when it fires twenty times a minute. It scales the
 * filter cutoffs too, so a pitched-up click stays proportionally bright
 * rather than turning dull.
 */
export function playVoices(ctx: AudioContext, voices: Voice[], pitch: number): void {
  const now = ctx.currentTime;

  for (const voice of voices) {
    const at = now + voice.start;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    envelope(gain, at, voice.duration, voice.gain);

    if (voice.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = voice.type;
      osc.frequency.setValueAtTime(voice.from * pitch, at);
      if (voice.to !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(voice.to * pitch, at + voice.duration);
      }
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + voice.duration);
      continue;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, voice.duration);

    if (voice.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = voice.filter.type;
      filter.frequency.setValueAtTime(voice.filter.from * pitch, at);
      if (voice.filter.to !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(voice.filter.to * pitch, at + voice.duration);
      }
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.connect(gain);
    }

    source.start(at);
    source.stop(at + voice.duration);
  }
}
