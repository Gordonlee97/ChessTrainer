import { create } from 'zustand';
import { ALL_LESSONS, lessonById } from '../content/lessons/index';
import type { Lesson, Segment } from '../content/schema';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';
import { deriveLessonState, type LessonState } from './lessonState';
import type { Grade } from './grade';

interface LessonStore {
  lessonId: string | null;
  segmentIndex: number;
  hintsShown: number;
  lastGrade: Grade | null;
  startLesson: (id: string) => void;
  stopLesson: () => void;
  revealHint: () => void;
  recordGrade: (grade: Grade) => void;
  clearGrade: () => void;
}

export const useLessonStore = create<LessonStore>((set) => ({
  lessonId: null,
  segmentIndex: 0,
  hintsShown: 0,
  lastGrade: null,

  startLesson: (id) => {
    const lesson = lessonById(id);
    if (!lesson) return;
    // Seeding the tree from the lesson's own opening position is what lets the
    // runner derive its state from the tree rather than tracking a second one.
    useTreeStore.getState().reset(lesson.segments[0].startFen ?? undefined);
    set({ lessonId: id, segmentIndex: 0, hintsShown: 0, lastGrade: null });
  },

  stopLesson: () => set({ lessonId: null, segmentIndex: 0, hintsShown: 0, lastGrade: null }),

  revealHint: () => set((prior) => ({ hintsShown: prior.hintsShown + 1 })),

  recordGrade: (grade) => set({ lastGrade: grade }),

  clearGrade: () => set({ lastGrade: null }),
}));

export interface ActiveLesson {
  lesson: Lesson;
  segment: Segment;
  state: LessonState;
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

  return { lesson, segment, state: deriveLessonState(segment, pathSan) };
}
