import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSharedEngine, hasSharedEngineFailed, resetSharedEngineForTests, restartSharedEngine } from './sharedEngine';

// Each createWorkerTransport() call gets its own listener sets, but all
// fatal errors can be triggered through the single shared `fail` helper,
// which dispatches to whichever transport is currently installed.
const fake = vi.hoisted(() => {
  let currentErrorListeners: Set<(reason: unknown) => void> = new Set();
  return {
    fail: (reason: unknown) => currentErrorListeners.forEach((cb) => cb(reason)),
    setCurrentErrorListeners: (listeners: Set<(reason: unknown) => void>) => {
      currentErrorListeners = listeners;
    },
  };
});

vi.mock('../engine/stockfishWorker', () => ({
  createWorkerTransport: () => {
    const listeners = new Set<(line: string) => void>();
    const errorListeners = new Set<(reason: unknown) => void>();
    fake.setCurrentErrorListeners(errorListeners);
    return {
      send: () => {},
      onLine: (cb: (line: string) => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      onError: (cb: (reason: unknown) => void) => {
        errorListeners.add(cb);
        return () => errorListeners.delete(cb);
      },
      terminate: () => {
        listeners.clear();
        errorListeners.clear();
      },
    };
  },
}));

describe('sharedEngine (Fix 4)', () => {
  beforeEach(() => {
    resetSharedEngineForTests();
  });

  it('returns the same Engine instance across repeated calls', () => {
    const a = getSharedEngine();
    const b = getSharedEngine();
    expect(a).toBe(b);
  });

  it('restartSharedEngine disposes the old instance and installs a new one', () => {
    const original = getSharedEngine();
    const disposeSpy = vi.spyOn(original, 'dispose');

    const restarted = restartSharedEngine();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(restarted).not.toBe(original);
    expect(getSharedEngine()).toBe(restarted);
  });

  it('tracks whether the shared engine has failed, and clears that on restart', () => {
    getSharedEngine();
    expect(hasSharedEngineFailed()).toBe(false);

    fake.fail(new Error('worker died'));
    expect(hasSharedEngineFailed()).toBe(true);

    restartSharedEngine();
    expect(hasSharedEngineFailed()).toBe(false);
  });

  it('resetSharedEngineForTests does not dispose the current instance, but forces a fresh one on next access', () => {
    const original = getSharedEngine();
    const disposeSpy = vi.spyOn(original, 'dispose');

    resetSharedEngineForTests();
    const next = getSharedEngine();

    expect(disposeSpy).not.toHaveBeenCalled();
    expect(next).not.toBe(original);
  });
});
