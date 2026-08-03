import { SoundManager } from './SoundManager';

/**
 * One SoundManager for the whole app. Button, Board, and CandidateRail all
 * import this instead of constructing their own — a single mute toggle (a
 * spec requirement, UI arriving in Plan 2) can only silence every sound at
 * once if every consumer shares one cache, one failed-load set, and one mute
 * flag.
 */
export const sounds = new SoundManager();
