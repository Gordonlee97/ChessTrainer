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

## Assumption flagged for whoever picks this up (superseded — see below)

The diagnosis above (flex main-axis content-sizing collapsing an
`aspect-ratio` + percentage-sized descendant) is offered as context, not as a
verified fix. It was not tested as a replacement design at first — see
"Follow-up: two corrected-CSS candidates" below, where it was.

## Follow-up: two corrected-CSS candidates (2026-08-09)

The coordinator asked whether a *corrected* CSS — a small fix rather than a
different design — works, before treating this as a `ResizeObserver` redesign
decision. Two candidates were tested on the same spike page, using the
forced-`#root` technique validated above (all three original measurements had
agreed, so this substitute is trusted here too). Method: `.centre` and
`.board-wrap`'s inline styles were reset and replaced with each candidate in
turn, on the live page, then measured with `getBoundingClientRect()` and
`getComputedStyle()` at two sizes:

- **wide-and-short** (`1400 x 600`, forced on `#root`) — height must bind.
- **narrow-and-tall** (`900 x 1000`, forced on `#root`) — width must bind.

### Candidate A — container query units

```css
.centre { container-type: size; min-height: 0; display: block; }
.board-wrap {
  width: min(100cqw, 100cqh);
  height: min(100cqw, 100cqh);
  margin: auto;
}
```

| Case | `main` | overflows root? | `.centre` | `.board-wrap` (rect = computed) | square? |
|---|---|---|---|---|---|
| wide-short `1400x600` | `1400 x 530` | no | `652 x 498` | `498 x 498` | **yes**, exact |
| narrow-tall `900x1000` | `900 x 930` | no | `356 x 898` | `356 x 356` | **yes**, exact |

`.board` (the grid inside the wrapper) measured 4px larger in each axis than
`.board-wrap` in both cases (`502x502` and `360x360` respectively) — this is
`.board`'s own 2px border (content-box sizing) poking past a wrapper that has
no `overflow: hidden`, present identically in both candidates and in the
original CSS; it is a pre-existing property of `.board`'s rule in the spike
page, not something either candidate introduces or fixes.

**Candidate A holds: pixel-exact square in both the height-bound and
width-bound cases, main-column width unaffected, nothing overflows.**

### Candidate B — definite block-size + aspect-ratio, in a grid

```css
.centre { display: grid; place-items: center; min-height: 0; }
.board-wrap { block-size: 100%; aspect-ratio: 1; max-inline-size: 100%; }
```

| Case | `main` | overflows root? | `.centre` | `.board-wrap` (computed) | square? |
|---|---|---|---|---|---|
| wide-short `1400x600` | `1400 x 530` | no | `652 x 498` | `502px x 498px` | **no** (4px off) |
| narrow-tall `900x1000` | `1446 x 930` | **yes — by 546px** | `902 x 898` | `902px x 898px` | **no** |

This is worse than the coordinator's predicted failure mode. In the
wide-and-short case (height correctly binding), the wrapper was still not
exactly square — `502px` computed width against `498px` computed height, a
reproducible 4px gap, not rounding noise (confirmed via `getComputedStyle`,
not just the bounding rect).

In the narrow-and-tall case it did not just produce a non-square wrapper as
predicted — it broke the surrounding grid layout. With `#root` forced to
`900px` wide, `main` rendered at `1446px` wide (546px over), and the whole
page overflowed horizontally
(`root.scrollWidth (1446ish) > root.clientWidth (900)`). Cause: `.board-wrap`
has no explicit `width`/`inline-size`; its used width is derived from
`aspect-ratio` against the definite `block-size: 100%` (which, per available
height, computes to a large number — `898px` here). Because neither
`.board-wrap` nor `.centre` nor `main` sets `min-width: 0`, that large
aspect-ratio-derived size becomes (or is treated similarly to) an automatic
minimum inline size that propagates upward through `.centre` and `main`,
inflating `main`'s own grid track past `#root`'s actual width — the same class
of "unconstrained intrinsic size leaking through an ancestor with no
containment/`min-width:0`" problem diagnosed in the original REFUTED section
above, just manifesting in the opposite direction (too big, not too small).
Candidate A does not have this failure mode because `container-type: size` on
`.centre` establishes size containment, which stops exactly this kind of
upward leak — `.board-wrap`'s size in Candidate A can never affect `.centre`'s
or `main`'s own sizing, by construction.

**Candidate B fails in both directions: mildly (4px non-square) when height
binds, and severely (546px page overflow, non-square) when width binds.**

### Recommendation

**A corrected CSS does work: Candidate A (container query units,
`container-type: size` + `width/height: min(100cqw, 100cqh)`).** It was
pixel-exact square in both the height-binding and width-binding cases, did not
disturb the surrounding grid's column widths, and nothing overflowed. This is
a small, targeted fix — swap `.centre`'s `display: flex` for
`container-type: size; display: block`, and `.board-wrap`'s
`aspect-ratio`/`max-*-size` recipe for the `min(100cqw, 100cqh)` recipe — not a
different design, and it does not need a `ResizeObserver`.

Candidate B (the `block-size: 100%` + `aspect-ratio` + `max-inline-size: 100%`
recipe) is REFUTED on its own: it is non-square in the case it should have
gotten right (wide-short) and actively overflows the page in the case it was
expected to merely get wrong shape-wise (narrow-tall). It should not be used
as specified.

Caveat: `container-type: size` requires each queried container to have a
definite size on both axes (true here, via the existing grid), and Baseline
browser support for `container-type: size` and `cqw`/`cqh` units should be
confirmed against this project's supported-browser list before Task 2 commits
to it — that check was not done here, as it is outside this spike's scope.
