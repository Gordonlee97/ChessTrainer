import { create } from 'zustand';
import { ALL_LESSONS, lessonById } from '../content/lessons/index';
import type { Lesson, Segment } from '../content/schema';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';
import { gradeMove, type Grade } from './grade';
import { deriveLessonState, type LessonState } from './lessonState';

interface LessonStore {
  lessonId: string | null;
  segmentIndex: number;
  hintsShown: number;
  startLesson: (id: string) => void;
  stopLesson: () => void;
  revealHint: () => void;
}

export const useLessonStore = create<LessonStore>((set) => ({
  lessonId: null,
  segmentIndex: 0,
  hintsShown: 0,

  startLesson: (id) => {
    const lesson = lessonById(id);
    if (!lesson) return;
    // Seeding the tree from the lesson's own opening position is what lets the
    // runner derive its state from the tree rather than tracking a second one.
    useTreeStore.getState().reset(lesson.segments[0].startFen ?? undefined);
    set({ lessonId: id, segmentIndex: 0, hintsShown: 0 });
  },

  stopLesson: () => set({ lessonId: null, segmentIndex: 0, hintsShown: 0 }),

  revealHint: () => set((prior) => ({ hintsShown: prior.hintsShown + 1 })),
}));

export interface ActiveLesson {
  lesson: Lesson;
  segment: Segment;
  state: LessonState;
  /**
   * The grade of the move that took the path off script, but only when that
   * divergence happened *at* a pending checkpoint — i.e. an attempted answer,
   * not ordinary exploration. Null while on script, while off script at a
   * point with no checkpoint, and once the lesson is not running.
   *
   * Derived, not stored: the checkpoint that was pending is
   * `segment.moves[state.ply].checkpoint`, and the move actually played is
   * `pathSan[state.ply]` (defined whenever `state.offScript`, since offScript
   * means `state.ply < pathSan.length`). Nothing needs to call a setter for
   * this to be right after branching, replaying, or returning to the lesson —
   * it falls out of the tree the same way `state` does.
   */
  attemptedGrade: Grade | null;
}

/** Null when no lesson is running. Recomputed from the tree on every render. */
export function useActiveLesson(): ActiveLesson | null {
  const lessonId = useLessonStore((store) => store.lessonId);
  const segmentIndex = useLessonStore((store) => store.segmentIndex);
  const tree = useTreeStore((store) => store.tree);

  if (!lessonId) return null;
  const lesson = ALL_LESSONS.find((entry) => entry.id === lessonId);
  if (!lesson) return null;

  const segment = lesson.segments[segmentIndex];
  if (!segment) return null;

  // `pathTo` returns root-first and includes the root, which carries no move.
  const pathSan = pathTo(tree, tree.selectedId)
    .slice(1)
    .map((node) => node.move!.san);

  const state = deriveLessonState(segment, pathSan);

  const attemptedCheckpoint = state.offScript ? (segment.moves[state.ply]?.checkpoint ?? null) : null;
  const attemptedGrade = attemptedCheckpoint ? gradeMove(attemptedCheckpoint, pathSan[state.ply]) : null;

  return { lesson, segment, state, attemptedGrade };
}
