import type { CSSProperties } from 'react';
import { Button } from './Button';

/**
 * The engine-is-dead notice and its retry, shared by `CandidateRail` and
 * `CheckpointPanel`.
 *
 * It lives here rather than inline in the rail because a checkpoint replaces
 * the entire right-hand rail: with the notice owned by the rail's ordinary
 * branch, the only control that can bring the engine back vanished for as
 * long as the question was on screen.
 */
export function EngineUnavailableNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card" role="status" style={{ fontSize: 13 }}>
      <p style={{ margin: '0 0 8px' }}>
        Engine unavailable — lesson content still works, but live evaluation is off.
      </p>
      <Button
        type="button"
        variant="ghost"
        onClick={onRetry}
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
