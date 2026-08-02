import type { UciTransport } from './types';

export const ENGINE_URL = '/engine/stockfish.js';

export function createWorkerTransport(url: string = ENGINE_URL): UciTransport {
  const worker = new Worker(url);
  const listeners = new Set<(line: string) => void>();

  worker.onmessage = (event: MessageEvent) => {
    const data = typeof event.data === 'string' ? event.data : String(event.data);
    for (const line of data.split('\n')) {
      if (line.trim().length > 0) listeners.forEach((cb) => cb(line.trim()));
    }
  };

  return {
    send(cmd: string) {
      worker.postMessage(cmd);
    },
    onLine(cb: (line: string) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    terminate() {
      listeners.clear();
      worker.terminate();
    },
  };
}
