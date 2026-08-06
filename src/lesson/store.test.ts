import { beforeEach, describe, expect, it } from 'vitest';
import { useTreeStore } from '../tree/store';
import { useLessonStore } from './store';

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

  it('ignores an unknown lesson id', () => {
    useLessonStore.getState().startLesson('does-not-exist');
    expect(useLessonStore.getState().lessonId).toBeNull();
  });

  it('reveals hints one at a time', () => {
    useLessonStore.getState().startLesson('italian-game');
    expect(useLessonStore.getState().hintsShown).toBe(0);
    useLessonStore.getState().revealHint();
    useLessonStore.getState().revealHint();
    expect(useLessonStore.getState().hintsShown).toBe(2);
  });

  it('resets hints when a lesson starts', () => {
    useLessonStore.getState().startLesson('italian-game');
    useLessonStore.getState().revealHint();
    useLessonStore.getState().startLesson('london-system');
    expect(useLessonStore.getState().hintsShown).toBe(0);
  });

  it('records and clears the last grade', () => {
    useLessonStore.getState().recordGrade({ kind: 'wrong' });
    expect(useLessonStore.getState().lastGrade).toEqual({ kind: 'wrong' });
    useLessonStore.getState().clearGrade();
    expect(useLessonStore.getState().lastGrade).toBeNull();
  });

  it('clears everything when the lesson stops', () => {
    useLessonStore.getState().startLesson('italian-game');
    useLessonStore.getState().revealHint();
    useLessonStore.getState().stopLesson();
    expect(useLessonStore.getState().lessonId).toBeNull();
    expect(useLessonStore.getState().hintsShown).toBe(0);
  });
});
