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
