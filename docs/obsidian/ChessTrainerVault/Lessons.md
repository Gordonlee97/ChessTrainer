---
updated: 2026-08-14
status: current
tags: [chesstrainer, process, lessons]
---

# Lessons

**This note exists so the same mistake is not made a fifth time.** It is not a
retrospective and not a list of good intentions — every entry names a failure
that actually happened here, counts how often, and states the specific
countermeasure now in force. If a countermeasure is not written into
[[Workflow]] or `CLAUDE.md`, it will not happen, so each one says where it lives.

Read this before writing a plan. Add to it whenever something recurs.

## How to use it

- **Before writing a plan**: read the failure modes. Most were introduced *by a
  plan*, not by an implementer.
- **When something goes wrong twice**: it belongs here. Once is bad luck; twice
  is a process gap.
- **When you add an entry**: put the countermeasure somewhere binding. A lesson
  that lives only in this file is a lesson that will be re-learned.

---

## Failure modes

### 1. Chess that is legal and still wrong

**Seven occurrences across Plans 2 and 3.** The most expensive class of error in
this repo by a wide margin.

| What | Caught by |
|---|---|
| Fork fixture: knight on d6 asserted to attack b6 and f6 — it attacks neither | Plan self-review |
| Pin fixture: bishop on b2 playing `Bb5`, not a diagonal | Plan self-review |
| Near-miss on `d6` at a ply where `d6` had already been played | Plan self-review |
| `centerControl.w > 0` at the start position — nothing attacks the centre on move one | Implementer |
| "`Nf6` loses to `Qxf7#`" — the knight *blocks* the f-file, so `Qxf7` is illegal | Implementer |
| `Nc4` near-miss illegal: White's own bishop occupies c4 in that line | Implementer |
| Fork lesson accepted `Nxe5` in the Blackburne Shilling Gambit — **it loses by force to `Qg5`**, and the two moves authored as near misses were the correct continuations | **Final whole-branch review, after eight tasks had passed** |

The last one is the lesson. `validateLessonChess` replays every authored move
through chess.js, so it catches **illegality**. It cannot catch **unsoundness**,
and a task review confirmed "`Nxe5` creates a true double attack on f7" — true,
and irrelevant, because it is a double attack that loses on the spot.

**Countermeasures — in [[Workflow]] §3 and §5:**

- **Never hand-write a FEN.** Derive it by replaying moves through chess.js in a
  scratch script and pasting the result. Three of the seven were hand-written.
- **Legality is not correctness.** For any position where a move is taught as
  *the answer*, run the vendored engine on it and confirm the accepted move is
  actually best. `public/engine/` is right there; Plan 3's fix wave used it to
  confirm `Nxd4` at +1.01 against `Nxe5` at −0.50.
- **A reviewer must re-derive the chess, not re-read it.** Every review prompt
  for content says so explicitly, and it is why four of these were caught.

### 2. Tests that pass against a broken implementation

**Seven occurrences.** Each one is a test that looked like coverage and was not.

- A rail test asserting `/centre|center/i` — which *locked in* the defect where
  every opening move produced the same sentence.
- Every explainer rule test used `toContain(tag)`, so nothing ever asserted
  which reason ranked **first** — the actual user-visible behaviour.
- A "transposition reuse" test that exercised the cache directly and never
  rendered the hook it was written to guard.
- `pgnToSans`'s `startFen` parameter was **inert**; the round-trip test passed
  with the parameter discarded entirely.
- An abort test asserting `stop` was sent — but `analyze()` sends `stop` on
  entry, so it passed with abort completely broken.
- A "shows nothing" test whose regex would have matched "0 of 3 checkpoints".
- **Plan 5, seventh:** a keyboard illegal-move test whose two assertions were
  both non-discriminating. `playMove` try/catches internally, so the tree is
  never touched by a bad call; and the stale announcement from the previous
  keystroke was never compared against. It "failed" its mutation check only
  because the implementer's chosen mutation happened to throw — a reviewer then
  wrote a non-crashing expression of the *same* defect and got four passing
  tests and exit code 0.

**Countermeasure — in [[Workflow]] §4, and `CLAUDE.md`:**

**Mutation-check any test written to guard a named defect.** Break the
implementation deliberately, confirm the test fails *for the right reason*,
restore it, confirm it passes. Report what you observed.

This is cheap and it has never once failed to settle the question. It is how
the `startFen` fix was proven, how the segment-orientation test was proven, and
how the `act()` fix was proven. A test whose failure you have not seen is a
test you are guessing about.

**Plan 5 added two refinements, both paid for:**

- **A failure caused by an exception is not evidence.** *How* it fails is the
  evidence, not *that* it fails. Require a clean assertion mismatch; if the
  mutation throws, pick a different mutation — a `try/catch` added later would
  silence the crash and leave the defect uncovered. One implementer also caught
  itself here honestly: its own new test passed against a broken store because
  it re-passed the same JSX element and React bailed out of re-rendering.
- **Deleting an assertion deletes an invariant — count it as a code change.**
  Moving the hint ladder out of `LessonRail` dropped
  `getByRole('button', { name: /^hint$/i })` from the "not this time" test as
  "no longer this component's control". It was the only encoding of *the reply
  must not name a control the player cannot see* — and within the same branch
  that invariant broke again, through a different gate, with a green suite. When
  a moved feature makes an assertion homeless, it moves to wherever both halves
  are on screen. Not into the bin.

### 3. Plan code written against a file shape that has moved

**Five occurrences.** Plans carry complete code, which is a strength for new
files and a trap for existing ones.

- A `useAnalysis` snippet reading `node.eval` reactively — the real file
  deliberately reads it fresh to avoid a re-analysis loop.
- "Put the `useMemo` above the return" — the component had **three** returns;
  following it literally would have broken the rules of hooks.
- `CandidateRail` snippets diverged in three separate plans.
- A `Board` test helper (`lastOptions()`) that does not exist.
- `LessonPicker` had been split into a child component the plan did not know about.

**Countermeasures — in [[Workflow]] §3:**

- **For a file that already exists, the plan describes the change and names the
  invariants to preserve — it does not paste a full replacement.**
- **Every dispatch touching an existing file says: read it in full first, adapt,
  and report any divergence rather than forcing the edit.** This works — every
  one of the five was caught and reported by the implementer.

**Plan 5 exposed a second variant with the same shape and a different cause:
plan code that was never stale, just wrong.** Both of Plan 5's Criticals came
from the brief, not the implementer — the CSS Grid placement that pushed the
board below the left rail, and the board-sizing CSS the opening spike measured
at 8×8px. Implementers transcribed both faithfully, exactly as instructed. The
existing countermeasure cannot catch this: "read the file and report divergence"
finds a plan that disagrees with the code, not a plan that is internally
coherent and incorrect.

**What does catch it:**

- **A spike, for any load-bearing claim the plan asserts rather than measures.**
  Plan 5 opened with one because the whole layout rested on how
  `react-chessboard` sizes itself. It came back REFUTED and cost one task
  instead of a rebuild. **This is the single highest-return thing in this
  document.**
- **Naming, in the brief, which parts are measured and which are assumed**, so
  an implementer knows where to push back rather than transcribing uniformly.
  Plan 5's later briefs said "the CSS below is measured, use it exactly — if you
  reach for `aspect-ratio`, stop", and no implementer re-broke it.

### 4. Assuming a mechanism's shape instead of reading it

- The purity guard's exemption was assumed to be a filename check. It was a
  single hardcoded literal path, so the next store would have failed the guard.
- `loadPgn` was assumed to honour the `Chess` it was constructed from. It does
  not — it reads the PGN's own header, which made a parameter inert.
- `chess.move` was assumed to throw rather than return falsy. True today,
  unguarded tomorrow.

**Countermeasure — in `CLAUDE.md`: grep, don't recall.** One task reported a
term absent from a file when it was plainly there, twice in the same file.
Verify library behaviour in a scratch script before writing prose that depends
on it; verify a repo mechanism by reading it before writing a plan step around it.

### 5. Cross-task drift

**Six occurrences, every one invisible to task-scoped review and caught only by
the whole-branch review.**

- Quality badges computed across mixed search depths, so candidates flickered
  through wrong bands mid-search.
- The authored comparison was unreachable: `alternatives` existed on exactly one
  move, that move carried a checkpoint, and the rail hid itself at checkpoints.
- `segmentIndex` was never advanced, so three lessons shipped with half their
  content unreachable and one ran a single move long.
- `SavedLines.open()` reset the tree without stopping a running lesson, so
  opening a saved line could record a checkpoint the player never answered —
  into durable storage, where `solved` is sticky.

Each is two tasks that individually satisfied their brief and together did not
agree. A task reviewer cannot see this; it only has one diff.

**Countermeasures — in [[Workflow]] §3 and §5:**

- **A plan names its shared surfaces.** When two tasks touch the same component,
  store, or lifecycle, say so in both briefs.
- **The final review is pointed at the seams explicitly**: "do tasks N and M
  agree about X?" is a better prompt than "look for problems."

**Fifth and sixth occurrences, Plan 5 (2026-08-09/10) — and they show the
countermeasure above is necessary but not sufficient.**

Plan 5's Task 5 was deliberately written as *one* task so a single implementer
would own both halves of the `pendingCheckpoint` surface, and the brief named
the hazard outright. It drifted anyway: `CandidateRail` gated the checkpoint
panel on `pendingCheckpoint` while `CheckpointPanel` derived
`pendingCheckpoint ?? attemptedCheckpoint`. Those are mutually exclusive, so
during answer-grading the panel never mounted and the hint ladder vanished at
exactly the moment the wrong-answer copy says "take a hint." A **third** copy of
the same rule was then found inside `checkpointComparison`.

Then it happened again, in the same branch, through a different mechanism: the
whole-branch review found the prompt and hints sitting *below* `CandidateRail`'s
engine-status early returns, so with the engine unavailable a lesson was
permanently unanswerable while the banner read "lesson content still works."

Neither was carelessness. The first was **the condition existing in two places
at all** — each copy individually correct, drifting the moment one had to handle
an extra state. The second was a correct condition evaluated **downstream of a
gate nobody re-examined**.

**Stronger rules, now in force:**

- **A shared condition gets one definition, not two agreeing ones.** The fix
  added `askingCheckpoint(active)` to `src/lesson/store.ts`; every consumer
  calls it. Widening the second copy would have fixed the symptom and left the
  mechanism intact.
- **When you move a feature, check what now gates it.** Moving the hint ladder
  from an unconditional sibling into a component mounted behind two engine-status
  returns changed its preconditions without changing a line of its own logic.
- **A test that renders a component directly never exercises its mount gate.**
  Every `CheckpointPanel` test rendered the panel, so none could notice that
  nothing mounted it. The test that catches this renders *through* the parent.

### 6. Green tests, broken app

**Every plan that had a UI. Every single time.**

| Plan | Suite green at | What the browser found |
|---|---|---|
| 2 | 223 | Four user-visible defects, including a caption that contradicted the board beside it and a verdict that asserted a difference then stated none |
| 3 | 318 | Three lessons shipping half their content unreachable |
| 4 | 407 | Nothing new — the first clean pass |
| 5 | 430 | The board and candidate rail rendering *below* the left rail on every page load — a CSS Grid placement bug |

**Countermeasure — in [[Workflow]] §5 and §6: run the browser check *before* the
final whole-branch review, not after.** In Plans 2 and 3 it ran afterwards,
which meant the final reviewer triaged a list it could not see the evidence for.
Running it first gives the reviewer real findings to weigh.

**Plan 5 sharpened this: end-of-plan is still too late for layout.** Task 6
shipped with a fully green suite while an empty, definitely-positioned
`.compare-portal` stole grid row 1 from auto-placement and pushed the centre and
right columns into an implicit row 2. jsdom performs no layout, so `npm test`
**structurally cannot** catch this class of bug; a reviewer found it only by
starting the dev server and reading `getBoundingClientRect()`. Had the plan's
browser pass stayed at the end, it would have sat undetected through two more
tasks.

**So: a task that writes grid or flex placement gets a browser check inside that
task**, not deferred to the plan's browser pass. The same applies to anything
whose correctness is a rendered geometry rather than a value.

**Blocker resolved (Plan 5).** The board *can* now be driven by automation.
`react-chessboard` still only handles drops, but the keyboard layer added in
Plan 5 is our own DOM: dispatching `keydown` on the `role="application"` wrapper
plays real moves. Two behaviours this project had never once observed were
watched working on 2026-08-10 — answering a checkpoint, and the wrong-answer
path. The third, **segment-level board orientation after "Next part"**, is still
unobserved.

Everything else is reachable: candidate-rail rows are real buttons that play
moves, and `localStorage` can be seeded and corrupted from the console.

**Environment limit worth knowing before you plan a browser check:** the browser
window cannot be resized here — confirmed independently by four agents.
`resize_window` reports success without moving the viewport; `window.resizeTo()`,
an OS restore-down keystroke and CSS `zoom` all fail, and no CDP device-metrics
tool is exposed. Media-query *declarations* can be exercised by injecting a
stylesheet under `@media all`; the *trigger* cannot. Do not spend a session
rediscovering this.

### 7. Warnings treated as background noise

Ten React `act()` warnings entered in Plan 3 and survived all of Plan 4's six
tasks. Each task dutifully confirmed "the count did not grow" — which is how a
warning becomes permanent.

The fix was **two `act()` wraps**, and the idiom already existed in the repo.

**Countermeasure — in `CLAUDE.md`:** record the warning count as a number in the
task report, and treat any non-zero count as a finding with an owner, not a
baseline to preserve.

### 8. A check that cannot tell its subject from a look-alike

**Ten occurrences on Plan 6 alone**, and it is the shape underneath most of
§2. A test, fixture or scan is written *about* the right rule and placed
somewhere that rule cannot be the thing producing the outcome. It passes, it
reads as coverage, and it is blind.

The last two are the ones worth dwelling on, because they are in the
**verification tooling** rather than in the app. Once you are hunting this
shape, the checks you write to hunt it have it too.

| The check | What it could not distinguish |
|---|---|
| Coverage fixtures all using `startFen: null` | side derived from the position vs. from index parity — a naive `moveIndex % 2` passed all 18 |
| Tip-of-line test stepping back to the **root** | the tip-of-line guard vs. the side-to-move guard — the player is White, so the root is blocked by both |
| Four keystrokes in one `act()` | four keystrokes vs. one — React never re-renders between them, so every handler after the first reads a stale closure |
| `MoveFeedback` inferring "correct" from a transition | answering vs. navigating backwards — both change the node *and* the pending checkpoint id |
| `MoveFeedback` unit tests driving the store directly | a store that is written vs. one nothing ever writes — commenting out both `noteAcceptance` calls left all 467 tests green |
| A regex over SANs and squares | a hint naming its move vs. a hint naming it **in English** — "the pawn in front of your king steps one square" is `e3` |
| A test whose fixture gained a checkpoint | the assertion still holding vs. its **premise** silently dissolving |
| A browser check for "Play the next move still present" | the button surviving for its own reason vs. the regression it was meant to catch |
| `section[aria-label="Candidate moves"]` as "the engine rail is visible" | the rail showing vs. hidden — `CheckpointPanel` reuses the same landmark, so the count is 1 either way |
| `npm test 2>&1 > file` to count warnings | zero warnings vs. **stderr never captured** — the redirects are in the wrong order, so the first "0 warnings" of the branch was worthless |

**Countermeasure — write the broken version and watch the check notice.** A
mutation check is not "did something fail" but "did *this* check fail, for
*this* reason, cleanly". Two corollaries, both paid for:

- **A failure caused by an exception is not evidence.** A later `try/catch`
  silences it. Require a clean assertion mismatch.
- **Confirm the mutation actually landed.** A regex that matches nothing looks
  exactly like a guard that works — the controller nearly reported a defect
  that did not exist this way. Assert the edited text differs before trusting a
  green run.

Placement is the other half: put the check where **only** the rule under test
can produce the outcome. The tip-of-line test works at the node after `e4` and
nowhere else in that line.

### 9. Content claims that are true-sounding and false

**Nine on Plan 6**, all in authored prose, none catchable by any test that
exists. `validateLessonChess` proves a move is legal; nothing proves a sentence
about the board is true.

The worst: a London hint said h7 was "guarded by nothing except the king". The
f6 knight also defends it — which is *precisely* why every h7 sacrifice in that
system begins by removing that knight. A beginner would have learned the
opposite of the truth, from a lesson that passed every gate.

Also found: "one piece has still never moved" when several had; several
attacker and defender counts off by one.

**Countermeasure — count it against the board, do not read it.** Any claim of
the form "X defends Y", "attacked N times", "nothing guards Z" gets replayed
through chess.js and counted, including empty squares. This is how all nine
were found, and how the review confirmed 13 of a 14-claim sample afterwards.

**This is unguarded by any committed test** — see [[Known Issues]]. A false
count still ships green today.

### 10. Repo state read once and reported as if it were still true

**Three instances, all on Plan 6**, and the third one shipped a blocker to
`master`. Every one is the same shape: a fact about the *repository* — branch
pushed, PR open, plan merged — established at one moment and then repeated later
as current, in a repo where more than one session is working at a time.

| Claim | What was actually true |
|---|---|
| `Start Here.md`: branch "**not pushed, not merged**", next action "push and open a PR" | Branch was pushed and PR #7 was open. Written by a session that had not pushed *yet* and never came back to the note |
| A background job's state: "Plan 6 merged, Plan 7 ready" | #7 was still open at the time |
| A session report: "**PR #7 is ready for review**" | #7 had been merged ~an hour earlier, mid-session, by another session. The two fixes just written were therefore *not* in the merge, and `master` carried a lesson-breaking dead-end until a second PR (#8) took it back out |

The third is the expensive one, and note what made it possible: the PR state
*was* checked, correctly, at the start of the session. It simply was not checked
again before being reported. Everything else in that report was verified by
running the app; the one unverified sentence was the one about the repository.

**Countermeasure — re-read PR and branch state immediately before claiming a
branch is finished, and treat the earlier reading as expired.** `gh pr view`
and `git fetch && git log --oneline origin/master..HEAD` cost one command each.
Specifically:

- **`--state open` is a filter, not a fact.** A PR missing from that list may be
  merged rather than absent; ask for `--state all` when the question is "does a
  PR exist for this work".
- **After pushing, confirm the commits are where you think.**
  `git merge-base --is-ancestor <sha> origin/master` answers "did this actually
  land" — a push to a branch whose PR already merged is silent and leaves no PR
  pointing at the work.
- **Concurrent sessions are the normal case here, not the exception** — see the
  banner in [[Start Here]]. Any statement of the form "nothing else has changed"
  is a guess unless a fetch backs it.

---

## What works — keep doing it

- **Escalating plan-mandated findings to the user.** Every time a reviewer said
  "the plan mandates this defect," putting it to the user produced the right
  call: the signed-zero mate bug, the weight clamp, the inverted fork lesson,
  the segment-orientation fix. None would have been fixed by a reviewer alone,
  and none should have been decided unilaterally.
- **The brief-plus-report file handoff.** Subagents get a brief path and a report
  path; nothing large is pasted into a prompt. This is what keeps a long session
  from drowning in its own context.
- **Model tiers.** Transcription-shaped tasks on the cheap tier, integration on
  standard, the final whole-branch review on the most capable. The final review
  earned its cost every time — it found the Critical in Plans 2, 3 and 4.
- **Asking implementers to report what they could *not* verify.** "Browser
  verification not performed" and "I could not confirm this claim" are the two
  most valuable sentences a subagent has produced here.
- **The ledger.** Long plans survive compaction only because progress is a file.

## What to try next

- ~~Run the browser check before the final review~~ — **tried in Plan 5, and it
  half-worked.** It caught real defects the final reviewer could then weigh, but
  a layout bug still reached the end of the plan because end-of-plan is too late
  for geometry. The refinement is in §6: layout gets checked inside the task
  that writes it.
- **A content spike task for any plan that authors chess**, mirroring Plan 1's
  engine-depth spike: derive every FEN and engine-check every taught move up
  front, in one task, before any prose is written. Six of the seven §1 errors
  would have surfaced there.
