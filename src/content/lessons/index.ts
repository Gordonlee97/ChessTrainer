import type { Lesson } from '../schema';
import { blackVsE4 } from './black-vs-e4';
import { italianGame } from './italian-game';
import { londonSystem } from './london-system';
import { themeControlTheCentre } from './theme-control-the-centre';
import { themeDevelopmentAndTempo } from './theme-development-and-tempo';
import { themeForksAndPins } from './theme-forks-and-pins';
import { themeKingsideAttack } from './theme-kingside-attack';

/** Every authored lesson. The registry the picker and the runner read. */
export const ALL_LESSONS: Lesson[] = [
  italianGame,
  blackVsE4,
  londonSystem,
  themeControlTheCentre,
  themeDevelopmentAndTempo,
  themeForksAndPins,
  themeKingsideAttack,
];

export function lessonById(id: string): Lesson | undefined {
  return ALL_LESSONS.find((lesson) => lesson.id === id);
}
