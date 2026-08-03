import type { UciTransport } from './types';

export const ENGINE_URL = '/engine/stockfish.js';

export function createWorkerTransport(url: string = ENGINE_URL): UciTransport {
  const worker = new Worker(url);
  const listeners = new Set<(line: string) => void>();
  const errorListeners = new Set<(reason: unknown) => void>();

  worker.onmessage = (event: MessageEvent) => {
    const data = typeof event.data === 'string' ? event.data : String(event.data);
    for (const line of data.split('\n')) {
      if (line.trim().length > 0) listeners.forEach((cb) => cb(line.trim()));
    }
  };

  // `new Worker(url)` does not throw synchronously when the script 404s or
  // fails to compile — it fires this asynchronous `error` event instead.
  // Without wiring it up, a broken engine produces no lines and no
  // rejection: a permanent, silent "Thinking..." spinner.
  worker.onerror = (event: ErrorEvent) => {
    errorListeners.forEach((cb) => cb(event));
  };

  return {
    send(cmd: string) {
      worker.postMessage(cmd);
    },
    onLine(cb: (line: string) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onError(cb: (reason: unknown) => void) {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },
    terminate() {
      listeners.clear();
      errorListeners.clear();
      worker.terminate();
    },
  };
}
