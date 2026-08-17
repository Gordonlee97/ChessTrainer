import { describe, expect, it } from 'vitest';
import { createTree, insertMove, select, type GameTree } from './tree';
import { buildMovesTable } from './movesTable';

/**
 * Replays SANs through the real tree functions rather than constructing
 * node objects by hand, so ids, FENs and `lastSelectedAt` are whatever the
 * production code actually produces.
 */
function play(tree: GameTree, ...sans: string[]): GameTree {
  let next = tree;
  for (const san of sans) {
    const inserted = insertMove(next, next.selectedId, san);
    next = select(inserted.tree, inserted.nodeId);
  }
  return next;
}

describe('buildMovesTable', () => {
  it('pairs a line into numbered rows', () => {
    const tree = play(createTree(), 'e4', 'e5', 'Nf3');
    const { rows } = buildMovesTable(tree);

    expect(rows).toHaveLength(2);
    expect(rows[0].number).toBe(1);
    expect(rows[0].white?.san).toBe('e4');
    expect(rows[0].black?.san).toBe('e5');
    expect(rows[1].number).toBe(2);
    expect(rows[1].white?.san).toBe('Nf3');
    expect(rows[1].black).toBeNull();
  });

  it('lists the continuation past the selected node, not just the path to it', () => {
    let tree = play(createTree(), 'e4', 'e5', 'Nf3');
    // Walk up two parents from the tip to the node after 'e4', rather than
    // writing an id literal — the id format is the tree's business.
    const afterE5 = tree.nodes[tree.selectedId].parentId!;
    const afterE4 = tree.nodes[afterE5].parentId!;
    tree = select(tree, afterE4);

    const { rows, lineIds, selectedIndex } = buildMovesTable(tree);

    // Stepping back hides nothing: this is what makes the arrows worth having.
    expect(rows[1].white?.san).toBe('Nf3');
    expect(lineIds).toHaveLength(4); // root + three moves
    expect(selectedIndex).toBe(1);
  });

  /**
   * The rule that keeps the table linear without storing anything: where a
   * node has several children the continuation follows the most recently
   * selected one. `select` maintains `lastSelectedAt`, and `playMove` selects
   * what it inserts, so playing a different move from an earlier position
   * moves the table onto the new line.
   */
  it('follows the most recently selected child at a branch', () => {
    let tree = play(createTree(), 'e4', 'e5');
    tree = select(tree, 'root');
    tree = play(tree, 'd4'); // a second child of root, now the most recent

    // Documents the intent, but note it does NOT discriminate: 'd4' is the
    // selected node here, so it sits on the path and appears whether or not
    // the continuation rule works. Confirmed by mutation — the reversed
    // comparison passes this line and fails the one below.
    expect(buildMovesTable(tree).rows[0].white?.san).toBe('d4');

    // Re-selecting the older branch makes it the most recent again. Both
    // steps matter: visiting 'e4' bumps it, and stepping back to the branch
    // point is what forces the continuation rule to choose. Asserting while
    // 'e4' is still selected would pass because it sits on the path, whether
    // or not the rule works at all.
    tree = select(tree, 'root/e4');
    tree = select(tree, 'root');
    expect(buildMovesTable(tree).rows[0].white?.san).toBe('e4');
  });

  /**
   * Numbering and colour come from the position, never from index parity.
   * This FEN is copied from `src/content/lessons/theme-development-and-tempo.ts`
   * (segment 2), where it is already validated by `validateLessonChess` — it is
   * Black to move on move 2, so a naive counter starting at 1 with White first
   * gets both the number and the column wrong.
   */
  it('starts on Black when the position does, and numbers from the FEN', () => {
    const blackToMove = 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2';
    const tree = play(createTree(blackToMove), 'Nc6');
    const { rows } = buildMovesTable(tree);

    expect(rows).toHaveLength(1);
    expect(rows[0].number).toBe(2);
    expect(rows[0].white).toBeNull();
    expect(rows[0].black?.san).toBe('Nc6');
  });

  it('gives the root a row-free entry in lineIds so "first" can reach it', () => {
    const tree = play(createTree(), 'e4');
    const { lineIds, selectedIndex } = buildMovesTable(tree);

    expect(lineIds[0]).toBe(tree.rootId);
    expect(selectedIndex).toBe(1);
  });

  it('handles a tree with no moves at all', () => {
    const { rows, lineIds, selectedIndex } = buildMovesTable(createTree());

    expect(rows).toEqual([]);
    expect(lineIds).toEqual(['root']);
    expect(selectedIndex).toBe(0);
  });
});
