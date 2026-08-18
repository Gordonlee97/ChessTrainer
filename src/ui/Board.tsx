import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { describeSquare, moveCursor } from '../chess/boardCursor';
import { legalDestinations } from '../chess/legalMoves';
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
  const noteAcceptance = useLessonStore((state) => state.noteAcceptance);
  const activeLesson = useActiveLesson();
  const orientation = activeLesson?.segment.side ?? activeLesson?.lesson.side ?? 'white';

  const highlight = useMemo(() => {
    if (!node.move) return {};
    // backgroundColor, not the `background` shorthand: the destination dots
    // below set backgroundImage on the same square, and the shorthand would
    // reset it depending on which React assigns first.
    const style = { backgroundColor: 'color-mix(in srgb, var(--board-highlight) 55%, transparent)' };
    return { [node.move.from]: style, [node.move.to]: style };
  }, [node.move]);

  const [cursor, setCursor] = useState('e2');
  /**
   * Whether the cursor ring should be drawn: true only once the player has
   * actually pressed a key the board handles, and false again the moment they
   * touch it with a pointer or focus leaves.
   *
   * This is `:focus-visible` semantics, and plain focus is not good enough —
   * that was the first attempt and it did not fix the reported bug. `cursor`
   * initialises to 'e2' and the ring was originally drawn unconditionally, so
   * it was painted from the first render and no interaction removed it, since
   * `setCursor` only ever moves it. Gating on focus left it appearing the
   * instant a piece was *dragged*, because pressing the pointer down on the
   * board focuses this wrapper — so a mouse-only player still got a purple
   * ring parked on a square they had never touched, still there several moves
   * later. Reported twice from the running app on 2026-08-17.
   */
  const [keyboardCursor, setKeyboardCursor] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // A held piece must not survive navigating to another position: the square
  // it points at may not hold that piece any more.
  useEffect(() => {
    setPicked(null);
  }, [node.id]);

  const cursorStyles = useMemo(() => {
    // Nothing at all until the keyboard is in use: the ring and the held piece
    // are both keyboard state, and showing either to a player driving the
    // board with a mouse is a mark they can neither explain nor dismiss. The
    // state itself is kept, so a piece picked up before a click elsewhere is
    // still held when the keyboard comes back.
    if (!keyboardCursor) return {};
    const styles: Record<string, CSSProperties> = {
      [cursor]: { boxShadow: 'inset 0 0 0 4px var(--secondary)' },
    };
    if (picked) styles[picked] = { boxShadow: 'inset 0 0 0 4px var(--primary)' };
    return styles;
  }, [cursor, picked, keyboardCursor]);

  /**
   * Where the selected piece may legally go, drawn the way every board site
   * draws it: a dot on an empty square, a ring around a piece that can be
   * taken. Shown for a selection made by any means — clicking or the
   * keyboard's pick-up — because the question "where can this go" does not
   * depend on how the piece was chosen.
   *
   * `backgroundImage` rather than the `background` shorthand so it composes
   * with the last-move highlight on the same square instead of erasing it.
   */
  const destinationStyles = useMemo(() => {
    if (!picked) return {};
    const styles: Record<string, CSSProperties> = {};
    for (const { to, captures } of legalDestinations(node.fen, picked)) {
      styles[to] = {
        // A capture tints the square around the piece rather than putting a
        // dot under it, which the piece would hide. It needs to be heavier
        // than the quiet-move dot: at the dot's weight the tint was swallowed
        // by the last-move highlight on the same square and read as nothing.
        backgroundImage: captures
          ? 'radial-gradient(circle, transparent 52%, color-mix(in srgb, var(--ink) 48%, transparent) 54%)'
          : 'radial-gradient(circle, color-mix(in srgb, var(--ink) 34%, transparent) 19%, transparent 21%)',
      };
    }
    return styles;
  }, [node.fen, picked]);

  /**
   * The three style sources merged per square rather than spread over one
   * another, so a square that is both a last-move endpoint and a legal
   * destination keeps both marks. A plain object spread would let whichever
   * source came last win the whole square.
   */
  const squareStyles = useMemo(() => {
    const merged: Record<string, CSSProperties> = {};
    for (const source of [highlight, destinationStyles, cursorStyles]) {
      for (const [square, style] of Object.entries(source)) {
        merged[square] = { ...merged[square], ...style };
      }
    }
    return merged;
  }, [highlight, destinationStyles, cursorStyles]);


  type MoveOutcome =
    | { kind: 'illegal' }
    | { kind: 'rejected'; san: string }
    | { kind: 'played'; san: string };

  /**
   * The single definition of what happens when the player tries to move a
   * piece from one square to another — legality, lesson grading, sound, and
   * the tree write, in that order.
   *
   * All three inputs go through here: dragging, the keyboard's place step, and
   * clicking a destination. It exists because the first two each carried their
   * own copy of the grading sequence, and adding a third would have made three
   * places that must agree about when a lesson answer counts. This repo has
   * been bitten by exactly that shape more than once — a shared rule with two
   * definitions drifts the moment one of them has to handle an extra state.
   *
   * Callers differ only in how they *report* the outcome: the keyboard
   * announces it, a drop returns a boolean telling react-chessboard whether to
   * leave the piece where it landed. Neither decides anything about grading.
   */
  function attemptMove(from: string, to: string): MoveOutcome {
    const resolved = resolveDrop(node.fen, from, to);
    if (!resolved) return { kind: 'illegal' };

    const checkpoint = askingCheckpoint(activeLesson);
    let checkpointAccepted = false;
    if (checkpoint) {
      const grade = gradeMove(checkpoint, resolved.san);
      if (grade.kind !== 'correct') {
        noteRejection(resolved.san, grade, node.id);
        sounds.play('incorrect');
        return { kind: 'rejected', san: resolved.san };
      }
      clearRejection();
      sounds.play('correct');
      checkpointAccepted = true;
    }

    const played = playMove(resolved.san);
    if (!played) return { kind: 'illegal' };

    sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound);
    // Recorded at the node the move landed on, not the one it was played
    // from — see lastAcceptance's doc in lesson/store.ts.
    if (checkpointAccepted) noteAcceptance(resolved.san, played);
    return { kind: 'played', san: resolved.san };
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const key = event.key;

    // Only the keys this handler acts on turn the ring on. Tab in particular
    // must not: arriving here by tabbing past the board is not navigating it,
    // and lighting up a square the player is moving away from is noise.
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight' ||
        key === 'Enter' || key === ' ' || key === 'Escape') {
      setKeyboardCursor(true);
    }

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

    const outcome = attemptMove(picked, cursor);
    if (outcome.kind === 'illegal') {
      setAnnouncement(`${picked} to ${cursor} is not a legal move`);
      return; // keep the piece held so the player can try another square
    }
    if (outcome.kind === 'rejected') {
      setAnnouncement(`${outcome.san} is not the answer`);
      return; // keep the piece held so the player can try another square
    }
    setAnnouncement(outcome.san);
    setPicked(null);
  }

  /**
   * Click to select a piece, click again to move it there.
   *
   * Selecting reuses the same `picked` state the keyboard uses, so the two
   * input methods cannot disagree about what is held, and moving goes through
   * `attemptMove` like every other input — a click can no more skip a lesson's
   * grading than a drag can.
   *
   * Clicking another of your own movable pieces switches the selection rather
   * than deselecting and making you click twice; clicking anything else with a
   * piece held puts it down.
   */
  function onSquareClick({ square }: { square: string }) {
    if (picked === null) {
      // No destinations means nothing worth selecting: an empty square, the
      // opponent's piece, or a piece with nowhere to go.
      if (legalDestinations(node.fen, square).length > 0) setPicked(square);
      return;
    }

    if (square === picked) {
      setPicked(null);
      return;
    }

    const canReach = legalDestinations(node.fen, picked).some((move) => move.to === square);
    if (!canReach) {
      // Re-select if they clicked another piece of their own that can move,
      // otherwise treat it as putting the held piece down.
      setPicked(legalDestinations(node.fen, square).length > 0 ? square : null);
      return;
    }

    // A rejected lesson answer keeps the piece held, exactly as the keyboard
    // and a drag do, so the player can try another square without reselecting.
    if (attemptMove(picked, square).kind !== 'rejected') setPicked(null);
  }

  function onPieceDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!targetSquare) return false;
    // A drop always ends the selection, however it is graded: the piece has
    // visibly left the player's hand.
    setPicked(null);
    // false returns the piece to its source square.
    return attemptMove(sourceSquare, targetSquare).kind === 'played';
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
      // Pointer use retires the ring; onBlur covers leaving the board
      // entirely. Both bubble, so they fire for anything inside the board —
      // including react-chessboard's own squares and pieces.
      onPointerDown={() => setKeyboardCursor(false)}
      onBlur={() => setKeyboardCursor(false)}
      style={{ outlineOffset: 3 }}
    >
      <Chessboard
        options={{
          id: 'main-board',
          position: node.fen,
          boardOrientation: orientation,
          onPieceDrop,
          onSquareClick,
          onPieceDrag,
          squareStyles,
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
