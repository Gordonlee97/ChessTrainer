import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

// Clicking a Button plays the shared buttonPress sound; without this mock,

import { GLOSSARY, GLOSSARY_TIERS } from '../content/glossary';
import { GlossaryMenu } from './GlossaryMenu';

describe('GlossaryMenu', () => {
  it('keeps the glossary closed until asked for', () => {
    render(<GlossaryMenu />);
    expect(screen.getByRole('button', { name: /glossary/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Zugzwang')).not.toBeInTheDocument();
  });

  it('shows every term once opened', async () => {
    const user = userEvent.setup();
    render(<GlossaryMenu />);
    await user.click(screen.getByRole('button', { name: /glossary/i }));

    for (const entry of GLOSSARY) {
      expect(screen.getByText(entry.term)).toBeInTheDocument();
    }
  });

  it('groups terms under their tier, simplest first', async () => {
    const user = userEvent.setup();
    render(<GlossaryMenu />);
    await user.click(screen.getByRole('button', { name: /glossary/i }));

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings).toEqual(GLOSSARY_TIERS.map((tier) => tier.heading));
  });

  it('pairs each term with its definition as a description list', async () => {
    const user = userEvent.setup();
    render(<GlossaryMenu />);
    await user.click(screen.getByRole('button', { name: /glossary/i }));

    // The definition must be the term's own <dd>, not merely present somewhere
    // in the panel — otherwise a layout that lost the pairing would pass.
    const ply = screen.getByText('Ply');
    expect(ply.tagName).toBe('DT');
    expect(ply.nextElementSibling?.tagName).toBe('DD');
    expect(ply.nextElementSibling).toHaveTextContent(/one move by one player/i);
  });

  it('closes on Escape and puts focus back on the trigger', async () => {
    const user = userEvent.setup();
    render(<GlossaryMenu />);
    const trigger = screen.getByRole('button', { name: /glossary/i });

    await user.click(trigger);
    expect(screen.getByText('Zugzwang')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Zugzwang')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    const user = userEvent.setup();
    render(
      <>
        <GlossaryMenu />
        <button type="button">elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: /glossary/i }));
    expect(screen.getByText('Zugzwang')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByText('Zugzwang')).not.toBeInTheDocument();
  });
});

describe('glossary content', () => {
  it('has no duplicate terms', () => {
    const terms = GLOSSARY.map((entry) => entry.term.toLowerCase());
    expect(new Set(terms).size).toBe(terms.length);
  });

  it('gives every term a definition that says something', () => {
    for (const entry of GLOSSARY) {
      expect(entry.definition.length).toBeGreaterThan(30);
      expect(entry.definition.trim()).toMatch(/\.$/); // a sentence, not a fragment
    }
  });

  it('files every term under a tier the panel renders', () => {
    const tiers = new Set(GLOSSARY_TIERS.map((tier) => tier.id));
    for (const entry of GLOSSARY) {
      expect(tiers.has(entry.tier)).toBe(true);
    }
  });

  /**
   * The app puts these words on screen, so a player meeting them has to be
   * able to look them up. This is the guard that keeps the glossary honest as
   * the UI's vocabulary changes.
   */
  it('defines the terms the app itself displays', () => {
    const terms = GLOSSARY.map((entry) => entry.term.toLowerCase());
    for (const shown of ['ply', 'evaluation', 'line (or variation)']) {
      expect(terms).toContain(shown);
    }
  });
});
