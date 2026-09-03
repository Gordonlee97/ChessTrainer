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
  /**
   * Optional band shaping; `to` sweeps the cutoff across the voice.
   *
   * `q` is what makes noise sound like a *struck object* rather than a hiss.
   * At the browser default (~1) a bandpass is broad and airy; at 6-10 it rings
   * around its centre frequency, which is how a wooden body reads. It is the
   * single most important parameter in this file for the move and capture
   * sounds.
   */
  filter?: { type: BiquadFilterType; from: number; to?: number; q?: number };
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
  // A piece lifted: the lightest possible tap. Higher body than a placed
  // piece and half the length, because nothing is being struck against the
  // board — the piece is leaving it.
  pickup: [
    { kind: 'noise', start: 0, duration: 0.035, gain: 0.3, filter: { type: 'bandpass', from: 760, q: 7 } },
    { kind: 'noise', start: 0, duration: 0.005, gain: 0.1, filter: { type: 'highpass', from: 3200 } },
  ],

  // A piece placed. Two layers, which is what a real impact is: a broadband
  // tick for the contact, and a resonant body for the wood.
  //
  // Note there is no oscillator here at all. The first version of this file
  // used a 180 Hz sine and it read as a beep — a sustained pitch is the one
  // thing a wooden knock never has. The pitch you hear is the bandpass
  // ringing, not a tone.
  move: [
    { kind: 'noise', start: 0, duration: 0.07, gain: 0.5, filter: { type: 'bandpass', from: 390, q: 7 } },
    { kind: 'noise', start: 0, duration: 0.006, gain: 0.16, filter: { type: 'highpass', from: 2600 } },
  ],

  // A capture is the same event with more force: a deeper body that rings
  // longer, plus a mid crack the quiet move does not have.
  capture: [
    { kind: 'noise', start: 0, duration: 0.11, gain: 0.55, filter: { type: 'bandpass', from: 250, q: 6 } },
    { kind: 'noise', start: 0, duration: 0.035, gain: 0.28, filter: { type: 'bandpass', from: 1500, q: 2.5 } },
    { kind: 'noise', start: 0, duration: 0.008, gain: 0.2, filter: { type: 'highpass', from: 3000 } },
  ],

  // Check is a notification, not an impact, so it is allowed a pitch — but a
  // short one that decays like a struck bar rather than a held beep.
  check: [
    { kind: 'tone', type: 'triangle', from: 660, start: 0, duration: 0.07, gain: 0.16 },
    { kind: 'tone', type: 'triangle', from: 990, start: 0.06, duration: 0.1, gain: 0.14 },
  ],

  // Mate. Until this existed, checkmate played `check` — the same two rising
  // notes as any other check, which is the wrong message twice over: it says
  // "look out" for a game that is already over, and it makes the most
  // consequential move on a board indistinguishable from the most routine one.
  //
  // Three things separate it from `check`. It *falls* rather than rises, which
  // is what closes a phrase instead of opening one. It ends on a note held four
  // times longer than anything else in this file — mate is the one moment where
  // a sound is allowed to take its time, because nothing follows it. And it
  // opens with an impact, because `check`'s pure tones sit oddly on a move that
  // just landed a piece: this is the only board event where no `move` or
  // `capture` sound plays alongside, so the thud has to come from here or not
  // at all.
  checkmate: [
    { kind: 'noise', start: 0, duration: 0.09, gain: 0.45, filter: { type: 'bandpass', from: 320, q: 6 } },
    { kind: 'tone', type: 'triangle', from: 587.33, start: 0.04, duration: 0.13, gain: 0.15 }, // D5
    { kind: 'tone', type: 'triangle', from: 440, start: 0.15, duration: 0.15, gain: 0.15 }, // A4
    { kind: 'tone', type: 'triangle', from: 293.66, start: 0.28, duration: 0.34, gain: 0.16 }, // D4
  ],

  // Solved. Two notes rather than three, and short: the old version held each
  // note for 0.12-0.22s, which is long enough to read as a melody demanding
  // attention rather than a confirmation you hear and move past.
  correct: [
    { kind: 'tone', type: 'sine', from: 659.25, start: 0, duration: 0.07, gain: 0.16 }, // E5
    { kind: 'tone', type: 'sine', from: 987.77, start: 0.065, duration: 0.13, gain: 0.15 }, // B5
  ],

  // Missed. A beginner hears this constantly, so it is the quietest sound in
  // the set and barely a pitch at all — a soft low thud with a hint of fall,
  // deliberately closer to a dropped piece than to a buzzer.
  incorrect: [
    { kind: 'tone', type: 'sine', from: 260, to: 200, start: 0, duration: 0.12, gain: 0.13 },
    { kind: 'noise', start: 0, duration: 0.05, gain: 0.12, filter: { type: 'bandpass', from: 300, q: 4 } },
  ],

  // Paper slide.
  hint: [
    { kind: 'noise', start: 0, duration: 0.13, gain: 0.09, filter: { type: 'bandpass', from: 2600, to: 900, q: 1.4 } },
  ],

  // Whoosh, quieter than before — it fires alongside a panel appearing, and
  // was competing with the thing it was meant to accompany.
  drawerOpen: [
    { kind: 'noise', start: 0, duration: 0.2, gain: 0.07, filter: { type: 'lowpass', from: 600, to: 3600 } },
  ],

  // The one sound allowed to feel like an event. Still shortened: four notes
  // at 0.14s each ran over half a second, which is a long time to wait after
  // clicking something.
  lessonComplete: [
    { kind: 'tone', type: 'triangle', from: 523.25, start: 0, duration: 0.09, gain: 0.16 }, // C5
    { kind: 'tone', type: 'triangle', from: 659.25, start: 0.08, duration: 0.09, gain: 0.16 }, // E5
    { kind: 'tone', type: 'triangle', from: 783.99, start: 0.16, duration: 0.09, gain: 0.16 }, // G5
    { kind: 'tone', type: 'triangle', from: 1046.5, start: 0.24, duration: 0.22, gain: 0.17 }, // C6
  ],

  // The most-fired sound in the app by a wide margin. A dry UI tick with no
  // pitch to get tired of — the old 900 Hz sine was a chirp, and a chirp
  // repeated forty times a minute is the fastest way to make someone mute an
  // app. Pitch variation still applies on top.
  buttonPress: [
    { kind: 'noise', start: 0, duration: 0.016, gain: 0.13, filter: { type: 'bandpass', from: 1900, q: 2 } },
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
  // 1.5ms, not 8ms. On a 40ms click an 8ms ramp is a sixth of the whole sound
  // spent fading in, which robs it of its transient and leaves something that
  // reads as a soft beep rather than an impact.
  const attack = Math.min(0.0015, duration / 6);
  gain.gain.setValueAtTime(SILENT, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
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
      if (voice.filter.q !== undefined) filter.Q.setValueAtTime(voice.filter.q, at);
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
