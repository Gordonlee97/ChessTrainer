/**
 * Every sound the app can play.
 *
 * This was a map of names to `/sounds/*.mp3` paths until the sounds became
 * synthesised — see `synth.ts`. Nothing is fetched now, so a name is all a
 * caller needs; the recipe behind it lives with the synthesiser.
 */
export const SOUND_NAMES = [
  'pickup',
  'move',
  'capture',
  'check',
  'correct',
  'incorrect',
  'hint',
  'drawerOpen',
  'lessonComplete',
  'buttonPress',
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

/** Sounds that get random pitch variation so repeats do not sound mechanical. */
export const PITCH_VARIED: ReadonlySet<SoundName> = new Set<SoundName>(['buttonPress']);

/** Two semitones up or down. */
export const PITCH_RANGE_SEMITONES = 2;
