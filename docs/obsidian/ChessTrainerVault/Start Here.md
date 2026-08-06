---
updated: 2026-08-05
status: current
tags: [chesstrainer, handoff]
---

# Start Here

**This is the handoff note.** Read it first; update it last. If you do one thing
in this vault before finishing a session, make it this note — everything else
can be reconstructed from the code, and this cannot.

## Repo state as of 2026-08-05

| | |
|---|---|
| Branch | `feat/content-and-lessons` |
| Base | `master` — PR #1 merged 2026-08-04, PR #2 (Plan 2) merged 2026-08-05 |
| Working tree | Clean |
| Suite | 343 passing, 1 skipped (expected — see below) |
| Last plan finished | Plan 3, the teaching layer, 2026-08-05 (eight tasks) |
| Last change | Whole-branch review fix wave, 2026-08-05 (nine items) |

The one expected skip is `src/engine/engine.smoke.test.ts`, which needs a real
`Worker`. jsdom has none, so the engine is verified in a browser instead. A
second skip is a real failure.

The fix wave that closed Plan 3's review is the reason to read [[Current State]]
before trusting anything written about lessons earlier in the branch: one lesson
was accepting a move that loses by force, three shipped half their content
unreachable, and the picker never rendered the summaries it was given.

## Do this next

**1. Run Plan 3 in a browser. It has never been opened.** The suite is green and
proves a lot, but nobody has watched a lesson run. Specifically worth doing by
hand:

- Start **Forks and Pins**, finish the pin segment, take "Next part", and check
  the fork segment reads as intended — it now teaches declining the Blackburne
  Shilling bait, and its near-miss reply quotes a mating line.
- Take all three hints at the Italian's first checkpoint, answer it, and confirm
  the second checkpoint starts with none showing and its own Hint button.
- Answer a checkpoint wrongly and confirm the question, the hints, and the
  Return control are all still on screen and all do what the copy says.
- At the Italian's `Bc4` checkpoint, confirm the Compare button appears and
  compares `Bb5` and `d4` — never `Bc4`. It depends on the engine's three lines
  containing both authored moves, so watch whether it flickers mid-search.
- Still unobserved from Plan 2: that `prefers-reduced-motion` suppresses the
  compare drawer's entrance animation while leaving a visible press signal
  (DevTools → Rendering → emulate). The CSS is right by inspection.

**2. Open a PR for this branch** once that is done. It sits on top of `master`
with PR #2 already merged in. Merge with `--merge`, not `--squash`, for the same
reason PR #1 was: the fix history is worth reading commit by commit.

**3. Then Plan 4 — progress persistence.** [[Roadmap]] has the ordering and the
two schema decisions already made. Do not start writing `src/progress/` directly;
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
