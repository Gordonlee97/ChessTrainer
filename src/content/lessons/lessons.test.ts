import { describe, expect, it } from 'vitest';
import { checkpointIds, validateLessonChess } from '../load';
import { ALL_LESSONS, lessonById } from './index';

describe('authored lessons', () => {
  it('has at least one lesson', () => {
    expect(ALL_LESSONS.length).toBeGreaterThan(0);
  });

  it.each(ALL_LESSONS.map((lesson) => [lesson.id, lesson] as const))(
    '%s replays legally through chess.js',
    (_id, lesson) => {
      expect(validateLessonChess(lesson)).toEqual([]);
    },
  );

  it('gives every lesson a unique id', () => {
    const ids = ALL_LESSONS.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every checkpoint an id unique across all lessons', () => {
    const ids = ALL_LESSONS.flatMap(checkpointIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('accepts at least one move at every checkpoint', () => {
    for (const lesson of ALL_LESSONS) {
      for (const segment of lesson.segments) {
        for (const move of segment.moves) {
          if (move.checkpoint) expect(move.checkpoint.accept.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never lets a nearMiss reply also be an accepted answer', () => {
    for (const lesson of ALL_LESSONS) {
      for (const segment of lesson.segments) {
        for (const move of segment.moves) {
          const checkpoint = move.checkpoint;
          if (!checkpoint?.nearMiss) continue;
          for (const san of Object.keys(checkpoint.nearMiss)) {
            expect(checkpoint.accept).not.toContain(san);
          }
        }
      }
    }
  });

  it('ends every note as a complete sentence', () => {
    for (const lesson of ALL_LESSONS) {
      for (const segment of lesson.segments) {
        for (const move of segment.moves) {
          if (move.note) expect(move.note).toMatch(/[.!?]$/);
        }
      }
    }
  });

  it('finds a lesson by id', () => {
    expect(lessonById('italian-game')?.title).toBe('The Italian Game');
    expect(lessonById('nope')).toBeUndefined();
  });
});
