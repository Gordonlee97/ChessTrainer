import { describe, expect, it, vi } from 'vitest';
import { emptyProgress, recordAttempt } from './progress';
import { loadProgress, saveProgress, STORAGE_KEY } from './storage';

/** A Storage stand-in we can make fail on demand. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: vi.fn((k: string, v: string) => {
      data[k] = v;
    }),
    removeItem: (k: string) => {
      delete data[k];
    },
    clear: () => {
      for (const k of Object.keys(data)) delete data[k];
    },
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length;
    },
  } as Storage;
}

describe('loadProgress', () => {
  it('returns empty progress when nothing is stored', () => {
    const { progress, recovered } = loadProgress(fakeStorage());
    expect(progress).toEqual(emptyProgress());
    expect(recovered).toBe(false);
  });

  it('round-trips saved progress', () => {
    const storage = fakeStorage();
    const written = recordAttempt(emptyProgress(), 'l', 'cp', { solved: true, hintsUsed: 1 });
    saveProgress(written, storage);
    expect(loadProgress(storage).progress).toEqual(written);
  });

  it('recovers from unparseable JSON instead of throwing', () => {
    const { progress, recovered } = loadProgress(fakeStorage({ [STORAGE_KEY]: '{not json' }));
    expect(progress).toEqual(emptyProgress());
    expect(recovered).toBe(true);
  });

  it('recovers from JSON that is not valid progress', () => {
    const stored = JSON.stringify({ version: 1, lessons: 'wrong', savedLines: [] });
    const { progress, recovered } = loadProgress(fakeStorage({ [STORAGE_KEY]: stored }));
    expect(progress).toEqual(emptyProgress());
    expect(recovered).toBe(true);
  });

  it('recovers from a version it does not understand', () => {
    const stored = JSON.stringify({ version: 99, lessons: {}, savedLines: [] });
    expect(loadProgress(fakeStorage({ [STORAGE_KEY]: stored })).recovered).toBe(true);
  });

  /**
   * The blast-radius tests. `progressSchema.safeParse` validates `Progress` as
   * one unit, so before per-item salvage a single bad saved line reset every
   * lesson the player had ever completed. Losing the broken item is the cost of
   * the corruption; losing everything else was a choice the loader was making.
   */
  const goodLine = {
    id: 'a',
    name: 'Italian mainline',
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    pgn: '1. e4 e5',
    createdAt: '2026-09-04T00:00:00.000Z',
  };
  const goodLesson = { checkpoints: { 'italian-open-with-e4': { attempts: 2, hintsUsed: 1, solved: true } } };

  it('keeps lesson progress when a saved line is malformed', () => {
    const stored = JSON.stringify({
      version: 1,
      lessons: { italian: goodLesson },
      // `name` is empty, which `savedLineSchema` requires to be non-empty.
      savedLines: [goodLine, { ...goodLine, id: 'b', name: '' }],
    });

    const { progress, recovered } = loadProgress(fakeStorage({ [STORAGE_KEY]: stored }));

    expect(recovered).toBe(true);
    expect(progress.lessons.italian).toEqual(goodLesson);
    expect(progress.savedLines).toEqual([goodLine]);
  });

  it('keeps the other lessons when one lesson record is malformed', () => {
    const stored = JSON.stringify({
      version: 1,
      lessons: {
        italian: goodLesson,
        london: { checkpoints: { 'x': { attempts: 'many', hintsUsed: 0, solved: true } } },
      },
      savedLines: [goodLine],
    });

    const { progress, recovered } = loadProgress(fakeStorage({ [STORAGE_KEY]: stored }));

    expect(recovered).toBe(true);
    expect(progress.lessons.italian).toEqual(goodLesson);
    expect(progress.lessons.london).toBeUndefined();
    expect(progress.savedLines).toEqual([goodLine]);
  });

  /**
   * A lesson is dropped whole rather than having its checkpoints picked over,
   * because `completedAt` asserts that *every* checkpoint is solved. Salvaging
   * a subset alongside it would leave a lesson claiming a completion it can no
   * longer evidence.
   */
  it('drops a whole lesson rather than keeping a completion it cannot evidence', () => {
    const stored = JSON.stringify({
      version: 1,
      lessons: {
        italian: {
          completedAt: '2026-09-04T00:00:00.000Z',
          checkpoints: {
            good: { attempts: 1, hintsUsed: 0, solved: true },
            bad: { attempts: -1, hintsUsed: 0, solved: true },
          },
        },
      },
      savedLines: [],
    });

    const { progress } = loadProgress(fakeStorage({ [STORAGE_KEY]: stored }));

    expect(progress.lessons.italian).toBeUndefined();
  });

  it('leaves a wholly valid blob untouched and unreported', () => {
    const stored = JSON.stringify({
      version: 1,
      lessons: { italian: goodLesson },
      savedLines: [goodLine],
    });

    const { progress, recovered } = loadProgress(fakeStorage({ [STORAGE_KEY]: stored }));

    expect(recovered).toBe(false);
    expect(progress.lessons.italian).toEqual(goodLesson);
    expect(progress.savedLines).toEqual([goodLine]);
  });

  it('reports unavailable storage as empty rather than throwing', () => {
    const hostile = {
      getItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    expect(() => loadProgress(hostile)).not.toThrow();
    expect(loadProgress(hostile).progress).toEqual(emptyProgress());
  });
});

describe('saveProgress', () => {
  it('reports success on a normal write', () => {
    expect(saveProgress(emptyProgress(), fakeStorage())).toEqual({ ok: true });
  });

  it('reports a quota failure without throwing', () => {
    const full = fakeStorage();
    (full.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const error = new Error('quota');
      error.name = 'QuotaExceededError';
      throw error;
    });
    expect(saveProgress(emptyProgress(), full)).toEqual({ ok: false, reason: 'quota' });
  });

  it('reports any other storage failure as unavailable', () => {
    const broken = fakeStorage();
    (broken.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('nope');
    });
    expect(saveProgress(emptyProgress(), broken)).toEqual({ ok: false, reason: 'unavailable' });
  });
});
