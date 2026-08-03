import { Board } from './ui/Board';
import { Breadcrumb } from './ui/Breadcrumb';

export function App() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 18px' }}>ChessTrainer</h1>
      <Breadcrumb />
      <div style={{ maxWidth: 480 }}>
        <Board />
      </div>
    </main>
  );
}
