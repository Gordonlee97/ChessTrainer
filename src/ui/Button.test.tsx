import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { sounds } from '../sound';
import { installAudioStub } from '../test/audioStub';

// The real shared sound manager, not a mock: two tests below assert that the
// mute toggle actually silences things, which a mocked module cannot show.
// `playSpy` records what the component asked for; `audio` records whether any
// sound actually came out, which is the only way muted and unmuted differ.
const audio = installAudioStub();
const playSpy = vi.spyOn(sounds, 'play');

describe('Button', () => {
  beforeEach(() => {
    playSpy.mockClear();
    audio.reset();
    sounds.setMuted(false);
  });

  it('plays a click sound when pressed', async () => {
    render(<Button>Compare lines</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Compare lines' }));
    expect(playSpy).toHaveBeenCalledTimes(1);
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

  it('merges a caller-supplied className with the shared btn class instead of overwriting it', () => {
    render(<Button className="candidate-row">Compare lines</Button>);
    const button = screen.getByRole('button', { name: 'Compare lines' });
    expect(button).toHaveClass('btn');
    expect(button).toHaveClass('candidate-row');
  });

  it('does not play the click sound when sound={false}, but still fires onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button sound={false} onClick={onClick}>
        Candidate move
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Candidate move' }));
    expect(playSpy).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
