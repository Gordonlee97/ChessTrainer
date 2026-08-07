---
updated: 2026-08-06
status: current
tags: [chesstrainer, handoff]
---

# Start Here

**This is the handoff note.** Read it first; update it last. If you do one thing
in this vault before finishing a session, make it this note — everything else
can be reconstructed from the code, and this cannot.

## Repo state as of 2026-08-06

| | |
|---|---|
| Branch | `feat/progress-and-controls` |
| Merged to `master` | PR #1 (Plan 1) 2026-08-04 · PR #2 (Plan 2) 2026-08-05 · PR #3 (Plan 3) 2026-08-06 |
| Working tree | Clean |
| Suite | 410 passing, 1 skipped (expected — see below), zero `act()` warnings |
| Last plan finished | Plan 4, progress/saved lines/controls, 2026-08-06 (six tasks + one whole-branch review fix wave) |
| Last change | The Plan 4 fix wave, on `feat/progress-and-controls`, not yet merged |

The one expected skip is `src/engine/engine.smoke.test.ts`, which needs a real
`Worker`. jsdom has none, so the engine is verified in a browser instead. A
second skip is a real failure.

The fix wave that closed Plan 4's review is the reason to read [[Current State]]
before trusting anything written about progress earlier in the branch: a saved
line opened during a running lesson could record a checkpoint the player never
answered, and a correct answer from a (currently hypothetical) multi-entry
`accept` list was being written to durable storage as permanently unsolved.

## Plan 4's browser pass — mostly done, one gap

**2026-08-06.** Driven by hand in Chrome. Confirmed working, console clean:

- The controls row renders; "Sound on" toggles to "Sound off" with
  `aria-pressed` following it, and **the mute survives a reload**.
- Saving a line stores name, PGN and `startFen`; it **survives a reload**, and
  "Open" rebuilds the position (breadcrumb back to `start › e4 › e5`).
- The picker shows "1 of 3 checkpoints" for partial progress and "Done" for a
  completed lesson.
- Board orientation follows the lesson: the London renders from White's side,
  "Answering 1.e4 as Black" from Black's.
- **Spec §10 holds**: with `chesstrainer.progress.v1` deliberately corrupted,
  the app comes up fully with "Your saved progress could not be read, so it is
  starting fresh" — not a blank screen.

**The gap: nothing was verified that requires moving a piece on the board.**
Neither a synthetic drag nor a click-to-move would drive `react-chessboard`
through automation — the board only handles drops, and a synthetic pointer
sequence froze the renderer. So these remain unobserved by hand:

- answering a checkpoint and watching the record appear
- the wrong-answer path showing its authored near-miss reply
- "Next part" advancing to a segment, and with it the **segment-level board
  orientation** that Plan 4's Task 1 added

All three are covered by unit tests, and the segment-orientation test asserts
the flipped value directly. A human with a mouse can close this in two minutes:
start **Development and Tempo**, answer the `Nf3` checkpoint, take "Next part",
and confirm the board flips to Black's side.

## Do this next

**1. Spend two minutes on the gap above**, then finish the branch. It is
otherwise ready to merge per [[Workflow]] — six tasks each reviewed
individually, plus a whole-branch review and its fix wave, both clean, and
zero `act()` warnings. See [[Current State]] for the before/after.

**2. Write Plan 5 — app shell and keyboard navigation.** [[Roadmap]] has what
it covers: a properly designed `App.tsx` (currently an inline-styled shell
stacking five components with no design pass) and the spec's outstanding
keyboard board-navigation requirement. Do not start writing either directly;
see [[Workflow]].

Worth knowing for Plan 5: **keyboard board navigation would also make the
board testable**. Every by-hand gap above exists because the only way to move
a piece is a mouse drag. Building keyboard moves buys accessibility and an
automatable input path in the same change.

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
