import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { checkpointIds, validateLessonChess, validateOpeningCoverage } from '../load';
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

  it('asks the player for every move on their side of an opening', () => {
    for (const lesson of ALL_LESSONS) {
      expect({ id: lesson.id, problems: validateOpeningCoverage(lesson) })
        .toEqual({ id: lesson.id, problems: [] });
    }
  });

  // Every answer key is looked up by exact string against the SAN the board
  // produces, so a key chess.js spells differently is dead content: legal, but
  // unreachable. `validateLessonChess` cannot see this — chess.js accepts
  // sloppy SAN on input, so legality says nothing about spellability.
  it('spells every accept and nearMiss key exactly as chess.js does', () => {
    const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const mismatches: string[] = [];

    for (const lesson of ALL_LESSONS) {
      for (const segment of lesson.segments) {
        const chess = new Chess(segment.startFen ?? START_FEN);
        for (const move of segment.moves) {
          const fenBefore = chess.fen();
          const checkpoint = move.checkpoint;
          if (checkpoint) {
            const keys = [...checkpoint.accept, ...Object.keys(checkpoint.nearMiss ?? {})];
            for (const key of keys) {
              const probe = new Chess(fenBefore);
              let canonical: string;
              try {
                canonical = probe.move(key).san;
              } catch {
                // validateLessonChess already reports an illegal key.
                continue;
              }
              if (canonical !== key) {
                mismatches.push(
                  `${lesson.id} / ${checkpoint.id}: authored "${key}", chess.js spells it "${canonical}"`,
                );
              }
            }
          }
          try {
            chess.move(move.san);
          } catch {
            // validateLessonChess already reports an illegal authored move.
            break;
          }
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('finds a lesson by id', () => {
    expect(lessonById('italian-game')?.title).toBe('The Italian Game');
    expect(lessonById('nope')).toBeUndefined();
  });
});
