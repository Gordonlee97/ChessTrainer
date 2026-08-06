import { Board } from './ui/Board';
import { Breadcrumb } from './ui/Breadcrumb';
import { CandidateRail } from './ui/CandidateRail';
import { LessonPicker } from './ui/LessonPicker';
import { LessonRail } from './ui/LessonRail';

export function App() {
  return (
    <main style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 18px' }}>ChessTrainer</h1>
      <Breadcrumb />
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 1 260px', minWidth: 220 }}>
          <LessonPicker />
          <LessonRail />
        </div>
        <div style={{ flex: '1 1 420px', maxWidth: 520 }}>
          <Board />
        </div>
        <div style={{ flex: '1 1 260px', minWidth: 240 }}>
          <CandidateRail />
        </div>
      </div>
    </main>
  );
}
