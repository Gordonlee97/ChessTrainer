import { describe, expect, it } from 'vitest';
import {
  addSavedLine,
  emptyProgress,
  lessonProgress,
  recordAttempt,
  recordLessonComplete,
  removeSavedLine,
} from './progress';

const line = {
  id: 'l1',
  name: 'My Italian',
  startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn: '1. e4 e5',
  createdAt: '2026-08-06T00:00:00.000Z',
};

describe('emptyProgress', () => {
  it('starts at version 1 with nothing recorded', () => {
    expect(emptyProgress()).toEqual({ version: 1, lessons: {}, savedLines: [] });
  });
});

describe('recordAttempt', () => {
  it('creates the lesson and checkpoint records on first use', () => {
    const p = recordAttempt(emptyProgress(), 'italian-game', 'cp1', {
      solved: false,
      hintsUsed: 0,
    });
    expect(p.lessons['italian-game'].checkpoints.cp1).toEqual({
      attempts: 1,
      hintsUsed: 0,
      solved: false,
    });
  });

  it('counts attempts cumulatively', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'cp', { solved: false, hintsUsed: 0 });
    p = recordAttempt(p, 'l', 'cp', { solved: false, hintsUsed: 1 });
    expect(p.lessons.l.checkpoints.cp.attempts).toBe(2);
  });

  it('records the hints used on the latest attempt', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'cp', { solved: false, hintsUsed: 0 });
    p = recordAttempt(p, 'l', 'cp', { solved: true, hintsUsed: 2 });
    expect(p.lessons.l.checkpoints.cp.hintsUsed).toBe(2);
  });

  it('never un-solves a checkpoint that was already solved', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'cp', { solved: true, hintsUsed: 0 });
    p = recordAttempt(p, 'l', 'cp', { solved: false, hintsUsed: 0 });
    expect(p.lessons.l.checkpoints.cp.solved).toBe(true);
  });

  it('does not mutate the progress it was given', () => {
    const before = emptyProgress();
    recordAttempt(before, 'l', 'cp', { solved: true, hintsUsed: 0 });
    expect(before.lessons).toEqual({});
  });

  it('keeps other lessons and checkpoints untouched', () => {
    let p = recordAttempt(emptyProgress(), 'a', 'cp1', { solved: true, hintsUsed: 0 });
    p = recordAttempt(p, 'b', 'cp2', { solved: false, hintsUsed: 3 });
    expect(p.lessons.a.checkpoints.cp1.solved).toBe(true);
    expect(p.lessons.b.checkpoints.cp2.hintsUsed).toBe(3);
  });
});

describe('recordLessonComplete', () => {
  it('stamps the completion time', () => {
    const p = recordLessonComplete(emptyProgress(), 'l', '2026-08-06T00:00:00.000Z');
    expect(p.lessons.l.completedAt).toBe('2026-08-06T00:00:00.000Z');
  });

  it('keeps the first completion time on a repeat', () => {
    let p = recordLessonComplete(emptyProgress(), 'l', '2026-08-06T00:00:00.000Z');
    p = recordLessonComplete(p, 'l', '2026-08-07T00:00:00.000Z');
    expect(p.lessons.l.completedAt).toBe('2026-08-06T00:00:00.000Z');
  });

  it('preserves checkpoint records already recorded', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'cp', { solved: true, hintsUsed: 1 });
    p = recordLessonComplete(p, 'l', '2026-08-06T00:00:00.000Z');
    expect(p.lessons.l.checkpoints.cp.solved).toBe(true);
  });
});

describe('saved lines', () => {
  it('adds a line', () => {
    expect(addSavedLine(emptyProgress(), line).savedLines).toEqual([line]);
  });

  it('puts the newest line first', () => {
    const older = { ...line, id: 'l0', name: 'Older' };
    const p = addSavedLine(addSavedLine(emptyProgress(), older), line);
    expect(p.savedLines.map((l) => l.id)).toEqual(['l1', 'l0']);
  });

  it('removes a line by id', () => {
    const p = removeSavedLine(addSavedLine(emptyProgress(), line), 'l1');
    expect(p.savedLines).toEqual([]);
  });

  it('ignores removing a line that is not there', () => {
    const p = addSavedLine(emptyProgress(), line);
    expect(removeSavedLine(p, 'nope').savedLines).toHaveLength(1);
  });
});

describe('lessonProgress', () => {
  it('reports nothing solved for an untouched lesson', () => {
    expect(lessonProgress(emptyProgress(), 'l', ['a', 'b'])).toEqual({
      solved: 0,
      total: 2,
      completed: false,
    });
  });

  it('counts only the checkpoints the lesson actually has', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'a', { solved: true, hintsUsed: 0 });
    // A checkpoint id from some other lesson must not be counted here.
    p = recordAttempt(p, 'l', 'stale', { solved: true, hintsUsed: 0 });
    expect(lessonProgress(p, 'l', ['a', 'b']).solved).toBe(1);
  });

  it('reports completed once the lesson has a completion time', () => {
    const p = recordLessonComplete(emptyProgress(), 'l', '2026-08-06T00:00:00.000Z');
    expect(lessonProgress(p, 'l', []).completed).toBe(true);
  });
});
