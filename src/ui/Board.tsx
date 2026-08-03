import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
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

    // Resolve the drag to SAN before handing it to the tree, which speaks SAN.
    const probe = new Chess(node.fen);
    let san: string;
    try {
      san = probe.move({ from: sourceSquare, to: targetSquare, promotion: 'q' }).san;
    } catch {
      return false;
    }

    const played = playMove(san);
    if (!played) return false;

    if (probe.isCheck()) sounds.play('check');
    else if (san.includes('x')) sounds.play('capture');
    else sounds.play('move');

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
