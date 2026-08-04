import { Chess, type Square } from 'chess.js';
import type { EvalResult } from '../engine/types';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type NodeId = string;

export interface TreeMove {
  san: string;
  from: Square;
  to: Square;
  promotion?: string;
}

export interface TreeNode {
  id: NodeId;
  parentId: NodeId | null;
  move: TreeMove | null;
  fen: string;
  childIds: NodeId[];
  eval?: EvalResult;
  origin: 'authored' | 'explored';
  annotationRef?: string;
  /** Monotonic counter, not a timestamp — makes eviction order deterministic in tests. */
  lastSelectedAt: number;
}

export interface GameTree {
  rootId: NodeId;
  selectedId: NodeId;
  nodes: Record<NodeId, TreeNode>;
  /** Node ids that must never be evicted (saved lines). */
  pinned: NodeId[];
  /** Incremented on every selection; the source of `lastSelectedAt`. */
  clock: number;
}

const ROOT_ID = 'root';

export function createTree(startFen: string = START_FEN): GameTree {
  return {
    rootId: ROOT_ID,
    selectedId: ROOT_ID,
    clock: 1,
    pinned: [],
    nodes: {
      [ROOT_ID]: {
        id: ROOT_ID,
        parentId: null,
        move: null,
        fen: startFen,
        childIds: [],
        origin: 'authored',
        lastSelectedAt: 1,
      },
    },
  };
}

export function insertMove(
  tree: GameTree,
  parentId: NodeId,
  san: string,
): { tree: GameTree; nodeId: NodeId } {
  const parent = tree.nodes[parentId];
  if (!parent) throw new Error(`Unknown node: ${parentId}`);

  const chess = new Chess(parent.fen);
  let move;
  try {
    move = chess.move(san);
  } catch {
    throw new Error(`Illegal move "${san}" in position ${parent.fen}`);
  }

  const nodeId = parentId === ROOT_ID ? `${ROOT_ID}/${move.san}` : `${parentId}/${move.san}`;
  const existing = tree.nodes[nodeId];
  if (existing) return { tree, nodeId };

  const node: TreeNode = {
    id: nodeId,
    parentId,
    move: {
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    },
    fen: chess.fen(),
    childIds: [],
    origin: 'explored',
    lastSelectedAt: tree.clock,
  };

  return {
    nodeId,
    tree: {
      ...tree,
      nodes: {
        ...tree.nodes,
        [parentId]: { ...parent, childIds: [...parent.childIds, nodeId] },
        [nodeId]: node,
      },
    },
  };
}

export function select(tree: GameTree, nodeId: NodeId): GameTree {
  const node = tree.nodes[nodeId];
  if (!node) throw new Error(`Unknown node: ${nodeId}`);
  const clock = tree.clock + 1;
  return {
    ...tree,
    clock,
    selectedId: nodeId,
    nodes: { ...tree.nodes, [nodeId]: { ...node, lastSelectedAt: clock } },
  };
}

export function setEval(tree: GameTree, nodeId: NodeId, evaluation: EvalResult): GameTree {
  const node = tree.nodes[nodeId];
  // Deliberately a silent no-op, unlike insertMove/select which throw on an
  // unknown id: an in-flight analysis can resolve after a reset() has
  // replaced the entire tree (a fresh createTree(), so nodeId no longer
  // exists in tree.nodes at all) landing between the request and its
  // resolution. That is an expected race, not a bug, and must not throw.
  // (evict() itself never removes nodes — it only clears cached evals — so
  // it is not a source of unknown ids here.)
  if (!node) return tree;
  return { ...tree, nodes: { ...tree.nodes, [nodeId]: { ...node, eval: evaluation } } };
}

export function pathTo(tree: GameTree, nodeId: NodeId): TreeNode[] {
  const path: TreeNode[] = [];
  let current: TreeNode | undefined = tree.nodes[nodeId];
  while (current) {
    path.unshift(current);
    current = current.parentId ? tree.nodes[current.parentId] : undefined;
  }
  return path;
}

/**
 * Clears the cached `eval` from the least-recently-selected nodes once the
 * number of nodes holding a cached eval exceeds `maxCachedEvals`. This never
 * removes a node from the tree and never rewrites `childIds` — a position
 * the user can navigate to is never discarded, only the (re-computable, and
 * comparatively bulky — PV string arrays) analysis cached on it. Nodes on
 * the selected path, pinned nodes, and authored nodes keep their eval
 * regardless of the cap: clearing the eval of the position currently on
 * screen would trigger a pointless re-analysis.
 */
export function evict(tree: GameTree, maxCachedEvals: number): GameTree {
  const protectedIds = new Set<NodeId>([
    ...tree.pinned,
    ...pathTo(tree, tree.selectedId).map((node) => node.id),
  ]);

  const allNodes = Object.values(tree.nodes);
  const cachedCount = allNodes.filter((node) => node.eval !== undefined).length;
  const overflow = cachedCount - maxCachedEvals;
  if (overflow <= 0) return tree;

  const clearable = allNodes
    .filter(
      (node) =>
        node.eval !== undefined && node.origin !== 'authored' && !protectedIds.has(node.id),
    )
    .sort((a, b) => a.lastSelectedAt - b.lastSelectedAt)
    .slice(0, overflow);

  if (clearable.length === 0) return tree;

  const nodes = { ...tree.nodes };
  for (const node of clearable) {
    const { eval: _droppedEval, ...rest } = nodes[node.id];
    nodes[node.id] = rest;
  }

  return { ...tree, nodes };
}
