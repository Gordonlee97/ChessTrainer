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

const MAX_CACHED_EVALS = 1000;

interface TreeStore {
  tree: GameTree;
  /**
   * The node the most recent `playMove` landed on, or `null` if the current
   * selection was not arrived at by playing a move.
   *
   * How a node was *reached* is not a property of the tree — the same node is
   * the same node whether you moved to it or navigated to it — but it is the
   * one thing that separates "the player just answered" from "the player is
   * looking back at an earlier position", and those two want opposite
   * behaviour from `useLessonAutoplay`. `insertMove` reuses an existing node
   * when a move is replayed from the same parent, so the arrival node's own
   * shape (its children, its move, its FEN) is identical in both cases and
   * cannot tell them apart. This records the transition instead.
   *
   * Cleared by `selectNode` and `reset`: navigating away means the last move
   * played is no longer where the player is standing.
   */
  lastPlayedId: NodeId | null;
  playMove: (san: string) => NodeId | null;
  selectNode: (nodeId: NodeId) => void;
  cacheEval: (nodeId: NodeId, evaluation: EvalResult) => void;
  reset: (startFen?: string) => void;
}

export const useTreeStore = create<TreeStore>((set, get) => ({
  tree: createTree(),
  lastPlayedId: null,

  playMove: (san) => {
    const { tree } = get();
    let inserted;
    try {
      inserted = insertMove(tree, tree.selectedId, san);
    } catch {
      return null;
    }
    set({
      tree: evict(select(inserted.tree, inserted.nodeId), MAX_CACHED_EVALS),
      lastPlayedId: inserted.nodeId,
    });
    return inserted.nodeId;
  },

  selectNode: (nodeId) => set({ tree: select(get().tree, nodeId), lastPlayedId: null }),

  cacheEval: (nodeId, evaluation) => set({ tree: setEval(get().tree, nodeId, evaluation) }),

  reset: (startFen) => set({ tree: createTree(startFen), lastPlayedId: null }),
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
