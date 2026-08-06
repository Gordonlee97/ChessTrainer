import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { lessonById } from '../content/lessons/index';
import { useTreeStore } from '../tree/store';
import { useActiveLesson, useLessonStore, type ActiveLesson } from './store';

/** `useActiveLesson` is a hook, so it needs a render to run in. */
function activeLesson(): ActiveLesson | null {
  return renderHook(() => useActiveLesson()).result.current;
}

/** The root position the tree is currently seeded from. */
function rootFen(): string {
  const { tree } = useTreeStore.getState();
  return tree.nodes[tree.rootId].fen;
}

describe('lesson store', () => {
  beforeEach(() => {
    useLessonStore.getState().stopLesson();
    useTreeStore.getState().reset();
  });

  it('starts with no active lesson', () => {
    expect(useLessonStore.getState().lessonId).toBeNull();
  });

  it('starts a lesson and resets the tree to its opening position', () => {
    useLessonStore.getState().startLesson('italian-game');
    expect(useLessonStore.getState().lessonId).toBe('italian-game');
    expect(useTreeStore.getState().tree.selectedId).toBe(useTreeStore.getState().tree.rootId);
  });

  it('seeds the tree from a segment-0 startFen when the lesson has one', () => {
    // Two lessons open away from the standard starting position, so this is
    // live production code: `startFen ?? undefined` must pass the FEN through
    // rather than dropping it and starting the player on move one.
    const lesson = lessonById('theme-forks-and-pins')!;
    const startFen = lesson.segments[0].startFen;
    expect(startFen).not.toBeNull();

    useLessonStore.getState().startLesson('theme-forks-and-pins');
    expect(rootFen()).toBe(startFen);
  });

  it('ignores an unknown lesson id', () => {
    useLessonStore.getState().startLesson('does-not-exist');
    expect(useLessonStore.getState().lessonId).toBeNull();
  });

  it('reveals hints one at a time', () => {
    useLessonStore.getState().startLesson('italian-game');
    expect(useLessonStore.getState().hintsShown['italian-open-with-e4']).toBeUndefined();
    useLessonStore.getState().revealHint('italian-open-with-e4');
    useLessonStore.getState().revealHint('italian-open-with-e4');
    expect(useLessonStore.getState().hintsShown['italian-open-with-e4']).toBe(2);
  });

  it('counts hints per checkpoint, so one checkpoint does not spend another\'s', () => {
    useLessonStore.getState().startLesson('italian-game');
    useLessonStore.getState().revealHint('italian-open-with-e4');
    useLessonStore.getState().revealHint('italian-open-with-e4');
    useLessonStore.getState().revealHint('italian-open-with-e4');
    expect(useLessonStore.getState().hintsShown['italian-bishop-to-c4'] ?? 0).toBe(0);
  });

  it('resets hints when a lesson starts', () => {
    useLessonStore.getState().startLesson('italian-game');
    useLessonStore.getState().revealHint('italian-open-with-e4');
    useLessonStore.getState().startLesson('london-system');
    expect(useLessonStore.getState().hintsShown).toEqual({});
  });

  it('clears everything when the lesson stops', () => {
    useLessonStore.getState().startLesson('italian-game');
    useLessonStore.getState().revealHint('italian-open-with-e4');
    useLessonStore.getState().stopLesson();
    expect(useLessonStore.getState().lessonId).toBeNull();
    expect(useLessonStore.getState().hintsShown).toEqual({});
  });

  describe('segment advancement', () => {
    it('moves to the next segment and re-seeds the tree from its startFen', () => {
      const lesson = lessonById('theme-control-the-centre')!;
      useLessonStore.getState().startLesson('theme-control-the-centre');
      useLessonStore.getState().nextSegment();

      expect(useLessonStore.getState().segmentIndex).toBe(1);
      expect(rootFen()).toBe(lesson.segments[1].startFen);
      expect(useTreeStore.getState().tree.selectedId).toBe(useTreeStore.getState().tree.rootId);
    });

    it('stays put on the final segment', () => {
      useLessonStore.getState().startLesson('london-system');
      const before = rootFen();
      useLessonStore.getState().nextSegment();
      expect(useLessonStore.getState().segmentIndex).toBe(0);
      expect(rootFen()).toBe(before);
    });

    it('does nothing when no lesson is running', () => {
      useLessonStore.getState().nextSegment();
      expect(useLessonStore.getState().segmentIndex).toBe(0);
      expect(useLessonStore.getState().lessonId).toBeNull();
    });

    it('starts a lesson back at segment 0 after advancing in a previous one', () => {
      useLessonStore.getState().startLesson('theme-control-the-centre');
      useLessonStore.getState().nextSegment();
      useLessonStore.getState().startLesson('italian-game');
      expect(useLessonStore.getState().segmentIndex).toBe(0);
    });
  });
});

describe('useActiveLesson', () => {
  beforeEach(() => {
    useLessonStore.getState().stopLesson();
    useTreeStore.getState().reset();
  });

  it('reports a further segment while one remains, and none on the last', () => {
    useLessonStore.getState().startLesson('theme-control-the-centre');
    expect(activeLesson()?.hasNextSegment).toBe(true);
    useLessonStore.getState().nextSegment();
    expect(activeLesson()?.hasNextSegment).toBe(false);
  });

  it('derives state from the segment the lesson has advanced to', () => {
    useLessonStore.getState().startLesson('theme-control-the-centre');
    useLessonStore.getState().nextSegment();
    const lesson = lessonById('theme-control-the-centre')!;
    expect(activeLesson()?.state.nextMove?.san).toBe(lesson.segments[1].moves[0].san);
  });

  it('exposes the checkpoint an off-script move was graded against', () => {
    // The `!offScript` guard in deriveLessonState suppresses pendingCheckpoint
    // the moment the player answers, so the checkpoint the attempt was judged
    // against has to come from somewhere else — this is that somewhere.
    useLessonStore.getState().startLesson('italian-game');
    useTreeStore.getState().playMove('d4');

    const active = activeLesson()!;
    expect(active.state.offScript).toBe(true);
    expect(active.state.pendingCheckpoint).toBeNull();
    expect(active.attemptedCheckpoint?.id).toBe('italian-open-with-e4');
    expect(active.attemptedGrade?.kind).toBe('near-miss');
  });
});
