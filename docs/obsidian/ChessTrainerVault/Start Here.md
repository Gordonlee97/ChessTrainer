---
updated: 2026-08-13
status: current
tags: [chesstrainer, handoff]
---

# Start Here

**This is the handoff note.** Read it first; update it last. If you do one thing
in this vault before finishing a session, make it this note — everything else
can be reconstructed from the code, and this cannot.

## Repo state as of 2026-08-13

| | |
|---|---|
| Branch | `feat/lesson-quiz-loop` — **not pushed, not merged** |
| Merged to `master` | Plans 1–5 |
| Working tree | Clean |
| Suite | 482 passing, 1 skipped (expected), **zero warnings** |
| Last plan finished | Plan 6, the lesson quiz loop — ten tasks, a browser pass, a whole-branch review and its fix wave |
| Merges cleanly into `master` | Yes, checked with `git merge-tree` |

The one expected skip is `src/engine/engine.smoke.test.ts`, which needs a real
`Worker`. jsdom has none, so the engine is verified in a browser. A second skip
is a real failure.

## What Plan 6 changed

Opening lessons became a **move-by-move quiz**. Every player-side move is asked;
a wrong answer bounces off the board without entering the game tree; the
opponent replies on its own 700ms later. Lessons moved into a header dropdown,
so the base page is now the explorer. The left rail became the lesson's
explanation panel. [[Current State]] has the detail; [[Architecture]] has the
three mechanisms and the boundaries between them.

Content: **24 checkpoints, 72 hints, 110 near-miss replies** across the three
openings. Theme lessons are deliberately untouched.

## Do this next

**1. Look at it, then decide about the cross.** The whole-branch review flagged
one thing it explicitly would not settle without a human at a real viewport: the
red ✕ for a wrong answer persists until the next attempt — that is the intended
behaviour, since it is a standing fact about an unsolved position — but it is an
opaque disc over the centre of the board, and the hints often ask the player to
reason about exactly those squares. It has **never been seen at a real
viewport**; the automation tab renders at zero size. Making it translucent is a
one-liner. Filed in [[Known Issues]].

**2. Watch the opponent reply.** Auto-play's 700ms move has never been observed
on a real board — a backgrounded automation tab throttles timers, so it is
covered only by unit tests with fake timers. Start any opening, answer the first
question, and confirm Black answers on its own. Two seconds.

**3. Then finish the branch** — push and open a PR, per [[Workflow]].

**4. Plan 7 is the moves table.** Already specified, in
`docs/superpowers/specs/2026-08-11-lesson-loop-and-moves-table-design.md` §4 —
a lichess-style numbered move list that replaces the breadcrumb, clickable to
jump, with arrows to step. It is deliberately *app furniture*, present in the
explorer as well as in lessons. `Breadcrumb.tsx` survives until it lands.

## Two things this branch learned, worth reading before the next plan

Both are in [[Lessons]], and both cost real rework here:

- **§8 — a check that cannot tell its subject from a look-alike.** Eight
  instances on this branch. A test placed where the rule under test is not the
  only thing producing the outcome passes while blind. The fix is to write the
  broken version and watch the check notice — *and* to confirm the mutation
  actually landed, because a mutation that changes nothing looks exactly like a
  guard that works.
- **§9 — content claims that sound true and are false.** Nine on this branch,
  none catchable by any test that exists. A hint claimed h7 was defended only by
  the king; the f6 knight defends it too, which is the whole reason h7
  sacrifices begin by removing that knight. Count claims against the board with
  chess.js; do not read them.

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
