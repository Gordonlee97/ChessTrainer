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
| Branch | `feat/lesson-quiz-loop` — **pushed; PR #7 open, not merged** |
| Merged to `master` | Plans 1–5 |
| Working tree | Clean |
| Suite | 482 passing, 1 skipped (expected), **zero warnings** |
| Last plan finished | Plan 6, the lesson quiz loop — ten tasks, **two independent browser passes**, a whole-branch review and its fix wave |
| Merges cleanly into `master` | Yes, checked with `git merge-tree` |

**Two Claude sessions worked this branch concurrently on 2026-08-12/13** and
neither knew about the other until the end. It did no damage — the commits are
disjoint and the second pass corroborated the first — but it is why the SDD
ledger at `.superpowers/sdd/2026-08-11-lesson-quiz-loop/progress.md` and this
vault were written by different hands and each records things the other does
not. The ledger has the content-review detail; the vault has the review and fix
wave. Read both if you need the full history of this branch.

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

## The second browser pass closed the last two never-observed behaviours

A second, independent pass on 2026-08-13 (`0b931fb`) watched both of the things
this project had never once seen, each measured rather than eyeballed:

- **The opponent's auto-reply, on a real board.** Node count 11 → 12 at
  **+291 ms** (Black to move, no reply yet) → 13 at **+7820 ms** with
  `move.san === "c5"`. The +291 ms sample is the part that matters: it proves
  the reply is deferred rather than same-tick. The earlier note that a hidden
  tab prevents this was **wrong** — hiddenness alone does not stop timers; a tab
  backgrounded for several minutes does. A fresh tab works fine.
- **Segment-level board orientation after "Next part"** — unobserved since Plan
  4 specified it. In `development-and-tempo`, `[data-square]` DOM order went
  `a8…h1` → `h1, g1 … a8`, `segmentIndex` 0→1, tree reseeded to one node, and
  the keyboard layer flipped with it (`ArrowUp` moved `b2 → b1`).

It also watched the near-miss reply that the content review had found **dead in
the app** — an authored key spelled `Bb5+` where the board produces `Bb5`, so
`gradeMove` never matched it. After the fix: `grade.kind === "near-miss"`, tree
11 → 11, and the authored text on screen instead of "Try again". A guard against
that whole class now ships in `lessons.test.ts`.

**Still never observed:** drag-and-drop (`onPieceDrop` remains unreachable to
automation), "Next part" inside an *opening* — all three openings have a single
segment, so the control cannot appear there by construction — and **the flowing
fallback layout below 1100×640**, which no pass has ever rendered.

**Moves *can* be automated, via the keyboard layer.** A third pass on
2026-08-13 drove real moves end to end — focus the board, arrow keys to the
square, Enter to pick up and place — and played wrong answers, near-misses and
correct answers this way. `CLAUDE.md`'s "anything requiring a piece to move on
the board cannot be automated today" is true only of *drag-and-drop*; the
keyboard path in `Board.tsx`'s `onKeyDown` is fully drivable, and it is what
found the autoplay dead-end. Worth correcting in `CLAUDE.md`.

## The third browser pass found a blocker, and it is fixed

The pass on 2026-08-13 drove the quiz loop through the keyboard layer and found
two defects that every prior pass had missed, both now fixed on this branch:

- **Replaying a move after stepping back dead-ended the lesson.** Step back to
  `start`, play `e4` again → the opponent never replied and the checkpoint panel
  went blank, permanently. `insertMove` reuses the node, so the tip-of-line
  guard in `useLessonAutoplay` read "already has a child" as "the player is
  reviewing" and declined. The tree store now records `lastPlayedId`, so the
  hook tests *how the player arrived* rather than inferring it from where they
  landed. See [[Decisions/Arrival By Move Versus Navigation]].
- **The feedback mark was 210.5px below the board's centre** — on the second
  rank, covering the d2 pawn — because `.board-wrap` is centred by block layout
  (vertical `auto` margin computes to 0) while `.move-feedback` was centred by
  absolute positioning (`inset: 0` + `auto` margin). The CSS comment asserting
  the two boxes matched was simply wrong. Now measured at offset 0.01px.

The mark is also translucent now (80%), which was the open judgement call the
whole-branch review deferred to a human at a real viewport. Correct placement
put it back over the four central squares, which is exactly where the hints ask
the player to look, so the two changes belong together.

## Do this next

**1. PR #7 is ready for review.** Branch pushed, suite green (485 passing, 1
expected skip, zero warnings), both blockers fixed and verified in the browser
rather than only in tests. Nothing outstanding.

**2. Plan 7 is the moves table.** Already specified, in
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
