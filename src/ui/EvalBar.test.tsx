import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EvalBar } from './EvalBar';

/** The fill div's inline width%, which encodes the rendered advantage. */
function fillWidth(container: HTMLElement): string {
  const fill = container.querySelector('[role="presentation"] > div') as HTMLElement;
  return fill.style.width;
}

describe('EvalBar', () => {
  it('renders a full White advantage for a positive mate score', () => {
    const { container } = render(<EvalBar cp={null} mate={3} />);
    expect(fillWidth(container)).toBe('100%');
  });

  it('renders a full Black advantage for a negative mate score', () => {
    const { container } = render(<EvalBar cp={null} mate={-3} />);
    expect(fillWidth(container)).toBe('0%');
  });

  it('renders a full Black advantage when White is the mated side (mate 0, normalized from White to move)', () => {
    // Engine normalization: sideToMoveSign is +1 when White is to move, so a
    // raw UCI "mate 0" (side to move is already mated) comes through as
    // plain +0 here — White is mated, so this must favor Black fully.
    const { container } = render(<EvalBar cp={null} mate={0} />);
    expect(fillWidth(container)).toBe('0%');
  });

  it('renders a full White advantage when Black is the mated side (mate 0, normalized from Black to move)', () => {
    // Engine normalization: sideToMoveSign is -1 when Black is to move, so
    // `0 * -1` is negative zero — Black is mated, so this must favor White
    // fully, even though the magnitude is still zero.
    const { container } = render(<EvalBar cp={null} mate={-0} />);
    expect(fillWidth(container)).toBe('100%');
  });
});
