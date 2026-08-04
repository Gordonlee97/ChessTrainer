---
updated: 2026-08-04
status: current
tags: [chesstrainer, handoff]
---

# Start Here

**This is the handoff note.** Read it first; update it last. If you do one thing
in this vault before finishing a session, make it this note — everything else
can be reconstructed from the code, and this cannot.

## Repo state as of 2026-08-04

| | |
|---|---|
| Branch | `feat/foundation-and-line-explorer` |
| Base | `master` |
| PR | [#1](https://github.com/Gordonlee97/ChessTrainer/pull/1) — **open, unmerged** |
| Working tree | Clean |
| Suite | 138 passing, 1 skipped (expected — see below) |
| Last plan finished | Plan 1, foundation and line explorer, 2026-08-03 |

The one expected skip is `src/engine/engine.smoke.test.ts`, which needs a real
`Worker`. jsdom has none, so the engine is verified in a browser instead. A
second skip is a real failure.

## Do this next

**1. Merge PR #1 first.** Plan 2 branches off `master`, not off the Plan 1
branch. Stacking would put 43 unreviewed commits underneath new work.

```bash
gh pr merge 1 --merge          # --merge, not --squash: the commit-by-commit
                               # trail of the engine's six revisions is
                               # genuinely useful history
git checkout master && git pull
```

**2. Settle the two blockers in [[Known Issues]] before writing Plan 2.** Both
change what the plan should say:

- **Node identity and transpositions.** Ids are SAN paths, so the same position
  reached by a different move order duplicates. Lesson content and "My Lines"
  both key off node identity. Decide whether to widen it or to design Plan 2
  around the limitation — but decide before writing the plan, not during it.
- **The spec says React 18; the build is React 19.** Amend
  `docs/superpowers/specs/2026-08-01-chesstrainer-design.md` §3. Specs are what
  plans get written against, so this drift propagates if left.

**3. Write Plan 2.** Do not start writing `src/explain/` directly — see
[[Workflow]]. The ordering and the fixed constraints are in [[Roadmap]]; the
first item is pawn-structure feature extraction, because the explainer depends
on it.

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
