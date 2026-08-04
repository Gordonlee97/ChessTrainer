import { Howl } from 'howler';
import { PITCH_RANGE_SEMITONES, PITCH_VARIED, SOUND_FILES, type SoundName } from './sounds';

export class SoundManager {
  private readonly cache = new Map<SoundName, Howl>();
  private readonly failed = new Set<SoundName>();
  private isMuted = false;

  get muted(): boolean {
    return this.isMuted;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  play(name: SoundName): void {
    if (this.isMuted) return;
    // Howler never drains its internal call queue for a Howl that failed to
    // load, so once we know a sound is missing we must stop touching it —
    // otherwise every play() call leaks two queued closures forever.
    if (this.failed.has(name)) return;

    let howl = this.cache.get(name);
    if (!howl) {
      // A missing file must never break the app — the sound simply does not play.
      howl = new Howl({
        src: [SOUND_FILES[name]],
        preload: true,
        onloaderror: () => {
          this.failed.add(name);
        },
      });
      this.cache.set(name, howl);
    }

    if (PITCH_VARIED.has(name)) {
      const semitones = (Math.random() * 2 - 1) * PITCH_RANGE_SEMITONES;
      howl.rate(2 ** (semitones / 12));
    }

    howl.play();
  }
}
