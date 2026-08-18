import { useLessonStore } from './lesson/store';
import { AppControls } from './ui/AppControls';
import { Board } from './ui/Board';
import { CandidateRail } from './ui/CandidateRail';
import { GlossaryMenu } from './ui/GlossaryMenu';
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
        <GlossaryMenu />
        <ProgressNotice />
        <span className="app-header-spacer" />
        <AppControls />
      </header>

      <div className="app-main">
        {/* Where the candidate rail sits depends on the mode, because the
            component is two different things. In the explorer it is the engine's
            candidate moves, and it belongs in the LEFT column under "My lines":
            in the right column it sat beneath the move list, which pushed it
            further down the page with every move played, and the left column
            had unused space that does not grow.

            During a lesson the same component hands its column to the
            checkpoint panel — the quiz. That belongs opposite the explanation,
            not stacked underneath it, which is what the design spec's §3 layout
            table asks for and what leaving it on the left produced: every word
            of the lesson crammed into one narrow column with the other empty.

            Exactly one instance is mounted either way. It moves parents rather
            than duplicating, and the engine behind it is a module-level
            singleton (`sharedEngine.ts`), so remounting re-subscribes rather
            than spawning a second worker. */}
        <div className="app-rail app-rail-left">
          {inLesson ? (
            <LessonRail />
          ) : (
            <>
              <SavedLines />
              <CandidateRail />
            </>
          )}
        </div>

        <div className="app-centre">
          {/* MoveFeedback is a SIBLING of .board-wrap, not a child — the
              placement its CSS comment describes and the reason Board itself
              stays free of it. It drifted inside during an unrelated rewrite of
              this block; the mark still landed correctly only because
              .board-wrap is unpositioned, so adding `position` or `overflow` to
              it later would have moved or clipped the mark for no visible
              reason. */}
          <div className="board-wrap">
            <Board />
          </div>
          <MoveFeedback />
        </div>

        {/* The move list stays first, so nothing above it can change height and
            shift it — the checkpoint panel below it grows as hints are
            revealed. */}
        <div className="app-rail app-rail-right">
          <MovesTable />
          {inLesson && <CandidateRail />}
        </div>

        <div className="compare-portal" id="compare-portal" />
      </div>
    </main>
  );
}
