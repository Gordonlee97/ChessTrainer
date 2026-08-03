import { useTreeStore } from '../tree/store';
import { EvalBar } from './EvalBar';
import { formatScore, useAnalysis } from './useAnalysis';

export function CandidateRail() {
  const { result, status } = useAnalysis();
  const playMove = useTreeStore((state) => state.playMove);

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
        Engine unavailable — lesson content still works, but live evaluation is off.
      </div>
    );
  }

  if (!result || result.lines.length === 0) {
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
        <button
          key={line.san}
          type="button"
          onClick={() => playMove(line.san)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            font: 'inherit',
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 8,
            padding: '10px 12px',
            cursor: 'pointer',
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: `2px solid ${index === 0 ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            boxShadow: `0 3px 0 ${index === 0 ? 'var(--primary)' : 'var(--border)'}`,
          }}
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
        </button>
      ))}
    </section>
  );
}
