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
