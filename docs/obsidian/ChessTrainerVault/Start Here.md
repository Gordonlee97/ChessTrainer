---
updated: 2026-08-10
status: current
tags: [chesstrainer, handoff]
---

# Start Here

**This is the handoff note.** Read it first; update it last. If you do one thing
in this vault before finishing a session, make it this note — everything else
can be reconstructed from the code, and this cannot.

## Repo state as of 2026-08-10

| | |
|---|---|
| Branch | `feat/app-shell-and-keyboard` |
| Merged to `master` | PR #1 (Plan 1) · #2 (Plan 2) · #3 (Plan 3) · #4 (Plan 4) |
| Working tree | Clean |
| Suite | 434 passing, 1 skipped (expected — see below), **zero warnings** |
| Last plan finished | Plan 5, app shell and keyboard navigation — eight tasks, each individually reviewed, plus a browser pass |
| Not yet done | **No whole-branch review.** The branch is not finished. |

The one expected skip is `src/engine/engine.smoke.test.ts`, which needs a real
`Worker`. jsdom has none, so the engine is verified in a browser instead. A
second skip is a real failure.

## Two of the three never-observed behaviours have now been observed

Until this branch, `react-chessboard` handled only drag-and-drop drops, so
**nothing requiring a piece to move could be verified without a human**. Plan 5's
keyboard layer is our own DOM and *is* drivable. On 2026-08-10:

- **Answering a checkpoint** — watched working.
- **The wrong-answer path** — watched working, including the near-miss reply
  with the Hint control still on screen beside it.
- **Segment-level orientation after "Next part"** — **still unobserved.**
  Lesson-level orientation was verified (`a8` first for White, `h1` first for
  Black) and shares the same derivation, but the segment flip itself has not
  been watched.

Numbers, method, and an explicit list of what could *not* be checked are in
`docs/superpowers/plans/spike-results-shell.md`.

**Known environment limit, confirmed by four separate agents:** the browser
window cannot be resized here. `resize_window` reports success without moving
the viewport; `window.resizeTo()`, an OS restore-down keystroke and CSS `zoom`
all fail, and no CDP device-metrics tool is exposed. So the real
`(min-width: 1100px) and (min-height: 640px)` breakpoint **trigger** has never
been exercised — only the fallback's declarations, via an injected stylesheet.
Do not burn time rediscovering this.

## Do this next

**1. Run the whole-branch review, then finish the branch.** Point it at the
seams. Every task passed its own review; what has not been asked is whether the
tasks agree with each other. Feed it the deferred minors listed in the ledger at
`.superpowers/sdd/2026-08-09-app-shell-and-keyboard/progress.md`.

**2. Merge PR #5 — and note that `Lessons.md` lives only on that branch.**
`docs/learning-loop` has been open since 2026-08-07 and contains the whole
learning-loop note. It is *not* on `master` and *not* on this branch, so the
lessons below have nowhere to go until it lands. Merge it, then add them.

**3. Add these to `Lessons.md` once PR #5 is merged.** Both were paid for on
this branch:

- **A shared condition gets one definition, not two agreeing ones.** Plan 5's
  Task 5 was written as a single task specifically to prevent a shared-surface
  drift, and it drifted anyway: `CandidateRail` gated on `pendingCheckpoint`
  while `CheckpointPanel` derived `pendingCheckpoint ?? attemptedCheckpoint`, so
  the hint ladder vanished during grading. A third copy of the same rule was
  later found in `checkpointComparison`. One owner is not enough when the rule
  itself is duplicated. Corollary: **a test that renders a component directly
  never exercises its mount gate** — every `CheckpointPanel` test rendered the
  panel, so none could see that nothing mounted it.
- **A task that writes grid or flex placement needs a browser check inside that
  task.** jsdom performs no layout, so `npm test` structurally cannot catch a
  CSS Grid bug. Plan 5 Task 6 shipped a green suite while the board and
  candidate rail rendered *below* the left rail on every page load, because an
  empty definitely-positioned portal target stole row 1 from auto-placement. A
  reviewer found it only by starting the dev server and measuring. Deferring the
  browser pass to the end of the plan is not sufficient.

**4. Two smaller things.** `docs/superpowers/plans/spike-results-shell.md`
records four new minors from the browser pass (a stale-closure cursor update, a
duplicated `role="status"` region, the cursor not resetting on New game, and a
possible engine-gating of the checkpoint prompt). None block merge.

## Where to look for what

- **What the project is** → [[Project Overview]]
- **What runs today** → [[Current State]]
- **What's next and why** → [[Roadmap]]
- **How the code fits together** → [[Architecture]]
- **How work gets done here** → [[Workflow]]
- **What's broken** → [[Known Issues]]
- **Why something is the way it is** → `Decisions/`, indexed from [[Home]]

## Before you touch the engine

`src/engine/engine.ts` took six revisions and each of the first three traded one
bug for another. Read [[Decisions/Engine Search Serialization]] first. Be
suspicious of any change that simplifies the drain protocol — every mechanism in
there has a specific bug behind it.

## Before you finish your session

1. Update [[Current State]] if behaviour changed.
2. Update [[Known Issues]] — including issues you found and chose *not* to fix.
3. Add a `Decisions/` note if you made a choice with consequences past this
   change.
4. **Update this note**: the repo state table, and "Do this next" so it names the
   real next action rather than the one that was true yesterday.

If the session changed nothing, change nothing. An empty update is noise.
