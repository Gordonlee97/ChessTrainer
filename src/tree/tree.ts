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
 * Drops the least recently selected explored nodes once the explored count
 * exceeds `maxExplored`. Authored nodes, pinned nodes, the selected node's
 * ancestry, and any node with surviving children are all protected — eviction
 * removes leaves only, so no reachable position is ever orphaned.
 */
export function evict(tree: GameTree, maxExplored: number): GameTree {
  const protectedIds = new Set<NodeId>([
    ...tree.pinned,
    ...pathTo(tree, tree.selectedId).map((node) => node.id),
  ]);

  const nodes = { ...tree.nodes };

  while (true) {
    const explored = Object.values(nodes).filter((node) => node.origin === 'explored');
    if (explored.length <= maxExplored) break;

    const removable = explored
      .filter((node) => !protectedIds.has(node.id) && node.childIds.length === 0)
      .sort((a, b) => a.lastSelectedAt - b.lastSelectedAt);

    const victim = removable[0];
    if (!victim) break; // nothing left that is safe to remove

    const parent = victim.parentId ? nodes[victim.parentId] : undefined;
    if (parent) {
      nodes[parent.id] = {
        ...parent,
        childIds: parent.childIds.filter((id) => id !== victim.id),
      };
    }
    delete nodes[victim.id];
  }

  return { ...tree, nodes };
}
