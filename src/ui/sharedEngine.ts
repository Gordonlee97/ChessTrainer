import { Engine } from '../engine/engine';
import { createWorkerTransport } from '../engine/stockfishWorker';

// Every useAnalysis() call site shares this single, lazily-created Engine
// (and its one Stockfish worker) rather than spawning its own. Plan 2 adds a
// second consumer of the hook (the compare drawer); two independently
// constructed engines would each run their own 7MB worker, competing for one
// core. Under React StrictMode, a per-hook-effect Engine was also created and
// torn down twice on mount.
let instance: Engine | null = null;

// Set once the shared engine reports a fatal transport error. Engine.onError
// callbacks are only notified if registered *before* the error fires, so a
// hook that mounts afterward (e.g. a second consumer arriving late) would
// otherwise never learn the engine is dead. Read via hasSharedEngineFailed().
let failed = false;

function create(): Engine {
  const engine = new Engine(createWorkerTransport());
  engine.onError(() => {
    failed = true;
  });
  return engine;
}

/** Returns the shared Engine, creating it lazily on first access. */
export function getSharedEngine(): Engine {
  if (!instance) {
    instance = create();
    failed = false;
  }
  return instance;
}

/** True once the shared engine has reported a fatal transport error. */
export function hasSharedEngineFailed(): boolean {
  return failed;
}

/**
 * Disposes the current shared engine (if any) and replaces it with a fresh
 * one. Used by the "Retry" action once the engine has been reported
 * unavailable — the worker otherwise lives for the lifetime of the page; no
 * single consumer's unmount should ever dispose it.
 */
export function restartSharedEngine(): Engine {
  instance?.dispose();
  instance = create();
  failed = false;
  return instance;
}

/**
 * Test-only: drops the shared instance (without disposing it — tests own
 * their fake transport's lifecycle) so the next getSharedEngine() call
 * constructs a fresh one, e.g. against a freshly reset fake transport.
 */
export function resetSharedEngineForTests(): void {
  instance = null;
  failed = false;
}
