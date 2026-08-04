import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const THEME_CSS_PATH = join(__dirname, 'theme.css');

describe('theme.css reduced-motion feedback', () => {
  // There is no CSS test harness here, and jsdom does not evaluate @media
  // blocks at all, so a getComputedStyle-based assertion would be vacuous —
  // it would pass whether or not the reduced-motion rule actually declares
  // anything. This is a deliberately weak, text-level check instead: it
  // can't confirm the rule visually works, but it does catch a future edit
  // that guts the prefers-reduced-motion block back down to disabling
  // transform/box-shadow with no replacement feedback at all.
  it('declares a feedback property other than transform or box-shadow on .btn:active inside the reduced-motion block', () => {
    const css = readFileSync(THEME_CSS_PATH, 'utf8');

    // theme.css formats nested rule bodies with a 2-space indent, so a
    // closing brace with no leading whitespace uniquely marks the end of
    // the top-level @media block (as opposed to a nested rule's own `}`).
    const mediaMatch = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
    expect(mediaMatch).not.toBeNull();
    const mediaBlock = mediaMatch![1];

    const activeMatch = mediaBlock.match(/\.btn:not\(:disabled\):active\s*\{([^}]*)\}/);
    expect(activeMatch).not.toBeNull();
    const declarations = activeMatch![1];

    const declaredProperties = [...declarations.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    const feedbackProperties = declaredProperties.filter(
      (prop) => prop !== 'transform' && prop !== 'box-shadow',
    );

    expect(feedbackProperties.length).toBeGreaterThan(0);
  });
});
