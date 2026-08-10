import { emptyProgress } from './progress';
import { progressSchema, type Progress } from './schema';

export const STORAGE_KEY = 'chesstrainer.progress.v1';

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Some privacy modes throw on the very act of touching localStorage.
    return null;
  }
}

/**
 * Reads stored progress.
 *
 * `recovered` is true when something was there but could not be used — bad
 * JSON, a shape that fails validation, or a version this build does not know.
 * The caller surfaces that to the player; the spec's rule is degrade, never
 * blank, so every failure path returns usable empty progress.
 */
export function loadProgress(
  storage: Storage | null = defaultStorage(),
): { progress: Progress; recovered: boolean } {
  if (!storage) return { progress: emptyProgress(), recovered: false };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { progress: emptyProgress(), recovered: false };
  }

  if (raw === null) return { progress: emptyProgress(), recovered: false };

  try {
    const parsed = progressSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { progress: emptyProgress(), recovered: true };
    return { progress: parsed.data, recovered: false };
  } catch {
    return { progress: emptyProgress(), recovered: true };
  }
}

/**
 * Removes stored progress entirely. Returns false when storage is
 * unavailable — some privacy modes throw on the act of touching it.
 */
export function clearProgress(storage: Storage | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function saveProgress(
  progress: Progress,
  storage: Storage | null = defaultStorage(),
): { ok: boolean; reason?: 'quota' | 'unavailable' } {
  if (!storage) return { ok: false, reason: 'unavailable' };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return { ok: true };
  } catch (error) {
    const quota = error instanceof Error && /quota/i.test(error.name + error.message);
    return { ok: false, reason: quota ? 'quota' : 'unavailable' };
  }
}
