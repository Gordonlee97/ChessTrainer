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

  it('reuses an existing node when the same move is replayed from the same parent', () => {
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

  describe('evict', () => {
    const EVAL = { depth: 10, lines: [] };

    it('clears the eval of the least-recently-selected nodes once the cached-eval count exceeds the cap, without removing any node or touching childIds', () => {
      let tree = createTree();
      const first = insertMove(tree, tree.rootId, 'e4');
      const second = insertMove(first.tree, first.tree.rootId, 'd4');
      const third = insertMove(second.tree, second.tree.rootId, 'c4');
      tree = select(third.tree, third.nodeId);
      tree = setEval(tree, first.nodeId, EVAL);
      tree = setEval(tree, second.nodeId, EVAL);
      tree = setEval(tree, third.nodeId, EVAL);

      const evicted = evict(tree, 2);

      // No node is ever removed and the tree shape is untouched.
      expect(Object.keys(evicted.nodes).sort()).toEqual(Object.keys(tree.nodes).sort());
      expect(evicted.nodes[tree.rootId].childIds).toEqual(tree.nodes[tree.rootId].childIds);
      expect(evicted.nodes[first.nodeId].childIds).toEqual(tree.nodes[first.nodeId].childIds);

      // Oldest cached eval is cleared; the two most-recently-selected survive.
      expect(evicted.nodes[first.nodeId].eval).toBeUndefined();
      expect(evicted.nodes[second.nodeId].eval).toBeDefined();
      expect(evicted.nodes[third.nodeId].eval).toBeDefined();
      // The position itself is still there and still navigable.
      expect(evicted.nodes[first.nodeId]).toBeDefined();
      expect(evicted.nodes[first.nodeId].fen).toBe(tree.nodes[first.nodeId].fen);
    });

    it('does nothing when the cached-eval count is at or under the cap', () => {
      let tree = createTree();
      const first = insertMove(tree, tree.rootId, 'e4');
      tree = select(first.tree, first.nodeId);
      tree = setEval(tree, first.nodeId, EVAL);

      const evicted = evict(tree, 5);
      expect(evicted.nodes[first.nodeId].eval).toBeDefined();
    });

    it('keeps the eval of every node on the selected path regardless of the cap', () => {
      let tree = createTree();
      const { tree: chained, nodeId } = withMoves(['e4', 'e5']);
      tree = select(chained, nodeId);
      const path = pathTo(tree, nodeId);
      for (const node of path) tree = setEval(tree, node.id, EVAL);

      const evicted = evict(tree, 0);
      for (const node of path) {
        expect(evicted.nodes[node.id].eval).toBeDefined();
      }
    });

    it('keeps evals on authored nodes regardless of the cap', () => {
      let tree = createTree();
      const e4 = insertMove(tree, tree.rootId, 'e4');
      const d4 = insertMove(e4.tree, tree.rootId, 'd4');
      tree = d4.tree;
      tree = {
        ...tree,
        nodes: {
          ...tree.nodes,
          [e4.nodeId]: { ...tree.nodes[e4.nodeId], origin: 'authored' },
        },
      };
      tree = setEval(tree, e4.nodeId, EVAL);
      tree = setEval(tree, d4.nodeId, EVAL);
      // Keep root selected — e4 is not on the selected path.
      expect(tree.selectedId).toBe(tree.rootId);

      const evicted = evict(tree, 0);
      expect(evicted.nodes[e4.nodeId].eval).toBeDefined(); // authored node keeps its eval
      expect(evicted.nodes[d4.nodeId].eval).toBeUndefined(); // explored sibling loses it
      expect(evicted.nodes[d4.nodeId]).toBeDefined(); // but the node itself remains
    });
  });
});
