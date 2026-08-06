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
  /**
   * Overrides the lesson's `side` for this segment. A theme lesson draws
   * positions from different games, so which side the player takes can
   * legitimately differ per position.
   */
  side: z.enum(['white', 'black']).optional(),
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
