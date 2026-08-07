---
updated: 2026-08-06
status: current
tags: [chesstrainer, process]
---

# Workflow

How work actually gets done on this project. Plan 1's 43 commits were produced
this way; following it is what makes the vault and the plans stay coherent.

## The cycle

```
brainstorm  →  spec  →  plan  →  implement task-by-task  →  review  →  finish branch
```

**Do not skip straight to code on anything larger than a bug fix.** The design
spec and Plan 1 both exist because writing them surfaced problems that would
otherwise have been found in review or in production — the plan for Plan 1
contained several bugs that were caught while reading it, before any code
existed.

### 1. Brainstorm

Open questions get settled with the user *before* a spec is written. Decisions
that are expensive to reverse — schema, public API, the shape of the data
model — are asked about, not assumed.

### 2. Spec

Lands in `docs/superpowers/specs/`. Records what is being built, the decisions
taken and why, and **an explicit out-of-scope list**. The out-of-scope list is
load-bearing: it is what stops scope creep later being mistaken for an oversight.

The current spec is `2026-08-01-chesstrainer-design.md`, approved and still
authoritative — with one known drift, tracked in [[Known Issues]].

### 3. Plan

Lands in `docs/superpowers/plans/`. Broken into numbered tasks, each small enough
to implement and review independently, with a **Global Constraints** section that
binds every task.

Plan 1 carried complete code in every step. That is not required, but the plan
must be specific enough that a task can be implemented without re-deciding
anything.

If a load-bearing assumption is uncertain, the plan gets a **spike task first**
that measures it and records the result — as Plan 1 did for engine depth, in
`spike-results.md`.

**Read [[Lessons]] before writing a plan.** Most of the failures recorded there
were introduced by a plan, not by an implementer, so planning time is when
reading it pays. Four rules come straight out of it:

- **Existing files get a description of the change, not a pasted replacement.**
  Name the invariants that must survive and tell the implementer to read the
  file in full and report divergence. Five plan snippets have been written
  against file shapes that had moved.
- **Never hand-write a FEN**, and for any position where a plan declares a move
  to be *the answer*, engine-check it. Legality is not correctness — a lesson
  once shipped teaching the losing side of a known trap.
- **Name the shared surfaces.** When two tasks touch the same component, store or
  lifecycle, say so in both briefs. Every cross-task defect this project has had
  was two tasks that each satisfied their own brief and did not agree with each
  other.
- **A plan that authors chess should spike the chess first** — derive every FEN
  and engine-check every taught move in one task, before any prose is written.

### 4. Implement, task by task

One task at a time. TDD where the plan says so. Each task ends with a commit, the
full suite green, and pristine test output.

**Warnings in test output are findings, not noise** — and the count is a number
you report, not a baseline you preserve. Ten `act()` warnings survived six tasks
because each one only checked the count had not *grown*.

**Mutation-check any test written to guard a named defect.** Break the
implementation, watch the test fail for the right reason, restore it, and report
what you saw. Six tests here have passed against a broken implementation; one of
them actively locked the defect in.

### 5. Review each task, then the whole branch

Reviews are done against the diff, by someone who did not write it, and who does
**not** trust the implementer's report — a stated rationale ("left it per YAGNI",
"kept it simple deliberately") never downgrades a finding. Several of Plan 1's
worst bugs were found by reviewers who built runtime probes outside the repo to
test a claim empirically rather than reading and agreeing.

Findings are categorised Critical / Important / Minor. Important means the task
cannot be trusted until it is fixed.

**A reviewer of chess content re-derives the chess; it does not re-read it.**
Four of this project's seven legal-but-wrong moves were caught that way, and the
one that got through to the final review was confirmed correct by a task review
that reasoned about the move without checking whether it actually won.

**Point the final review at the seams**, not at "look for problems." A whole-
branch review's unique value is the question a task reviewer cannot ask: *do
tasks N and M agree about X?* Every cross-task defect here was found that way.

**When a finding is plan-mandated, it is the user's call.** Do not dismiss it
because the plan says so, and do not quietly fix against the plan. Putting it to
the user has produced the right answer every time — the signed-zero mate bug,
the weight clamp, the inverted fork lesson.

### 6. Finish the branch

**Run the browser check before the final whole-branch review, not after.** Every
plan with a UI has shipped defects past a green suite — four past 223 tests,
three lessons half-unreachable past 318. Running it first means the final
reviewer triages real findings instead of a list it cannot see evidence for.

Note the standing blocker: **anything requiring a piece to move on the board
cannot be automated.** `react-chessboard` only handles drops. Candidate-rail rows
are real buttons and `localStorage` can be seeded or corrupted from the console,
so most of the app is reachable — but checkpoint answers are hand-only until
keyboard board navigation lands.

Then verify the suite on the tree being integrated, confirm the base branch, and
let the user choose: merge locally, open a PR, or leave it. **The integration
decision is the user's**, always.

## The Superpowers skills

This project's process comes from the Superpowers plugin. If it is installed, use
the skills directly:

| Stage | Skill |
|---|---|
| Brainstorm | `superpowers:brainstorming` |
| Plan | `superpowers:writing-plans` |
| Implement | `superpowers:subagent-driven-development` |
| Review | `superpowers:requesting-code-review` |
| Finish | `superpowers:finishing-a-development-branch` |

If it is not installed, follow the cycle above by hand — the sequence matters
more than the tooling.

## Conventions

**Branches:** `feat/<plan-slug>`, e.g. `feat/foundation-and-line-explorer`. One
branch per plan.

**Commits:** conventional commits, scope optional.

```
feat: add UCI engine wrapper with MultiPV parsing and abort support
fix(engine): bound a timed-out search's drain and notify onError
fix(ui): handle the -0/+0 mate blind spot in formatScore
test: add isolated pinned and authored node eviction protection tests
docs: clarify mobility JSDoc to match chess.js 1.4.0 behavior
chore: scaffold Vite + React + TS + Vitest with core purity guard
```

Prefixes in use: `feat` `fix` `test` `docs` `chore`. Subject in the imperative,
lowercase after the colon. The body explains *why*, not what the diff already
shows.

**Before reporting any work complete:** `npm test` and `npm run typecheck`.

## Session continuity

Plan 1 used a ledger at `.superpowers/sdd/progress.md` to carry state between
sessions. **That path is gitignored and does not travel with the repo** — it is
local to one machine.

The durable equivalent is this vault, and specifically [[Start Here]] and
[[Current State]]. Anything a future session needs to know goes there, not into
a gitignored working file.

Related: [[Start Here]], [[Roadmap]], [[Lessons]].
