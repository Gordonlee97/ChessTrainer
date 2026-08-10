import { create } from 'zustand';
import { ALL_LESSONS, lessonById } from '../content/lessons/index';
import type { Checkpoint, Lesson, Segment } from '../content/schema';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';
import { gradeMove, type Grade } from './grade';
import { deriveLessonState, type LessonState } from './lessonState';

interface LessonStore {
  lessonId: string | null;
  segmentIndex: number;
  /**
   * How many hints have been revealed, keyed by the checkpoint's authored id.
   * Per checkpoint rather than per lesson: a lesson-wide counter carried the
   * three hints taken at one checkpoint straight into the next, printing the
   * tier that names the answer before the player had seen the question. The
   * per-checkpoint counts are also what a later plan needs to tell
   * solved-cold from solved-after-three-hints.
   */
  hintsShown: Record<string, number>;
  startLesson: (id: string) => void;
  stopLesson: () => void;
  nextSegment: () => void;
  revealHint: (checkpointId: string) => void;
}

/**
 * Points the tree at a segment's opening position. Seeding the tree rather
 * than storing a position is what lets the runner derive its state from the
 * tree; both `startLesson` and `nextSegment` go through here so a segment
 * reached by advancing opens exactly the way segment 0 does.
 */
function seedTree(segment: Segment): void {
  useTreeStore.getState().reset(segment.startFen ?? undefined);
}

export const useLessonStore = create<LessonStore>((set, get) => ({
  lessonId: null,
  segmentIndex: 0,
  hintsShown: {},

  startLesson: (id) => {
    const lesson = lessonById(id);
    if (!lesson) return;
    seedTree(lesson.segments[0]);
    set({ lessonId: id, segmentIndex: 0, hintsShown: {} });
  },

  stopLesson: () => set({ lessonId: null, segmentIndex: 0, hintsShown: {} }),

  nextSegment: () => {
    const { lessonId, segmentIndex } = get();
    const lesson = lessonId ? lessonById(lessonId) : undefined;
    const next = lesson?.segments[segmentIndex + 1];
    // The last segment has nowhere to go: the completion message stands.
    if (!next) return;
    seedTree(next);
    // Hint counts are keyed by checkpoint id, which is unique across every
    // lesson, so they survive the move without leaking into the next segment.
    set({ segmentIndex: segmentIndex + 1 });
  },

  revealHint: (checkpointId) =>
    set((prior) => ({
      hintsShown: { ...prior.hintsShown, [checkpointId]: (prior.hintsShown[checkpointId] ?? 0) + 1 },
    })),
}));

export interface ActiveLesson {
  lesson: Lesson;
  segment: Segment;
  /** Which segment of the lesson is running, 0-based. */
  segmentIndex: number;
  /** True while a further segment remains, so the UI can offer to move on. */
  hasNextSegment: boolean;
  state: LessonState;
  /**
   * The checkpoint a divergence was graded against — the one that was pending
   * at the moment the player answered. Null while on script and while off
   * script at a point with no checkpoint. The UI keeps the prompt and the
   * hint control on screen from this, so a graded attempt does not unmount
   * the very controls its reply talks about.
   */
  attemptedCheckpoint: Checkpoint | null;
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

  return {
    lesson,
    segment,
    segmentIndex,
    hasNextSegment: segmentIndex + 1 < lesson.segments.length,
    state,
    attemptedCheckpoint,
    attemptedGrade,
  };
}

/**
 * The checkpoint currently being asked — normally the pending one, but while
 * an answer is being graded `pendingCheckpoint` is null (the path has left
 * the line) and this falls back to `attemptedCheckpoint`, because the reply
 * to a graded attempt talks about taking a hint, so the question and the
 * hint control must stay on screen through grading, not just before it.
 *
 * `CandidateRail` (deciding whether to mount `CheckpointPanel` at all) and
 * `CheckpointPanel` (deciding whether to render its own prompt) both need
 * this exact answer. It is defined once, here, and both call it — two
 * independent copies of this rule drifted apart once already: `CandidateRail`
 * gated on `pendingCheckpoint` alone, so during grading it fell through to
 * the ordinary candidate list while `CheckpointPanel` (never mounted) sat
 * unreachable with a hint ladder no one could see.
 */
export function askingCheckpoint(active: ActiveLesson | null): Checkpoint | null {
  return active ? (active.state.pendingCheckpoint ?? active.attemptedCheckpoint) : null;
}
