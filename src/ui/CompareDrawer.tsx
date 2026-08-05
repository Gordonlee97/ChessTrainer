import { useMemo } from 'react';
import type { PvLine } from '../engine/types';
import { compareLines, type LineSummary } from '../explain/compare';
import { formatScore } from './useAnalysis';
import { Button } from './Button';
import { EvalBar } from './EvalBar';
import { MiniBoard } from './MiniBoard';

function LinePanel({ summary, line }: { summary: LineSummary; line: PvLine }) {
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
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '0 0 10px' }}>
        Board shown after {summary.plies} {summary.plies === 1 ? 'ply' : 'plies'}
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

export function CompareDrawer({
  a,
  b,
  baseFen,
  onClose,
}: {
  a: PvLine;
  b: PvLine;
  baseFen: string;
  onClose: () => void;
}) {
  const comparison = useMemo(() => compareLines(baseFen, a, b), [baseFen, a, b]);

  return (
    <div role="dialog" aria-label={`Compare ${a.san} and ${b.san}`} className="compare-drawer">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>
          Compare {a.san} and {b.san}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        <LinePanel summary={comparison.a} line={a} />
        <LinePanel summary={comparison.b} line={b} />
      </div>

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
    </div>
  );
}
