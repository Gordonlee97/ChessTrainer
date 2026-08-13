import { useEffect, useId, useRef, useState } from 'react';
import { checkpointIds } from '../content/load';
import { ALL_LESSONS } from '../content/lessons/index';
import { useLessonStore } from '../lesson/store';
import { lessonProgress } from '../progress/progress';
import { useProgressStore } from '../progress/store';
import type { Progress } from '../progress/schema';
import { Button } from './Button';

function LessonMenuGroup({
  heading,
  kind,
  progress,
  onChoose,
}: {
  heading: string;
  kind: 'opening' | 'theme';
  progress: Progress;
  onChoose: (id: string) => void;
}) {
  const lessons = ALL_LESSONS.filter((lesson) => lesson.kind === kind);

  return (
    <section>
      <h3 style={{ fontSize: 12, letterSpacing: '.08em', color: 'var(--ink-soft)', margin: '0 0 8px' }}>
        {heading}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lessons.map((lesson) => (
          // The summary sits outside the button on purpose: it is what the
          // field was added for — the one place a player can see what a
          // lesson is about before starting it — but folding it into the
          // control would make the button's accessible name a paragraph.
          <div key={lesson.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Button variant="ghost" onClick={() => onChoose(lesson.id)}>
              {lesson.title}
            </Button>
            <p style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--ink-soft)', margin: 0 }}>
              {lesson.summary}
            </p>
            {(() => {
              const { solved, total, completed } = lessonProgress(
                progress,
                lesson.id,
                checkpointIds(lesson),
              );
              if (completed) return <p className="lesson-progress">Done</p>;
              if (solved === 0) return null;
              return (
                <p className="lesson-progress">
                  {solved} of {total} checkpoints
                </p>
              );
            })()}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The header disclosure that replaced `LessonPicker`'s inline placement in
 * the left rail. It is a disclosure, not a menu widget: no arrow-key roving
 * between lessons, and no `aria-modal` — the panel does not trap Tab, so
 * claiming modality would be a lie the project already has a rule against.
 * Its keyboard contract is exactly Escape-to-close and click-outside-to-close,
 * both returning focus to the trigger button.
 */
export function LessonMenu() {
  const [open, setOpen] = useState(false);
  const startLesson = useLessonStore((store) => store.startLesson);
  const progress = useProgressStore((store) => store.progress);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    // Deliberately does not return focus to the button: unlike Escape, an
    // outside click has already placed focus (or the user's attention)
    // somewhere the player chose, and yanking it back to the trigger would
    // fight that click rather than simply dismissing the panel.
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  function choose(id: string) {
    startLesson(id);
    setOpen(false);
  }

  return (
    <div className="lesson-menu">
      <Button
        ref={buttonRef}
        variant="ghost"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Lessons
      </Button>
      {open && (
        <div id={panelId} ref={panelRef} className="lesson-menu-panel">
          <LessonMenuGroup heading="OPENINGS" kind="opening" progress={progress} onChoose={choose} />
          <LessonMenuGroup heading="IDEAS" kind="theme" progress={progress} onChoose={choose} />
        </div>
      )}
    </div>
  );
}
