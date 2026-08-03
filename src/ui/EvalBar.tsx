export function EvalBar({ cp, mate }: { cp: number | null; mate: number | null }) {
  // A mate score of exactly 0 means the side to move is already mated — the
  // magnitude carries no sign, but engine.ts's White-relative normalization
  // (raw UCI mate * sideToMoveSign) still leaves the sign bit distinguishing
  // the two cases: White to move (sideToMoveSign +1) yields +0 (White is
  // mated), Black to move (sideToMoveSign -1) yields -0 (Black is mated, so
  // this favors White). Object.is is required here because `0 > 0`,
  // `-0 > 0`, and `-0 === 0` are all false/true in the same unhelpful way.
  const matesInWhiteFavor = mate !== null && (mate > 0 || Object.is(mate, -0));
  // Map centipawns onto 0-100% with a soft clamp; +/-500cp is treated as decisive.
  const advantage =
    mate !== null ? (matesInWhiteFavor ? 1 : 0) : 0.5 + Math.max(-500, Math.min(500, cp ?? 0)) / 1000;

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
