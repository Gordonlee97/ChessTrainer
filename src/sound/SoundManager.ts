import { PITCH_RANGE_SEMITONES, PITCH_VARIED, type SoundName } from './sounds';
import { RECIPES, playVoices } from './synth';

const MUTE_KEY = 'chesstrainer.muted';

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Plays the app's sounds by synthesising them, rather than by loading files.
 *
 * The project ships no audio assets — see `CLAUDE.md` — because the files
 * were never this project's to ship. Generating the sounds sidesteps that
 * entirely: nothing is licensed, nothing is downloaded, and the whole sound
 * design is a few dozen numbers in `synth.ts` that can be tuned by editing
 * them rather than by re-recording anything.
 *
 * Every failure path is silent by construction. No Web Audio, a context the
 * browser refuses to create, a suspended context that will not resume — each
 * one leaves the app fully usable and quiet. Sound is a garnish here, and it
 * must never be the reason something breaks.
 */
export class SoundManager {
  private context: AudioContext | null = null;
  /** Set once creating a context has failed, so it is attempted exactly once. */
  private unavailable = false;
  private isMuted = readStoredMute();

  get muted(): boolean {
    return this.isMuted;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem(MUTE_KEY, String(muted));
    } catch {
      // A browser that refuses storage must still mute for the session —
      // sound is optional by construction and this must never throw.
    }
  }

  play(name: SoundName): void {
    if (this.isMuted) return;

    const ctx = this.acquireContext();
    if (!ctx) return;

    try {
      playVoices(ctx, RECIPES[name], this.pitchFor(name));
    } catch {
      // A scheduling failure on one sound must not take the click with it.
    }
  }

  /**
   * The context is created on first play rather than in the constructor, for
   * two reasons: a page that never makes a sound never pays for an audio
   * graph, and browsers refuse to start one outside a user gesture — the
   * first `play()` is always inside a click or a keypress, which the module's
   * construction is not.
   */
  private acquireContext(): AudioContext | null {
    if (this.unavailable) return null;

    if (!this.context) {
      const Ctor = typeof AudioContext !== 'undefined' ? AudioContext : undefined;
      if (!Ctor) {
        this.unavailable = true;
        return null;
      }
      try {
        this.context = new Ctor();
      } catch {
        this.unavailable = true;
        return null;
      }
    }

    // Autoplay policy parks a fresh context in 'suspended' until a gesture.
    // Resuming is fire-and-forget: this sound may be lost, the next will not.
    if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);

    return this.context;
  }

  /**
   * A multiplier on every frequency in the recipe. Only the button press is
   * varied — it fires far more often than anything else, and identical
   * repeats are what make an interface feel mechanical.
   */
  private pitchFor(name: SoundName): number {
    if (!PITCH_VARIED.has(name)) return 1;
    const semitones = (Math.random() * 2 - 1) * PITCH_RANGE_SEMITONES;
    return 2 ** (semitones / 12);
  }
}
