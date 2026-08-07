import { lineToPgn, pgnToSans } from '../chess/pgn';
import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';
import { Button } from './Button';

export function SavedLines() {
  const tree = useTreeStore((store) => store.tree);
  const reset = useTreeStore((store) => store.reset);
  const playMove = useTreeStore((store) => store.playMove);
  const stopLesson = useLessonStore((store) => store.stopLesson);
  const savedLines = useProgressStore((store) => store.progress.savedLines);
  const keepLine = useProgressStore((store) => store.keepLine);
  const dropLine = useProgressStore((store) => store.dropLine);
  const saveFailed = useProgressStore((store) => store.saveFailed);

  const path = pathTo(tree, tree.selectedId);
  const sans = path.slice(1).map((node) => node.move!.san);
  const startFen = tree.nodes[tree.rootId].fen;

  function save() {
    const name = sans.slice(0, 6).join(' ') || 'Line';
    keepLine({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      startFen,
      pgn: lineToPgn(startFen, sans),
      createdAt: new Date().toISOString(),
    });
  }

  function open(line: (typeof savedLines)[number]) {
    // A lesson stays live otherwise: useActiveLesson() re-derives from
    // lessonId plus the tree, so if the opened line happens to follow the
    // running lesson's script, its checkpoints would be recorded as solved
    // without the player ever having answered them.
    stopLesson();
    reset(line.startFen);
    for (const san of pgnToSans(line.pgn, line.startFen)) playMove(san);
  }

  return (
    <section aria-label="My lines" className="saved-lines">
      <h3 className="saved-lines-heading">MY LINES</h3>

      {saveFailed && (
        <p role="status" className="progress-notice">
          This line was not saved — your browser storage is full or unavailable.
        </p>
      )}

      {sans.length > 0 && (
        <Button variant="ghost" onClick={save}>
          Save this line
        </Button>
      )}

      {savedLines.length === 0 ? (
        <p className="saved-lines-empty">
          Nothing saved yet. Play a line you want to come back to, then save it.
        </p>
      ) : (
        <ul className="saved-lines-list">
          {savedLines.map((line) => (
            <li key={line.id}>
              <span className="saved-lines-name">{line.name}</span>
              <Button variant="ghost" onClick={() => open(line)}>
                Open
              </Button>
              <Button variant="ghost" onClick={() => dropLine(line.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
