import { create } from 'zustand';
import {
  addSavedLine,
  recordAttempt,
  recordLessonComplete,
  removeSavedLine,
} from './progress';
import type { Progress, SavedLine } from './schema';
import { loadProgress, saveProgress } from './storage';

interface ProgressStore {
  progress: Progress;
  /** Stored progress existed but could not be used; the player is told once. */
  recovered: boolean;
  /** The last write failed. Shown so the player knows nothing is being kept. */
  saveFailed: boolean;
  noteAttempt: (
    lessonId: string,
    checkpointId: string,
    outcome: { solved: boolean; hintsUsed: number },
    dedupeKey: string,
  ) => void;
  noteLessonComplete: (lessonId: string) => void;
  keepLine: (line: SavedLine) => void;
  dropLine: (id: string) => void;
  dismissNotice: () => void;
  reset: () => void;
}

/**
 * Session-only. Recording is driven by derived state that survives re-renders,
 * so the same attempt would otherwise be counted every time React re-runs the
 * effect. This is about render behaviour, not history, so it is never stored.
 */
const recorded = new Set<string>();

function persist(progress: Progress): { progress: Progress; saveFailed: boolean } {
  return { progress, saveFailed: !saveProgress(progress).ok };
}

export const useProgressStore = create<ProgressStore>((set, get) => {
  const initial = loadProgress();

  return {
    progress: initial.progress,
    recovered: initial.recovered,
    saveFailed: false,

    noteAttempt: (lessonId, checkpointId, outcome, dedupeKey) => {
      if (recorded.has(dedupeKey)) return;
      recorded.add(dedupeKey);
      set(persist(recordAttempt(get().progress, lessonId, checkpointId, outcome)));
    },

    noteLessonComplete: (lessonId) => {
      // Guarding here, not just in the reducer: the caller is an effect that
      // re-runs on every render while a lesson sits complete, and without this
      // every one of those renders would rewrite localStorage.
      if (get().progress.lessons[lessonId]?.completedAt) return;
      set(persist(recordLessonComplete(get().progress, lessonId, new Date().toISOString())));
    },

    keepLine: (line) => set(persist(addSavedLine(get().progress, line))),

    dropLine: (id) => set(persist(removeSavedLine(get().progress, id))),

    dismissNotice: () => set({ recovered: false, saveFailed: false }),

    reset: () => {
      recorded.clear();
      const reloaded = loadProgress();
      set({ progress: reloaded.progress, recovered: reloaded.recovered, saveFailed: false });
    },
  };
});
