import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QualityBadge } from './QualityBadge';

describe('QualityBadge', () => {
  it('renders the label', () => {
    render(<QualityBadge band="blunder" label="Blunder" />);
    expect(screen.getByText('Blunder')).toBeInTheDocument();
  });

  it('exposes the band as a data attribute so CSS can colour it', () => {
    render(<QualityBadge band="inaccuracy" label="Inaccuracy" />);
    expect(screen.getByText('Inaccuracy')).toHaveAttribute('data-band', 'inaccuracy');
  });

  it('does not signal quality by colour alone', () => {
    // Accessibility: the band must be readable as text, not just hue.
    render(<QualityBadge band="mistake" label="Mistake" />);
    expect(screen.getByText('Mistake')).toHaveTextContent(/mistake/i);
  });
});
