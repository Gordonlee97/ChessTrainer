import { useEffect, useId, useRef, useState } from 'react';
import { lineToPgn, pgnToSans } from '../chess/pgn';
import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { useTreeStore } from '../tree/store';
import { pathTo } from '../tree/tree';
import { sounds } from '../sound';
import { Button } from './Button';

/**
 * "My lines" is two controls and nothing else: **Save** and **Open**.
 *
 * It used to render the whole list inline, which meant the box grew without
 * bound as lines were saved and shoved everything below it down the rail —
 * the same complaint that moved the candidate rail out of the right column.
 * The list lives in a disclosure panel now, so the resting size of this
 * section is fixed no matter how many lines exist.
 *
 * Saving asks for a name. The old behaviour derived one by joining the first
 * six moves, which produced entries like "e4 e5 Nf3 Nc6 Bb5 a6" — unreadable
 * at a glance and identical between any two lines sharing an opening, which
 * is precisely the case where you need to tell them apart.
 *
 * The disclosure follows `LessonMenu`'s contract exactly rather than inventing
 * a second one: Escape closes and returns focus to the trigger, an outside
 * click closes without moving focus, and there is no `aria-modal` because Tab
 * is not trapped.
 */
/**
 * "Line 4" when three exist — but derived from the highest number already used
 * rather than from the count, which collides after a delete: save three, delete
 * the second, and a count-based default offers "Line 3" again. Names exist to
 * tell two saves apart, so handing out a duplicate by default defeats the
 * feature. The player can still type whatever they like, duplicates included.
 */
function nextDefaultName(saved: { name: string }[]): string {
  const highest = saved.reduce((best, line) => {
    const match = /^Line (\d+)$/.exec(line.name.trim());
    return match ? Math.max(best, Number(match[1])) : best;
  }, 0);
  return `Line ${Math.max(highest, saved.length) + 1}`;
}

export function SavedLines() {
  const tree = useTreeStore((store) => store.tree);
  const reset = useTreeStore((store) => store.reset);
  const playMove = useTreeStore((store) => store.playMove);
  const stopLesson = useLessonStore((store) => store.stopLesson);
  const savedLines = useProgressStore((store) => store.progress.savedLines);
  const keepLine = useProgressStore((store) => store.keepLine);
  const dropLine = useProgressStore((store) => store.dropLine);

  const [listOpen, setListOpen] = useState(false);
  /** The pending name while the save form is showing; null when it is closed. */
  const [draftName, setDraftName] = useState<string | null>(null);

  const openButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const nameId = useId();

  const path = pathTo(tree, tree.selectedId);
  const sans = path.slice(1).map((node) => node.move!.san);
  const startFen = tree.nodes[tree.rootId].fen;

  useEffect(() => {
    if (!listOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setListOpen(false);
      openButtonRef.current?.focus();
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || openButtonRef.current?.contains(target)) return;
      setListOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [listOpen]);

  function commitSave() {
    const name = (draftName ?? '').trim();
    if (!name) return; // the form's own required-ness; nothing to save under
    keepLine({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      startFen,
      pgn: lineToPgn(startFen, sans),
      createdAt: new Date().toISOString(),
    });
    setDraftName(null);
  }

  function open(line: (typeof savedLines)[number]) {
    // A lesson stays live otherwise: useActiveLesson() re-derives from
    // lessonId plus the tree, so if the opened line happens to follow the
    // running lesson's script, its checkpoints would be recorded as solved
    // without the player ever having answered them.
    stopLesson();
    reset(line.startFen);
    for (const san of pgnToSans(line.pgn, line.startFen)) playMove(san);
    setListOpen(false);
  }

  return (
    <section aria-label="My lines" className="card saved-lines">
      <h3 className="saved-lines-heading">MY LINES</h3>

      <div className="saved-lines-actions">
        <Button
          variant="ghost"
          onClick={() => setDraftName(nextDefaultName(savedLines))}
          disabled={sans.length === 0 || draftName !== null}
        >
          Save
        </Button>

        <div>
          <Button
            ref={openButtonRef}
            variant="ghost"
            aria-expanded={listOpen}
            aria-controls={panelId}
            onClick={() => setListOpen((value) => !value)}
          >
            Open
          </Button>

          {listOpen && (
            <div id={panelId} ref={panelRef} className="saved-lines-panel">
              {savedLines.length === 0 ? (
                <p className="saved-lines-empty">
                  Nothing saved yet. Play a line you want to come back to, then save it.
                </p>
              ) : (
                <ul className="saved-lines-list">
                  {savedLines.map((line) => (
                    <li key={line.id}>
                      <button
                        type="button"
                        className="saved-lines-open"
                        onClick={() => {
                          // Raw <button>s for layout, so the shared press sound
                          // the Button component plays has to be played here —
                          // opening and deleting are the two most consequential
                          // actions in this panel and were the only silent
                          // controls in the app.
                          sounds.play('buttonPress');
                          open(line);
                        }}
                      >
                        {line.name}
                      </button>
                      {/* Named for the line it removes: a panel of identical
                          "Delete" buttons tells a screen reader nothing about
                          which one it is on. */}
                      <button
                        type="button"
                        className="saved-lines-delete"
                        aria-label={`Delete ${line.name}`}
                        onClick={() => {
                          sounds.play('buttonPress');
                          dropLine(line.id);
                        }}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {draftName !== null && (
        <form
          className="saved-lines-form"
          onSubmit={(event) => {
            event.preventDefault();
            commitSave();
          }}
        >
          <label className="saved-lines-label" htmlFor={nameId}>
            Name this line
          </label>
          <input
            id={nameId}
            className="saved-lines-input"
            value={draftName}
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              // Escape cancels here rather than in the disclosure effect
              // above, and must stop there: without stopPropagation the
              // document-level listener that closes the Open panel also fired,
              // so one Escape in this input closed the form, closed the list,
              // and moved focus to the Open button.
              if (event.key === 'Escape') {
                event.stopPropagation();
                setDraftName(null);
              }
            }}
          />
          <div className="saved-lines-form-actions">
            <Button type="submit" variant="ghost" disabled={draftName.trim() === ''}>
              Save line
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraftName(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
