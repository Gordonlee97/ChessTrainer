import { Chess } from 'chess.js';

const GLYPHS: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

export function MiniBoard({ fen, label }: { fen: string; label: string }) {
  const board = new Chess(fen).board();

  return (
    <div
      role="img"
      aria-label={label}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        aspectRatio: '1',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 3px 0 #e0c3a3',
      }}
    >
      {board.flatMap((row, rankIndex) =>
        row.map((cell, fileIndex) => (
          <div
            key={`${rankIndex}-${fileIndex}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'min(3vw, 18px)',
              lineHeight: 1,
              background:
                (rankIndex + fileIndex) % 2 === 0 ? 'var(--board-light)' : 'var(--board-dark)',
              color: cell?.color === 'w' ? '#fff' : '#111',
              textShadow:
                cell?.color === 'w' ? '0 0 2px rgba(0,0,0,.8)' : '0 0 2px rgba(255,255,255,.8)',
            }}
          >
            {cell ? GLYPHS[cell.type] : ''}
          </div>
        )),
      )}
    </div>
  );
}
