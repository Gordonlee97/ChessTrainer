import { useState } from 'react';
import { useLessonStore } from '../lesson/store';
import { useProgressStore } from '../progress/store';
import { sounds } from '../sound';
import { useTreeStore } from '../tree/store';
import { Button } from './Button';

export function AppControls() {
  const resetTree = useTreeStore((store) => store.reset);
  const stopLesson = useLessonStore((store) => store.stopLesson);
  const clearAll = useProgressStore((store) => store.clearAll);
  const [muted, setMuted] = useState(sounds.muted);
  const [confirmingClear, setConfirmingClear] = useState(false);

  function newGame() {
    stopLesson();
    resetTree();
  }

  function toggleSound() {
    const next = !sounds.muted;
    sounds.setMuted(next);
    setMuted(next);
  }

  function clearProgress() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    clearAll();
    setConfirmingClear(false);
  }

  return (
    <div className="app-controls">
      <Button variant="ghost" onClick={newGame}>
        New game
      </Button>
      <Button variant="ghost" onClick={toggleSound} aria-pressed={muted}>
        {muted ? 'Sound off' : 'Sound on'}
      </Button>
      <Button variant="ghost" onClick={clearProgress}>
        {confirmingClear ? 'Really clear?' : 'Clear progress'}
      </Button>
    </div>
  );
}
