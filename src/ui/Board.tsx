import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { resolveDrop } from '../chess/resolveDrop';
import { SoundManager } from '../sound/SoundManager';
import { useSelectedNode, useTreeStore } from '../tree/store';

const sounds = new SoundManager();

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function Board() {
  const node = useSelectedNode();
  const playMove = useTreeStore((state) => state.playMove);

  const highlight = useMemo(() => {
    if (!node.move) return {};
    const style = { background: 'color-mix(in srgb, var(--board-highlight) 55%, transparent)' };
    return { [node.move.from]: style, [node.move.to]: style };
  }, [node.move]);

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

    const played = playMove(resolved.san);
    if (!played) return false;

    sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound);
    return true;
  }

  return (
    <Chessboard
      options={{
        id: 'main-board',
        position: node.fen,
        onPieceDrop,
        squareStyles: highlight,
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
  );
}
