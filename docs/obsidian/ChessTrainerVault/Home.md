---
updated: 2026-08-06
status: current
tags: [chesstrainer, index]
---

# ChessTrainer — Working Memory

This vault is the running state of the ChessTrainer project. It is maintained
alongside the code, not written up afterwards. If a note contradicts the code,
the code is right and the note is a bug — see [[Known Issues]].

**Picking up the work? → [[Start Here]].** Repo state, the next action, and what
to update before you finish.

**Just want to understand the project?** [[Project Overview]], then
[[Current State]]. About ten minutes.

## Map of content

| Note | Read it when you want to know |
|---|---|
| [[Start Here]] | Where things stand right now and what to do next — the handoff note |
| [[Project Overview]] | What ChessTrainer is, who it's for, what it deliberately isn't |
| [[Current State]] | What actually works today, and what's still scaffolding |
| [[Roadmap]] | What's next, in priority order, and why |
| [[Architecture]] | How the pieces fit and which invariants must not break |
| [[Workflow]] | How work gets done here: the cycle, the review bar, the conventions |
| [[Lessons]] | Mistakes made more than once, and the countermeasures now in force — read before writing a plan |
| [[Known Issues]] | Bugs, leaks, dead code, drift between spec and reality |
| [[Glossary]] | What "PV", "MultiPV", "centipawn", "node", and "line" mean here |

## Decisions

One note each, with the alternatives that were rejected and what the choice
makes harder later.

- [[Decisions/Game Tree As Source Of Truth]]
- [[Decisions/Engine Search Serialization]]
- [[Decisions/Single MultiPV Search]]
- [[Decisions/White-Relative Evaluations]]
- [[Decisions/Single-Threaded Stockfish Build]]
- [[Decisions/Hybrid Explanations]]
- [[Decisions/React 19 Upgrade]]

## Where the authoritative documents live

The vault summarises and links; it does not duplicate.

| Document | Path |
|---|---|
| Design spec (approved 2026-08-01) | `docs/superpowers/specs/2026-08-01-chesstrainer-design.md` |
| Plan 1 — foundation and line explorer | `docs/superpowers/plans/2026-08-01-foundation-and-line-explorer.md` |
| Engine depth spike results | `docs/superpowers/plans/spike-results.md` |
| Instructions for Claude | `CLAUDE.md` (repo root) |
| Stockfish provenance and licence | `public/engine/README.md` |

## Repository

<https://github.com/Gordonlee97/ChessTrainer> — public. Default branch `master`.
As of 2026-08-04 the Plan 1 work sits in PR #1 on branch
`feat/foundation-and-line-explorer`, not yet merged.
