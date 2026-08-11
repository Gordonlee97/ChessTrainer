import { useLessonStore } from './lesson/store';
import { AppControls } from './ui/AppControls';
import { Board } from './ui/Board';
import { Breadcrumb } from './ui/Breadcrumb';
import { CandidateRail } from './ui/CandidateRail';
import { LessonPicker } from './ui/LessonPicker';
import { LessonRail } from './ui/LessonRail';
import { ProgressNotice } from './ui/ProgressNotice';
import { SavedLines } from './ui/SavedLines';
import { useLessonAutoplay } from './ui/useLessonAutoplay';

export function App() {
  useLessonAutoplay();
  const lessonId = useLessonStore((store) => store.lessonId);
  const inLesson = lessonId !== null;

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1 className="app-wordmark">ChessTrainer</h1>
        <ProgressNotice />
        <span className="app-header-spacer" />
        <AppControls />
      </header>

      <div className="app-crumb">
        <Breadcrumb />
      </div>

      <div className="app-main">
        <div className="app-rail app-rail-left">
          {inLesson ? (
            <LessonRail />
          ) : (
            <>
              <LessonPicker />
              <SavedLines />
            </>
          )}
        </div>

        <div className="app-centre">
          <div className="board-wrap">
            <Board />
          </div>
        </div>

        <div className="app-rail app-rail-right">
          <CandidateRail />
        </div>

        <div className="compare-portal" id="compare-portal" />
      </div>
    </main>
  );
}
