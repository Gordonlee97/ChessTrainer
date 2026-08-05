import type { Lesson } from '../schema';
import { italianGame } from './italian-game';

/** Every authored lesson. The registry the picker and the runner read. */
export const ALL_LESSONS: Lesson[] = [italianGame];

export function lessonById(id: string): Lesson | undefined {
  return ALL_LESSONS.find((lesson) => lesson.id === id);
}
