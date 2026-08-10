---
updated: 2026-08-09
status: current
tags: [chesstrainer, spike, css]
---

# Spike results: can the board be capped by available height?

## Claim under test

A `.board-wrap` with `aspect-ratio: 1; max-block-size: 100%; max-inline-size: 100%`,
sitting inside `.centre { display: flex; min-height: 0; }`, itself inside a grid
row of definite height — does this cap the board by whichever of width/height is
tighter, so it shrinks correctly when the viewport gets short?

Page tested: `docs/superpowers/plans/shell-sizing-spike.html`, served over
`http://localhost` (see "Tooling note" below for why `file://` wasn't used).

## Tooling note — real window resize did not work in this environment

`resize_window` (Chrome DevTools Protocol window-bounds call) reported success on
every call but the browser window stayed at its OS-maximized size
(`outerWidth`/`outerHeight` = `2560x1392`, matching `screen.availWidth/Height`) for
both `1400x900` and `1400x600` requests, and even an `800x500` request. Verified
with a freshly created tab too — same result. This looks like an environment
limitation (window is pinned maximized), not something fixable from the page or
from this tool.

Two measurements were taken instead:

1. **The real, uncontrolled viewport** (`2552x1308` — effectively a large "tall"
   case, comfortably bigger than the requested `1400x900`), with no modification
   to the page at all. This is a genuine browser measurement, just not at the
   requested window size.
2. **A substitute for the two target sizes**: `#root`'s own box (the CSS grid
   root that starts at `100dvh`) was forced to explicit `width`/`height` via
   inline style (`position: fixed; width: 1400px; height: 900px`, then
   `height: 600px`), leaving `html`/`body` at their real size. This isolates
   exactly the mechanism under test — a definite-height ancestor containing
   `main` → `.centre` → `.board-wrap` — without depending on real window
   dimensions. It is **not** a literal window resize, so the "page scrolls"
   check (`document.documentElement.scrollHeight > innerHeight`) is not
   meaningful under it (the real `html`/`body` stay at screen size regardless);
   `root.scrollHeight > root.clientHeight` was checked instead, as the
   equivalent local check.

All three measurements agree, which is the important part: the outcome does not
depend on viewport size.

## Raw numbers

| Case | Viewport / forced size | `.board` (id `b`) | `.board-wrap` | square? | overflow |
|---|---|---|---|---|---|
| Real, uncontrolled (large/"tall") | `2552 x 1308` | `8 x 8` px | `4 x 8` px | board: yes (coincidentally); wrap: **no** | page: no |
| Forced "tall" | `1400 x 900` | `8 x 8` px | `4 x 8` px | board: yes; wrap: no | root: no |
| Forced "short" | `1400 x 600` | `8 x 8` px | `4 x 8` px | board: yes; wrap: no | root: no |

`.centre` itself, at the real viewport, correctly received `1228 x 1206` px from
the grid (the intended available space). `.board-wrap` inside it did not use any
of that space.

## What actually happened

The board did not fill the available space at all, in any of the three
measurements — not "shrinks incorrectly," but stuck at an ~8px sliver regardless
of whether ~1200px or ~600px were available. `max-inline-size` / `max-block-size`
are **upper bounds only**; they cap a size that is otherwise driven larger by
something else. Nothing in this recipe supplies that drive:

- `.centre` is `display: flex`. `.board-wrap` is a flex item with no
  `flex-grow`, `flex-basis`, or explicit `width`/`height`, so its main-axis
  (inline/width) size resolves via content-based (`auto`/max-content) sizing.
- `.board`'s `width: 100%; height: 100%` are percentages against that
  auto-sizing ancestor, so they don't contribute a positive intrinsic size at
  that stage — percentages resolve against an indefinite size as effectively
  `auto`/near-zero here.
- The 64 empty `<i>` grid cells (`aspect-ratio: 1/1`, no other sizing) also
  contribute ~0 to intrinsic sizing, since `aspect-ratio` only transfers a size
  when the *other* axis is already definite, which it isn't during max-content
  measurement.
- The result: `.board-wrap`'s content-based width collapses to ~4px (from
  `.board`'s own 2px border on each side), `aspect-ratio: 1` cannot inflate that
  because the transfer needs a definite opposite-axis size first, and
  `max-inline-size`/`max-block-size: 100%` never get a chance to bind, because
  the box they would be capping never grows large in the first place.

This is a structural, not a size-dependent, failure — it is why the tall and
short measurements are identical.

## Verdict: REFUTED

The board did not stay square in the sense that matters (it did not fill and
shrink to available space; the wrapper itself wasn't even square), it did not
respond to a smaller container, and — separately from those two — it collapsed
to a near-invisible sliver on every tested size, including the generously large
"tall" one. This is worse than "doesn't shrink correctly": the mechanism as
specified in the brief does not size the board at all.

Per the brief: **stopping here, reporting to the controller.** Not improvising a
fix. The documented fallback — a measured `ResizeObserver` sizing the board
explicitly — is a different design and needs a human decision before Task 2
proceeds.

## Assumption flagged for whoever picks this up

The diagnosis above (flex main-axis content-sizing collapsing an
`aspect-ratio` + percentage-sized descendant) is offered as context, not as a
verified fix. It was not tested as a replacement design — e.g., whether
changing `.centre` to `display: grid` with `place-items: stretch`, or giving
`.board-wrap` an explicit driving size (`width: 100%` plus the two `max-*-size`
caps, or `flex: 1 1 0` with `min-width: 0`), would resolve it without a
`ResizeObserver`. That is a real, cheap-to-test alternative worth trying before
committing to `ResizeObserver`, but it is a different claim than the one this
spike was scoped to measure, so it was not tried here.
