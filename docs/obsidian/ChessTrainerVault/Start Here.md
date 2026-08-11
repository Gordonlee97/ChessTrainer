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
| Suite | 443 passing, 1 skipped (expected — see below), **zero warnings** |
| Last plan finished | Plan 5, app shell and keyboard navigation — eight tasks, each individually reviewed, plus a browser pass |
| Whole-branch review | Run 2026-08-10. One Critical and three Importants; **all four fixed** in one wave — see `.superpowers/sdd/2026-08-09-app-shell-and-keyboard/fix-wave-report.md` |
| Fix-wave re-review | Run 2026-08-10. **All four ADDRESSED, merge recommended.** Mutations reproduced independently. |
| Fix-wave browser pass | Run 2026-08-10 on merged `master`. C1 verified **both** halves — including with the engine physically removed — and I3 verified. See `docs/superpowers/plans/spike-results-shell.md` |
| Verification debt | "One search per checkpoint" is proven structurally and by test, never watched on the wire |

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

**1. Plan 5 is done and merged (PR #6, 2026-08-10).** The whole-branch review,
its fix wave, the scoped re-review, and a fix-wave browser pass are all
complete. The C1 fix was verified with the engine *physically removed* from
`public/engine/`, so a lesson is now answerable with no engine at all — the
banner's "lesson content still works" is finally true.

Pick the next plan from [[Roadmap]].

**2. Two smaller things.** `docs/superpowers/plans/spike-results-shell.md`
records four minors from the browser pass. The fourth — "a possible engine
gating of the checkpoint prompt" — turned out to be the review's Critical and is
now fixed; the note there still calls it pre-existing and transient, which it
was not. The other three (a stale-closure cursor update, a duplicated
`role="status"` region, the cursor not resetting on New game) stand and none
block merge.

## Where to look for what

- **What the project is** → [[Project Overview]]
- **What runs today** → [[Current State]]
- **What's next and why** → [[Roadmap]]
- **How the code fits together** → [[Architecture]]
- **How work gets done here** → [[Workflow]]
- **Mistakes not to make again** → [[Lessons]] — read this before writing a plan
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
