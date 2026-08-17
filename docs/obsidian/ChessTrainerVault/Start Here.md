---
updated: 2026-08-16
status: current
tags: [chesstrainer, handoff]
---

# Start Here

**This is the handoff note.** Read it first; update it last. If you do one thing
in this vault before finishing a session, make it this note — everything else
can be reconstructed from the code, and this cannot.

## Repo state as of 2026-08-15

| | |
|---|---|
| Branch | `feat/moves-table`, 11 commits ahead of `origin/master` (`bb68efc`..`a4e2abf`). **Complete, browser-verified and whole-branch reviewed, but not merged — no PR opened yet.** |
| Merged to `master` | Plans 1–6 only |
| Working tree | Clean |
| Suite | 506 passing, 1 skipped (expected), **zero warnings**; `tsc --noEmit` and `npm run build` both clean |
| Last plan finished | Plan 7, the moves table — six tasks plus a browser pass. See [[Roadmap]] and [[Current State]] |
| CI | **There is none.** No `.github/workflows`; `npm test` and `npm run typecheck` locally are the only gate |

Re-checked immediately before writing this note (per [[Lessons]] §10):
`gh pr list --state all` shows no PR for `feat/moves-table`; `git log
origin/master..HEAD` shows exactly the 11 commits above. Nothing else is in
flight on this branch.

**The whole-branch review ran on 2026-08-15 and returned "ship with named
fixes".** The three it named are fixed (`410faef`, `a4e2abf`): a test now pins
the Black lesson's auto-played opening move, two vault notes that had begun
contradicting themselves were corrected, and the `Known Issues` entry that
`movesTable.ts` cites now exists. Seven further findings were filed rather than
fixed — they are in [[Known Issues]] under the 2026-08-15 heading.

**One regression ships knowingly**: `black-vs-e4`'s intro paragraph is replaced
700ms after the lesson opens, because autoplay advances the ply on a timer and
the intro is gated on ply 0. It is filed, it breaks nothing, and the fix is a
design choice rather than a patch — see [[Known Issues]]. Decide it before the
next content pass.

**Three Claude sessions have now worked this branch concurrently**, and the third
time it cost something: PR #7 was merged on 2026-08-13 at 21:38 UTC by one
session while another was mid-fix on a blocker, so Plan 6 reached `master` with a
lesson-breaking bug in it and needed a second PR (#8, merged 2026-08-14 07:42
UTC) to take it back out. Nothing was lost, but two hours of `master` carried a
dead-end.

The lesson generalises past this branch and is recorded in [[Lessons]] §10:
**re-read the PR state immediately before claiming a branch is finished**, not at
the start of the session. Both fixes in #8 were also invisible to the SDD ledger
at `.superpowers/sdd/2026-08-11-lesson-quiz-loop/progress.md`, which is
local-only — the vault is the only shared record.

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
two defects that every prior pass had missed, both fixed and merged in PR #8:

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

## Plan 7, the moves table, is done and browser-verified — not yet merged

Six tasks on `feat/moves-table`, finished 2026-08-15: the autoplay-owed-reply
fix reconciled with a navigation-reached tip (`bd37bb7`), the pure derivation
`buildMovesTable`, the `MovesTable` component and its four controls, mounting
it in place of `Breadcrumb.tsx` (now deleted), and focus-scoped arrow keys.
[[Current State]] and [[Architecture]] have the detail.

A browser pass on 2026-08-15 ran all five checks the plan called for:
stepping back keeps the continuation listed (the whole reason this replaced
the breadcrumb); playing a different move from a branch point makes the table
follow the new line; a Black-to-move segment (`development-and-tempo` part 2)
numbers its first row `2.` with an elided White cell; stepping back
mid-lesson never drags the player forward again; and — the one that mattered
most — answering a checkpoint correctly, clicking an earlier moves-table row,
then clicking `last`, still produces the opponent's reply rather than a blank
panel. All five held. Full session notes, including an unexplained (and
almost certainly harmless) rendering glitch during the pass, are in
`.superpowers/sdd/2026-08-14-moves-table/task-6-report.md`.

**This branch is not merged and no PR exists for it.** `gh pr list --state
all` was checked immediately before writing this note (not at session start —
see [[Lessons]] §10) and shows nothing for `feat/moves-table`.

## Do this next

**Open a PR for `feat/moves-table` and merge it**, following [[Workflow]].
Nothing else is in flight. Once merged, the next roadmap item is the compare
drawer's contrast vocabulary — see [[Roadmap]] "Next" — which is a design
decision before it is code, not a task to start writing against directly.

## Three things this branch learned, worth reading before the next plan

All are in [[Lessons]], and all cost real rework here:

- **§10 — repo state read once and reported as if it were still true.** Three
  instances, and the third one is why `master` briefly shipped a broken lesson.
  Re-read PR and branch state *immediately* before calling a branch finished;
  the reading you took at the start of the session has expired, because another
  session is probably working too.

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
