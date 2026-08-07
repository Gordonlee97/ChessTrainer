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
