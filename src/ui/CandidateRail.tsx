import { Chess } from 'chess.js';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { resolveSan } from '../chess/resolveDrop';
import type { Alternative } from '../content/schema';
import type { AuthoredContrastPair } from '../explain/compare';
import { buildContext, describeMove } from '../explain/explain';
import { classifyMove } from '../explain/quality';
import { askingCheckpoint, useActiveLesson } from '../lesson/store';
import { sounds } from '../sound';
import { useSelectedNode, useTreeStore } from '../tree/store';
import { Button } from './Button';
import { CheckpointPanel } from './CheckpointPanel';
import { CompareDrawer } from './CompareDrawer';
import { EngineUnavailableNotice } from './EngineUnavailableNotice';
import { EvalBar } from './EvalBar';
import { QualityBadge } from './QualityBadge';
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

/**
 * The authored pros and cons for a pair of moves, or undefined when the
 * lesson has nothing to say about either — in which case `compareLines`
 * falls back to its own heuristic summary.
 */
function authoredContrastFor(
  alternatives: Alternative[] | undefined,
  aSan: string,
  bSan: string,
): AuthoredContrastPair | undefined {
  if (!alternatives) return undefined;
  const find = (san: string) => alternatives.find((entry) => entry.san === san);
  const a = find(aSan);
  const b = find(bSan);
  if (!a && !b) return undefined;
  return {
    a: a ? { pros: a.pros, cons: a.cons } : undefined,
    b: b ? { pros: b.pros, cons: b.cons } : undefined,
  };
}

export function CandidateRail() {
  const { result, status, retry } = useAnalysis();
  const node = useSelectedNode();
  const playMove = useTreeStore((state) => state.playMove);
  const [comparing, setComparing] = useState(false);
  const activeLesson = useActiveLesson();

  // Without this, leaving the drawer open and navigating to a position with
  // fewer than 2 candidates (which unmounts it) and then back to one with 2+
  // silently reopens it with no click — a comparison the player never asked
  // for, attached to whatever position they've now landed on.
  useEffect(() => {
    setComparing(false);
  }, [node.id]);

  // Building a context runs chess.js twice per candidate, so this is
  // memoised on the position and the analysis result rather than recomputed
  // on every render. Hooks must run unconditionally, so this sits above the
  // early returns below even though it's unused in the unavailable/thinking
  // states.
  const annotations = useMemo(() => {
    // classifyMove compares one line against another, which is only
    // meaningful at equal depth. Stockfish emits multipv 1,2,3 within each
    // iteration, so mid-search there is always a render where lines[0] is a
    // full iteration deeper than lines[1..2] — enough for the #2 and #3
    // candidates to flicker through "Mistake" and "Blunder" before settling.
    // The fix belongs here rather than in the engine: the engine is right to
    // stream what it has, the rail is wrong to judge it. Ideas are withheld
    // with the badges so a row does not half-appear.
    if (status === 'analyzing') return [];
    if (!result || result.lines.length === 0) return [];
    const best = result.lines[0];
    return result.lines.map((line) => {
      try {
        const ctx = buildContext(node.fen, line.san, best, line);
        return {
          // Spec §7: "the top two or three by weight are rendered as prose".
          idea: describeMove(ctx, 2),
          quality: classifyMove(best, line, ctx.mover),
        };
      } catch {
        // A PV whose first move is not legal here must not take the rail down.
        return null;
      }
    });
  }, [node.fen, result, status]);

  const alternatives = activeLesson?.state.nextMove?.alternatives;

  // Only fires when the lesson's current move carries `alternatives` and
  // those alternatives' SANs match the two lines actually being compared —
  // an off-book candidate pair falls back to the heuristic in compareLines.
  const authoredContrast = useMemo(() => {
    if (!result || result.lines.length < 2) return undefined;
    return authoredContrastFor(alternatives, result.lines[0].san, result.lines[1].san);
  }, [alternatives, result]);

  function playCandidate(san: string) {
    // Shares resolveDrop's classification (via resolveSan) so a candidate
    // click and the equivalent drag-and-drop move sound identical.
    const resolved = resolveSan(node.fen, san);
    const played = playMove(san);
    if (played && resolved) {
      sounds.play(resolved.sound === 'quiet' ? 'move' : resolved.sound);
    }
  }

  // The single gate for "a checkpoint is being asked", and it sits *above*
  // the engine-status returns on purpose. The prompt and the hint ladder are
  // lesson content: they were an unconditional sibling of this rail before
  // the panel absorbed them, and with the gate below the unavailable/thinking
  // returns a dead engine made the lesson unanswerable while LessonRail's
  // reply went on naming a Hint control that was not on screen. What the
  // panel can say about the *engine* — the authored comparison — degrades to
  // absent from a null `result`; the question never does.
  if (askingCheckpoint(activeLesson)) {
    return <CheckpointPanel result={result} status={status} onRetry={retry} />;
  }

  if (status === 'unavailable') {
    return <EngineUnavailableNotice onRetry={retry} />;
  }

  if (!result || result.lines.length === 0) {
    // A finished analysis (status idle) with zero candidate moves is not
    // necessarily checkmate or stalemate — see noCandidatesMessage above,
    // which also covers every PV being filtered as illegal or a `bestmove`
    // arriving before any pv-bearing `info`. Anything else (still
    // analyzing, or no result at all yet) is the ordinary "still thinking"
    // state.
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
              '--btn-shadow': index === 0 ? 'var(--primary)' : 'var(--border)',
            } as CSSProperties
          }
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{line.san}</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {annotations[index] && (
                <QualityBadge
                  band={annotations[index]!.quality.band}
                  label={annotations[index]!.quality.label}
                />
              )}
              <span>{formatScore(line)}</span>
            </span>
          </div>
          <div style={{ marginTop: 6 }}>
            <EvalBar cp={line.cp} mate={line.mate} />
          </div>
          {annotations[index]?.idea ? (
            <div style={{ marginTop: 6, fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>
              {annotations[index]!.idea}
            </div>
          ) : null}
          <div style={{ marginTop: 4, fontWeight: 600, fontSize: 12, color: 'var(--ink-soft)' }}>
            {line.pv.slice(0, 6).join(' ')}
          </div>
        </Button>
      ))}
      {result.lines.length >= 2 && (
        <>
          <Button
            variant="secondary"
            style={{ width: '100%', marginTop: 4 }}
            onClick={() => setComparing((open) => !open)}
          >
            {comparing ? 'Hide comparison' : `Compare ${result.lines[0].san} and ${result.lines[1].san}`}
          </Button>
          {comparing && (
            <CompareDrawer
              a={result.lines[0]}
              b={result.lines[1]}
              baseFen={node.fen}
              onClose={() => setComparing(false)}
              authored={authoredContrast}
            />
          )}
        </>
      )}
    </section>
  );
}
