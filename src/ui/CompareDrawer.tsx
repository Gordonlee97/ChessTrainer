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
      <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '6px 0 10px' }}>
        {formatScore(line)} after {line.pv.length} plies
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
        {/*
         * Not an <h2>: the dialog's aria-label already conveys "Compare {a.san}
         * and {b.san}" as its accessible name. A heading-role element with the
         * same text would collide with the per-line <h3> below on any query
         * for the SAN alone (e.g. name matching /e4/ matches both "Compare e4
         * and d4" and the "e4" panel heading), and would double-announce the
         * same text to a screen reader right after the dialog name.
         */}
        <div style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          Compare {a.san} and {b.san}
        </div>
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
