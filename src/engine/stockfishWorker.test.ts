import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkerTransport } from './stockfishWorker';

/** A minimal stand-in for the DOM Worker API, controllable from tests. */
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: string[] = [];
  terminated = false;

  constructor(public readonly url: string) {}

  postMessage(msg: string): void {
    this.posted.push(msg);
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('createWorkerTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces the worker error event through onError (Fix 2)', () => {
    // `new Worker(url)` never throws synchronously when the script 404s or
    // the wasm fails to instantiate — it fires this `error` event instead.
    // Without wiring it through, that failure was invisible: no lines, no
    // rejection, permanent "Thinking...".
    let created: FakeWorker | undefined;
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        constructor(url: string) {
          super(url);
          created = this;
        }
      },
    );

    const transport = createWorkerTransport('/fake-engine.js');
    const onError = vi.fn();
    transport.onError(onError);

    const errorEvent = new ErrorEvent('error', { message: 'engine script failed to load' });
    created?.onerror?.(errorEvent);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(errorEvent);
  });

  it('clears error listeners on terminate', () => {
    let created: FakeWorker | undefined;
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        constructor(url: string) {
          super(url);
          created = this;
        }
      },
    );

    const transport = createWorkerTransport('/fake-engine.js');
    const onError = vi.fn();
    transport.onError(onError);
    transport.terminate();

    created?.onerror?.(new ErrorEvent('error'));

    expect(onError).not.toHaveBeenCalled();
    expect(created?.terminated).toBe(true);
  });
});
