# Plan 4 — Progress, Saved Lines, and Controls

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app remember you — lessons you finished, checkpoints you solved and how much help you needed, and lines you want to keep — and give you the two controls it currently has the capability for but no way to reach.

**Architecture:** Progress is a single versioned object in localStorage, reduced by pure functions and read through a Zustand store. Nothing in the lesson or tree layers learns about persistence; the recording happens at the UI edge, keyed by the authored checkpoint ids the content already guarantees are unique. Saved lines are stored as PGN plus their starting position, so they survive any change to the tree's addressing.

**Tech Stack:** TypeScript, Zod, chess.js, React 19, Zustand, Vitest.

**Source spec:** `docs/superpowers/specs/2026-08-01-chesstrainer-design.md` (§5 progress types, §10 failure handling)
**Vault:** `docs/obsidian/ChessTrainerVault/` — read `Start Here.md` first.

## Scope

Progress persistence, saved lines, the new-game control, and the mute toggle — one theme: state the app keeps and state you control. **A properly designed `App.tsx` layout and keyboard board navigation are Plan 5**, since both are shell work and belong together.

Task 1 also settles a decision that gates the rest: board orientation moves onto the segment.

## Decisions taken before writing this plan

1. **`side` becomes an optional field on the segment, overriding the lesson's.** `theme-development-and-tempo`'s second segment is played from Black's side of a White-oriented board today. A theme lesson draws positions from different games, so whose side you are on can legitimately differ per position — this is arguably where the field belonged. It keeps the lesson's contrast pair intact rather than splitting it into two picker entries that no longer read as a contrast.
2. **A saved line stores its starting FEN explicitly, alongside the PGN.** PGN's own mechanism for a non-standard start is `SetUp`/`FEN` headers, and whether chess.js emits them automatically is a version detail this plan will not gamble on. An explicit field is equivalent, deterministic, and one less thing to verify. The spec's intent — portable, replayable, immune to tree addressing changes — is preserved.
3. **Attempts are recorded at the UI edge, not in the lesson runner.** The runner stays pure and position-free; a small effect watches the derived grade and records once per distinct attempt. Recording inside the runner would give it a side effect and a dependency on storage.

## Global Constraints

- **No React, react-dom, or zustand imports in `src/chess/`, `src/engine/`, `src/tree/`, `src/explain/`, `src/content/`, `src/lesson/`, or `src/progress/`.** `src/test/purity.test.ts` enforces this. Store files are exempt via an **explicitly enumerated** `STORE_EXEMPTIONS` set — add `src/progress/store.ts` to it, and do not loosen it to a basename or glob match.
- **The game tree is the single source of truth for position.** Progress records outcomes; it never stores a position.
- **Checkpoints are keyed by their authored `id`**, never by position index, so editing a lesson does not silently reassign past results. The content layer already guarantees these are unique across all lessons.
- **Failure handling, per spec §10: degrade, never blank.** Corrupt or unreadable stored progress resets with an explicit notice; a full quota fails the write without throwing. Neither may take the app down.
- **Evaluations above `src/engine/` are White-relative.** Nothing here re-normalizes.
- **Press feedback uses `box-shadow`, never a box-model property.**
- **`prefers-reduced-motion` is honoured and must still leave a visible press signal.**
- **Success and failure are never signalled by colour alone.**
- **Do not modify `src/engine/engine.ts`.** Nothing here requires it.
- Commit with conventional prefixes: `feat` `fix` `test` `docs` `chore`.
- `npm test` and `npm run typecheck` before any task is complete. **Exactly one expected skip** — `src/engine/engine.smoke.test.ts` needs a real `Worker`. A second skip is a real failure.

---

### Task 1: Segment-level board orientation

**Files:**
- Modify: `src/content/schema.ts`
- Modify: `src/content/lessons/theme-development-and-tempo.ts`
- Modify: `src/ui/Board.tsx`
- Test: `src/content/load.test.ts`
- Test: `src/ui/Board.test.tsx`

**Interfaces:**
- Consumes: `Segment`, `Lesson` from `src/content/schema`; `useActiveLesson()` from `src/lesson/store`.
- Produces: `Segment.side?: 'white' | 'black'` — an optional override of the lesson's `side`.

This closes the one issue `Known Issues.md` lists as blocking nothing but visible immediately: `theme-development-and-tempo`'s second segment starts after `1.e4 e5 2.Qh5` with **Black** to move and addresses the player as Black, while the lesson declares `side: 'white'` and the board orients from that.

- [ ] **Step 1: Add the optional field to the segment schema**

In `src/content/schema.ts`, add to `segmentSchema`:

```ts
  /**
   * Overrides the lesson's `side` for this segment. A theme lesson draws
   * positions from different games, so which side the player takes can
   * legitimately differ per position.
   */
  side: z.enum(['white', 'black']).optional(),
```

- [ ] **Step 2: Write the failing tests**

Append to `src/content/load.test.ts`:

```ts
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
```

Append to `src/ui/Board.test.tsx`, following the file's existing pattern of asserting on the `options` object handed to the mocked `Chessboard`:

```tsx
  it('orients from the segment when it overrides the lesson', () => {
    useLessonStore.getState().startLesson('theme-development-and-tempo');
    useLessonStore.getState().nextSegment();
    render(<Board />);
    expect(lastOptions().boardOrientation).toBe('black');
    useLessonStore.getState().stopLesson();
  });

  it('falls back to the lesson side when the segment does not override', () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<Board />);
    expect(lastOptions().boardOrientation).toBe('white');
    useLessonStore.getState().stopLesson();
  });
```

Read the existing Board test file first — it already has a helper for reading the captured options and an import of `useLessonStore`. Use whatever those are actually called rather than inventing `lastOptions()`; adapt the snippet and say so in your report.

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/content/load.test.ts src/ui/Board.test.tsx`
Expected: the schema tests fail because `side` is not yet in the schema; the orientation test fails because `Board` still reads only `lesson.side`.

- [ ] **Step 4: Read the segment's side in `Board.tsx`**

The existing line derives orientation from the lesson alone. Change it to prefer the segment:

```tsx
  const orientation = activeLesson?.segment.side ?? activeLesson?.lesson.side ?? 'white';
```

`useActiveLesson()` already returns the active `segment`, so nothing else changes.

- [ ] **Step 5: Set the override on the segment that needs it**

In `src/content/lessons/theme-development-and-tempo.ts`, add `side: 'black'` to the **second** segment — the one whose `startFen` is the position after `e4 e5 Qh5`. Do not touch the first segment.

While there, check the second segment's `intro` and notes read correctly for a player sitting on Black's side of the board, since that is now what they will see. Fix any that address the player as White. Do not change any `san`, `accept`, `nearMiss` key or `startFen`.

- [ ] **Step 6: Run the tests, then the full suite**

Run: `npm test && npm run typecheck`
Expected: all pass, one skip.

- [ ] **Step 7: Commit**

```bash
git add src/content src/ui
git commit -m "feat: let a segment override the lesson's board orientation"
```

---

### Task 2: Progress schema, reducers, and storage

**Files:**
- Create: `src/progress/schema.ts`
- Create: `src/progress/progress.ts`
- Create: `src/progress/storage.ts`
- Test: `src/progress/progress.test.ts`
- Test: `src/progress/storage.test.ts`
- Modify: `src/test/purity.test.ts`

**Interfaces:**
- Consumes: Zod.
- Produces:
  - `CheckpointRecord { attempts: number; hintsUsed: number; solved: boolean }`
  - `LessonRecord { completedAt?: string; checkpoints: Record<string, CheckpointRecord> }`
  - `SavedLine { id: string; name: string; startFen: string; pgn: string; createdAt: string }`
  - `Progress { version: 1; lessons: Record<string, LessonRecord>; savedLines: SavedLine[] }`
  - `emptyProgress(): Progress`
  - `recordAttempt(p, lessonId, checkpointId, { solved, hintsUsed }): Progress`
  - `recordLessonComplete(p, lessonId, at): Progress`
  - `addSavedLine(p, line): Progress`, `removeSavedLine(p, id): Progress`
  - `lessonProgress(p, lessonId, checkpointIds): { solved: number; total: number; completed: boolean }`
  - `STORAGE_KEY`, `loadProgress(storage?): { progress: Progress; recovered: boolean }`, `saveProgress(p, storage?): { ok: boolean; reason?: 'quota' | 'unavailable' }`

All of it pure or IO-only; no React, no store.

- [ ] **Step 1: Add `src/progress` to the purity guard**

In `src/test/purity.test.ts`, add `'src/progress'` to `PURE_DIRS`, and add the store path to the exemption set so Task 3 can put a Zustand store there:

```ts
const STORE_EXEMPTIONS = new Set([
  join('src', 'tree', 'store.ts'),
  join('src', 'lesson', 'store.ts'),
  join('src', 'progress', 'store.ts'),
]);
```

Read the file first — the exemption is an enumerated set, and it must stay one. Report what you find if the shape differs.

- [ ] **Step 2: Write `src/progress/schema.ts`**

```ts
import { z } from 'zod';

export const checkpointRecordSchema = z.object({
  /** How many graded attempts have been recorded, right or wrong. */
  attempts: z.number().int().min(0),
  /** Hints revealed on the attempt that solved it, or the most recent attempt. */
  hintsUsed: z.number().int().min(0),
  solved: z.boolean(),
});

export const lessonRecordSchema = z.object({
  /** ISO timestamp. Absent until every checkpoint in the lesson is solved. */
  completedAt: z.string().optional(),
  /** Keyed by the checkpoint's authored id — never by position. */
  checkpoints: z.record(z.string(), checkpointRecordSchema),
});

export const savedLineSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** The position the line starts from. Kept explicitly rather than as a PGN header. */
  startFen: z.string().min(1),
  pgn: z.string().min(1),
  createdAt: z.string().min(1),
});

export const progressSchema = z.object({
  version: z.literal(1),
  lessons: z.record(z.string(), lessonRecordSchema),
  savedLines: z.array(savedLineSchema),
});

export type CheckpointRecord = z.infer<typeof checkpointRecordSchema>;
export type LessonRecord = z.infer<typeof lessonRecordSchema>;
export type SavedLine = z.infer<typeof savedLineSchema>;
export type Progress = z.infer<typeof progressSchema>;
```

- [ ] **Step 3: Write the failing reducer tests**

`src/progress/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addSavedLine,
  emptyProgress,
  lessonProgress,
  recordAttempt,
  recordLessonComplete,
  removeSavedLine,
} from './progress';

const line = {
  id: 'l1',
  name: 'My Italian',
  startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn: '1. e4 e5',
  createdAt: '2026-08-06T00:00:00.000Z',
};

describe('emptyProgress', () => {
  it('starts at version 1 with nothing recorded', () => {
    expect(emptyProgress()).toEqual({ version: 1, lessons: {}, savedLines: [] });
  });
});

describe('recordAttempt', () => {
  it('creates the lesson and checkpoint records on first use', () => {
    const p = recordAttempt(emptyProgress(), 'italian-game', 'cp1', {
      solved: false,
      hintsUsed: 0,
    });
    expect(p.lessons['italian-game'].checkpoints.cp1).toEqual({
      attempts: 1,
      hintsUsed: 0,
      solved: false,
    });
  });

  it('counts attempts cumulatively', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'cp', { solved: false, hintsUsed: 0 });
    p = recordAttempt(p, 'l', 'cp', { solved: false, hintsUsed: 1 });
    expect(p.lessons.l.checkpoints.cp.attempts).toBe(2);
  });

  it('records the hints used on the latest attempt', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'cp', { solved: false, hintsUsed: 0 });
    p = recordAttempt(p, 'l', 'cp', { solved: true, hintsUsed: 2 });
    expect(p.lessons.l.checkpoints.cp.hintsUsed).toBe(2);
  });

  it('never un-solves a checkpoint that was already solved', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'cp', { solved: true, hintsUsed: 0 });
    p = recordAttempt(p, 'l', 'cp', { solved: false, hintsUsed: 0 });
    expect(p.lessons.l.checkpoints.cp.solved).toBe(true);
  });

  it('does not mutate the progress it was given', () => {
    const before = emptyProgress();
    recordAttempt(before, 'l', 'cp', { solved: true, hintsUsed: 0 });
    expect(before.lessons).toEqual({});
  });

  it('keeps other lessons and checkpoints untouched', () => {
    let p = recordAttempt(emptyProgress(), 'a', 'cp1', { solved: true, hintsUsed: 0 });
    p = recordAttempt(p, 'b', 'cp2', { solved: false, hintsUsed: 3 });
    expect(p.lessons.a.checkpoints.cp1.solved).toBe(true);
    expect(p.lessons.b.checkpoints.cp2.hintsUsed).toBe(3);
  });
});

describe('recordLessonComplete', () => {
  it('stamps the completion time', () => {
    const p = recordLessonComplete(emptyProgress(), 'l', '2026-08-06T00:00:00.000Z');
    expect(p.lessons.l.completedAt).toBe('2026-08-06T00:00:00.000Z');
  });

  it('keeps the first completion time on a repeat', () => {
    let p = recordLessonComplete(emptyProgress(), 'l', '2026-08-06T00:00:00.000Z');
    p = recordLessonComplete(p, 'l', '2026-08-07T00:00:00.000Z');
    expect(p.lessons.l.completedAt).toBe('2026-08-06T00:00:00.000Z');
  });

  it('preserves checkpoint records already recorded', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'cp', { solved: true, hintsUsed: 1 });
    p = recordLessonComplete(p, 'l', '2026-08-06T00:00:00.000Z');
    expect(p.lessons.l.checkpoints.cp.solved).toBe(true);
  });
});

describe('saved lines', () => {
  it('adds a line', () => {
    expect(addSavedLine(emptyProgress(), line).savedLines).toEqual([line]);
  });

  it('puts the newest line first', () => {
    const older = { ...line, id: 'l0', name: 'Older' };
    const p = addSavedLine(addSavedLine(emptyProgress(), older), line);
    expect(p.savedLines.map((l) => l.id)).toEqual(['l1', 'l0']);
  });

  it('removes a line by id', () => {
    const p = removeSavedLine(addSavedLine(emptyProgress(), line), 'l1');
    expect(p.savedLines).toEqual([]);
  });

  it('ignores removing a line that is not there', () => {
    const p = addSavedLine(emptyProgress(), line);
    expect(removeSavedLine(p, 'nope').savedLines).toHaveLength(1);
  });
});

describe('lessonProgress', () => {
  it('reports nothing solved for an untouched lesson', () => {
    expect(lessonProgress(emptyProgress(), 'l', ['a', 'b'])).toEqual({
      solved: 0,
      total: 2,
      completed: false,
    });
  });

  it('counts only the checkpoints the lesson actually has', () => {
    let p = recordAttempt(emptyProgress(), 'l', 'a', { solved: true, hintsUsed: 0 });
    // A checkpoint id from some other lesson must not be counted here.
    p = recordAttempt(p, 'l', 'stale', { solved: true, hintsUsed: 0 });
    expect(lessonProgress(p, 'l', ['a', 'b']).solved).toBe(1);
  });

  it('reports completed once the lesson has a completion time', () => {
    const p = recordLessonComplete(emptyProgress(), 'l', '2026-08-06T00:00:00.000Z');
    expect(lessonProgress(p, 'l', []).completed).toBe(true);
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test -- src/progress/progress.test.ts`
Expected: FAIL — `Failed to resolve import "./progress"`.

- [ ] **Step 5: Implement `src/progress/progress.ts`**

```ts
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
```

- [ ] **Step 6: Run the reducer tests**

Run: `npm test -- src/progress/progress.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 7: Write the failing storage tests**

`src/progress/storage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyProgress, recordAttempt } from './progress';
import { loadProgress, saveProgress, STORAGE_KEY } from './storage';

/** A Storage stand-in we can make fail on demand. */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: vi.fn((k: string, v: string) => {
      data[k] = v;
    }),
    removeItem: (k: string) => {
      delete data[k];
    },
    clear: () => {
      for (const k of Object.keys(data)) delete data[k];
    },
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length;
    },
  } as Storage;
}

describe('loadProgress', () => {
  it('returns empty progress when nothing is stored', () => {
    const { progress, recovered } = loadProgress(fakeStorage());
    expect(progress).toEqual(emptyProgress());
    expect(recovered).toBe(false);
  });

  it('round-trips saved progress', () => {
    const storage = fakeStorage();
    const written = recordAttempt(emptyProgress(), 'l', 'cp', { solved: true, hintsUsed: 1 });
    saveProgress(written, storage);
    expect(loadProgress(storage).progress).toEqual(written);
  });

  it('recovers from unparseable JSON instead of throwing', () => {
    const { progress, recovered } = loadProgress(fakeStorage({ [STORAGE_KEY]: '{not json' }));
    expect(progress).toEqual(emptyProgress());
    expect(recovered).toBe(true);
  });

  it('recovers from JSON that is not valid progress', () => {
    const stored = JSON.stringify({ version: 1, lessons: 'wrong', savedLines: [] });
    const { progress, recovered } = loadProgress(fakeStorage({ [STORAGE_KEY]: stored }));
    expect(progress).toEqual(emptyProgress());
    expect(recovered).toBe(true);
  });

  it('recovers from a version it does not understand', () => {
    const stored = JSON.stringify({ version: 99, lessons: {}, savedLines: [] });
    expect(loadProgress(fakeStorage({ [STORAGE_KEY]: stored })).recovered).toBe(true);
  });

  it('reports unavailable storage as empty rather than throwing', () => {
    const hostile = {
      getItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    expect(() => loadProgress(hostile)).not.toThrow();
    expect(loadProgress(hostile).progress).toEqual(emptyProgress());
  });
});

describe('saveProgress', () => {
  it('reports success on a normal write', () => {
    expect(saveProgress(emptyProgress(), fakeStorage())).toEqual({ ok: true });
  });

  it('reports a quota failure without throwing', () => {
    const full = fakeStorage();
    (full.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const error = new Error('quota');
      error.name = 'QuotaExceededError';
      throw error;
    });
    expect(saveProgress(emptyProgress(), full)).toEqual({ ok: false, reason: 'quota' });
  });

  it('reports any other storage failure as unavailable', () => {
    const broken = fakeStorage();
    (broken.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('nope');
    });
    expect(saveProgress(emptyProgress(), broken)).toEqual({ ok: false, reason: 'unavailable' });
  });
});
```

- [ ] **Step 8: Run to verify failure, then implement `src/progress/storage.ts`**

Run: `npm test -- src/progress/storage.test.ts` → FAIL on the missing import.

```ts
import { emptyProgress } from './progress';
import { progressSchema, type Progress } from './schema';

export const STORAGE_KEY = 'chesstrainer.progress.v1';

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Some privacy modes throw on the very act of touching localStorage.
    return null;
  }
}

/**
 * Reads stored progress.
 *
 * `recovered` is true when something was there but could not be used — bad
 * JSON, a shape that fails validation, or a version this build does not know.
 * The caller surfaces that to the player; the spec's rule is degrade, never
 * blank, so every failure path returns usable empty progress.
 */
export function loadProgress(
  storage: Storage | null = defaultStorage(),
): { progress: Progress; recovered: boolean } {
  if (!storage) return { progress: emptyProgress(), recovered: false };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { progress: emptyProgress(), recovered: false };
  }

  if (raw === null) return { progress: emptyProgress(), recovered: false };

  try {
    const parsed = progressSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { progress: emptyProgress(), recovered: true };
    return { progress: parsed.data, recovered: false };
  } catch {
    return { progress: emptyProgress(), recovered: true };
  }
}

export function saveProgress(
  progress: Progress,
  storage: Storage | null = defaultStorage(),
): { ok: boolean; reason?: 'quota' | 'unavailable' } {
  if (!storage) return { ok: false, reason: 'unavailable' };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return { ok: true };
  } catch (error) {
    const quota = error instanceof Error && /quota/i.test(error.name + error.message);
    return { ok: false, reason: quota ? 'quota' : 'unavailable' };
  }
}
```

- [ ] **Step 9: Run the full suite and commit**

Run: `npm test && npm run typecheck`

```bash
git add src/progress src/test/purity.test.ts
git commit -m "feat: add progress schema, reducers, and resilient storage"
```

---

### Task 3: The progress store, recording checkpoint outcomes

**Files:**
- Create: `src/progress/store.ts`
- Test: `src/progress/store.test.ts`
- Modify: `src/ui/LessonRail.tsx`
- Test: `src/ui/LessonRail.test.tsx`

**Interfaces:**
- Consumes: everything from Task 2; `useActiveLesson()`, `useLessonStore` from `src/lesson/store`; `checkpointIds` from `src/content/load`; `useTreeStore` from `src/tree/store`.
- Produces:
  - `useProgressStore` — `{ progress, recovered, saveFailed, noteAttempt(lessonId, checkpointId, outcome, dedupeKey), noteLessonComplete(lessonId), keepLine(line), dropLine(id), dismissNotice(), reset() }`
  - Consumers read per-lesson progress with the pure `lessonProgress(progress, lessonId, checkpointIds)` from Task 2, not a hook — Task 4 calls it inside a `map`, and a hook cannot be called in a loop.

**Recording happens once per distinct attempt.** The grade is *derived* from the tree, so it persists across re-renders and while the player sits on the wrong node. The store therefore keeps a session-only set of dedupe keys — `${lessonId}:${checkpointId}:${nodeId}` — so re-selecting a node already recorded does not inflate the count. That set is deliberately **not** persisted: it is about this session's render behaviour, not the player's history.

- [ ] **Step 1: Write the failing store tests**

`src/progress/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY } from './storage';
import { useProgressStore } from './store';

describe('progress store', () => {
  beforeEach(() => {
    localStorage.clear();
    useProgressStore.getState().reset();
  });

  it('starts empty', () => {
    expect(useProgressStore.getState().progress.lessons).toEqual({});
  });

  it('records an attempt and persists it', () => {
    useProgressStore.getState().noteAttempt('l', 'cp', { solved: true, hintsUsed: 1 }, 'k1');
    expect(useProgressStore.getState().progress.lessons.l.checkpoints.cp.solved).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toContain('cp');
  });

  it('ignores a repeat of the same dedupe key', () => {
    const store = useProgressStore.getState();
    store.noteAttempt('l', 'cp', { solved: false, hintsUsed: 0 }, 'same');
    store.noteAttempt('l', 'cp', { solved: false, hintsUsed: 0 }, 'same');
    expect(useProgressStore.getState().progress.lessons.l.checkpoints.cp.attempts).toBe(1);
  });

  it('records a genuinely different attempt', () => {
    const store = useProgressStore.getState();
    store.noteAttempt('l', 'cp', { solved: false, hintsUsed: 0 }, 'k1');
    store.noteAttempt('l', 'cp', { solved: false, hintsUsed: 0 }, 'k2');
    expect(useProgressStore.getState().progress.lessons.l.checkpoints.cp.attempts).toBe(2);
  });

  it('records lesson completion', () => {
    useProgressStore.getState().noteLessonComplete('l');
    expect(useProgressStore.getState().progress.lessons.l.completedAt).toBeTruthy();
  });

  it('keeps and drops saved lines', () => {
    const line = {
      id: 'x',
      name: 'Line',
      startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '1. e4',
      createdAt: '2026-08-06T00:00:00.000Z',
    };
    useProgressStore.getState().keepLine(line);
    expect(useProgressStore.getState().progress.savedLines).toHaveLength(1);
    useProgressStore.getState().dropLine('x');
    expect(useProgressStore.getState().progress.savedLines).toHaveLength(0);
  });

  it('surfaces a recovery notice when stored progress was unusable', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    useProgressStore.getState().reset();
    expect(useProgressStore.getState().recovered).toBe(true);
    useProgressStore.getState().dismissNotice();
    expect(useProgressStore.getState().recovered).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement `src/progress/store.ts`**

```ts
import { create } from 'zustand';
import {
  addSavedLine,
  emptyProgress,
  lessonProgress,
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
```

Note `lessonProgress` is imported and re-exported for consumers rather than
wrapped in a hook: Task 4 calls it once per lesson inside a `map`, and a hook
cannot be called in a loop.

Run the store tests: PASS, 7 tests.

- [ ] **Step 3: Write the failing rail tests**

Append to `src/ui/LessonRail.test.tsx`:

```tsx
  it('records a wrong answer against the checkpoint', () => {
    useProgressStore.getState().reset();
    useLessonStore.getState().startLesson('italian-game');
    useTreeStore.getState().playMove('d4');
    render(<LessonRail />);

    const record =
      useProgressStore.getState().progress.lessons['italian-game']
        ?.checkpoints['italian-open-with-e4'];
    expect(record?.attempts).toBe(1);
    expect(record?.solved).toBe(false);
  });

  it('records a solved checkpoint with the hints it took', () => {
    useProgressStore.getState().reset();
    useLessonStore.getState().startLesson('italian-game');
    useLessonStore.getState().revealHint('italian-open-with-e4');
    useTreeStore.getState().playMove('e4');
    render(<LessonRail />);

    const record =
      useProgressStore.getState().progress.lessons['italian-game']
        ?.checkpoints['italian-open-with-e4'];
    expect(record?.solved).toBe(true);
    expect(record?.hintsUsed).toBe(1);
  });

  it('does not double-count a re-render of the same attempt', () => {
    useProgressStore.getState().reset();
    useLessonStore.getState().startLesson('italian-game');
    useTreeStore.getState().playMove('d4');
    const { rerender } = render(<LessonRail />);
    rerender(<LessonRail />);
    rerender(<LessonRail />);

    expect(
      useProgressStore.getState().progress.lessons['italian-game']
        .checkpoints['italian-open-with-e4'].attempts,
    ).toBe(1);
  });
```

- [ ] **Step 4: Record outcomes from `LessonRail`**

Read `src/ui/LessonRail.tsx` in full first. Add the imports and one effect, placed with the other hooks **above every early return**:

```tsx
import { useEffect } from 'react';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
```

```tsx
  const noteAttempt = useProgressStore((store) => store.noteAttempt);
  const noteLessonComplete = useProgressStore((store) => store.noteLessonComplete);
  const selectedId = useTreeStore((store) => store.tree.selectedId);

  useEffect(() => {
    if (!active) return;
    const { lesson, state, attemptedCheckpoint, attemptedGrade } = active;

    // A graded attempt: the player answered and it was not accepted.
    if (attemptedCheckpoint && attemptedGrade) {
      noteAttempt(
        lesson.id,
        attemptedCheckpoint.id,
        { solved: false, hintsUsed: hintsShown[attemptedCheckpoint.id] ?? 0 },
        `${lesson.id}:${attemptedCheckpoint.id}:${selectedId}`,
      );
      return;
    }

    // Solved: the path walked past a checkpoint-bearing move while on script.
    if (!state.offScript && state.ply > 0) {
      const passed = segment.moves[state.ply - 1]?.checkpoint;
      if (passed) {
        noteAttempt(
          lesson.id,
          passed.id,
          { solved: true, hintsUsed: hintsShown[passed.id] ?? 0 },
          `${lesson.id}:${passed.id}:${selectedId}`,
        );
      }
    }

    if (state.complete && !state.offScript && !active.hasNextSegment) {
      noteLessonComplete(lesson.id);
    }
  }, [active, segment, hintsShown, selectedId, noteAttempt, noteLessonComplete]);
```

`active`, `segment` and `hintsShown` are already read in this component — reuse whatever the file actually calls them rather than re-deriving, and report any place this snippet does not match.

**This effect runs on every render, and that is intended.** `useActiveLesson()`
recomputes from the tree and returns a fresh object each time, so `active` never
has stable identity and the dependency array cannot prevent re-runs. The dedupe
key is what makes that safe — it is the mechanism, not a belt-and-braces extra.
**Do not "fix" the re-running by memoising `active`**: a memo keyed on something
stable would go stale against the tree, which is the bug this design avoids.
The completion call is separately guarded inside the store for the same reason.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test && npm run typecheck`

```bash
git add src/progress src/ui/LessonRail.tsx src/ui/LessonRail.test.tsx
git commit -m "feat: record checkpoint outcomes and lesson completion"
```

---

### Task 4: Progress in the picker

**Files:**
- Modify: `src/ui/LessonPicker.tsx`
- Test: `src/ui/LessonPicker.test.tsx`
- Modify: `src/ui/theme.css`

**Interfaces:**
- Consumes: `useProgressStore` (Task 3); `lessonProgress` (Task 2); `checkpointIds` from `src/content/load`; `ALL_LESSONS`.
- Produces: nothing new — this is the read side.

Progress the player cannot see is progress that might as well not exist.

- [ ] **Step 1: Write the failing tests**

Append to `src/ui/LessonPicker.test.tsx`:

```tsx
  it('shows nothing for a lesson never started', () => {
    useProgressStore.getState().reset();
    render(<LessonPicker />);
    // Deliberately specific: lesson summaries are free to contain the word
    // "checkpoint", so match the progress line's actual shape instead.
    expect(screen.queryByText(/\d+ of \d+ checkpoints/i)).not.toBeInTheDocument();
  });

  it('shows how many checkpoints are solved once some are', () => {
    useProgressStore.getState().reset();
    useProgressStore
      .getState()
      .noteAttempt('italian-game', 'italian-open-with-e4', { solved: true, hintsUsed: 0 }, 'k');
    render(<LessonPicker />);
    expect(screen.getByText(/1 of 3 checkpoints/i)).toBeInTheDocument();
  });

  it('marks a completed lesson as done in text, not colour alone', () => {
    useProgressStore.getState().reset();
    useProgressStore.getState().noteLessonComplete('london-system');
    render(<LessonPicker />);
    expect(screen.getByText(/done/i)).toBeInTheDocument();
  });

  it('tells the player when stored progress could not be read', () => {
    useProgressStore.setState({ recovered: true });
    render(<LessonPicker />);
    expect(screen.getByRole('status')).toHaveTextContent(/could not be read|starting fresh/i);
    useProgressStore.getState().dismissNotice();
  });

  it('tells the player when progress cannot be saved', () => {
    useProgressStore.setState({ saveFailed: true });
    render(<LessonPicker />);
    expect(screen.getByRole('status')).toHaveTextContent(/not being saved/i);
    useProgressStore.getState().dismissNotice();
  });
```

The Italian has three checkpoints (`italian-open-with-e4`, `italian-bishop-to-c4`, `italian-castle-kingside`). If that count has changed, use the real one and say so.

- [ ] **Step 2: Run to verify failure, then add the progress line to `LessonPicker.tsx`**

Add imports:

```tsx
import { checkpointIds } from '../content/load';
import { useProgressStore } from '../progress/store';
import { lessonProgress } from '../progress/progress';
```

Inside the group's map over lessons, under each button:

```tsx
        {(() => {
          const { solved, total, completed } = lessonProgress(
            progress,
            lesson.id,
            checkpointIds(lesson),
          );
          if (completed) return <p className="lesson-progress">Done</p>;
          if (solved === 0) return null;
          return (
            <p className="lesson-progress">
              {solved} of {total} checkpoints
            </p>
          );
        })()}
```

reading `progress` once at the top of the component with the other hooks:

```tsx
  const progress = useProgressStore((store) => store.progress);
```

And above the two groups, the notice:

```tsx
      {(recovered || saveFailed) && (
        <p role="status" className="progress-notice">
          {recovered
            ? 'Your saved progress could not be read, so it is starting fresh.'
            : 'Progress is not being saved — your browser storage is full or unavailable.'}
        </p>
      )}
```

with `recovered` and `saveFailed` read from the store alongside `progress`.

- [ ] **Step 3: Add the styles to `src/ui/theme.css`**

```css
.lesson-progress {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-soft);
  margin: 4px 0 0;
}

.progress-notice {
  font-size: 12px;
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  margin: 0 0 12px;
}
```

- [ ] **Step 4: Run the full suite and commit**

Run: `npm test && npm run typecheck`

```bash
git add src/ui
git commit -m "feat: show lesson progress and storage notices in the picker"
```

---

### Task 5: Saved lines

**Files:**
- Create: `src/chess/pgn.ts`
- Create: `src/ui/SavedLines.tsx`
- Test: `src/chess/pgn.test.ts`
- Test: `src/ui/SavedLines.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/ui/theme.css`

**Interfaces:**
- Consumes: chess.js; `useTreeStore`, `pathTo` from `src/tree/`; `useProgressStore` (Task 3).
- Produces:
  - `lineToPgn(startFen: string, sans: string[]): string`
  - `pgnToSans(pgn: string, startFen: string): string[]`
  - `SavedLines` — the component.

**The line is stored as its starting FEN plus a PGN movetext.** PGN's own mechanism for a non-standard start is `SetUp`/`FEN` headers; keeping the FEN as its own field is equivalent and avoids depending on how a particular chess.js version emits and re-reads headers.

- [ ] **Step 1: Write the failing PGN tests**

`src/chess/pgn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lineToPgn, pgnToSans } from './pgn';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

describe('lineToPgn', () => {
  it('writes a line from the standard start', () => {
    expect(lineToPgn(START, ['e4', 'e5', 'Nf3'])).toContain('e4');
  });

  it('round-trips through pgnToSans', () => {
    const sans = ['e4', 'e5', 'Nf3', 'Nc6'];
    expect(pgnToSans(lineToPgn(START, sans), START)).toEqual(sans);
  });

  it('round-trips a line that starts from a custom position', () => {
    const sans = ['Nf3', 'Nc6', 'Bc4'];
    expect(pgnToSans(lineToPgn(AFTER_E4_E5, sans), AFTER_E4_E5)).toEqual(sans);
  });

  it('produces an empty movetext for an empty line', () => {
    expect(pgnToSans(lineToPgn(START, []), START)).toEqual([]);
  });

  it('throws on a move that is illegal in the line', () => {
    expect(() => lineToPgn(START, ['e4', 'e4'])).toThrow(/illegal/i);
  });

  it('returns an empty list rather than throwing on unreadable pgn', () => {
    expect(pgnToSans('this is not pgn at all', START)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement `src/chess/pgn.ts`**

```ts
import { Chess } from 'chess.js';

/**
 * Renders a line as PGN movetext.
 *
 * The starting position is kept by the caller rather than written as a
 * `SetUp`/`FEN` header, so reading it back does not depend on how a given
 * chess.js version round-trips headers.
 */
export function lineToPgn(startFen: string, sans: string[]): string {
  const chess = new Chess(startFen);
  for (const san of sans) {
    try {
      chess.move(san);
    } catch {
      throw new Error(`Illegal move "${san}" while writing PGN from ${startFen}`);
    }
  }
  return chess.pgn();
}

/** Reads a line back. Returns an empty list if the PGN cannot be understood. */
export function pgnToSans(pgn: string, startFen: string): string[] {
  const chess = new Chess(startFen);
  try {
    chess.loadPgn(pgn);
  } catch {
    return [];
  }
  return chess.history();
}
```

**Verify `loadPgn` behaves as assumed before trusting these tests.** In this chess.js version, confirm in a scratch script that `loadPgn` on a `Chess` constructed from a custom FEN keeps that starting position rather than resetting to the standard one, and that it throws (rather than silently succeeding) on unreadable input. If either differs, adapt the implementation — for example by replaying the movetext manually — and report what you found.

- [ ] **Step 3: Write the failing component tests**

`src/ui/SavedLines.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
import { SavedLines } from './SavedLines';

describe('SavedLines', () => {
  beforeEach(() => {
    localStorage.clear();
    useProgressStore.getState().reset();
    useTreeStore.getState().reset();
  });

  it('offers no save when no moves have been played', () => {
    render(<SavedLines />);
    expect(screen.queryByRole('button', { name: /save this line/i })).not.toBeInTheDocument();
  });

  it('saves the current line under a default name', async () => {
    useTreeStore.getState().playMove('e4');
    useTreeStore.getState().playMove('e5');
    render(<SavedLines />);

    await userEvent.click(screen.getByRole('button', { name: /save this line/i }));
    expect(useProgressStore.getState().progress.savedLines).toHaveLength(1);
    expect(useProgressStore.getState().progress.savedLines[0].pgn).toContain('e4');
  });

  it('lists a saved line and reopens it', async () => {
    useTreeStore.getState().playMove('e4');
    useTreeStore.getState().playMove('e5');
    render(<SavedLines />);
    await userEvent.click(screen.getByRole('button', { name: /save this line/i }));

    useTreeStore.getState().reset();
    expect(useTreeStore.getState().tree.selectedId).toBe(useTreeStore.getState().tree.rootId);

    await userEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(useTreeStore.getState().tree.selectedId).toContain('e5');
  });

  it('deletes a saved line', async () => {
    useTreeStore.getState().playMove('e4');
    render(<SavedLines />);
    await userEvent.click(screen.getByRole('button', { name: /save this line/i }));
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(useProgressStore.getState().progress.savedLines).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run to verify failure, then implement `src/ui/SavedLines.tsx`**

```tsx
import { lineToPgn, pgnToSans } from '../chess/pgn';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';
import { Button } from './Button';

export function SavedLines() {
  const tree = useTreeStore((store) => store.tree);
  const reset = useTreeStore((store) => store.reset);
  const playMove = useTreeStore((store) => store.playMove);
  const savedLines = useProgressStore((store) => store.progress.savedLines);
  const keepLine = useProgressStore((store) => store.keepLine);
  const dropLine = useProgressStore((store) => store.dropLine);

  const path = pathTo(tree, tree.selectedId);
  const sans = path.slice(1).map((node) => node.move!.san);
  const startFen = tree.nodes[tree.rootId].fen;

  function save() {
    const name = sans.slice(0, 6).join(' ') || 'Line';
    keepLine({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      startFen,
      pgn: lineToPgn(startFen, sans),
      createdAt: new Date().toISOString(),
    });
  }

  function open(line: (typeof savedLines)[number]) {
    reset(line.startFen);
    for (const san of pgnToSans(line.pgn, line.startFen)) playMove(san);
  }

  return (
    <section aria-label="My lines" className="saved-lines">
      <h3 className="saved-lines-heading">MY LINES</h3>

      {sans.length > 0 && (
        <Button variant="ghost" onClick={save}>
          Save this line
        </Button>
      )}

      {savedLines.length === 0 ? (
        <p className="saved-lines-empty">
          Nothing saved yet. Play a line you want to come back to, then save it.
        </p>
      ) : (
        <ul className="saved-lines-list">
          {savedLines.map((line) => (
            <li key={line.id}>
              <span className="saved-lines-name">{line.name}</span>
              <Button variant="ghost" onClick={() => open(line)}>
                Open
              </Button>
              <Button variant="ghost" onClick={() => dropLine(line.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Add the styles and mount the component**

In `src/ui/theme.css`:

```css
.saved-lines {
  border: 2px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  margin-top: 16px;
}
.saved-lines-heading {
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
  margin: 0 0 8px;
}
.saved-lines-empty {
  font-size: 12px;
  color: var(--ink-soft);
  margin: 0;
}
.saved-lines-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.saved-lines-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.saved-lines-name {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  flex: 1 1 auto;
}
```

In `src/App.tsx`, add `<SavedLines />` to the left column beneath `<LessonRail />`, with its import. Change nothing else about the layout — the designed shell is Plan 5.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test && npm run typecheck && npm run build`

```bash
git add src/chess/pgn.ts src/chess/pgn.test.ts src/ui src/App.tsx
git commit -m "feat: save and reopen lines as PGN"
```

---

### Task 6: New-game control and mute toggle

**Files:**
- Create: `src/ui/AppControls.tsx`
- Test: `src/ui/AppControls.test.tsx`
- Modify: `src/sound/SoundManager.ts`
- Modify: `src/App.tsx`
- Modify: `src/ui/theme.css`

**Interfaces:**
- Consumes: `useTreeStore` (`reset`), `useLessonStore` (`stopLesson`), `sounds` from `src/sound/index`.
- Produces: `AppControls` — the component.

Two capabilities the app has had with no way to reach them: `SoundManager` honours a mute flag that nothing sets, and `reset` had no caller outside lessons.

**Mute must survive a reload**, or it is not a setting — it is a nuisance the player re-applies every visit. It is a single boolean and unrelated to lesson progress, so it gets its own storage key rather than joining the progress object.

- [ ] **Step 1: Give `SoundManager` a persisted mute**

Read `src/sound/SoundManager.ts` first. It already has `setMuted(muted: boolean)` and a `muted` getter. Add persistence around them:

```ts
const MUTE_KEY = 'chesstrainer.muted';

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}
```

Initialise the internal flag from `readStoredMute()`, and in `setMuted`, write it back inside a `try`/`catch` that swallows failures — a browser that refuses storage must still mute for the session. **Sound is optional by construction: nothing here may throw.**

Add to `src/sound/SoundManager.test.ts`:

```ts
  it('starts muted when that was stored', () => {
    localStorage.setItem('chesstrainer.muted', 'true');
    expect(new SoundManager().muted).toBe(true);
    localStorage.clear();
  });

  it('persists a mute change', () => {
    const manager = new SoundManager();
    manager.setMuted(true);
    expect(localStorage.getItem('chesstrainer.muted')).toBe('true');
    localStorage.clear();
  });

  it('still mutes when storage refuses to write', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('denied');
    };
    const manager = new SoundManager();
    expect(() => manager.setMuted(true)).not.toThrow();
    expect(manager.muted).toBe(true);
    Storage.prototype.setItem = original;
  });
```

- [ ] **Step 2: Write the failing controls tests**

`src/ui/AppControls.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLessonStore } from '../lesson/store';
import { sounds } from '../sound';
import { useTreeStore } from '../tree/store';
import { AppControls } from './AppControls';

describe('AppControls', () => {
  beforeEach(() => {
    localStorage.clear();
    useTreeStore.getState().reset();
    useLessonStore.getState().stopLesson();
    sounds.setMuted(false);
  });

  it('clears the board back to the starting position', async () => {
    useTreeStore.getState().playMove('e4');
    render(<AppControls />);
    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    const tree = useTreeStore.getState().tree;
    expect(tree.selectedId).toBe(tree.rootId);
    expect(Object.keys(tree.nodes)).toHaveLength(1);
  });

  it('leaves any running lesson when a new game starts', async () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<AppControls />);
    await userEvent.click(screen.getByRole('button', { name: /new game/i }));
    expect(useLessonStore.getState().lessonId).toBeNull();
  });

  it('toggles sound and says which state it is in', async () => {
    render(<AppControls />);
    const toggle = screen.getByRole('button', { name: /sound/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(toggle);
    expect(sounds.muted).toBe(true);
    expect(screen.getByRole('button', { name: /sound/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the muted state as text, not colour alone', async () => {
    render(<AppControls />);
    await userEvent.click(screen.getByRole('button', { name: /sound/i }));
    expect(screen.getByRole('button', { name: /sound off/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify failure, then implement `src/ui/AppControls.tsx`**

```tsx
import { useState } from 'react';
import { useLessonStore } from '../lesson/store';
import { sounds } from '../sound';
import { useTreeStore } from '../tree/store';
import { Button } from './Button';

export function AppControls() {
  const resetTree = useTreeStore((store) => store.reset);
  const stopLesson = useLessonStore((store) => store.stopLesson);
  const [muted, setMuted] = useState(sounds.muted);

  function newGame() {
    stopLesson();
    resetTree();
  }

  function toggleSound() {
    const next = !sounds.muted;
    sounds.setMuted(next);
    setMuted(next);
  }

  return (
    <div className="app-controls">
      <Button variant="ghost" onClick={newGame}>
        New game
      </Button>
      <Button variant="ghost" onClick={toggleSound} aria-pressed={muted}>
        {muted ? 'Sound off' : 'Sound on'}
      </Button>
    </div>
  );
}
```

Note `stopLesson()` runs before `resetTree()`: `stopLesson` itself does not touch the tree, so resetting afterwards is what actually clears the board.

- [ ] **Step 4: Add the styles and mount it**

In `src/ui/theme.css`:

```css
.app-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
```

In `src/App.tsx`, render `<AppControls />` above the `<Breadcrumb />`, with its import. Change nothing else.

- [ ] **Step 5: Run the full suite, typecheck, and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass, one skip, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/ui src/sound src/App.tsx
git commit -m "feat: add a new-game control and a persisted mute toggle"
```

---

## Manual verification before the branch is finished

Tests cannot see any of this. Run `npm run dev` and confirm:

- Solve the Italian's first checkpoint; the picker shows "1 of 3 checkpoints".
- Get one wrong first, then right — the count still moves, and the record shows it took more than one attempt.
- Finish a whole lesson; the picker says "Done".
- Reload the page; the progress is still there.
- Play a line, save it, hit New game, then Open it — the position comes back.
- Toggle Sound off, reload, and confirm it is still off.
- Start **Development and Tempo**, take "Next part", and confirm the board is now oriented from **Black's** side for that segment.
- In DevTools, corrupt the `chesstrainer.progress.v1` key and reload: the app must come up with a notice, not a blank screen.

## What Plan 5 covers

- A properly designed `App.tsx` layout — it is now hosting the picker, lesson rail, saved lines, and controls on top of a placeholder
- Keyboard board navigation, the spec's outstanding accessibility requirement
- The compare drawer's contrast vocabulary, which `Known Issues.md` records as needing a design decision rather than a patch
- More authored `alternatives` — one move in the corpus carries them

## Before finishing this branch

Update the vault per `CLAUDE.md`: `Current State.md`, `Known Issues.md` (delete the board-orientation entry, which Task 1 resolves), `Roadmap.md`, `Architecture.md` for the new `src/progress/` layer, and `Start Here.md` last.
