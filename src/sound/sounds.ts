export const SOUND_FILES = {
  pickup: '/sounds/pickup.mp3',
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  correct: '/sounds/correct.mp3',
  incorrect: '/sounds/incorrect.mp3',
  hint: '/sounds/hint.mp3',
  drawerOpen: '/sounds/drawer-open.mp3',
  lessonComplete: '/sounds/lesson-complete.mp3',
  buttonPress: '/sounds/button-press.mp3',
} as const;

export type SoundName = keyof typeof SOUND_FILES;

/** Sounds that get random pitch variation so repeats do not sound mechanical. */
export const PITCH_VARIED: ReadonlySet<SoundName> = new Set<SoundName>(['buttonPress']);

/** Two semitones up or down, expressed as a playback rate multiplier. */
export const PITCH_RANGE_SEMITONES = 2;
