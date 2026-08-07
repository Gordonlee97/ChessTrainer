import { useState } from 'react';
import { useLessonStore } from '../lesson/store';
import { sounds } from '../sound';
import { useTreeStore } from '../tree/store';
import { Button } from './Button';

export function AppControls() {
  const resetTree = useTreeStore((store) => store.reset);
  const stopLesson = useLessonStore((store) => store.stopLesson);
  const [muted, setMuted] = useState(sounds.muted);

  function newGame() {
    stopLesson();
    resetTree();
  }

  function toggleSound() {
    const next = !sounds.muted;
    sounds.setMuted(next);
    setMuted(next);
  }

  return (
    <div className="app-controls">
      <Button variant="ghost" onClick={newGame}>
        New game
      </Button>
      <Button variant="ghost" onClick={toggleSound} aria-pressed={muted}>
        {muted ? 'Sound off' : 'Sound on'}
      </Button>
    </div>
  );
}
