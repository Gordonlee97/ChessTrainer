import { useProgressStore } from '../progress/store';
import { Button } from './Button';

/**
 * Lives in the header rather than in a rail. Both previous render sites —
 * LessonPicker and SavedLines — are hidden while a lesson runs, so a player
 * whose progress failed to load could not dismiss the notice: starting a
 * lesson simply took it away and bringing it back required leaving.
 */
export function ProgressNotice() {
  const recovered = useProgressStore((store) => store.recovered);
  const saveFailed = useProgressStore((store) => store.saveFailed);
  const dismissNotice = useProgressStore((store) => store.dismissNotice);

  if (!recovered && !saveFailed) return null;

  return (
    <p role="status" className="progress-notice">
      {recovered
        ? 'Your saved progress could not be read, so it is starting fresh.'
        : 'Progress is not being saved — your browser storage is full or unavailable.'}
      <Button variant="ghost" onClick={dismissNotice} aria-label="Dismiss this notice">
        Dismiss
      </Button>
    </p>
  );
}
