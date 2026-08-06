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

**Browser verification is done — 2026-08-05.** Plan 3 was driven by hand in
Chrome after the fix wave. Everything the fix wave claimed to fix was confirmed
working, and the console was clean throughout:

- The picker lists three openings and four ideas, each with its summary.
- At a checkpoint the candidate rail is replaced by "Engine suggestions are
  hidden…" and the answer appears nowhere on the page.
- Playing `d4` at the Italian's first checkpoint returns its **authored**
  near-miss reply, with the prompt, the Hint button and "Return to the lesson"
  all still on screen — no error wording.
- Notes that used to vanish before a checkpoint now render.
- At the `Bc4` checkpoint the Compare button offers **`Bb5` and `d4`**, and a
  page-wide scan confirmed `Bc4` appears nowhere. The drawer opens as a
  `role="region"` and shows the authored Ruy Lopez and Scotch pros and cons.
- **Forks and Pins**: the pin segment completes, "Next part" advances, and the
  fork segment now asks *"The free pawn on e5 is bait. Which capture takes the
  forking knight instead?"* — the corrected lesson.

**One thing still unobserved**, carried from Plan 2: that
`prefers-reduced-motion` suppresses the compare drawer's entrance animation
while leaving a visible press signal (DevTools → Rendering → emulate). The CSS
is right by inspection and a reviewer has checked it twice, but nobody has
watched it with the emulation on.

## Do this next

**1. Open a PR for this branch.** It sits on top of `master` with PR #2 already
merged in. Merge with `--merge`, not `--squash`, for the same reason PR #1 was:
the fix history is worth reading commit by commit.

**2. Then Plan 4 — progress persistence.** [[Roadmap]] has the ordering and the
two schema decisions already made. Do not start writing `src/progress/` directly;
see [[Workflow]].

Decide the board-orientation question before Plan 4 touches lessons:
`theme-development-and-tempo`'s second segment is played from Black's side of a
White-oriented board, because `side` lives on the lesson rather than the
segment. [[Known Issues]] has both honest fixes.

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
