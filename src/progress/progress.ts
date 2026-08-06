import type { CheckpointRecord, LessonRecord, Progress, SavedLine } from './schema';

export function emptyProgress(): Progress {
  return { version: 1, lessons: {}, savedLines: [] };
}

function lessonOf(progress: Progress, lessonId: string): LessonRecord {
  return progress.lessons[lessonId] ?? { checkpoints: {} };
}

/**
 * Records one graded attempt at a checkpoint.
 *
 * `solved` is sticky: a checkpoint that has been solved stays solved, so
 * revisiting a lesson and getting it wrong later does not erase the fact that
 * you once knew it.
 */
export function recordAttempt(
  progress: Progress,
  lessonId: string,
  checkpointId: string,
  outcome: { solved: boolean; hintsUsed: number },
): Progress {
  const lesson = lessonOf(progress, lessonId);
  const previous: CheckpointRecord = lesson.checkpoints[checkpointId] ?? {
    attempts: 0,
    hintsUsed: 0,
    solved: false,
  };

  const updated: CheckpointRecord = {
    attempts: previous.attempts + 1,
    hintsUsed: outcome.hintsUsed,
    solved: previous.solved || outcome.solved,
  };

  return {
    ...progress,
    lessons: {
      ...progress.lessons,
      [lessonId]: {
        ...lesson,
        checkpoints: { ...lesson.checkpoints, [checkpointId]: updated },
      },
    },
  };
}

/** Stamps a lesson finished. The first completion is the one that is kept. */
export function recordLessonComplete(
  progress: Progress,
  lessonId: string,
  at: string,
): Progress {
  const lesson = lessonOf(progress, lessonId);
  if (lesson.completedAt) return progress;

  return {
    ...progress,
    lessons: { ...progress.lessons, [lessonId]: { ...lesson, completedAt: at } },
  };
}

/** Newest first — the list is shown in that order and it is the useful one. */
export function addSavedLine(progress: Progress, line: SavedLine): Progress {
  return { ...progress, savedLines: [line, ...progress.savedLines] };
}

export function removeSavedLine(progress: Progress, id: string): Progress {
  return { ...progress, savedLines: progress.savedLines.filter((line) => line.id !== id) };
}

/**
 * How far through a lesson the player is.
 *
 * `checkpointIds` comes from the lesson content, so a record left behind by an
 * id that no longer exists is ignored rather than inflating the count.
 */
export function lessonProgress(
  progress: Progress,
  lessonId: string,
  checkpointIds: string[],
): { solved: number; total: number; completed: boolean } {
  const lesson = progress.lessons[lessonId];
  const solved = checkpointIds.filter((id) => lesson?.checkpoints[id]?.solved).length;
  return { solved, total: checkpointIds.length, completed: Boolean(lesson?.completedAt) };
}
