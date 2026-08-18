import { useMemo } from 'react';
import { buildMovesTable } from '../tree/movesTable';
import { Button } from './Button';
import { useTreeStore } from '../tree/store';

/**
 * The move list and its four controls.
 *
 * Everything shown here is derived from the tree on each render by
 * `buildMovesTable`; this component stores nothing about the line. The
 * controls and the rows therefore cannot disagree about what the line is,
 * which is the failure this repo keeps meeting when one idea gets two
 * definitions (`Lessons.md` §5).
 *
 * `useMemo` is keyed on the tree object, which the store replaces on every
 * change — `buildMovesTable` allocates fresh arrays, so subscribing to its
 * result directly would hand `useSyncExternalStore` a new reference on every
 * render and loop forever. `useCurrentPath` in `tree/store.ts` solves the
 * same problem with `useShallow`; this shape is cheaper here because the
 * whole model is rebuilt as one value.
 */
export function MovesTable() {
  const tree = useTreeStore((state) => state.tree);
  const selectNode = useTreeStore((state) => state.selectNode);
  const { rows, lineIds, selectedIndex } = useMemo(() => buildMovesTable(tree), [tree]);

  const go = (index: number) => selectNode(lineIds[index]);
  const atStart = selectedIndex <= 0;
  const atEnd = selectedIndex >= lineIds.length - 1;

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (!atStart) go(selectedIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (!atEnd) go(selectedIndex + 1);
    }
  }

  return (
    <section className="moves-table" aria-label="Moves" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="moves-table-controls">
        <Button
          type="button"
          variant="ghost"
          onClick={() => go(0)}
          disabled={atStart}
        >
          <span aria-hidden="true">⏮</span>
          <span className="visually-hidden">First move</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => go(selectedIndex - 1)}
          disabled={atStart}
        >
          <span aria-hidden="true">◀</span>
          <span className="visually-hidden">Previous move</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => go(selectedIndex + 1)}
          disabled={atEnd}
        >
          <span aria-hidden="true">▶</span>
          <span className="visually-hidden">Next move</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => go(lineIds.length - 1)}
          disabled={atEnd}
        >
          <span aria-hidden="true">⏭</span>
          <span className="visually-hidden">Last move</span>
        </Button>
      </div>

      <ol className="moves-table-rows">
        {rows.map((row) => (
          <li key={`${row.number}-${row.white?.nodeId ?? row.black?.nodeId}`}>
            <span className="moves-table-number">{row.number}.</span>
            {row.white ? (
              <button
                type="button"
                className="moves-table-move"
                onClick={() => selectNode(row.white!.nodeId)}
                aria-current={row.white.nodeId === tree.selectedId ? 'true' : undefined}
              >
                {row.white.san}
              </button>
            ) : (
              <span className="moves-table-move moves-table-elision" aria-hidden="true">
                …
              </span>
            )}
            {row.black && (
              <button
                type="button"
                className="moves-table-move"
                onClick={() => selectNode(row.black!.nodeId)}
                aria-current={row.black.nodeId === tree.selectedId ? 'true' : undefined}
              >
                {row.black.san}
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
