import { describe, expect, it } from 'vitest';
import { checkpointIds, parseLesson, validateLessonChess } from './load';
import type { Lesson } from './schema';

const minimal = {
  id: 'demo',
  title: 'Demo',
  kind: 'opening',
  side: 'white',
  summary: 'A two-move demo.',
  tags: ['demo'],
  segments: [
    {
      startFen: null,
      moves: [{ san: 'e4', note: 'Takes the centre.' }, { san: 'e5' }],
    },
  ],
};

describe('parseLesson', () => {
  it('accepts a well-formed lesson', () => {
    expect(parseLesson(minimal).id).toBe('demo');
  });

  it('rejects a lesson with no segments', () => {
    expect(() => parseLesson({ ...minimal, segments: [] })).toThrow(/segments/i);
  });

  it('rejects a checkpoint with no accepted move', () => {
    const broken = structuredClone(minimal) as typeof minimal & {
      segments: { moves: { checkpoint?: unknown }[] }[];
    };
    broken.segments[0].moves[0].checkpoint = {
      id: 'x',
      prompt: 'p',
      accept: [],
      hints: ['h'],
    };
    expect(() => parseLesson(broken)).toThrow();
  });

  it('names the lesson in the error so a bad file is findable', () => {
    expect(() => parseLesson({ ...minimal, title: '' })).toThrow(/title/i);
  });
});

describe('validateLessonChess', () => {
  it('reports nothing for a legal line', () => {
    expect(validateLessonChess(parseLesson(minimal))).toEqual([]);
  });

  it('reports an illegal authored move with its position', () => {
    const bad = structuredClone(minimal);
    bad.segments[0].moves[1].san = 'e4';
    const problems = validateLessonChess(parseLesson(bad));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/e4/);
    expect(problems[0]).toMatch(/segment 0.*move 1/i);
  });

  it('reports a checkpoint accept move that is illegal where it is asked for', () => {
    const bad = structuredClone(minimal) as Lesson;
    bad.segments[0].moves[0].checkpoint = {
      id: 'demo-first',
      prompt: 'Play the best first move.',
      accept: ['Nf6'],
      hints: ['Think about the centre.'],
    };
    const problems = validateLessonChess(bad);
    expect(problems.some((p) => /Nf6/.test(p))).toBe(true);
  });

  it('reports a nearMiss key that is not a legal move there', () => {
    const bad = structuredClone(minimal) as Lesson;
    bad.segments[0].moves[0].checkpoint = {
      id: 'demo-first',
      prompt: 'Play the best first move.',
      accept: ['e4'],
      hints: ['Think about the centre.'],
      nearMiss: { Qh5: 'Too early.', Ke2: 'Never.' },
    };
    // Qh5 is illegal on move one; Ke2 is illegal too. Both must be reported.
    expect(validateLessonChess(bad)).toHaveLength(2);
  });

  it('reports an alternative whose move is illegal at that point', () => {
    const bad = structuredClone(minimal) as Lesson;
    bad.segments[0].moves[0].alternatives = [
      { san: 'Nf6', name: 'Nonsense', note: 'n', pros: ['p'], cons: ['c'] },
    ];
    expect(validateLessonChess(bad).some((p) => /Nf6/.test(p))).toBe(true);
  });

  it('validates a segment that starts from a custom FEN', () => {
    // Bc4 only becomes legal once e2 is vacated by 1.e4 (verified against
    // chess.js directly: legal from this FEN, illegal from the standard
    // start where the e2 pawn still blocks the f1 bishop). That makes the
    // test fail if startFen is ever ignored, unlike a move legal from both.
    const fromFen = structuredClone(minimal) as Lesson;
    fromFen.segments[0].startFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    fromFen.segments[0].moves = [{ san: 'Bc4' }, { san: 'Nf6' }];
    expect(validateLessonChess(fromFen)).toEqual([]);
  });

  it('reports a malformed startFen instead of throwing', () => {
    const bad = structuredClone(minimal) as Lesson;
    bad.segments[0].startFen = 'not a fen';
    let problems: string[] = [];
    expect(() => {
      problems = validateLessonChess(bad);
    }).not.toThrow();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/segment 0/i);
  });
});

describe('segment side override', () => {
  it('accepts a segment with no side, leaving it undefined', () => {
    expect(parseLesson(minimal).segments[0].side).toBeUndefined();
  });

  it('accepts a segment that overrides the side', () => {
    const overridden = structuredClone(minimal) as typeof minimal & {
      segments: { side?: string }[];
    };
    overridden.segments[0].side = 'black';
    expect(parseLesson(overridden).segments[0].side).toBe('black');
  });

  it('rejects a segment side that is not a colour', () => {
    const bad = structuredClone(minimal) as typeof minimal & {
      segments: { side?: string }[];
    };
    bad.segments[0].side = 'green';
    expect(() => parseLesson(bad)).toThrow();
  });
});

describe('checkpointIds', () => {
  it('lists every checkpoint id in order', () => {
    const withCheckpoints = structuredClone(minimal) as Lesson;
    withCheckpoints.segments[0].moves[0].checkpoint = {
      id: 'first',
      prompt: 'p',
      accept: ['e4'],
      hints: ['h'],
    };
    expect(checkpointIds(withCheckpoints)).toEqual(['first']);
  });
});
