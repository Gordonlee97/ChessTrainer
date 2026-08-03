import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ play: vi.fn(), rate: vi.fn() }));

vi.mock('howler', () => ({
  Howl: vi.fn(() => ({ play: mocks.play, rate: mocks.rate })),
}));

import { Button } from './Button';

describe('Button', () => {
  beforeEach(() => {
    mocks.play.mockClear();
  });

  it('plays a click sound when pressed', async () => {
    render(<Button>Compare lines</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Compare lines' }));
    expect(mocks.play).toHaveBeenCalledTimes(1);
  });

  it('renders its label and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Compare lines</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Compare lines' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Compare lines
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Compare lines' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('exposes the variant as a data attribute for styling', () => {
    render(<Button variant="secondary">Hint</Button>);
    expect(screen.getByRole('button', { name: 'Hint' })).toHaveAttribute(
      'data-variant',
      'secondary',
    );
  });

  it('does not play the click sound when sound={false}, but still fires onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button sound={false} onClick={onClick}>
        Candidate move
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Candidate move' }));
    expect(mocks.play).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
