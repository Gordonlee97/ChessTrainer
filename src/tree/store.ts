import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { EvalResult } from '../engine/types';
import {
  createTree,
  evict,
  insertMove,
  pathTo,
  select,
  setEval,
  type GameTree,
  type NodeId,
  type TreeNode,
} from './tree';

const MAX_EXPLORED_NODES = 1000;

interface TreeStore {
  tree: GameTree;
  playMove: (san: string) => NodeId | null;
  selectNode: (nodeId: NodeId) => void;
  cacheEval: (nodeId: NodeId, evaluation: EvalResult) => void;
  reset: () => void;
}

export const useTreeStore = create<TreeStore>((set, get) => ({
  tree: createTree(),

  playMove: (san) => {
    const { tree } = get();
    let inserted;
    try {
      inserted = insertMove(tree, tree.selectedId, san);
    } catch {
      return null;
    }
    set({ tree: evict(select(inserted.tree, inserted.nodeId), MAX_EXPLORED_NODES) });
    return inserted.nodeId;
  },

  selectNode: (nodeId) => set({ tree: select(get().tree, nodeId) }),

  cacheEval: (nodeId, evaluation) => set({ tree: setEval(get().tree, nodeId, evaluation) }),

  reset: () => set({ tree: createTree() }),
}));

export function useSelectedNode(): TreeNode {
  return useTreeStore((state) => state.tree.nodes[state.tree.selectedId]);
}

export function useCurrentPath(): TreeNode[] {
  // pathTo() builds a fresh array every call. Without a shallow-equality
  // selector, useSyncExternalStore sees a new reference on every render
  // (even when the tree hasn't changed) and re-renders forever. The array's
  // elements are stable node references from tree.nodes, so shallow equality
  // correctly short-circuits once the path stops changing.
  return useTreeStore(useShallow((state) => pathTo(state.tree, state.tree.selectedId)));
}
