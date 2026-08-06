import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

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
import { useTreeStore } from '../tree/store';
import { Board } from './Board';

type PieceDrag = (args: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => void;

describe('Board', () => {
  beforeEach(() => {
    useLessonStore.getState().stopLesson();
    useTreeStore.getState().reset();
    mocks.play.mockClear();
    sounds.setMuted(false);
  });

  it('plays the pickup sound when a piece is picked up', () => {
    render(<Board />);
    const onPieceDrag = chessboardOptions.current?.onPieceDrag as PieceDrag;
    onPieceDrag({ isSparePiece: false, piece: { pieceType: 'wP' }, square: 'e2' });
    expect(mocks.play).toHaveBeenCalledTimes(1);
  });

  it("honors the shared sound manager's mute flag for pickup", () => {
    sounds.setMuted(true);
    render(<Board />);
    const onPieceDrag = chessboardOptions.current?.onPieceDrag as PieceDrag;
    onPieceDrag({ isSparePiece: false, piece: { pieceType: 'wP' }, square: 'e2' });
    expect(mocks.play).not.toHaveBeenCalled();
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
});
