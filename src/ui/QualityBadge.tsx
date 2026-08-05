import type { QualityBand } from '../explain/quality';

export function QualityBadge({ band, label }: { band: QualityBand; label: string }) {
  return (
    <span
      data-band={band}
      className="quality-badge"
      style={{
        fontSize: 11,
        fontWeight: 800,
        padding: '2px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
