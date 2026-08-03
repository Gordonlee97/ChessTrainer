import { Chess } from 'chess.js';
import type { CSSProperties } from 'react';
import { resolveSan } from '../chess/resolveDrop';
import { sounds } from '../sound';
import { useSelectedNode, useTreeStore } from '../tree/store';
import { Button } from './Button';
import { EvalBar } from './EvalBar';
import { formatScore, useAnalysis } from './useAnalysis';

/**
 * Describes a position where a finished analysis has zero usable lines. Only
 * checkmate/stalemate genuinely means the position has no legal moves — a
 * finished analysis can also land at zero lines when every PV was filtered
 * as illegal, or a `bestmove` arrived before any pv-bearing `info`, so those
 * cases get a neutral message rather than a false terminal-position claim.
 */
function noCandidatesMessage(fen: string): string {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return 'Checkmate.';
  if (chess.isStalemate()) return 'Stalemate — the game is drawn.';
  return 'No candidate moves available.';
}

export function CandidateRail() {
  const { result, status, retry } = useAnalysis();
  const node = useSelectedNode();
  const playMove = useTreeStore((state) => state.playMove);

  function playCandidate(san: string) {
    // Shares resolveDrop's classification (via resolveSan) so a candidate
    // click and the equivalent drag-and-drop move sound identical.
    const resolved = resolveSan(node.fen, san);
    const played = playMove(san);
    if (played && resolved) {
      sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound);
    }
  }

  if (status === 'unavailable') {
    return (
      <div
        role="status"
        style={{
          padding: 12,
          borderRadius: 'var(--radius)',
          border: '2px solid var(--border)',
          fontSize: 13,
        }}
      >
        <p style={{ margin: '0 0 8px' }}>
          Engine unavailable — lesson content still works, but live evaluation is off.
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={retry}
          style={
            {
              fontWeight: 700,
              fontSize: 13,
              padding: '6px 12px',
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '2px solid var(--border)',
              '--btn-shadow': 'var(--border)',
            } as CSSProperties
          }
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!result || result.lines.length === 0) {
    // A finished analysis (status idle) with zero candidate moves means the
    // position itself has no legal moves — checkmate or stalemate — not
    // that analysis is still running. Anything else (still analyzing, or no
    // result at all yet) is the ordinary "still thinking" state.
    if (status === 'idle' && result) {
      return (
        <div role="status" style={{ padding: 12, color: 'var(--ink-soft)', fontSize: 13 }}>
          {noCandidatesMessage(node.fen)}
        </div>
      );
    }
    return (
      <div role="status" style={{ padding: 12, color: 'var(--ink-soft)', fontSize: 13 }}>
        Thinking…
      </div>
    );
  }

  return (
    <section aria-label="Candidate moves">
      <h2 style={{ fontSize: 12, letterSpacing: '.08em', color: 'var(--ink-soft)', margin: '0 0 8px' }}>
        CANDIDATE MOVES · depth {result.depth}
      </h2>
      {result.lines.map((line, index) => (
        <Button
          key={`${index}-${line.san}`}
          type="button"
          variant="ghost"
          // The move sound (played by playCandidate below) is the only
          // sound a candidate click makes — it must match dragging the same
          // move exactly, so the shared buttonPress click is suppressed.
          sound={false}
          onClick={() => playCandidate(line.san)}
          style={
            {
              display: 'block',
              width: '100%',
              textAlign: 'left',
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 8,
              padding: '10px 12px',
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: `2px solid ${index === 0 ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              boxShadow: `0 3px 0 ${index === 0 ? 'var(--primary)' : 'var(--border)'}`,
              '--btn-shadow': index === 0 ? 'var(--primary)' : 'var(--border)',
            } as CSSProperties
          }
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{line.san}</span>
            <span>{formatScore(line)}</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <EvalBar cp={line.cp} mate={line.mate} />
          </div>
          <div style={{ marginTop: 6, fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)' }}>
            {line.pv.slice(0, 6).join(' ')}
          </div>
        </Button>
      ))}
    </section>
  );
}
