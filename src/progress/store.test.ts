import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from './storage';
import { useProgressStore } from './store';

describe('progress store', () => {
  beforeEach(() => {
    localStorage.clear();
    useProgressStore.getState().reset();
  });

  it('starts empty', () => {
    expect(useProgressStore.getState().progress.lessons).toEqual({});
  });

  it('records an attempt and persists it', () => {
    useProgressStore.getState().noteAttempt('l', 'cp', { solved: true, hintsUsed: 1 }, 'k1');
    expect(useProgressStore.getState().progress.lessons.l.checkpoints.cp.solved).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('cp');
  });

  it('ignores a repeat of the same dedupe key', () => {
    const store = useProgressStore.getState();
    store.noteAttempt('l', 'cp', { solved: false, hintsUsed: 0 }, 'same');
    store.noteAttempt('l', 'cp', { solved: false, hintsUsed: 0 }, 'same');
    expect(useProgressStore.getState().progress.lessons.l.checkpoints.cp.attempts).toBe(1);
  });

  it('records a genuinely different attempt', () => {
    const store = useProgressStore.getState();
    store.noteAttempt('l', 'cp', { solved: false, hintsUsed: 0 }, 'k1');
    store.noteAttempt('l', 'cp', { solved: false, hintsUsed: 0 }, 'k2');
    expect(useProgressStore.getState().progress.lessons.l.checkpoints.cp.attempts).toBe(2);
  });

  it('records lesson completion', () => {
    useProgressStore.getState().noteLessonComplete('l');
    expect(useProgressStore.getState().progress.lessons.l.completedAt).toBeTruthy();
  });

  it('keeps and drops saved lines', () => {
    const line = {
      id: 'x',
      name: 'Line',
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '1. e4',
      createdAt: '2026-08-06T00:00:00.000Z',
    };
    useProgressStore.getState().keepLine(line);
    expect(useProgressStore.getState().progress.savedLines).toHaveLength(1);
    useProgressStore.getState().dropLine('x');
    expect(useProgressStore.getState().progress.savedLines).toHaveLength(0);
  });

  it('surfaces a recovery notice when stored progress was unusable', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    useProgressStore.getState().reset();
    expect(useProgressStore.getState().recovered).toBe(true);
    useProgressStore.getState().dismissNotice();
    expect(useProgressStore.getState().recovered).toBe(false);
  });

  it('clears everything, in memory and in storage', () => {
    useProgressStore.getState().noteAttempt('l', 'cp', { solved: true, hintsUsed: 0 }, 'k1');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('cp');

    useProgressStore.getState().clearAll();

    expect(useProgressStore.getState().progress).toEqual({ version: 1, lessons: {}, savedLines: [] });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('does not let an already-recorded attempt come back after clearing', () => {
    // `clearAll` used to empty the dedupe set. LessonRail's recording effect
    // re-derives the in-flight attempt from the tree on every render, so the
    // very next render re-recorded it and a twice-confirmed destructive
    // action silently undid itself. The dedupe key is what stands between
    // "the player answered this" and "React rendered again".
    useProgressStore.getState().noteAttempt('l', 'cp', { solved: true, hintsUsed: 0 }, 'k1');
    useProgressStore.getState().clearAll();

    useProgressStore.getState().noteAttempt('l', 'cp', { solved: true, hintsUsed: 0 }, 'k1');

    expect(useProgressStore.getState().progress.lessons).toEqual({});
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('still records a genuinely new attempt after clearing', () => {
    // Suppressing the re-derivation must not freeze recording altogether: a
    // different move is a different tree node, hence a different key.
    useProgressStore.getState().noteAttempt('l', 'cp', { solved: false, hintsUsed: 0 }, 'k1');
    useProgressStore.getState().clearAll();
    useProgressStore.getState().noteAttempt('l', 'cp', { solved: true, hintsUsed: 0 }, 'k2');

    expect(useProgressStore.getState().progress.lessons.l.checkpoints.cp.attempts).toBe(1);
    expect(useProgressStore.getState().progress.lessons.l.checkpoints.cp.solved).toBe(true);
  });
});
