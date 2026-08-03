import { beforeEach, describe, expect, it } from 'vitest';
import { useTreeStore } from './store';

describe('tree store', () => {
  beforeEach(() => {
    useTreeStore.getState().reset();
  });

  it('plays a legal move from the selected node and selects the result', () => {
    const nodeId = useTreeStore.getState().playMove('e4');
    expect(nodeId).not.toBeNull();
    expect(useTreeStore.getState().tree.selectedId).toBe(nodeId);
  });

  it('returns null and changes nothing for an illegal move', () => {
    const before = useTreeStore.getState().tree;
    expect(useTreeStore.getState().playMove('e5')).toBeNull();
    expect(useTreeStore.getState().tree).toBe(before);
  });

  it('caches an eval onto a node', () => {
    const nodeId = useTreeStore.getState().playMove('e4')!;
    useTreeStore.getState().cacheEval(nodeId, {
      depth: 14,
      lines: [{ san: 'e5', cp: 22, mate: null, pv: ['e5'] }],
    });
    expect(useTreeStore.getState().tree.nodes[nodeId].eval?.depth).toBe(14);
  });

  it('navigates back to an ancestor and branches from there', () => {
    const store = useTreeStore.getState();
    store.playMove('e4');
    store.playMove('e5');
    store.selectNode(useTreeStore.getState().tree.rootId);
    const d4 = useTreeStore.getState().playMove('d4');

    const root = useTreeStore.getState().tree.nodes.root;
    expect(root.childIds).toHaveLength(2);
    expect(useTreeStore.getState().tree.selectedId).toBe(d4);
  });
});
