import { useCurrentPath, useTreeStore } from '../tree/store';

export function Breadcrumb() {
  const path = useCurrentPath();
  const selectNode = useTreeStore((state) => state.selectNode);
  const selectedId = useTreeStore((state) => state.tree.selectedId);

  return (
    <nav
      aria-label="Move history"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}
    >
      {path.map((node, index) => (
        <span key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {index > 0 && <span style={{ color: 'var(--ink-soft)' }}>›</span>}
          <button
            type="button"
            onClick={() => selectNode(node.id)}
            aria-current={node.id === selectedId ? 'true' : undefined}
            style={{
              font: 'inherit',
              fontWeight: node.id === selectedId ? 800 : 600,
              fontSize: 13,
              padding: '4px 10px',
              borderRadius: 999,
              cursor: 'pointer',
              border: '2px solid var(--border)',
              background: node.id === selectedId ? 'var(--border)' : 'transparent',
              color: 'var(--ink)',
            }}
          >
            {node.move?.san ?? 'start'}
          </button>
        </span>
      ))}
    </nav>
  );
}
