---
updated: 2026-08-04
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

### 4. Implement, task by task

One task at a time. TDD where the plan says so. Each task ends with a commit, the
full suite green, and pristine test output.

**Warnings in test output are findings, not noise.**

### 5. Review each task, then the whole branch

Reviews are done against the diff, by someone who did not write it, and who does
**not** trust the implementer's report — a stated rationale ("left it per YAGNI",
"kept it simple deliberately") never downgrades a finding. Several of Plan 1's
worst bugs were found by reviewers who built runtime probes outside the repo to
test a claim empirically rather than reading and agreeing.

Findings are categorised Critical / Important / Minor. Important means the task
cannot be trusted until it is fixed.

### 6. Finish the branch

Verify the suite on the tree being integrated, confirm the base branch, then let
the user choose: merge locally, open a PR, or leave it. **The integration
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

Related: [[Start Here]], [[Roadmap]].
