import { z } from 'zod';
import { emptyProgress } from './progress';
import {
  lessonRecordSchema,
  progressSchema,
  savedLineSchema,
  type Progress,
} from './schema';

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
    return salvage(JSON.parse(raw));
  } catch {
    // JSON.parse threw: there is no structure to salvage anything from.
    return { progress: emptyProgress(), recovered: true };
  }
}

/** Just the envelope. `version` is the one field nothing can be salvaged around. */
const envelopeSchema = z.object({ version: z.literal(1) });

/**
 * Turns a parsed-but-untrusted blob into usable progress, keeping whatever
 * survives validation instead of discarding all of it.
 *
 * This used to be a single `progressSchema.safeParse`, which validates
 * `Progress` as one unit — so one malformed saved line (a field tightened in a
 * later build, a write truncated by a full disk) reset every lesson's progress
 * along with it. The spec's "degrade, never blank" rule was satisfied in the
 * sense that the app still ran, but the blast radius was everything the player
 * had ever done.
 *
 * Salvage stops at the *item* level — one lesson record, one saved line — and
 * deliberately does not go inside a lesson to rescue individual checkpoints.
 * A `LessonRecord` carries `completedAt`, which means "every checkpoint in this
 * lesson is solved". Keeping a subset of checkpoints while keeping that
 * timestamp would manufacture a lesson claiming completion it can no longer
 * evidence, and dropping the timestamp would silently un-complete a lesson the
 * player really did finish. Neither is better than dropping the one record.
 */
function salvage(value: unknown): { progress: Progress; recovered: boolean } {
  const whole = progressSchema.safeParse(value);
  if (whole.success) return { progress: whole.data, recovered: false };

  // Anything reaching here failed validation, so `recovered` is true however
  // much is rescued below — the caller's contract is "something was there and
  // could not be used as-is", not "nothing was rescued".
  if (!envelopeSchema.safeParse(value).success) {
    return { progress: emptyProgress(), recovered: true };
  }

  const source = value as { lessons?: unknown; savedLines?: unknown };
  const progress = emptyProgress();

  if (source.lessons !== null && typeof source.lessons === 'object' && !Array.isArray(source.lessons)) {
    for (const [id, record] of Object.entries(source.lessons)) {
      const parsed = lessonRecordSchema.safeParse(record);
      if (parsed.success) progress.lessons[id] = parsed.data;
    }
  }

  if (Array.isArray(source.savedLines)) {
    for (const line of source.savedLines) {
      const parsed = savedLineSchema.safeParse(line);
      if (parsed.success) progress.savedLines.push(parsed.data);
    }
  }

  return { progress, recovered: true };
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
