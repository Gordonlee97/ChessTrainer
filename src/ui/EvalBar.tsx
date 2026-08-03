export function EvalBar({ cp, mate }: { cp: number | null; mate: number | null }) {
  // Map centipawns onto 0-100% with a soft clamp; +/-500cp is treated as decisive.
  const advantage = mate !== null ? (mate > 0 ? 1 : 0) : 0.5 + Math.max(-500, Math.min(500, cp ?? 0)) / 1000;

  return (
    <div
      role="presentation"
      style={{ height: 10, borderRadius: 5, background: 'var(--border)', overflow: 'hidden' }}
    >
      <div
        style={{
          width: `${advantage * 100}%`,
          height: '100%',
          background: 'linear-gradient(90deg, var(--good), var(--primary))',
        }}
      />
    </div>
  );
}
