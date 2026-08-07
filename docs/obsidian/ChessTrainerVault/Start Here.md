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

## Plan 4 has not been verified in a browser

Nothing in Plan 4 — progress surviving reload, saved lines round-tripping, the
mute toggle persisting, the corrected board orientation, a corrupted storage
key recovering with a notice — has been driven by hand. The plan's own manual
checklist (`docs/superpowers/plans/2026-08-06-progress-and-controls.md`, at
the bottom) is the list to work through. It has not started.

## Do this next

**1. Verify Plan 4 in a browser**, using the checklist at the bottom of
`docs/superpowers/plans/2026-08-06-progress-and-controls.md`. In particular:
solve a checkpoint, reload, and confirm the picker still shows it solved;
save a line, start "New game", and reopen it; toggle sound off, reload, and
confirm it stayed off; corrupt the `chesstrainer.progress.v1` key in
DevTools and reload to confirm the app comes up with a notice, not a blank
screen, per spec §10.

**2. Finish the branch.** Once verified, this is ready to merge per
[[Workflow]] — six tasks, each reviewed individually, plus a whole-branch
review and its fix wave, both clean. See [[Current State]] for the full
before/after.

**3. Write Plan 5 — app shell and keyboard navigation.** [[Roadmap]] has what
it covers: a properly designed `App.tsx` (currently an inline-styled shell
stacking four components with no design pass) and the spec's outstanding
keyboard board-navigation requirement. Do not start writing either directly;
see [[Workflow]].

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
