---
updated: 2026-08-06
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

**Six occurrences.** Each one is a test that looked like coverage and was not.

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

**Countermeasure — in [[Workflow]] §4, and `CLAUDE.md`:**

**Mutation-check any test written to guard a named defect.** Break the
implementation deliberately, confirm the test fails *for the right reason*,
restore it, confirm it passes. Report what you observed.

This is cheap and it has never once failed to settle the question. It is how
the `startFen` fix was proven, how the segment-orientation test was proven, and
how the `act()` fix was proven. A test whose failure you have not seen is a
test you are guessing about.

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

**Four occurrences, every one invisible to task-scoped review and caught only by
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

### 6. Green tests, broken app

**Every plan that had a UI. Every single time.**

| Plan | Suite green at | What the browser found |
|---|---|---|
| 2 | 223 | Four user-visible defects, including a caption that contradicted the board beside it and a verdict that asserted a difference then stated none |
| 3 | 318 | Three lessons shipping half their content unreachable |
| 4 | 407 | Nothing new — the first clean pass |

**Countermeasure — in [[Workflow]] §5 and §6: run the browser check *before* the
final whole-branch review, not after.** In Plans 2 and 3 it ran afterwards,
which meant the final reviewer triaged a list it could not see the evidence for.
Running it first gives the reviewer real findings to weigh.

**Known blocker:** the board cannot be driven by automation. Neither a synthetic
drag nor a click reaches `react-chessboard` — it only handles drops, and a
pointer-event sequence froze the renderer. Anything requiring a piece to move is
currently hand-only. **Keyboard board navigation (Plan 5) fixes this and the
accessibility requirement in one change** — that is the strongest argument for
doing it next.

Everything else is reachable: candidate-rail rows are real buttons that play
moves, and `localStorage` can be seeded and corrupted from the console.

### 7. Warnings treated as background noise

Ten React `act()` warnings entered in Plan 3 and survived all of Plan 4's six
tasks. Each task dutifully confirmed "the count did not grow" — which is how a
warning becomes permanent.

The fix was **two `act()` wraps**, and the idiom already existed in the repo.

**Countermeasure — in `CLAUDE.md`:** record the warning count as a number in the
task report, and treat any non-zero count as a finding with an owner, not a
baseline to preserve.

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

- **Run the browser check before the final review** (see §6). Untested as an
  ordering; the reasoning is above.
- **A content spike task for any plan that authors chess**, mirroring Plan 1's
  engine-depth spike: derive every FEN and engine-check every taught move up
  front, in one task, before any prose is written. Six of the seven §1 errors
  would have surfaced there.
