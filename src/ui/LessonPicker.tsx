import { ALL_LESSONS } from '../content/lessons/index';
import { useLessonStore } from '../lesson/store';
import { Button } from './Button';

function LessonGroup({ heading, kind }: { heading: string; kind: 'opening' | 'theme' }) {
  const startLesson = useLessonStore((store) => store.startLesson);
  const lessons = ALL_LESSONS.filter((lesson) => lesson.kind === kind);

  return (
    <section>
      <h3 style={{ fontSize: 12, letterSpacing: '.08em', color: 'var(--ink-soft)', margin: '0 0 8px' }}>
        {heading}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lessons.map((lesson) => (
          <Button key={lesson.id} variant="ghost" onClick={() => startLesson(lesson.id)}>
            {lesson.title}
          </Button>
        ))}
      </div>
    </section>
  );
}

export function LessonPicker() {
  const lessonId = useLessonStore((store) => store.lessonId);
  if (lessonId) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <LessonGroup heading="OPENINGS" kind="opening" />
      <LessonGroup heading="IDEAS" kind="theme" />
    </div>
  );
}
