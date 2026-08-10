import { checkpointIds } from '../content/load';
import { ALL_LESSONS } from '../content/lessons/index';
import { useLessonStore } from '../lesson/store';
import { lessonProgress } from '../progress/progress';
import { useProgressStore } from '../progress/store';
import type { Progress } from '../progress/schema';
import { Button } from './Button';

function LessonGroup({
  heading,
  kind,
  progress,
}: {
  heading: string;
  kind: 'opening' | 'theme';
  progress: Progress;
}) {
  const startLesson = useLessonStore((store) => store.startLesson);
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
            <Button variant="ghost" onClick={() => startLesson(lesson.id)}>
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

export function LessonPicker() {
  const lessonId = useLessonStore((store) => store.lessonId);
  const progress = useProgressStore((store) => store.progress);
  if (lessonId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LessonGroup heading="OPENINGS" kind="opening" progress={progress} />
      <LessonGroup heading="IDEAS" kind="theme" progress={progress} />
    </div>
  );
}
