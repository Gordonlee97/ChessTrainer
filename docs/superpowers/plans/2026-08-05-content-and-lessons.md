# Plan 3 — Content and Lessons

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the line explorer into something you can be taught by — authored openings and theme lessons that run as a rail through the existing board, with prompts, hints, and specific replies to near-miss answers.

**Architecture:** Lessons are validated data. A Zod schema plus a loader that replays every authored move through chess.js means a typo fails the test suite rather than blanking the board. The runner holds no position state of its own: it derives where you are in a lesson by comparing the game tree's current path against the lesson's move list, so branching off and coming back needs no special handling.

**Tech Stack:** TypeScript, Zod (new), chess.js, React 19, Zustand, Vitest.

**Source spec:** `docs/superpowers/specs/2026-08-01-chesstrainer-design.md` (§5 progress types, §6 content format, §8 flow 3)
**Vault:** `docs/obsidian/ChessTrainerVault/` — read `Start Here.md` first.

## Scope

Content pipeline, the v1 content, and the lesson runner. **Progress persistence and the queued polish items (mute toggle, keyboard board navigation, a real `App.tsx` layout beyond what lessons need, a new-game control) are Plan 4.** A lesson you cannot resume is still a lesson you can do; splitting here keeps this plan near the size of Plans 1 and 2, both of which needed post-review fix waves at that size.

## Decisions taken before writing this plan

1. **Content files are TypeScript modules, not the YAML the spec illustrates.** YAML would need a parser dependency and Vite loader config; TS literals typed by the Zod schema get compile-time checking for free and keep the runtime dependency count unchanged. Zod still validates at load, catching what types cannot — illegal SAN, duplicate checkpoint ids, hints that reveal nothing. The spec's substance is preserved: data files, Zod-validated, every `san` replayed in tests.
2. **The compare drawer's pros and cons come from authored content where it exists.** The spec's `alternatives:` entries already carry `pros:` and `cons:`; Task 8 wires them through so curated openings get authored comparisons and the Plan 2 heuristic stays a fallback for off-book positions. This closes the "choose on feel" gap without inventing new heuristics.
3. **The compare drawer becomes `role="region"`, not `role="dialog"`.** It is an inline panel with no `aria-modal`, focus trap, or Escape handling, and making it a true modal would require a visual rework. `region` describes what it actually is and promises nothing it does not keep.
4. **The schema adds two fields the spec's example does not show: `kind` and `summary`.** `kind: 'opening' | 'theme'` is what lets the picker separate the two lesson types the spec itself distinguishes in §6.1; `summary` gives the picker something to show. Everything else matches the spec's field names exactly.
5. **The lesson advances one ply at a time under the player's control, for both colours.** A "Play the next move" control walks the authored line; at a checkpoint it is replaced by a prompt and the player must make the move on the board themselves. No auto-play of the opponent, which would otherwise need different behaviour for White and Black lessons.

## Global Constraints

- **No React, react-dom, or zustand imports in `src/chess/`, `src/engine/`, `src/tree/`, `src/explain/`, or `src/lesson/`.** `src/test/purity.test.ts` enforces this. Files named `store.ts` are the established exemption — verify that exemption still exists before relying on it in Task 6.
- **The game tree is the single source of truth for position.** The lesson runner derives its state from the tree's current path and stores no position of its own. Do not add a parallel position state.
- **Evaluations above `src/engine/` are White-relative.** Normalized once at the UCI boundary; never re-normalize.
- **At a checkpoint the candidate rail hides**, so the engine cannot leak the answer.
- **Going off-script is not an error state.** A "return to lesson" control waits until taken; the branch the player made stays in the tree.
- **`nearMiss` moves get their authored reply, not a generic "wrong".**
- **Checkpoints are keyed by their authored `id`, not by position index**, so inserting a move into a lesson does not silently reassign past results. Ids must be unique across all lessons.
- **Press feedback uses `box-shadow`, never a box-model property.**
- **`prefers-reduced-motion` is honoured everywhere and must still leave a visible press signal.**
- **Success and failure are never signalled by colour alone.**
- **Do not modify `src/engine/engine.ts`.** Its search serialization took six revisions; nothing here requires touching it.
- Commit with conventional prefixes: `feat` `fix` `test` `docs` `chore`.
- `npm test` and `npm run typecheck` before any task is complete. **Exactly one expected skip** — `src/engine/engine.smoke.test.ts` needs a real `Worker`. A second skip is a real failure.

---

### Task 1: Content schema and validating loader

**Files:**
- Create: `src/content/schema.ts`
- Create: `src/content/load.ts`
- Test: `src/content/load.test.ts`
- Modify: `package.json` (add `zod`)
- Modify: `src/test/purity.test.ts` (add `src/content` and `src/lesson` to `PURE_DIRS`)

**Interfaces:**
- Consumes: chess.js.
- Produces:
  - `Checkpoint`, `Alternative`, `LessonMove`, `Segment`, `Lesson` — types inferred from the Zod schemas
  - `lessonSchema` — the Zod schema
  - `parseLesson(raw: unknown): Lesson` — throws with a readable message
  - `validateLessonChess(lesson: Lesson): string[]` — returns human-readable problems, empty when clean
  - `checkpointIds(lesson: Lesson): string[]`

`validateLessonChess` is the load-bearing piece: it replays every authored move, checkpoint answer, near-miss key and alternative through chess.js in the position where it is supposed to be legal. Tasks 2–4 author several hundred moves; without this, a single typo surfaces as a blank board at runtime.

- [ ] **Step 1: Install Zod**

Run:

```bash
npm install zod
```

- [ ] **Step 2: Add the new directories to the purity guard**

In `src/test/purity.test.ts`, extend `PURE_DIRS` to include the two directories this plan creates:

```ts
const PURE_DIRS = ['src/chess', 'src/engine', 'src/tree', 'src/explain', 'src/content', 'src/lesson'];
```

Read the surrounding file first — the guard was hardened after Plan 1 and the exemption mechanism may not be the simple filename check it started as. Report what you find if it differs.

- [ ] **Step 3: Write `src/content/schema.ts`**

```ts
import { z } from 'zod';

export const checkpointSchema = z.object({
  /** Stable across edits — progress is keyed by this, never by position. */
  id: z.string().min(1),
  prompt: z.string().min(1),
  /** SAN moves accepted as correct. At least one. */
  accept: z.array(z.string().min(1)).min(1),
  /** Shown one at a time, in order, on request. */
  hints: z.array(z.string().min(1)).min(1).max(3),
  /** SAN -> the specific reply that move earns, instead of a generic "wrong". */
  nearMiss: z.record(z.string(), z.string().min(1)).optional(),
});

export const alternativeSchema = z.object({
  san: z.string().min(1),
  name: z.string().min(1),
  note: z.string().min(1),
  pros: z.array(z.string().min(1)).min(1),
  cons: z.array(z.string().min(1)).min(1),
});

export const lessonMoveSchema = z.object({
  san: z.string().min(1),
  note: z.string().min(1).optional(),
  checkpoint: checkpointSchema.optional(),
  alternatives: z.array(alternativeSchema).min(1).optional(),
});

export const segmentSchema = z.object({
  /** null means the standard starting position. */
  startFen: z.string().nullable(),
  intro: z.string().min(1).optional(),
  moves: z.array(lessonMoveSchema).min(1),
});

export const lessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(['opening', 'theme']),
  /** Whose side the player takes. Sets board orientation. */
  side: z.enum(['white', 'black']),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)),
  segments: z.array(segmentSchema).min(1),
});

export type Checkpoint = z.infer<typeof checkpointSchema>;
export type Alternative = z.infer<typeof alternativeSchema>;
export type LessonMove = z.infer<typeof lessonMoveSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
```

- [ ] **Step 4: Write the failing loader tests**

`src/content/load.test.ts`:

```ts
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
    const fromFen = structuredClone(minimal) as Lesson;
    fromFen.segments[0].startFen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    fromFen.segments[0].moves = [{ san: 'Nf3' }, { san: 'Nc6' }];
    expect(validateLessonChess(fromFen)).toEqual([]);
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
```

- [ ] **Step 5: Run to verify failure**

Run: `npm test -- src/content/load.test.ts`
Expected: FAIL — `Failed to resolve import "./load"`.

- [ ] **Step 6: Implement `src/content/load.ts`**

```ts
import { Chess } from 'chess.js';
import { lessonSchema, type Lesson, type Segment } from './schema';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Parses and validates a lesson's shape. Throws a readable error on failure. */
export function parseLesson(raw: unknown): Lesson {
  const result = lessonSchema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid lesson: ${detail}`);
  }
  return result.data;
}

/** Can `san` be played in this position? Leaves `chess` untouched either way. */
function isLegal(fen: string, san: string): boolean {
  const probe = new Chess(fen);
  try {
    probe.move(san);
    return true;
  } catch {
    return false;
  }
}

function validateSegment(segment: Segment, segmentIndex: number): string[] {
  const problems: string[] = [];
  const chess = new Chess(segment.startFen ?? START_FEN);

  segment.moves.forEach((move, moveIndex) => {
    const where = `segment ${segmentIndex}, move ${moveIndex}`;
    const fenBefore = chess.fen();

    // Everything attached to a move is judged in the position *before* it.
    if (move.checkpoint) {
      for (const accepted of move.checkpoint.accept) {
        if (!isLegal(fenBefore, accepted)) {
          problems.push(`${where}: checkpoint accepts "${accepted}", which is illegal there`);
        }
      }
      for (const nearMissSan of Object.keys(move.checkpoint.nearMiss ?? {})) {
        if (!isLegal(fenBefore, nearMissSan)) {
          problems.push(`${where}: nearMiss key "${nearMissSan}" is illegal there`);
        }
      }
    }

    for (const alternative of move.alternatives ?? []) {
      if (!isLegal(fenBefore, alternative.san)) {
        problems.push(`${where}: alternative "${alternative.san}" is illegal there`);
      }
    }

    try {
      chess.move(move.san);
    } catch {
      problems.push(`${where}: "${move.san}" is illegal in ${fenBefore}`);
      // The rest of the segment is unreachable once the line breaks.
      throw new StopSegment(problems);
    }
  });

  return problems;
}

/** Signals that a segment cannot be replayed further. Carries what was found. */
class StopSegment extends Error {
  constructor(readonly problems: string[]) {
    super('segment replay stopped');
  }
}

/**
 * Replays every authored move, checkpoint answer, near-miss key and alternative
 * through chess.js. Returns readable problems; empty means the lesson's chess is
 * sound. This is what stops a typo reaching the board as a blank screen.
 */
export function validateLessonChess(lesson: Lesson): string[] {
  const problems: string[] = [];
  lesson.segments.forEach((segment, index) => {
    try {
      problems.push(...validateSegment(segment, index));
    } catch (error) {
      if (error instanceof StopSegment) problems.push(...error.problems);
      else throw error;
    }
  });
  return problems;
}

export function checkpointIds(lesson: Lesson): string[] {
  return lesson.segments.flatMap((segment) =>
    segment.moves.flatMap((move) => (move.checkpoint ? [move.checkpoint.id] : [])),
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test -- src/content/load.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 8: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all pass, one skip.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/content src/test/purity.test.ts
git commit -m "feat: add lesson content schema and validating loader"
```

---

### Task 2: The Italian Game

**Files:**
- Create: `src/content/lessons/italian-game.ts`
- Create: `src/content/lessons/index.ts`
- Test: `src/content/lessons/lessons.test.ts`

**Interfaces:**
- Consumes: `parseLesson`, `validateLessonChess`, `checkpointIds` (Task 1).
- Produces:
  - `italianGame: Lesson`
  - `ALL_LESSONS: Lesson[]` — the registry Tasks 3, 4, 6 and 7 extend and read
  - `lessonById(id: string): Lesson | undefined`

This is the exemplar. Tasks 3 and 4 follow its shape, so get the voice right here: second person, one idea per note, no jargon without immediately explaining it, and never more than two sentences.

- [ ] **Step 1: Write the lessons registry test**

This test runs over every lesson in the registry, so Tasks 3 and 4 inherit it for free.

`src/content/lessons/lessons.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { checkpointIds, validateLessonChess } from '../load';
import { ALL_LESSONS, lessonById } from './index';

describe('authored lessons', () => {
  it('has at least one lesson', () => {
    expect(ALL_LESSONS.length).toBeGreaterThan(0);
  });

  it.each(ALL_LESSONS.map((lesson) => [lesson.id, lesson] as const))(
    '%s replays legally through chess.js',
    (_id, lesson) => {
      expect(validateLessonChess(lesson)).toEqual([]);
    },
  );

  it('gives every lesson a unique id', () => {
    const ids = ALL_LESSONS.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every checkpoint an id unique across all lessons', () => {
    const ids = ALL_LESSONS.flatMap(checkpointIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('accepts at least one move at every checkpoint', () => {
    for (const lesson of ALL_LESSONS) {
      for (const segment of lesson.segments) {
        for (const move of segment.moves) {
          if (move.checkpoint) expect(move.checkpoint.accept.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never lets a nearMiss reply also be an accepted answer', () => {
    for (const lesson of ALL_LESSONS) {
      for (const segment of lesson.segments) {
        for (const move of segment.moves) {
          const checkpoint = move.checkpoint;
          if (!checkpoint?.nearMiss) continue;
          for (const san of Object.keys(checkpoint.nearMiss)) {
            expect(checkpoint.accept).not.toContain(san);
          }
        }
      }
    }
  });

  it('ends every note as a complete sentence', () => {
    for (const lesson of ALL_LESSONS) {
      for (const segment of lesson.segments) {
        for (const move of segment.moves) {
          if (move.note) expect(move.note).toMatch(/[.!?]$/);
        }
      }
    }
  });

  it('finds a lesson by id', () => {
    expect(lessonById('italian-game')?.title).toBe('The Italian Game');
    expect(lessonById('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/content/lessons/lessons.test.ts`
Expected: FAIL — `Failed to resolve import "./index"`.

- [ ] **Step 3: Write `src/content/lessons/italian-game.ts`**

The move sequence is the Giuoco Pianissimo, a quiet Italian that a beginner can actually hold together: `1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.Bb3 Ba7 9.Nbd2`.

```ts
import { parseLesson } from '../load';

export const italianGame = parseLesson({
  id: 'italian-game',
  title: 'The Italian Game',
  kind: 'opening',
  side: 'white',
  summary:
    'The most natural opening in chess: put a pawn in the middle, bring out both minor pieces, and castle. Every move has one clear job.',
  tags: ['center-control', 'development', 'king-safety'],
  segments: [
    {
      startFen: null,
      intro:
        'You are White. The plan is simple and you can hold it in your head: claim the centre, develop the knight and bishop, and get the king safe. Nothing clever is required.',
      moves: [
        {
          san: 'e4',
          note: 'Claims a central square and frees two pieces at once — the bishop on f1 and the queen. Almost no other first move does two jobs.',
          checkpoint: {
            id: 'italian-open-with-e4',
            prompt: 'Open the game. Which pawn move claims the centre and frees two pieces?',
            accept: ['e4'],
            hints: [
              'Central pawn moves are the ones that open lines for your pieces.',
              'The pawn in front of your king can go two squares.',
              'Play e4.',
            ],
            nearMiss: {
              d4: 'Also a real opening move — that is the Queen\'s Gambit family. But e4 frees your bishop toward f7, which is where this lesson goes.',
              Nf3: 'A good developing move, but play a central pawn first so your pieces have lines to come out on.',
            },
          },
        },
        { san: 'e5', note: 'Black mirrors you. Now both sides have a pawn in the centre and the fight is over d4 and d5.' },
        {
          san: 'Nf3',
          note: 'Develops a piece and attacks the e5 pawn at the same time. A developing move that also makes a threat is a free tempo.',
        },
        { san: 'Nc6', note: 'Black defends e5 with a knight, which also develops. Notice both sides are following the same rules.' },
        {
          san: 'Bc4',
          note: 'The bishop points at f7 — the one square in Black\'s camp defended by nothing but the king.',
          checkpoint: {
            id: 'italian-bishop-to-c4',
            prompt: 'Develop your light-squared bishop to its most aggressive square.',
            accept: ['Bc4'],
            hints: [
              'Aim at the weakest point in Black\'s position.',
              'f7 is defended only by the king.',
              'The bishop belongs on c4.',
            ],
            nearMiss: {
              Bb5: 'Also strong — that is the Ruy Lopez, and a fine opening. But we are learning the Italian, where c4 hits f7 directly.',
              Be2: 'Safe but passive. The bishop does nothing from e2; on c4 it eyes Black\'s weakest square.',
              d4: 'Sharp, and a real opening called the Scotch. Compare it with the Compare button — but for now, develop.',
            },
          },
          alternatives: [
            {
              san: 'd4',
              name: 'Scotch Game',
              note: 'Strikes in the centre immediately instead of developing quietly.',
              pros: [
                'Opens lines for your pieces straight away',
                'Far less theory to remember than the quiet lines',
                'You get an open game where tactics decide things',
              ],
              cons: [
                'Trades off your strong e-pawn, releasing the central tension',
                'Punishes slow development much harder if you drift',
              ],
            },
            {
              san: 'Bb5',
              name: 'Ruy Lopez',
              note: 'Pressures the knight that defends e5, rather than aiming at f7.',
              pros: [
                'Applies long-term pressure to Black\'s centre',
                'The most respected opening in chess at every level',
              ],
              cons: [
                'Far more theory than the Italian',
                'The point of the pressure is slow and hard to feel as a beginner',
              ],
            },
          ],
        },
        { san: 'Bc5', note: 'Black copies you, aiming a bishop at your own weak square on f2. Symmetry is fine here.' },
        {
          san: 'c3',
          note: 'A quiet move with a real point: it prepares d4, so your pawns can take the whole centre next.',
        },
        { san: 'Nf6', note: 'Black develops the last minor piece that can come out easily, and attacks your e4 pawn.' },
        {
          san: 'd3',
          note: 'Defends e4 and opens a path for the dark-squared bishop. Solid rather than ambitious, which is what you want while learning.',
        },
        { san: 'd6', note: 'Black defends e5 the same way, for the same reason.' },
        {
          san: 'O-O',
          note: 'The king goes behind a wall of untouched pawns and the rook joins the game. Castle early and you avoid most disasters.',
          checkpoint: {
            id: 'italian-castle-kingside',
            prompt: 'Your pieces are out and the centre is stable. Make your king safe.',
            accept: ['O-O'],
            hints: [
              'Kings do not belong in the centre once lines start opening.',
              'You have a move that relocates the king and develops a rook at once.',
              'Castle kingside.',
            ],
            nearMiss: {
              Bg5: 'Developing, but your king is still in the middle. Get it safe first — this bishop move will still be there.',
              b4: 'Too loose. Pawn moves on the side while your king sits in the centre is how beginners lose games.',
            },
          },
        },
        { san: 'O-O', note: 'Black does the same. Both kings are safe and the real game starts now.' },
        { san: 'Re1', note: 'The rook steps onto the central file it was castled next to. Rooks belong on open or soon-to-open files.' },
        { san: 'a6', note: 'A useful little move, taking b5 away from your pieces before you can use it.' },
        { san: 'Bb3', note: 'Stepping back before Black can chase the bishop with d5 or Na5, keeping the aim at f7.' },
        { san: 'Ba7', note: 'Black tucks the bishop away for the same reason.' },
        {
          san: 'Nbd2',
          note: 'The last minor piece comes out, heading for f1 and then g3 or e3. Every piece is now doing something.',
        },
      ],
    },
  ],
});
```

- [ ] **Step 4: Write `src/content/lessons/index.ts`**

```ts
import type { Lesson } from '../schema';
import { italianGame } from './italian-game';

/** Every authored lesson. The registry the picker and the runner read. */
export const ALL_LESSONS: Lesson[] = [italianGame];

export function lessonById(id: string): Lesson | undefined {
  return ALL_LESSONS.find((lesson) => lesson.id === id);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/content/lessons/lessons.test.ts`
Expected: PASS.

If `validateLessonChess` reports a problem, **the move list is wrong, not the validator** — work out the real move and fix the content. Do not weaken the test.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test && npm run typecheck`

```bash
git add src/content/lessons
git commit -m "feat: add the Italian Game lesson and the lesson registry"
```

---

### Task 3: The Black defence and the London System

**Files:**
- Create: `src/content/lessons/black-vs-e4.ts`
- Create: `src/content/lessons/london-system.ts`
- Modify: `src/content/lessons/index.ts`

**Interfaces:**
- Consumes: `parseLesson` (Task 1), the shape and voice established in Task 2.
- Produces: `blackVsE4: Lesson`, `londonSystem: Lesson`, both added to `ALL_LESSONS`.

The registry test from Task 2 covers these automatically once they are in `ALL_LESSONS` — it replays every move, checks id uniqueness, and requires notes to be complete sentences.

**The chess below is fixed and must be used exactly.** The prose is yours to write, following Task 2's voice: second person, one idea per note, at most two sentences, no jargon left unexplained. Read `italian-game.ts` first and match it.

- [ ] **Step 1: Write `src/content/lessons/black-vs-e4.ts`**

- `id: 'black-vs-e4'`, `title: 'Answering 1.e4 as Black'`, `kind: 'opening'`, `side: 'black'`
- `tags: ['center-control', 'development', 'king-safety']`
- One segment, `startFen: null`
- Moves, in order: `e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O`

This deliberately mirrors Task 2's line so the player sees the same structure from the other side. Notes should say so — the teaching point is that Black follows the same three rules.

Three checkpoints, all on **Black's** moves:

| Move | `id` | `accept` | Prompt should ask for |
|---|---|---|---|
| `e5` (ply 2) | `black-e4-meet-with-e5` | `['e5']` | The move that stakes an equal claim in the centre |
| `Bc5` (ply 6) | `black-e4-bishop-to-c5` | `['Bc5']` | The bishop's most active square, mirroring White's |
| `O-O` (ply 12) | `black-e4-castle` | `['O-O']` | Getting the king safe once the pieces are out |

Each needs exactly three hints, going from a general principle to naming the move. Give each checkpoint at least one `nearMiss` entry — **the move must be legal in that position**, or the loader test will reject it.

Moves that are legal at each point, verified: `c5` and `e6` at ply 2 (both real defences worth naming by name); `Be7` and `Bd6` at ply 6; `h6` and `Bg4` at ply 12. Note that `d6` has *already been played* by ply 12 and is therefore not available as a near miss there — this is exactly the kind of slip `validateLessonChess` exists to catch, so trust it over this table if they disagree.

- [ ] **Step 2: Write `src/content/lessons/london-system.ts`**

- `id: 'london-system'`, `title: 'The London System'`, `kind: 'opening'`, `side: 'white'`
- `tags: ['development', 'king-safety', 'pawn-structure']`
- One segment, `startFen: null`
- Moves, in order: `d4 d5 Bf4 Nf6 e3 e6 Nf3 Bd6 Bg3 O-O Bd3 c5 c3 Nc6 Nbd2 b6 O-O`

The teaching point is that this setup is playable against almost anything — the same five moves in almost any order. Say that.

Two checkpoints:

| Move | `id` | `accept` | Prompt should ask for |
|---|---|---|---|
| `Bf4` (ply 3) | `london-bishop-out-first` | `['Bf4']` | Getting the dark-squared bishop outside the pawn chain before playing e3 |
| `O-O` (ply 17) | `london-castle` | `['O-O']` | King safety once the setup is complete |

`Bf4`'s checkpoint is the heart of the lesson: play `e3` first and the bishop is stuck behind its own pawns for the rest of the game. Give it a `nearMiss` for `e3` saying exactly that. `Nf3` is also legal at ply 3 and worth a near-miss.

- [ ] **Step 3: Register both lessons**

In `src/content/lessons/index.ts`:

```ts
import type { Lesson } from '../schema';
import { blackVsE4 } from './black-vs-e4';
import { italianGame } from './italian-game';
import { londonSystem } from './london-system';

/** Every authored lesson. The registry the picker and the runner read. */
export const ALL_LESSONS: Lesson[] = [italianGame, blackVsE4, londonSystem];

export function lessonById(id: string): Lesson | undefined {
  return ALL_LESSONS.find((lesson) => lesson.id === id);
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- src/content/lessons/lessons.test.ts`
Expected: PASS, now covering three lessons.

If a move is rejected, fix the content — the sequences above are standard lines and any failure means a transcription slip. Report it if you believe a listed move is genuinely wrong.

- [ ] **Step 5: Run the full suite and commit**

```bash
git add src/content/lessons
git commit -m "feat: add the Black defence and London System lessons"
```

---

### Task 4: The four theme lessons

**Files:**
- Create: `src/content/lessons/theme-control-the-centre.ts`
- Create: `src/content/lessons/theme-development-and-tempo.ts`
- Create: `src/content/lessons/theme-forks-and-pins.ts`
- Create: `src/content/lessons/theme-kingside-attack.ts`
- Modify: `src/content/lessons/index.ts`

**Interfaces:**
- Consumes: `parseLesson` (Task 1), the voice from Task 2.
- Produces: four `Lesson` values with `kind: 'theme'`, all registered in `ALL_LESSONS`.

Theme lessons use several short segments, each starting from a position rather than the opening move. **Derive every `startFen` with chess.js rather than writing one by hand** — hand-written FENs are the single most common defect in this project's history. For each segment below, play the listed moves from the standard start in a scratch script, print `chess.fen()`, and paste the result.

A scratch derivation script you can run and then delete:

```bash
node -e "
const { Chess } = require('chess.js');
const c = new Chess();
for (const m of ['e4','e5','Nf3','Nc6','Bc4','Nf6']) c.move(m);
console.log(c.fen());
"
```

- [ ] **Step 1: `theme-control-the-centre.ts`**

`id: 'theme-control-the-centre'`, `title: 'Control the Centre'`, `kind: 'theme'`, `side: 'white'`, `tags: ['center-control']`.

Two segments:

1. **From the start** (`startFen: null`), `intro` explaining that central squares matter because pieces standing on or attacking them reach more of the board. Moves: `e4 e5 Nf3 Nc6 d4`. One checkpoint on `d4`, id `theme-centre-strike-d4`, accepting `['d4']`, asking for the move that challenges Black's central pawn directly. Near-miss on `Bc4` ("develops, but this lesson is about the pawn break") and `Nc3`.
2. **From after `e4 e5 Nf3 Nc6 Bc4 Nf6`** (derive the FEN), showing the quiet alternative — the centre held rather than broken. Moves: `d3 Bc5 c3`. No checkpoint; the point is the contrast with segment 1.

- [ ] **Step 2: `theme-development-and-tempo.ts`**

`id: 'theme-development-and-tempo'`, `title: 'Development and Tempo'`, `kind: 'theme'`, `side: 'white'`, `tags: ['development', 'tempo']`.

Two segments:

1. **From the start**, moves `e4 e5 Nf3 Nc6 Bc4 Bc5 c3`. Checkpoint on `Nf3`, id `theme-tempo-knight-with-threat`, accepting `['Nf3']`, prompting for a developing move that also makes a threat. Near-miss on `Nc3` ("develops, but threatens nothing — compare it with the move that does both") and `d3`.
2. **From after `e4 e5 Qh5`** (derive the FEN), the counter-example: moves `Nc6 Bc4 g6 Qf3 Qe7`. `intro` should say plainly that White's early queen sortie loses time because every Black move both develops and chases it. No checkpoint — this segment teaches by showing the mistake.

   **`Qe7` is not optional here.** With the White queen on f3 and bishop on c4, `Qxf7#` is mate, so Black must cover f7. A knight on f6 does *not* defend f7 — the natural-looking `Nf6` loses on the spot. The note on `Qe7` must say why the queen and not the knight, because a beginner will reach for the knight. This is also why the segment stops here rather than continuing.

- [ ] **Step 3: `theme-forks-and-pins.ts`**

`id: 'theme-forks-and-pins'`, `title: 'Forks and Pins'`, `kind: 'theme'`, `side: 'white'`, `tags: ['fork', 'pin']`.

Two segments, both from derived FENs:

1. **A pin.** From after `e4 e5 Nf3 Nc6 Bb5 d6` — derive that FEN. Once Black plays `d6` the d7 square empties, so the b5 bishop, the c6 knight and the e8 king stand on one unbroken diagonal: the knight is genuinely pinned and cannot move. Moves: `d4`. Checkpoint on `d4`, id `theme-pin-exploit-with-d4`, accepting `['d4']`, prompting to attack the square the pinned knight is supposed to be defending. Near-miss on `Bxc6+` ("wins a piece for a piece, but the pin was worth more than the trade — a pinned piece is already yours to attack") and `O-O` ("safe and good, but there is a way to press the pin first").
2. **A fork.** From after `e4 e5 Nf3 Nc6 Bc4 Nd4` — Black's knight jumps to a forking square. Derive that FEN. Moves: `Nxe5`. Checkpoint on `Nxe5`, id `theme-fork-punish-nd4`, accepting `['Nxe5']`, prompting for the move that takes a pawn and threatens f7 at the same time. Near-miss on `Nxd4` ("natural, but it releases the tension and gives Black exactly the trade they wanted") and `c3`.

**Verify both positions carefully.** Confirm each checkpoint's accepted move is legal in the derived FEN, and that each near-miss key is also legal there — `validateLessonChess` will catch it, but understand the position rather than guessing.

- [ ] **Step 4: `theme-kingside-attack.ts`**

`id: 'theme-kingside-attack'`, `title: 'Attacking the Kingside'`, `kind: 'theme'`, `side: 'white'`, `tags: ['king-safety', 'space']`.

One segment, from the derived FEN after `e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O`. This is the Italian position from Task 2, which is the point: the player has already been here.

Moves: `Re1 a6 Nbd2 Ba7 Nf1 Ne7 Ng3`. `intro` should explain the plan in one sentence — the knight walks `b1-d2-f1-g3` to reach the kingside, because attacks need more attackers than the defender has defenders.

One checkpoint on `Nf1`, id `theme-attack-knight-rerouting`, accepting `['Nf1']`, prompting for the move that starts walking the knight toward the enemy king. Near-miss on `Nc4` ("a decent square, but it points at the queenside — we are attacking the other wing") and `h3`.

- [ ] **Step 5: Register all four**

Extend `ALL_LESSONS` in `src/content/lessons/index.ts` to `[italianGame, blackVsE4, londonSystem, themeControlTheCentre, themeDevelopmentAndTempo, themeForksAndPins, themeKingsideAttack]`, importing each.

- [ ] **Step 6: Run the tests**

Run: `npm test -- src/content/lessons/lessons.test.ts`
Expected: PASS across all seven lessons.

- [ ] **Step 7: Run the full suite and commit**

```bash
git add src/content/lessons
git commit -m "feat: add the four theme lessons"
```

---

### Task 5: The lesson runner

**Files:**
- Create: `src/lesson/lessonState.ts`
- Create: `src/lesson/grade.ts`
- Test: `src/lesson/lessonState.test.ts`
- Test: `src/lesson/grade.test.ts`

**Interfaces:**
- Consumes: `Lesson`, `Segment`, `Checkpoint`, `LessonMove` from `src/content/schema`.
- Produces:
  - `LessonState { ply: number; offScript: boolean; nextMove: LessonMove | null; pendingCheckpoint: Checkpoint | null; complete: boolean }`
  - `deriveLessonState(segment: Segment, pathSan: string[]): LessonState`
  - `Grade = { kind: 'correct' } | { kind: 'near-miss'; reply: string } | { kind: 'wrong' }`
  - `gradeMove(checkpoint: Checkpoint, san: string): Grade`

**The runner holds no position of its own.** `deriveLessonState` takes the SAN moves the game tree has actually walked since the segment's start and works out where in the lesson that puts you. This is what makes branching off and returning need no special handling: the tree changes, the derivation re-runs, and the answer is simply different.

- [ ] **Step 1: Write the failing derivation tests**

`src/lesson/lessonState.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lesson/lessonState.test.ts`
Expected: FAIL — `Failed to resolve import "./lessonState"`.

- [ ] **Step 3: Implement `src/lesson/lessonState.ts`**

```ts
import type { Checkpoint, LessonMove, Segment } from '../content/schema';

export interface LessonState {
  /** How many of the lesson's moves the path followed before diverging (or in full). */
  ply: number;
  /** True once the path has left the authored line. Not an error — see the spec. */
  offScript: boolean;
  /** The move the lesson wants next, or null when the line is finished. */
  nextMove: LessonMove | null;
  /** Set when `nextMove` carries a checkpoint, so the UI can ask instead of tell. */
  pendingCheckpoint: Checkpoint | null;
  /** True once every authored move has been followed. */
  complete: boolean;
}

/**
 * Works out where in a lesson a path of played moves puts you.
 *
 * The runner deliberately stores nothing: the game tree is the source of truth
 * for position, and this re-derives from it. That is why branching off a lesson
 * and returning needs no special handling — the path changes and the answer
 * changes with it.
 */
export function deriveLessonState(segment: Segment, pathSan: string[]): LessonState {
  let ply = 0;
  while (ply < pathSan.length && ply < segment.moves.length && pathSan[ply] === segment.moves[ply].san) {
    ply += 1;
  }

  const offScript = ply < pathSan.length;
  const complete = ply === segment.moves.length;
  const nextMove = complete ? null : segment.moves[ply];

  return {
    ply,
    offScript,
    nextMove,
    // While off script the lesson is not asking for anything — the player is exploring.
    pendingCheckpoint: !offScript && nextMove?.checkpoint ? nextMove.checkpoint : null,
    complete,
  };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- src/lesson/lessonState.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing grading tests**

`src/lesson/grade.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Checkpoint } from '../content/schema';
import { gradeMove } from './grade';

const checkpoint: Checkpoint = {
  id: 'cp',
  prompt: 'Develop the bishop.',
  accept: ['Bc4'],
  hints: ['Aim at f7.'],
  nearMiss: { Bb5: 'That is the Ruy Lopez — also good, but not this lesson.' },
};

describe('gradeMove', () => {
  it('accepts an accepted move', () => {
    expect(gradeMove(checkpoint, 'Bc4')).toEqual({ kind: 'correct' });
  });

  it('returns the authored reply for a near miss', () => {
    expect(gradeMove(checkpoint, 'Bb5')).toEqual({
      kind: 'near-miss',
      reply: 'That is the Ruy Lopez — also good, but not this lesson.',
    });
  });

  it('falls back to a plain wrong for anything else', () => {
    expect(gradeMove(checkpoint, 'h3')).toEqual({ kind: 'wrong' });
  });

  it('accepts any of several accepted moves', () => {
    const many: Checkpoint = { ...checkpoint, accept: ['Bc4', 'Bb5'] };
    expect(gradeMove(many, 'Bb5').kind).toBe('correct');
  });

  it('prefers acceptance over a near miss when a move is listed in both', () => {
    // Content should not do this, and a test in Task 2 forbids it — but if it
    // happens, being told you are right beats being corrected.
    const conflicting: Checkpoint = { ...checkpoint, accept: ['Bc4', 'Bb5'] };
    expect(gradeMove(conflicting, 'Bb5').kind).toBe('correct');
  });

  it('handles a checkpoint with no nearMiss map', () => {
    const bare: Checkpoint = { id: 'c', prompt: 'p', accept: ['e4'], hints: ['h'] };
    expect(gradeMove(bare, 'd4')).toEqual({ kind: 'wrong' });
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- src/lesson/grade.test.ts`
Expected: FAIL — `Failed to resolve import "./grade"`.

- [ ] **Step 7: Implement `src/lesson/grade.ts`**

```ts
import type { Checkpoint } from '../content/schema';

export type Grade =
  | { kind: 'correct' }
  | { kind: 'near-miss'; reply: string }
  | { kind: 'wrong' };

/**
 * Judges a played move against a checkpoint.
 *
 * Acceptance is checked first: if content ever lists a move as both accepted
 * and a near miss, being told you are right beats being corrected.
 */
export function gradeMove(checkpoint: Checkpoint, san: string): Grade {
  if (checkpoint.accept.includes(san)) return { kind: 'correct' };

  const reply = checkpoint.nearMiss?.[san];
  if (reply) return { kind: 'near-miss', reply };

  return { kind: 'wrong' };
}
```

- [ ] **Step 8: Run the full suite and commit**

Run: `npm test && npm run typecheck`

```bash
git add src/lesson
git commit -m "feat: add lesson state derivation and checkpoint grading"
```

---

### Task 6: The lesson store and rail

**Files:**
- Create: `src/lesson/store.ts`
- Create: `src/ui/LessonRail.tsx`
- Test: `src/lesson/store.test.ts`
- Test: `src/ui/LessonRail.test.tsx`
- Modify: `src/tree/store.ts` (let `reset` take a starting FEN)
- Modify: `src/ui/CandidateRail.tsx` (hide during a checkpoint)
- Modify: `src/ui/theme.css` (rail styles)

**Interfaces:**
- Consumes: `deriveLessonState`, `gradeMove` (Task 5); `ALL_LESSONS`, `lessonById` (Task 2); `useTreeStore`, `useCurrentPath` (existing).
- Produces:
  - `useLessonStore` — `{ lessonId, segmentIndex, hintsShown, lastGrade, startLesson(id), stopLesson(), revealHint(), recordGrade(grade), clearGrade() }`
  - `useActiveLesson(): { lesson: Lesson; segment: Segment; state: LessonState } | null`
  - `LessonRail` — the component

`src/lesson/store.ts` imports Zustand. `src/lesson` is in `PURE_DIRS` from Task 1, so this relies on the `store.ts` filename exemption — **verify that exemption exists before writing the file**; if the guard was hardened to an explicit allowlist, add this path to it and say so in your report.

- [ ] **Step 1: Let the tree store reset to a given position**

In `src/tree/store.ts`, change `reset` to accept an optional starting FEN and pass it to `createTree`:

```ts
  reset: (startFen?: string) => set({ tree: createTree(startFen) }),
```

Update the `TreeStore` interface's `reset` signature to `(startFen?: string) => void`. `createTree` already defaults to the standard position, so existing callers are unaffected. This also finally gives `reset` a caller, which `Known Issues.md` lists as dead code — remove that entry when you update the vault.

- [ ] **Step 2: Write the failing store tests**

`src/lesson/store.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify failure, then implement `src/lesson/store.ts`**

Run: `npm test -- src/lesson/store.test.ts` → FAIL on the missing import.

```ts
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
```

Run the store tests again: PASS, 7 tests.

- [ ] **Step 4: Write the failing rail tests**

`src/ui/LessonRail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';
import { LessonRail } from './LessonRail';

describe('LessonRail', () => {
  beforeEach(() => {
    useLessonStore.getState().stopLesson();
    useTreeStore.getState().reset();
  });

  it('renders nothing when no lesson is running', () => {
    const { container } = render(<LessonRail />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the lesson title and intro when started', () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<LessonRail />);
    expect(screen.getByRole('heading', { name: /italian game/i })).toBeInTheDocument();
  });

  it('asks for the move at a checkpoint instead of naming it', () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<LessonRail />);
    // The Italian's first move is itself a checkpoint.
    expect(screen.getByText(/which pawn move claims the centre/i)).toBeInTheDocument();
    expect(screen.queryByText(/play e4\./i)).not.toBeInTheDocument();
  });

  it('reveals hints one at a time, in order', async () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<LessonRail />);

    await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    expect(screen.getByText(/central pawn moves/i)).toBeInTheDocument();
    expect(screen.queryByText(/play e4\./i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    expect(screen.getByText(/play e4\./i)).toBeInTheDocument();
  });

  it('stops offering hints once they are exhausted', async () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<LessonRail />);
    for (let i = 0; i < 3; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: /hint/i }));
    }
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('advances the line when the player asks for the next move', async () => {
    useLessonStore.getState().startLesson('london-system');
    render(<LessonRail />);
    // The London's first move is not a checkpoint, so the rail offers to play it.
    await userEvent.click(screen.getByRole('button', { name: /play the next move/i }));
    expect(useTreeStore.getState().tree.selectedId).toContain('d4');
  });

  it('offers a way back when the player has gone off script', () => {
    useLessonStore.getState().startLesson('london-system');
    useTreeStore.getState().playMove('h4');
    render(<LessonRail />);
    expect(screen.getByRole('button', { name: /return to the lesson/i })).toBeInTheDocument();
  });

  it('does not treat going off script as an error', () => {
    useLessonStore.getState().startLesson('london-system');
    useTreeStore.getState().playMove('h4');
    render(<LessonRail />);
    expect(screen.queryByText(/wrong|incorrect|error/i)).not.toBeInTheDocument();
  });

  it('says so when the lesson is finished', () => {
    useLessonStore.getState().startLesson('london-system');
    const store = useTreeStore.getState();
    for (const san of [
      'd4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Bg3',
      'O-O', 'Bd3', 'c5', 'c3', 'Nc6', 'Nbd2', 'b6', 'O-O',
    ]) {
      store.playMove(san);
    }
    render(<LessonRail />);
    expect(screen.getByText(/finished|complete/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run to verify failure, then implement `src/ui/LessonRail.tsx`**

Run: `npm test -- src/ui/LessonRail.test.tsx` → FAIL on the missing import.

```tsx
import { useActiveLesson, useLessonStore } from '../lesson/store';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';
import { Button } from './Button';

export function LessonRail() {
  const active = useActiveLesson();
  const hintsShown = useLessonStore((store) => store.hintsShown);
  const lastGrade = useLessonStore((store) => store.lastGrade);
  const revealHint = useLessonStore((store) => store.revealHint);
  const stopLesson = useLessonStore((store) => store.stopLesson);
  const playMove = useTreeStore((store) => store.playMove);
  const selectNode = useTreeStore((store) => store.selectNode);
  const tree = useTreeStore((store) => store.tree);

  if (!active) return null;
  const { lesson, segment, state } = active;

  /**
   * Select the last node still on the lesson's line. `state.ply` counts the
   * moves that matched, and `pathTo` includes the root at index 0, so the node
   * after `ply` matching moves sits at index `ply`. The branch the player
   * explored stays in the tree — this only moves the selection.
   */
  function returnToLesson() {
    const path = pathTo(tree, tree.selectedId);
    const target = path[Math.min(state.ply, path.length - 1)];
    selectNode(target.id);
  }

  return (
    <section aria-label="Lesson" className="lesson-rail">
      <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>{lesson.title}</h2>

      {state.ply === 0 && segment.intro && (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{segment.intro}</p>
      )}

      {state.complete && !state.offScript && (
        <p style={{ fontSize: 14, fontWeight: 800 }}>Lesson complete — nicely done.</p>
      )}

      {state.offScript && (
        <>
          <p style={{ fontSize: 13 }}>
            You have stepped off the lesson line. Explore as long as you like — the lesson waits.
          </p>
          <Button variant="ghost" onClick={returnToLesson}>
            Return to the lesson
          </Button>
        </>
      )}

      {!state.offScript && state.pendingCheckpoint && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 700 }}>{state.pendingCheckpoint.prompt}</p>

          <ol style={{ fontSize: 13, paddingLeft: 18 }}>
            {state.pendingCheckpoint.hints.slice(0, hintsShown).map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ol>

          {hintsShown < state.pendingCheckpoint.hints.length && (
            <Button variant="ghost" onClick={revealHint}>
              Hint
            </Button>
          )}

          {lastGrade?.kind === 'near-miss' && (
            <p role="status" style={{ fontSize: 13 }}>
              {lastGrade.reply}
            </p>
          )}
          {lastGrade?.kind === 'wrong' && (
            <p role="status" style={{ fontSize: 13 }}>
              Not this time — try another move, or take a hint.
            </p>
          )}
        </div>
      )}

      {!state.offScript && !state.complete && !state.pendingCheckpoint && state.nextMove && (
        <>
          {state.ply > 0 && segment.moves[state.ply - 1]?.note && (
            <p style={{ fontSize: 13 }}>{segment.moves[state.ply - 1].note}</p>
          )}
          <Button onClick={() => playMove(state.nextMove!.san)}>Play the next move</Button>
        </>
      )}

      <Button variant="ghost" onClick={stopLesson}>
        Leave lesson
      </Button>
    </section>
  );
}
```

- [ ] **Step 6: Add the rail styles to `src/ui/theme.css`**

```css
.lesson-rail {
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
```

- [ ] **Step 7: Hide the candidate rail during a checkpoint**

In `src/ui/CandidateRail.tsx`, import `useActiveLesson` and return a placeholder when a checkpoint is pending, so the engine cannot leak the answer. Put the hook with the others, **above every early return**:

```tsx
  const activeLesson = useActiveLesson();
```

and, after the existing early returns for `unavailable` and the empty/thinking state, add:

```tsx
  if (activeLesson?.state.pendingCheckpoint) {
    return (
      <div
        role="status"
        style={{ padding: 12, borderRadius: 'var(--radius)', border: '2px solid var(--border)', fontSize: 13 }}
      >
        Engine suggestions are hidden while the lesson is asking you for a move.
      </div>
    );
  }
```

Add a test to `src/ui/CandidateRail.test.tsx`:

```tsx
  it('hides engine suggestions while a checkpoint is pending', () => {
    useLessonStore.getState().startLesson('italian-game');
    analysis.value = {
      status: 'idle',
      result: { depth: 20, lines: [{ san: 'e4', cp: 31, mate: null, pv: ['e4'] }] },
    } as never;

    render(<CandidateRail />);
    expect(screen.queryByRole('button', { name: /^e4/ })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/hidden while the lesson/i);
    useLessonStore.getState().stopLesson();
  });
```

- [ ] **Step 8: Run the full suite and commit**

Run: `npm test && npm run typecheck`

```bash
git add src/lesson src/ui src/tree/store.ts
git commit -m "feat: add the lesson store and rail with hint tiers"
```

---

### Task 7: Lesson picker and app layout

**Files:**
- Create: `src/ui/LessonPicker.tsx`
- Test: `src/ui/LessonPicker.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/ui/Board.tsx` (orient the board to the lesson's side)
- Modify: `src/ui/theme.css`

**Interfaces:**
- Consumes: `ALL_LESSONS` (Task 2), `useLessonStore`, `useActiveLesson` (Task 6).
- Produces: `LessonPicker` — the component.

This is the smallest layout that makes lessons reachable. **A full designed `App.tsx` is Plan 4** — do not redesign the shell beyond adding the lesson column and the picker.

- [ ] **Step 1: Write the failing picker tests**

`src/ui/LessonPicker.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLessonStore } from '../lesson/store';
import { LessonPicker } from './LessonPicker';

describe('LessonPicker', () => {
  beforeEach(() => useLessonStore.getState().stopLesson());

  it('lists every lesson', () => {
    render(<LessonPicker />);
    expect(screen.getByRole('button', { name: /the italian game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /london system/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forks and pins/i })).toBeInTheDocument();
  });

  it('separates openings from themes', () => {
    render(<LessonPicker />);
    expect(screen.getByRole('heading', { name: /openings/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ideas/i })).toBeInTheDocument();
  });

  it('starts the lesson that was clicked', async () => {
    render(<LessonPicker />);
    await userEvent.click(screen.getByRole('button', { name: /the italian game/i }));
    expect(useLessonStore.getState().lessonId).toBe('italian-game');
  });

  it('renders nothing once a lesson is running', () => {
    useLessonStore.getState().startLesson('italian-game');
    const { container } = render(<LessonPicker />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement `src/ui/LessonPicker.tsx`**

```tsx
import { ALL_LESSONS } from '../content/lessons/index';
import { useLessonStore } from '../lesson/store';
import { Button } from './Button';

function LessonGroup({ heading, kind }: { heading: string; kind: 'opening' | 'theme' }) {
  const startLesson = useLessonStore((store) => store.startLesson);
  const lessons = ALL_LESSONS.filter((lesson) => lesson.kind === kind);

  return (
    <section>
      <h3 style={{ fontSize: 12, letterSpacing: '.08em', color: 'var(--ink-soft)', margin: '0 0 8px' }}>
        {heading}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lessons.map((lesson) => (
          <Button key={lesson.id} variant="ghost" onClick={() => startLesson(lesson.id)}>
            {lesson.title}
          </Button>
        ))}
      </div>
    </section>
  );
}

export function LessonPicker() {
  const lessonId = useLessonStore((store) => store.lessonId);
  if (lessonId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LessonGroup heading="OPENINGS" kind="opening" />
      <LessonGroup heading="IDEAS" kind="theme" />
    </div>
  );
}
```

- [ ] **Step 3: Orient the board to the lesson's side**

In `src/ui/Board.tsx`, import `useActiveLesson` and pass `boardOrientation` through the `options` object. react-chessboard v5 takes all configuration in `options`; the prop is `boardOrientation: 'white' | 'black'`.

```tsx
  const activeLesson = useActiveLesson();
  const orientation = activeLesson?.lesson.side ?? 'white';
```

and inside `options`:

```tsx
        boardOrientation: orientation,
```

Add a test to `src/ui/Board.test.tsx` asserting the board flips for a Black lesson. If `react-chessboard` does not expose orientation in a way the test can observe, assert on the value passed rather than the rendered output, and say so in your report.

- [ ] **Step 4: Wire the picker and rail into `src/App.tsx`**

```tsx
import { Board } from './ui/Board';
import { Breadcrumb } from './ui/Breadcrumb';
import { CandidateRail } from './ui/CandidateRail';
import { LessonPicker } from './ui/LessonPicker';
import { LessonRail } from './ui/LessonRail';

export function App() {
  return (
    <main style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 18px' }}>ChessTrainer</h1>
      <Breadcrumb />
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 1 260px', minWidth: 220 }}>
          <LessonPicker />
          <LessonRail />
        </div>
        <div style={{ flex: '1 1 420px', maxWidth: 520 }}>
          <Board />
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 240 }}>
          <CandidateRail />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test && npm run typecheck && npm run build`

```bash
git add src/ui src/App.tsx
git commit -m "feat: add the lesson picker and wire lessons into the app"
```

---

### Task 8: Authored comparisons, and the drawer becomes a region

**Files:**
- Modify: `src/explain/compare.ts`
- Modify: `src/explain/compare.test.ts`
- Modify: `src/ui/CompareDrawer.tsx`
- Modify: `src/ui/CompareDrawer.test.tsx`
- Modify: `src/ui/CandidateRail.tsx`

**Interfaces:**
- Consumes: `compareLines`, `Comparison`, `LineSummary` (Plan 2); `Alternative` (Task 1); `useActiveLesson` (Task 6).
- Produces: `compareLines(baseFen, a, b, plies?, authored?)` — an optional fifth argument supplying authored pros and cons.

Plan 2 left the verdict saying "choose on feel" whenever two strong openings score alike on the heuristic's coarse features. The spec's answer was always authored content: `alternatives:` entries carry `pros:` and `cons:`. This task connects them, so curated openings get authored comparisons and the heuristic remains the fallback off-book.

- [ ] **Step 1: Write the failing compare tests**

Append to `src/explain/compare.test.ts`:

```ts
describe('authored contrast', () => {
  const authored = {
    a: { pros: ['Opens lines at once'], cons: ['Releases the central tension'] },
    b: { pros: ['Keeps a bind on the centre'], cons: ['Slower to get going'] },
  };

  it('prefers authored pros and cons over the computed ones', () => {
    const result = compareLines(START, italian, scotch, 8, authored);
    expect(result.a.pros).toEqual(['Opens lines at once']);
    expect(result.a.cons).toEqual(['Releases the central tension']);
    expect(result.b.pros).toEqual(['Keeps a bind on the centre']);
  });

  it('falls back to computed contrast for a line with no authored entry', () => {
    const result = compareLines(START, italian, scotch, 8, { a: authored.a });
    expect(result.a.pros).toEqual(['Opens lines at once']);
    expect(result.b.pros.length).toBeGreaterThan(0);
    expect(result.b.pros).not.toEqual(authored.b.pros);
  });

  it('uses the authored contrast in the verdict', () => {
    const result = compareLines(START, italian, scotch, 8, authored);
    expect(result.verdict).toMatch(/opens lines at once/i);
    expect(result.verdict).toMatch(/keeps a bind on the centre/i);
  });

  it('behaves exactly as before when nothing is authored', () => {
    expect(compareLines(START, italian, scotch, 8)).toEqual(compareLines(START, italian, scotch));
  });
});
```

- [ ] **Step 2: Run to verify failure, then extend `compareLines`**

In `src/explain/compare.ts`, add the type and the optional parameter. Keep the existing four-argument behaviour byte-identical — the last test above pins that.

```ts
export interface AuthoredContrast {
  pros: string[];
  cons: string[];
}

export interface AuthoredContrastPair {
  a?: AuthoredContrast;
  b?: AuthoredContrast;
}
```

Extend the signature to `compareLines(baseFen, a, b, plies = DEFAULT_PLIES, authored?: AuthoredContrastPair)` and, after each `summarise` call, replace the computed pros and cons when an authored entry exists for that side:

```ts
  const summaryA = applyAuthored(summarise(a, baseFen, baseFeatures, mover, plies), authored?.a);
  const summaryB = applyAuthored(summarise(b, baseFen, baseFeatures, mover, plies), authored?.b);
```

with:

```ts
/** Authored content wins over the heuristic — a human wrote it for this exact line. */
function applyAuthored(summary: LineSummary, authored?: AuthoredContrast): LineSummary {
  if (!authored) return summary;
  return { ...summary, pros: authored.pros, cons: authored.cons };
}
```

`buildVerdict` already reads `pros[0]` and `cons[0]`, so the verdict picks up authored text with no further change.

- [ ] **Step 3: Change the drawer from a dialog to a region**

In `src/ui/CompareDrawer.tsx`, change `role="dialog"` to `role="region"` and keep the `aria-label`. Add an `authored?: AuthoredContrastPair` prop and pass it to `compareLines`.

Update the assertion in `src/ui/CompareDrawer.test.tsx` that queries `getByRole('dialog')` to query `region` instead, and keep the accessible-name assertion. Add:

```tsx
  it('renders authored pros when the lesson supplies them', () => {
    render(
      <CompareDrawer
        a={a}
        b={b}
        baseFen={START}
        onClose={vi.fn()}
        authored={{ a: { pros: ['Authored pro'], cons: ['Authored con'] } }}
      />,
    );
    expect(screen.getByText('Authored pro')).toBeInTheDocument();
  });
```

- [ ] **Step 4: Supply authored contrast from the active lesson**

In `src/ui/CandidateRail.tsx`, when a lesson is running and the current lesson move carries `alternatives`, match them to the two compared lines by SAN and pass them down. Add near the other hooks, above every early return:

```tsx
  const authoredContrast = useMemo(() => {
    const alternatives = activeLesson?.state.nextMove?.alternatives;
    if (!alternatives || !result || result.lines.length < 2) return undefined;
    const find = (san: string) => alternatives.find((entry) => entry.san === san);
    const a = find(result.lines[0].san);
    const b = find(result.lines[1].san);
    if (!a && !b) return undefined;
    return {
      a: a ? { pros: a.pros, cons: a.cons } : undefined,
      b: b ? { pros: b.pros, cons: b.cons } : undefined,
    };
  }, [activeLesson, result]);
```

and pass `authored={authoredContrast}` to `<CompareDrawer />`.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test && npm run typecheck && npm run build`

```bash
git add src/explain src/ui
git commit -m "feat: use authored pros and cons in comparisons; make the drawer a region"
```

---

## Manual verification before the branch is finished

Tests cannot see any of this. Run `npm run dev` and confirm:

- The picker lists three openings and four ideas; clicking one starts it.
- The Italian's first checkpoint asks for a move and **the candidate rail is hidden**.
- Hints reveal one at a time and stop at three.
- Playing `d4` at that checkpoint gives its authored near-miss reply, not "wrong".
- Playing a move that is neither accepted nor a near miss gives the plain reply.
- Going off script shows the return control and **no error styling**.
- "Return to the lesson" comes back to the line with the explored branch still in the tree.
- Starting the Black lesson **flips the board**.
- On the Italian's move 3, Compare shows the **authored** Scotch pros and cons.
- Reduced motion (DevTools → Rendering) still leaves a visible press signal.

## What Plan 4 covers

- `src/progress/` — versioned localStorage: lesson completions, checkpoint accuracy keyed by authored id, and "My Lines" as PGN
- Mute toggle UI, keyboard board navigation, a properly designed `App.tsx`, and a new-game control
- The richer compare contrast vocabulary (open vs closed centre, castling timing, trades), now that authored content covers the curated openings

## Before finishing this branch

Update the vault per `CLAUDE.md`: `Current State.md`, `Known Issues.md` (delete the `reset`-has-no-caller entry, which Task 6 resolves, and the `role="dialog"` entry, which Task 8 resolves), `Roadmap.md`, `Architecture.md` for the new `src/content/` and `src/lesson/` layers, and `Start Here.md` last.
