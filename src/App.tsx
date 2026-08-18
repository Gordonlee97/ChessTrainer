import { useLessonStore } from './lesson/store';
import { AppControls } from './ui/AppControls';
import { Board } from './ui/Board';
import { CandidateRail } from './ui/CandidateRail';
import { LessonMenu } from './ui/LessonMenu';
import { LessonRail } from './ui/LessonRail';
import { MoveFeedback } from './ui/MoveFeedback';
import { MovesTable } from './ui/MovesTable';
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
        <LessonMenu />
        <ProgressNotice />
        <span className="app-header-spacer" />
        <AppControls />
      </header>

      <div className="app-main">
        <div className="app-rail app-rail-left">
          {inLesson ? <LessonRail /> : <SavedLines />}
        </div>

        <div className="app-centre">
          <div className="board-wrap">
            <Board />
          </div>
          <MoveFeedback />
        </div>

        {/* The moves table sits ABOVE the candidates, which is the reverse of
            the design spec's §3 table. The candidate rail's height changes
            constantly while a search runs — depth ticks, explanation text
            rewraps, the Compare button appears — and anything below it slides
            up and down with every one of those. Anchoring the move list to the
            top of the rail is what makes it hold still while a move is played,
            which is how every board site behaves and what the spec was really
            after. */}
        <div className="app-rail app-rail-right">
          <MovesTable />
          <CandidateRail />
        </div>

        <div className="compare-portal" id="compare-portal" />
      </div>
    </main>
  );
}
