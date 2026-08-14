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

  /**
   * `lastPlayedId` exists so a consumer can tell "the player moved here" from
   * "the player navigated here" — the two are indistinguishable from the node
   * itself, because `insertMove` reuses a node when the same move is replayed
   * from the same parent. `useLessonAutoplay` depends on it; see
   * `Decisions/Arrival By Move Versus Navigation`.
   *
   * The clearing half is the fragile one: any future action that moves the
   * selection without going through `playMove` has to clear it too, or a
   * lesson will autoplay at a position the player only walked back to.
   */
  it('records the node a move landed on, and clears it on navigation', () => {
    expect(useTreeStore.getState().lastPlayedId).toBeNull(); // fresh tree

    const e4 = useTreeStore.getState().playMove('e4');
    expect(useTreeStore.getState().lastPlayedId).toBe(e4);

    useTreeStore.getState().selectNode(useTreeStore.getState().tree.rootId);
    expect(useTreeStore.getState().lastPlayedId).toBeNull();

    // Replaying reuses the node (same id as the first time) — and must still
    // count as an arrival by move, which is the case the tip-of-line guard
    // this replaced got wrong.
    expect(useTreeStore.getState().playMove('e4')).toBe(e4);
    expect(useTreeStore.getState().lastPlayedId).toBe(e4);

    useTreeStore.getState().reset();
    expect(useTreeStore.getState().lastPlayedId).toBeNull();
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
