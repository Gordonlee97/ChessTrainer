import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));

vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { sounds } from './index';

describe('shared sound manager', () => {
  beforeEach(() => {
    mocks.play.mockClear();
    sounds.setMuted(false);
  });

  it('is a single instance every consumer imports', async () => {
    // A second import of the same specifier must resolve to the same module
    // instance (this is guaranteed by the ES module cache), giving every
    // consumer — Button, Board, CandidateRail — one shared mute flag instead
    // of each holding its own SoundManager.
    const again = await import('./index');
    expect(again.sounds).toBe(sounds);
  });

  it('honors a single mute toggle for every consumer', () => {
    sounds.setMuted(true);
    sounds.play('move');
    expect(mocks.play).not.toHaveBeenCalled();
  });
});
