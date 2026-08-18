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

describe('theme.css feedback overlay placement', () => {
  /**
   * Guards the defect found in the browser on 2026-08-13, and it is worth
   * being clear about what this can and cannot do.
   *
   * The overlay must sit on the board, and the board is a *block* child of
   * .app-centre — so its vertical `margin: auto` computes to zero and it hangs
   * from the top, while only its horizontal autos centre it. An absolutely
   * positioned overlay with `inset: 0` and `margin: auto` centres on both
   * axes, which put the mark 210.5px below the board's centre — on the second
   * rank — on a 2552x1308 viewport. The two rules looked like they matched and
   * did not.
   *
   * jsdom performs no layout, so the honest assertion (measure both boxes and
   * compare) is not available here at any price; that check lives in a browser
   * pass. This is the same deliberately weak, text-level shape as the
   * reduced-motion test above: it cannot prove the overlay lands on the board,
   * only that nobody has restored the specific declaration pair that is known
   * to move it off.
   */
  it('does not centre .move-feedback vertically inside .app-centre', () => {
    const css = readFileSync(THEME_CSS_PATH, 'utf8');

    const ruleMatch = css.match(/\n\.move-feedback \{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    const declarations = ruleMatch![1];

    const value = (property: string) =>
      declarations.match(new RegExp(`(?:^|;|\\n)\\s*${property}\\s*:\\s*([^;]+)`))?.[1].trim();

    // `inset: 0` alone stretches top AND bottom, which is what lets an auto
    // vertical margin centre the box. The bottom edge has to be released.
    const inset = value('inset');
    expect(inset).toBeDefined();
    expect(inset!.split(/\s+/)).toHaveLength(4);
    expect(inset!.split(/\s+/)[2]).toBe('auto'); // bottom

    // …and the vertical margin must not be auto, so the top pin actually
    // decides the position. A one- or two-value shorthand's first token is
    // the vertical one.
    const margin = value('margin');
    expect(margin).toBeDefined();
    expect(margin!.split(/\s+/)[0]).not.toBe('auto');
  });
});

describe('theme.css moves-table row columns', () => {
  /**
   * Guards the defect reported from the running app on 2026-08-17: a row
   * holding only a White move stretched that move across the whole row, so the
   * selected-move fill spanned the empty Black column. It happened because the
   * row was a flex line and the moves were `flex: 1 1 0` — one child takes
   * everything when it is the only one.
   *
   * Same weak, text-level shape as the tests above, and the same honest
   * caveat: jsdom performs no layout, so this cannot prove the columns render
   * as halves. It can only catch a return to the flex arrangement that caused
   * the spanning.
   */
  it('lays the row out as a grid with two equal move columns', () => {
    const css = readFileSync(THEME_CSS_PATH, 'utf8');

    const ruleMatch = css.match(/\n\.moves-table-rows li \{([^}]*)\}/);
    expect(ruleMatch).not.toBeNull();
    const declarations = ruleMatch![1];

    expect(declarations).toMatch(/display:\s*grid/);

    const columns = declarations.match(/grid-template-columns:\s*([^;]+)/)?.[1].trim();
    expect(columns).toBeDefined();
    // The two move columns must be equal and flexible; the number column ahead
    // of them may size however it likes.
    expect(columns!.endsWith('1fr 1fr')).toBe(true);
  });
});
