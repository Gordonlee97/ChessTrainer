import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { moveNumber, sideToMove } from '../chess/side';
import type { PvLine } from '../engine/types';
import { compareLines, type AuthoredContrastPair, type LineSummary } from '../explain/compare';
import type { ContrastRow } from '../explain/contrastRows';
import { formatScore } from './useAnalysis';
import { Button } from './Button';
import { EvalBar } from './EvalBar';
import { MiniBoard } from './MiniBoard';

/**
 * "1.e4 e5 2.Nf3 Nc6" — numbered the way a scoresheet is, starting from
 * whatever `baseFen` actually holds (a line can begin mid-game, and with
 * Black to move), never from array-index parity. Reuses the same
 * FEN-derived `sideToMove`/`moveNumber` `movesTable.ts` numbers the tree
 * with, so a comparison started from a Black-to-move position numbers its
 * first move `N...` instead of misreading it as White's.
 */
function formatMoveList(baseFen: string, moves: string[]): string {
  let side = sideToMove(baseFen);
  let number = moveNumber(baseFen);
  const parts: string[] = [];

  moves.forEach((san, index) => {
    if (side === 'white') {
      parts.push(`${number}.${san}`);
    } else if (index === 0) {
      parts.push(`${number}...${san}`);
    } else {
      parts.push(san);
    }
    if (side === 'black') number += 1;
    side = side === 'white' ? 'black' : 'white';
  });

  return parts.join(' ');
}

function LinePanel({
  summary,
  line,
  baseFen,
}: {
  summary: LineSummary;
  line: PvLine;
  baseFen: string;
}) {
  const movesLater = Math.ceil(summary.plies / 2);

  return (
    <section
      style={{
        flex: '1 1 240px',
        border: '2px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 12,
        background: 'var(--surface)',
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{summary.san}</h3>
      {summary.moves.length > 0 && (
        <p
          style={{
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'var(--ink-soft)',
            margin: '0 0 8px',
          }}
        >
          {formatMoveList(baseFen, summary.moves)}
        </p>
      )}
      <MiniBoard fen={summary.endFen} label={`Position after the ${summary.san} line`} />
      <div style={{ marginTop: 8 }}>
        <EvalBar cp={line.cp} mate={line.mate} />
      </div>
      {/*
        Two separate claims, deliberately not one sentence. The score is the
        engine's verdict on the whole principal variation; the board above is
        a snapshot taken part-way through it. Running them together ("+0.31
        after 8 plies") reads as a score for the pictured position, which it
        is not — and the ply count is the number the walk actually played,
        not the length of the PV.
      */}
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '6px 0 2px' }}>
        Engine score for the whole line: {formatScore(line)}
      </p>
      {/*
        Counted in moves rather than plies. "Ply" is exactly right and exactly
        the wrong word here: this panel exists to explain a choice to a
        beginner, and it is the one place the term appeared with nothing to
        explain it. The Glossary defines it for anyone who meets it elsewhere.

        Rounded up, because the walk can stop on an odd ply — a short principal
        variation or an illegal continuation — and "2½ moves" is worse than
        half a move of imprecision in a caption under a picture.
      */}
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 10px' }}>
        {movesLater === 0
          ? // The walk played nothing — an empty principal variation, or a first
            // move that would not apply — so `endFen` is the position the player
            // is already looking at. "0 moves later" states a distance that is
            // not one and invites the reader to hunt for a difference.
            'Board shown at the current position'
          : `Board shown ${movesLater} ${movesLater === 1 ? 'move' : 'moves'} later`}
      </p>
      {summary.pros.length > 0 && (
        <>
          <h4 style={{ fontSize: 12, margin: '0 0 4px' }}>Pros</h4>
          <ul style={{ fontSize: 12, margin: '0 0 8px', paddingLeft: 18 }}>
            {summary.pros.map((pro) => (
              <li key={pro}>{pro}</li>
            ))}
          </ul>
        </>
      )}
      {summary.cons.length > 0 && (
        <>
          <h4 style={{ fontSize: 12, margin: '0 0 4px' }}>Cons</h4>
          <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>
            {summary.cons.map((con) => (
              <li key={con}>{con}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * The five fixed rows, shared between the two lines rather than repeated
 * inside each panel — a row already holds both sides' text (see
 * `ContrastRow`), so rendering it per-panel would say the same thing twice.
 *
 * A differing row is never marked by colour alone: `data-differs` carries it
 * as an attribute for tests and assistive tech that ignore colour, the "≠"
 * glyph carries it as visible text, and `.contrast-row--differs` carries it
 * as weight — three independent channels, matching the project rule that
 * colour can be one signal but never the only one.
 */
function ContrastRows({ rows }: { rows: ContrastRow[] }) {
  return (
    // A plain <div>, not a <section> — a <section> with an accessible name
    // picks up an implicit ARIA role of "region", which would collide with
    // the drawer's own single `role="region"` and break `getByRole('region')`
    // for anything that queries it (including this component's own tests).
    // The <h4> below gives it context without claiming a landmark.
    <div style={{ marginTop: 14 }}>
      <h4
        style={{
          fontSize: 11,
          margin: '0 0 6px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
        }}
      >
        How these lines compare
      </h4>
      <div className="contrast-rows">
        {rows.map((row) => (
          <div
            key={row.id}
            className={row.equal ? 'contrast-row' : 'contrast-row contrast-row--differs'}
            data-differs={row.equal ? 'false' : 'true'}
          >
            <span className="contrast-row-label">
              {row.label}
              {!row.equal && (
                <span className="contrast-row-mark" aria-hidden="true">
                  {' '}
                  ≠
                </span>
              )}
            </span>
            <span className="contrast-row-value">{row.aText}</span>
            <span className="contrast-row-value">{row.bText}</span>
            {!row.equal && (
              <span className="visually-hidden"> — differs between the two lines</span>
            )}
            <p className="contrast-row-gloss">{row.gloss}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompareDrawer({
  a,
  b,
  baseFen,
  onClose,
  authored,
}: {
  a: PvLine;
  b: PvLine;
  baseFen: string;
  onClose: () => void;
  authored?: AuthoredContrastPair;
}) {
  const comparison = useMemo(
    () => compareLines(baseFen, a, b, undefined, authored),
    [baseFen, a, b, authored],
  );

  const rootRef = useRef<HTMLDivElement>(null);

  // Focus capture/restore lives here, not at the call sites, so both
  // CandidateRail's and CheckpointPanel's drawers get it for free. Captured
  // on mount (before focus moves into the drawer below) and restored on
  // unmount only if the previously-focused element is still attached — it
  // can legitimately be gone, e.g. the position changed underneath and the
  // rail that held it re-rendered.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    rootRef.current?.focus();
    return () => {
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const portalTarget = document.getElementById('compare-portal') ?? document.body;

  return createPortal(
    <div
      ref={rootRef}
      role="region"
      aria-label={`Compare ${a.san} and ${b.san}`}
      tabIndex={-1}
      className="compare-drawer"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>
          Compare {a.san} and {b.san}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <LinePanel summary={comparison.a} line={a} baseFen={baseFen} />
        <LinePanel summary={comparison.b} line={b} baseFen={baseFen} />
      </div>

      <ContrastRows rows={comparison.rows} />

      <p
        data-testid="verdict"
        style={{
          fontSize: 13,
          marginTop: 12,
          padding: '10px 12px',
          borderLeft: '4px solid var(--primary)',
          background: 'rgba(255, 122, 69, 0.08)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <strong>Verdict:</strong> {comparison.verdict}
      </p>
    </div>,
    portalTarget,
  );
}
