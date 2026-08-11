import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { describeSquare, moveCursor } from '../chess/boardCursor';
import { resolveDrop } from '../chess/resolveDrop';
import { gradeMove } from '../lesson/grade';
import { askingCheckpoint, useActiveLesson, useLessonStore } from '../lesson/store';
import { sounds } from '../sound';
import { useSelectedNode, useTreeStore } from '../tree/store';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function Board() {
  const node = useSelectedNode();
  const playMove = useTreeStore((state) => state.playMove);
  const noteRejection = useLessonStore((state) => state.noteRejection);
  const clearRejection = useLessonStore((state) => state.clearRejection);
  const activeLesson = useActiveLesson();
  const orientation = activeLesson?.segment.side ?? activeLesson?.lesson.side ?? 'white';

  const highlight = useMemo(() => {
    if (!node.move) return {};
    const style = { background: 'color-mix(in srgb, var(--board-highlight) 55%, transparent)' };
    return { [node.move.from]: style, [node.move.to]: style };
  }, [node.move]);

  const [cursor, setCursor] = useState('e2');
  const [picked, setPicked] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // A held piece must not survive navigating to another position: the square
  // it points at may not hold that piece any more.
  useEffect(() => {
    setPicked(null);
  }, [node.id]);

  const cursorStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {
      [cursor]: { boxShadow: 'inset 0 0 0 4px var(--secondary)' },
    };
    if (picked) styles[picked] = { boxShadow: 'inset 0 0 0 4px var(--primary)' };
    return styles;
  }, [cursor, picked]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const key = event.key;

    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault(); // otherwise the page scrolls under the board
      const next = moveCursor(cursor, key, orientation);
      setCursor(next);
      setAnnouncement(describeSquare(node.fen, next));
      return;
    }

    if (key === 'Escape') {
      if (picked) {
        setPicked(null);
        setAnnouncement('put down');
      }
      return;
    }

    if (key !== 'Enter' && key !== ' ') return;
    event.preventDefault();

    if (picked === null) {
      const description = describeSquare(node.fen, cursor);
      if (description.endsWith('empty')) {
        setAnnouncement(`${description} — nothing to pick up`);
        return;
      }
      setPicked(cursor);
      setAnnouncement(`picked up ${description}`);
      return;
    }

    const resolved = resolveDrop(node.fen, picked, cursor);
    if (!resolved) {
      setAnnouncement(`${picked} to ${cursor} is not a legal move`);
      return; // keep the piece held so the player can try another square
    }

    const checkpoint = askingCheckpoint(activeLesson);
    if (checkpoint) {
      const grade = gradeMove(checkpoint, resolved.san);
      if (grade.kind !== 'correct') {
        noteRejection(resolved.san, grade, node.id);
        sounds.play('incorrect');
        setAnnouncement(`${resolved.san} is not the answer`);
        return; // keep the piece held so the player can try another square
      }
      clearRejection();
    }

    const played = playMove(resolved.san);
    if (played) {
      sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound);
      setAnnouncement(resolved.san);
    }
    setPicked(null);
  }

  function onPieceDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!targetSquare) return false;

    const resolved = resolveDrop(node.fen, sourceSquare, targetSquare);
    if (!resolved) return false;

    const checkpoint = askingCheckpoint(activeLesson);
    if (checkpoint) {
      const grade = gradeMove(checkpoint, resolved.san);
      if (grade.kind !== 'correct') {
        noteRejection(resolved.san, grade, node.id);
        sounds.play('incorrect');
        return false; // react-chessboard returns the piece to its source square
      }
      clearRejection();
    }

    const played = playMove(resolved.san);
    if (!played) return false;

    sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound);
    return true;
  }

  function onPieceDrag(): void {
    sounds.play('pickup');
  }

  return (
    <div
      role="application"
      aria-label="Chess board. Use arrow keys to move the cursor, Enter to pick up and place a piece."
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ outlineOffset: 3 }}
    >
      <Chessboard
        options={{
          id: 'main-board',
          position: node.fen,
          boardOrientation: orientation,
          onPieceDrop,
          onPieceDrag,
          squareStyles: { ...highlight, ...cursorStyles },
          lightSquareStyle: { backgroundColor: 'var(--board-light)' },
          darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
          boardStyle: {
            borderRadius: 'var(--radius)',
            boxShadow:
              '0 5px 0 var(--board-light), 0 10px 24px color-mix(in srgb, var(--board-dark) 25%, transparent)',
          },
          dropSquareStyle: { boxShadow: 'inset 0 0 0 4px var(--board-highlight)' },
          animationDurationInMs: prefersReducedMotion ? 0 : 180,
          showAnimations: !prefersReducedMotion,
        }}
      />
      <p role="status" aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
    </div>
  );
}
