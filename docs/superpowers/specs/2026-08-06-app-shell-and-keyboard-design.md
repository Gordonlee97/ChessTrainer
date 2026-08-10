# App Shell and Keyboard Navigation — Design

**Status:** approved 2026-08-06
**Supersedes:** nothing. Extends `2026-08-01-chesstrainer-design.md`, which
remains authoritative for everything not restated here.

## 1. What this is

`src/App.tsx` has never had a design pass. It is an inline-styled flex shell
that has accumulated five components — `AppControls`, `Breadcrumb`,
`LessonPicker`, `LessonRail`, `SavedLines`, `Board`, `CandidateRail` — stacked
with no visual hierarchy. On a normal desktop window the content occupies
roughly the top half of the viewport and the rest is empty.

This design replaces that shell with a deliberate one-screen layout, and adds
the keyboard board navigation the original spec requires (§11, "Accessibility:
keyboard board navigation") but never designed.

Two decisions were settled before anything else, and everything below follows
from them:

1. **One layout, not two.** The shell does not restructure itself between
   exploring and following a lesson. The board and its column never move; only
   the contents of the two side rails change. A board that jumps position when
   a lesson starts is the thing this avoids.
2. **The shell fills the viewport.** It is exactly one screen tall, the page
   itself never scrolls, and the rails scroll inside themselves.

## 2. Shell structure

`#root` is `100dvh` — dynamic viewport units, not `vh`, so mobile browser
chrome does not push content out of view — with `overflow: hidden`. Inside it,
a CSS grid of three rows:

| Row | Height | Contents |
|---|---|---|
| Header | `auto` | Wordmark, the progress notice (§6), then `AppControls` pushed right |
| Breadcrumb | `auto` | The current path; scrolls horizontally when a line grows long |
| Main | `1fr` | Three columns |

Main's columns are `minmax(220px, 22%) 1fr minmax(260px, 28%)`.

Both rails carry `min-height: 0` alongside `overflow-y: auto`. Without
`min-height: 0` a grid item refuses to shrink below its content and the whole
page grows instead of the rail scrolling — this is the single most common way
a layout of this shape fails, and it fails silently at small window heights.

### The board's size is the load-bearing assumption

The centre column holds the eval bar and a square board wrapper:
`aspect-ratio: 1; max-block-size: 100%; max-inline-size: 100%; margin: auto`.
The board is therefore capped by whichever of width or height runs out first,
and sits centred in whatever is left.

This is necessary because **`react-chessboard` is width-driven**. Reading
`node_modules/react-chessboard/dist/index.esm.js`: the board grid is
`width: 100%; height: 100%` with `grid-template-columns: repeat(N, 1fr)`, and
each square carries `aspectRatio: '1/1'`. A square's own aspect ratio
determines its height, so total board height follows from its width, and
`height: 100%` on the container does **not** shrink it. Only constraining the
wrapper's *width* by the available height will cap the board.

**This was read, not run.** The `aspect-ratio` + `max-block-size` pattern is
well established and depends on the grid row giving the wrapper a definite
height, which `1fr` does — but the claim is unverified in a browser. The
implementation plan must open with a spike step that proves it before any
other layout work is built on top of it.

### Compare

`CompareDrawer` opens as an overlay covering the centre and right columns and
**not** the left rail, so lesson context stays readable while comparing. It
traps focus, closes on Escape, and returns focus to the control that opened it.

Today the drawer opens inside the right rail, which is ~260px wide and holds
three mini boards. Giving it the width of two columns is the main reason the
compare feature stops feeling cramped.

## 3. Panel behaviour by mode

The board and its column are fixed. Only the rails change.

| | Left rail | Right rail |
|---|---|---|
| Idle | `LessonPicker`, then `SavedLines` | `CandidateRail` |
| Lesson, ordinary move | `LessonRail` — title, note, "Play the next move", "Leave lesson" | `CandidateRail` |
| Lesson, checkpoint pending | `LessonRail` **without** its hint block | **Checkpoint panel**: prompt, revealed hints, "Show another hint", and the existing authored comparison |
| Lesson, answer graded | `LessonRail` with the reply and "Return to the lesson" | Checkpoint panel remains |

### Why the hint block moves

`CandidateRail.tsx:204` collapses the entire rail to one grey sentence —
"Engine suggestions are hidden while the lesson is asking you for a move" —
the moment a checkpoint is pending. That is correct behaviour and a wasted
third of the screen at the app's most important moment.

The hint ladder moves into that column. The space that would have handed the
player the answer instead shows them how to find it, which is the project's
stated first goal. It requires no new authored content: `asking.hints` and
`revealHint` already exist in `LessonRail.tsx`.

The graded state keeps the checkpoint panel on screen deliberately. A wrong
answer's reply text tells the player to take a hint, so the hints must be
visible beside it.

### What the checkpoint panel must not lose

The checkpoint branch of `CandidateRail` (lines 204–243) renders more than the
grey notice. It also renders `checkpointComparison` — a "Compare X and Y"
button and drawer whose pair is drawn from the lesson's authored
`alternatives` and **excludes any move the checkpoint would accept**, so it
contrasts two moves without leaking the answer.

That affordance exists because Plan 3's review found the authored contrast was
otherwise unreachable: every move in the corpus carrying `alternatives` is also
a checkpoint, and the rail hid itself at checkpoints. The new checkpoint panel
**absorbs it unchanged**, along with the `useMemo` that builds it. Losing it
would silently re-introduce a bug this project has already paid to fix.

### Shared surface — name this in both task briefs

The `LessonRail` change and the `CandidateRail` change both read
`useActiveLesson().state.pendingCheckpoint` and must agree about it. A rail
that drops its hints while the other rail has not yet shown them leaves the
player with no hints at all.

No new store surface is introduced; both components read state that exists.
This is exactly the cross-task-drift shape recorded four times in
`Lessons.md` §5, so the plan states the shared condition in both briefs rather
than leaving each task to infer it.

### SavedLines during a lesson

`SavedLines` is absent from the left rail while a lesson runs. Plan 4's review
found that `SavedLines.open()` could reset the tree without stopping the
lesson, crediting a checkpoint the player never answered. That guard stays;
removing the affordance during a lesson makes the hazard unreachable rather
than merely handled.

## 4. The responsive floor

One breakpoint. At `min-width: 1100px` **and** `min-height: 640px`, the
one-screen grid described in §2 applies.

Below either threshold the shell falls back to a single flowing column:
`#root` drops `overflow: hidden` and its fixed height, the three-column grid
collapses to one column, and the rails lose `overflow-y: auto` so the page
scrolls as a whole. Source order is header, breadcrumb, board, right rail,
left rail — the board and the candidate explanations ahead of the lesson
picker and saved lines, so the two things a player is actually looking at do
not sit below a list.

The mode behaviour in §3 is unchanged by the fallback: the same panels appear
and disappear, they are merely stacked. The keyboard navigation in §5 is
likewise unaffected.

Stating the fallback explicitly matters because the current stacked layout is
being replaced, so "what exists today" will not survive this work to be fallen
back to. This preserves the original spec's desktop-first stance (§ "Platform":
responsive down to tablet, phone best-effort) and its exclusion of a
phone-first layout.

## 5. Keyboard board navigation

The keyboard layer does not touch `react-chessboard`'s internals or its DOM.

- The board wrapper takes `tabindex="0"` and an accessible name.
- A cursor square lives in React state in `Board.tsx`.
- The cursor ring and the pick-up highlight are rendered by **merging entries
  into the existing `squareStyles` object** — the same mechanism `Board.tsx:19`
  already uses for the last-move highlight. No overlay, no shadow DOM, nothing
  to keep in sync with the library.

Interaction:

| Key | Effect |
|---|---|
| Arrows | Move the cursor one square |
| Enter / Space | Pick up the piece on the cursor square; press again on a target to move |
| Escape | Put the piece down without moving |

**Arrow direction follows `boardOrientation`.** With the board flipped for
Black, Up is rank − 1. `Board.tsx` already derives orientation from
`activeLesson?.segment.side ?? activeLesson?.lesson.side ?? 'white'`, and
segment-level orientation flips mid-lesson. An implementation that ignores
this is correct for every White lesson and wrong for every Black one.

A move resolves through the existing `resolveDrop(fen, from, to)` and calls
`playMove`, so promotion, castling, and the move sound behave identically to a
drag. An `aria-live="polite"` region announces the cursor square with its
occupant, and announces an illegal attempt without playing it.

### The accessibility tradeoff, stated plainly

This is a single focusable widget with a live region, not a
`role="grid"` of 64 focusable cells. A real grid is better assistive-technology
practice. Building one means shadowing a third-party board's DOM and keeping
two representations in sync, which is a durable source of drift. The
single-widget pattern is well established for board and canvas interfaces and
is the one that will not rot. This is a deliberate trade, not an oversight.

### It closes the automation blocker

`Lessons.md` §6 records that nothing requiring a piece to move can be verified
without a human: `react-chessboard` handles drops only, synthetic drags do not
reach it, and a pointer-event sequence froze the renderer. Three behaviours
have therefore never been observed by hand — answering a checkpoint, the
wrong-answer reply, and segment-level board orientation after "Next part".

A `keydown` on our own wrapper is trivially dispatchable from a test or from
browser automation. **Hands-off verification of the checkpoint path is a goal
of this work, not a side effect**, and the plan's browser check is expected to
cover those three behaviours for the first time.

## 6. The progress notice, and two queued items

### The notice moves to the header

`dismissNotice()` (`src/progress/store.ts:67`) has no caller outside tests. The
recovery and save-failure notices render in exactly two places —
`LessonPicker.tsx:70` and `SavedLines.tsx:48` — and **both live in the left
rail, and both are hidden during a lesson under §3**. A player whose stored
progress failed to load would see the notice, start a lesson, and watch it
disappear with no way to dismiss it.

The notice moves into the header, where no mode can hide it, and gains a
dismiss button. That gives `dismissNotice()` its caller and removes the
duplicate render site in one change.

### Clear progress

A "Clear progress" control joins `AppControls` in the header, behind an
explicit confirmation step, since it wipes durable storage. It clears
`chesstrainer.progress.v1` and resets the in-memory progress store.

### `tree.pinned` is removed

`Tree.pinned` (`src/tree/tree.ts:33`) is initialised to `[]` and never written
to. `evict()` honours it and `tree.test.ts:134` covers it, so the branch is
tested and permanently unreachable in production. The field, the eviction
branch, and the test are removed.

The alternative — wiring it so saved-line nodes keep their evals through
eviction — is a feature nobody has asked for. A tested but unreachable branch
in the eviction path is worse than no branch, because it reads as a working
feature to the next person touching that code.

## 7. Testing

Layout is verified by assertion, not by screenshot:

- the progress notice renders in the header while a lesson is running
- the checkpoint panel replaces the candidate list and carries the hints
- `LessonRail` does not render its hint block while a checkpoint is pending
- `SavedLines` is absent from the DOM during a lesson

The §4 fallback is not unit-testable — jsdom does not evaluate media queries
against a real viewport — so it is verified by hand in the browser at a window
narrower than 1100px and at one shorter than 640px, and the result is reported.
Do not write a test that asserts the fallback by stubbing `matchMedia`; it
would assert the stub, which is precisely the shape of the six tests in
`Lessons.md` §2 that passed against broken implementations.

Keyboard navigation:

- cursor movement under **both** board orientations
- an illegal attempt announces and does not call `playMove`
- a legal attempt calls `playMove` with the expected SAN
- Escape cancels a pick-up

**Mutation-check the orientation test and the illegal-move test.** Both guard
named defects: the orientation test guards the flipped-board bug described in
§5, and the illegal-move test guards a keyboard path that silently plays
nothing. Break each implementation deliberately, confirm the test fails for
the right reason, restore, confirm it passes, and report what was observed.

Test output must be pristine. The warning count is reported as a number; it is
currently zero and any non-zero count is a finding with an owner.

## 8. Out of scope

- Theming or a colour-scheme switch
- A phone-first layout — still excluded, per the original spec
- User-resizable panels, drag-to-reorder, or saved layout preferences
- A `role="grid"` board with 64 focusable cells (see §5)
- Any change to `src/engine/` or to `src/tree/` beyond deleting `pinned`
- Wiring `pinned` to protect saved-line evals

## 9. Open risk

The board sizing described in §2 is read from the library's source, not
observed in a browser. It is the one claim the rest of the layout depends on.
The plan opens with a spike that proves or disproves it, and records the
result, before any layout task runs.
