import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// react-chessboard renders a full drag-and-drop board that jsdom cannot
// usefully exercise. Capture the `options` object Board hands it instead, so
// tests can invoke the callbacks directly, the same way CandidateRail.test.tsx
// swaps out useAnalysis rather than driving a real engine.
const chessboardOptions = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('react-chessboard', () => ({
  Chessboard: (props: { options: Record<string, unknown> }) => {
    chessboardOptions.current = props.options;
    return null;
  },
}));

import { useLessonStore } from '../lesson/store';
import { sounds } from '../sound';
import { installAudioStub } from '../test/audioStub';

// The real shared sound manager, not a mock: two tests below assert that the
// mute toggle actually silences things, which a mocked module cannot show.
// `playSpy` records what the component asked for; `audio` records whether any
// sound actually came out, which is the only way muted and unmuted differ.
const audio = installAudioStub();
const playSpy = vi.spyOn(sounds, 'play');

import { useTreeStore } from '../tree/store';
import { Board } from './Board';

type PieceDrag = (args: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => void;

describe('Board', () => {
  beforeEach(() => {
    useLessonStore.getState().stopLesson();
    useTreeStore.getState().reset();
    playSpy.mockClear();
    audio.reset();
    sounds.setMuted(false);
    sounds.setMuted(false);
  });

  it('plays the pickup sound when a piece is picked up', () => {
    render(<Board />);
    const onPieceDrag = chessboardOptions.current?.onPieceDrag as PieceDrag;
    onPieceDrag({ isSparePiece: false, piece: { pieceType: 'wP' }, square: 'e2' });
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("honors the shared sound manager's mute flag for pickup", () => {
    sounds.setMuted(true);
    render(<Board />);
    const onPieceDrag = chessboardOptions.current?.onPieceDrag as PieceDrag;
    onPieceDrag({ isSparePiece: false, piece: { pieceType: 'wP' }, square: 'e2' });
    // The board still asks for the sound — muting is the manager's job, not
    // the board's — so the observable is that nothing came out of it.
    expect(playSpy).toHaveBeenCalledWith('pickup');
    expect(audio.gains).toBe(0);
  });

  it('defaults to the white orientation when no lesson is running', () => {
    render(<Board />);
    expect(chessboardOptions.current?.boardOrientation).toBe('white');
  });

  it('flips to the black orientation for a Black lesson', () => {
    useLessonStore.getState().startLesson('black-vs-e4');
    render(<Board />);
    expect(chessboardOptions.current?.boardOrientation).toBe('black');
  });

  it('orients from the segment when it overrides the lesson', () => {
    useLessonStore.getState().startLesson('theme-development-and-tempo');
    useLessonStore.getState().nextSegment();
    render(<Board />);
    expect(chessboardOptions.current?.boardOrientation).toBe('black');
  });

  it('falls back to the lesson side when the segment does not override', () => {
    useLessonStore.getState().startLesson('italian-game');
    render(<Board />);
    expect(chessboardOptions.current?.boardOrientation).toBe('white');
  });
});
