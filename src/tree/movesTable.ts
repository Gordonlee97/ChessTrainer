import { moveNumber, sideToMove } from '../chess/side';
import { pathTo, type GameTree, type NodeId, type TreeNode } from './tree';

export interface MovesCell {
  nodeId: NodeId;
  san: string;
}

export interface MovesRow {
  /** Fullmove number, from the FEN — never from index parity. */
  number: number;
  /** null when the displayed line begins with Black to move. */
  white: MovesCell | null;
  /** null when the line ends on a White move. */
  black: MovesCell | null;
}

export interface MovesTableModel {
  rows: MovesRow[];
  /** Root first, then every move on the displayed line, in order. */
  lineIds: NodeId[];
  /** Index into `lineIds` of the selected node. Always >= 0. */
  selectedIndex: number;
}

/**
 * Walks forward from `node`, taking the child with the greatest
 * `lastSelectedAt` at every branch, until a node with no children.
 *
 * This is what keeps the table linear without storing which line the player
 * is on: `select` bumps `lastSelectedAt`, and `playMove` selects whatever it
 * inserts, so the most recently visited child is always the one the player
 * last cared about. The consequence — the line you leave disappears from the
 * table — is the existing behaviour of the whole UI and is recorded in
 * `Known Issues.md`, not a regression introduced here.
 */
function continuationFrom(tree: GameTree, node: TreeNode): TreeNode[] {
  const forward: TreeNode[] = [];
  let current = node;
  while (current.childIds.length > 0) {
    let best = tree.nodes[current.childIds[0]];
    for (const childId of current.childIds) {
      const child = tree.nodes[childId];
      if (child.lastSelectedAt > best.lastSelectedAt) best = child;
    }
    forward.push(best);
    current = best;
  }
  return forward;
}

/**
 * The whole displayed line — the path to the selected node *and* the
 * continuation past it — as numbered rows plus the ordered ids the
 * navigation controls step through.
 *
 * Deriving both from one walk is deliberate: first/previous/next/last and the
 * rendered rows must never disagree about what the line is, and the way that
 * goes wrong in this repo is two correct-looking definitions of the same
 * thing drifting apart (`Lessons.md` §5).
 */
export function buildMovesTable(tree: GameTree): MovesTableModel {
  const selected = tree.nodes[tree.selectedId];
  const behind = pathTo(tree, tree.selectedId);
  const line = [...behind, ...continuationFrom(tree, selected)];

  const rows: MovesRow[] = [];
  // `line[0]` is the root, which is a position rather than a move; every
  // other entry is the move that produced it, so the position it was played
  // from is the entry before it.
  for (let index = 1; index < line.length; index += 1) {
    const node = line[index];
    const from = line[index - 1].fen;
    const cell: MovesCell = { nodeId: node.id, san: node.move!.san };

    if (sideToMove(from) === 'white') {
      rows.push({ number: moveNumber(from), white: cell, black: null });
    } else {
      const open = rows[rows.length - 1];
      // A Black move continues the open row unless the line began mid-move,
      // in which case its White half never existed.
      if (open && open.black === null) open.black = cell;
      else rows.push({ number: moveNumber(from), white: null, black: cell });
    }
  }

  const lineIds = line.map((node) => node.id);
  return { rows, lineIds, selectedIndex: lineIds.indexOf(tree.selectedId) };
}
