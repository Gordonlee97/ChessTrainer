import { describe, expect, it } from 'vitest';
import { createTree, evict, insertMove, pathTo, select, setEval } from './tree';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function withMoves(sans: string[]) {
  let tree = createTree();
  let nodeId = tree.rootId;
  for (const san of sans) {
    const result = insertMove(tree, nodeId, san);
    tree = result.tree;
    nodeId = result.nodeId;
  }
  return { tree, nodeId };
}

describe('game tree', () => {
  it('starts with a root node holding the initial position', () => {
    const tree = createTree();
    expect(tree.nodes[tree.rootId].fen).toBe(START);
    expect(tree.nodes[tree.rootId].move).toBeNull();
    expect(tree.selectedId).toBe(tree.rootId);
  });

  it('inserts a move as a child and advances the position', () => {
    const { tree, nodeId } = withMoves(['e4']);
    const node = tree.nodes[nodeId];
    expect(node.move?.san).toBe('e4');
    expect(node.move?.from).toBe('e2');
    expect(node.move?.to).toBe('e4');
    expect(node.fen).toContain('b KQkq');
    expect(tree.nodes[tree.rootId].childIds).toContain(nodeId);
  });

  it('reuses an existing node instead of duplicating a transposition', () => {
    const first = withMoves(['e4']);
    const second = insertMove(first.tree, first.tree.rootId, 'e4');
    expect(second.nodeId).toBe(first.nodeId);
    expect(second.tree.nodes[second.tree.rootId].childIds).toHaveLength(1);
  });

  it('throws on an illegal move', () => {
    const tree = createTree();
    expect(() => insertMove(tree, tree.rootId, 'e5')).toThrow(/illegal/i);
  });

  it('supports sibling branches from the same parent', () => {
    let { tree } = withMoves([]);
    const a = insertMove(tree, tree.rootId, 'e4');
    const b = insertMove(a.tree, a.tree.rootId, 'd4');
    expect(b.tree.nodes[b.tree.rootId].childIds).toHaveLength(2);
    expect(a.nodeId).not.toBe(b.nodeId);
  });

  it('returns the path from root to a node', () => {
    const { tree, nodeId } = withMoves(['e4', 'e5', 'Nf3']);
    expect(pathTo(tree, nodeId).map((n) => n.move?.san ?? 'start')).toEqual([
      'start',
      'e4',
      'e5',
      'Nf3',
    ]);
  });

  it('caches an eval on a node', () => {
    const { tree, nodeId } = withMoves(['e4']);
    const updated = setEval(tree, nodeId, {
      depth: 12,
      lines: [{ san: 'e5', cp: 20, mate: null, pv: ['e5'] }],
    });
    expect(updated.nodes[nodeId].eval?.depth).toBe(12);
    expect(tree.nodes[nodeId].eval).toBeUndefined(); // original untouched
  });

  it('records selection order when selecting', () => {
    const { tree, nodeId } = withMoves(['e4', 'e5']);
    const updated = select(tree, nodeId);
    expect(updated.selectedId).toBe(nodeId);
    expect(updated.nodes[nodeId].lastSelectedAt).toBeGreaterThan(0);
  });

  it('evicts the least recently selected explored leaves over the cap', () => {
    let tree = createTree();
    const first = insertMove(tree, tree.rootId, 'e4');
    const second = insertMove(first.tree, first.tree.rootId, 'd4');
    const third = insertMove(second.tree, second.tree.rootId, 'c4');
    tree = select(third.tree, third.nodeId);

    const evicted = evict(tree, 2);
    expect(Object.keys(evicted.nodes)).toHaveLength(3); // root + 2 survivors
    expect(evicted.nodes[third.nodeId]).toBeDefined(); // currently selected survives
    expect(evicted.nodes[first.nodeId]).toBeUndefined(); // oldest goes
  });

  it('never evicts authored nodes, pinned nodes, or the selected path', () => {
    let tree = createTree();
    const a = insertMove(tree, tree.rootId, 'e4');
    tree = a.tree;
    tree.nodes[a.nodeId] = { ...tree.nodes[a.nodeId], origin: 'authored' };
    const b = insertMove(tree, a.nodeId, 'e5');
    tree = select(b.tree, b.nodeId);

    const evicted = evict(tree, 0);
    expect(evicted.nodes[a.nodeId]).toBeDefined();
    expect(evicted.nodes[b.nodeId]).toBeDefined();
  });

  it('cascades eviction through an unprotected explored chain down to the cap', () => {
    let tree = createTree();
    const { tree: chained } = withMoves(['e4', 'e5', 'Nf3']);
    tree = select(chained, tree.rootId); // select root — whole chain is unprotected

    const evicted = evict(tree, 0);
    expect(Object.keys(evicted.nodes)).toEqual([tree.rootId]); // only root survives
    expect(evicted.nodes[tree.rootId].childIds).toHaveLength(0); // root correctly re-parented as childless
  });
});
