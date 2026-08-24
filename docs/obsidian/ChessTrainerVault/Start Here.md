---
updated: 2026-08-24
status: current
tags: [chesstrainer, handoff]
---

# Start Here

**This is the handoff note.** Read it first; update it last. If you do one thing
in this vault before finishing a session, make it this note — everything else
can be reconstructed from the code, and this cannot.

## Repo state as of 2026-08-21

| | |
|---|---|
| Branch | `feat/compare-contrast-vocabulary`, checked out. **Not merged, no PR opened.** |
| Merged to `master` | Plans 1–7, plus a wave of UI work driven by playing the app (PR #13). `master` is at `404fc63` |
| Working tree | Clean once this session's vault commit lands; before that, only `docs/` and three `src/ui/` files touched (see below) |
| Suite | **575 passing, 1 skipped (expected), zero warnings**; `tsc --noEmit` clean |
| Last work finished | Task 5 of the compare-contrast-vocabulary plan — browser pass, a regression test, two stale docstrings, a spec correction, and this vault update |
| CI | **There is none.** No `.github/workflows`; `npm test` and `npm run typecheck` locally are the only gate |

Re-checked immediately before writing this note (per [[Lessons]] §10):
`gh pr list --state all` shows PRs #1–14, all `MERGED`, and none for
`feat/compare-contrast-vocabulary` — the branch has never had a PR opened.
`git log --oneline origin/master..HEAD` shows the branch sitting on top of
`master`, unmerged: the spec, the plan, a pre-execution correction, and the
implementation, test and vault commits.

**Deliberately not stated as a number.** Two drafts of this sentence gave a
count and both were wrong — the second was accurate when written and stale by
the time it was committed, because the commit that corrected it became one
more. A count of a branch, written into a note *inside* that branch, invalidates
itself on write. Run the command.

## The compare drawer's contrast vocabulary is done, on an unmerged branch

Five tasks, complete 2026-08-21 on `feat/compare-contrast-vocabulary`. The
compare drawer used to describe each candidate line independently, which
meant two strong moves usually produced identical prose. It now contrasts the
pair directly on five fixed rows — Centre, Development, King safety, Tempo,
Open or closed — plus the moves each line actually walked, shown above the
mini-board so the pictured position is followable. Full detail in
[[Current State]] and [[Architecture]]; commits `7c3de3f` (engine
measurements), `d326127`+`277a023` (the vocabulary module), `9ca51c0`
(rewiring `compare.ts`), `8de7c6f` (rendering), plus this session's two
commits, `4f10aba` (regression test and docstring fixes) and `cd162a7`
(this vault update). Two earlier commits, `bdc5204` (spec) and `87a78f9`
(plan), plus `95af741` (a pre-execution correction), complete the branch.

**This session's browser pass (Task 5) held up.** All five rows render with
both values and a gloss; they render exactly once for the pair, measured via
DOM query rather than eyeballed. The walked moves do make the mini-board
followable — §3.4's whole justification. A Scotch-reached pawn trade moved
the Centre and Open-or-closed rows, confirming they respond to the real
board. The Italian's `Bc4` checkpoint still carries authored prose alongside
all five rows, though it renders *above* the grid rather than beneath it —
a spec deviation found this session, filed in [[Known Issues]] rather than
fixed, since it was outside this task's scope.

**The density judgement went partly against the standing "simple wins ties"
instruction.** The plain case is compact and clear; a comparison carrying
authored pros/cons is a genuine wall, needing three scroll ticks to reach the
verdict. The five-row grid itself is not the problem — full reasoning,
including the King-safety and move-list-duplication questions the task asked
directly, is in [[Known Issues]]. Nothing was cut; that was deliberately left
for the author to decide.

**Three small things were also fixed this session, unrelated to the browser
pass:** a regression test for `formatMoveList`'s previously-untested
Black-to-move branch (mutation-checked — breaking the branch failed the test
for the right reason, restoring it passed), two stale docstrings in
`CandidateRail.tsx` and `CheckpointPanel.tsx` that still described a
heuristic-summary fallback removed on this branch, and the design spec's
§3.3 footer wording corrected to match what actually shipped (the code and
three test files were right; the spec's copy-paste had dropped the
"Practically equal — " lead-in).

**The whole-branch review ran on 2026-08-15 and returned "ship with named
fixes".** The three it named are fixed (`410faef`, `a4e2abf`): a test now pins
the Black lesson's auto-played opening move, two vault notes that had begun
contradicting themselves were corrected, and the `Known Issues` entry that
`movesTable.ts` cites now exists. Seven further findings were filed rather than
fixed — they are in [[Known Issues]] under the 2026-08-15 heading.

**Plan 7's one regression is fixed** (2026-08-17): `black-vs-e4`'s intro no
longer vanishes when autoplay supplies White's opening move. The intro is gated
on the player having moved rather than on ply 0 — `playerHasMoved` in
`lesson/store.ts`, derived from the position rather than ply parity, since a
segment may start with either side to move.

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

## PR #13: what a session of playing the app produced

Not a plan. Six commits, each one something noticed while clicking around, fixed
and browser-verified before the next was started. Worth reading because the
shape of the work is different from every other branch here — no spec, no task
list, and the review at the end earned its keep.

- **The board answers a click.** Clicking a piece marks where it can legally go
  — a dot on an empty square, a tinted ring around a capture — and clicking a
  mark plays the move. `src/chess/legalMoves.ts` asks chess.js rather than
  re-deriving geometry.
- **One grading path.** Dragging and the keyboard each carried their own copy of
  legality → grade → sound → write. Clicking would have been a third, so the
  sequence is now `attemptMove` in `Board.tsx` and the three inputs differ only
  in how they report the result. See [[Architecture]].
- **The rails settled.** Candidates sit in the left column in the explorer and
  on the right during a lesson, where the same component *is* the quiz panel;
  the move list owns the right column and no longer slides around.
- **"My lines" is Save and Open**, with named saves and a disclosure list.
- **A player's glossary** in the header, 30 terms simplest-first, including the
  engine words the app displays. Distinct from this vault's own `Glossary.md`.
- **The compare drawer speaks in moves**, not plies.

**The review found ten things and two were worth the whole exercise.** A
keyboard-held piece kept its destination dots after the board lost focus; fixing
that immediately broke click-to-move, because `focusout` bubbles and
react-chessboard's squares are focusable, so the click that should have played a
move cleared the selection first. Neither was visible to jsdom — the click tests
call `onSquareClick` directly and never dispatch focus. Both are pinned now, and
the guard is mutation-checked.

It also caught that a python index-slice had silently deleted two whole
`Known Issues` sections. Restored from `master`; the three coverage gaps in them
are still open.

## Do this next

**1. Get `feat/compare-contrast-vocabulary` reviewed and merged.** It is
complete — five tasks, browser-verified, suite green — sitting on `master` at
`404fc63` with no PR opened. This session deliberately did not open one; that
is a decision for whoever picks this up next, per the task boundary it was
given.

**2. Decide whether to act on what this session's browser pass found and left
open**, both in [[Known Issues]] under "Found on the compare-contrast-vocabulary
browser pass": authored prose renders above the five-row grid rather than
beneath it (a small, mechanical fix — move the pros/cons block out of
`LinePanel` and render it after `ContrastRows`), and the density judgement
that the authored-prose case is a wall while the plain case is not. Neither
was fixed this session on purpose — they were found during a task scoped to
observing and reporting, not redesigning.

**3. A design pass by eye**, which is the only item on the roadmap no
automation can close. The layout has been measured exhaustively — regions
aligned, board square, rails bounded — and never *judged*. The roadmap used to
name the wrong-answer ✕ as the instance nobody could look at; that was wrong on
both counts and is corrected there.

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
