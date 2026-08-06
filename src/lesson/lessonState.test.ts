import { describe, expect, it } from 'vitest';
import type { Segment } from '../content/schema';
import { deriveLessonState } from './lessonState';

const segment: Segment = {
  startFen: null,
  moves: [
    { san: 'e4' },
    { san: 'e5' },
    {
      san: 'Nf3',
      checkpoint: {
        id: 'cp-nf3',
        prompt: 'Develop with a threat.',
        accept: ['Nf3'],
        hints: ['Attack something.'],
      },
    },
    { san: 'Nc6' },
  ],
};

describe('deriveLessonState', () => {
  it('starts at ply zero with the first move pending', () => {
    const state = deriveLessonState(segment, []);
    expect(state.ply).toBe(0);
    expect(state.offScript).toBe(false);
    expect(state.nextMove?.san).toBe('e4');
    expect(state.complete).toBe(false);
  });

  it('advances as the path follows the line', () => {
    expect(deriveLessonState(segment, ['e4']).ply).toBe(1);
    expect(deriveLessonState(segment, ['e4', 'e5']).ply).toBe(2);
  });

  it('surfaces the checkpoint when the next move carries one', () => {
    const state = deriveLessonState(segment, ['e4', 'e5']);
    expect(state.pendingCheckpoint?.id).toBe('cp-nf3');
  });

  it('reports no pending checkpoint when the next move has none', () => {
    expect(deriveLessonState(segment, ['e4']).pendingCheckpoint).toBeNull();
  });

  it('goes off script when the path diverges', () => {
    const state = deriveLessonState(segment, ['e4', 'e6']);
    expect(state.offScript).toBe(true);
    // ply reports how much of the lesson was followed before diverging
    expect(state.ply).toBe(1);
  });

  it('stays off script once diverged, even if a later move rejoins by name', () => {
    const state = deriveLessonState(segment, ['d4', 'e5']);
    expect(state.offScript).toBe(true);
    expect(state.ply).toBe(0);
  });

  it('reports completion at the end of the line', () => {
    const state = deriveLessonState(segment, ['e4', 'e5', 'Nf3', 'Nc6']);
    expect(state.complete).toBe(true);
    expect(state.nextMove).toBeNull();
    expect(state.pendingCheckpoint).toBeNull();
    expect(state.offScript).toBe(false);
  });

  it('treats a path longer than the lesson as off script', () => {
    const state = deriveLessonState(segment, ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    expect(state.offScript).toBe(true);
    expect(state.complete).toBe(true);
  });
});
