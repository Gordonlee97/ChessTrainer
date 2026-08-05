---
updated: 2026-08-05
status: current
tags: [chesstrainer, handoff]
---

# Start Here

**This is the handoff note.** Read it first; update it last. If you do one thing
in this vault before finishing a session, make it this note — everything else
can be reconstructed from the code, and this cannot.

## Repo state as of 2026-08-05

| | |
|---|---|
| Branch | `feat/teaching-layer` |
| Base | `master` (PR #1 merged 2026-08-04) |
| PR | Not yet opened for this branch |
| Working tree | Clean |
| Suite | 246 passing, 1 skipped (expected — see below) |
| Last plan finished | Plan 2, the explainer and compare, 2026-08-04 (nine tasks) |
| Last change | Whole-branch review fix wave, 2026-08-05 (nine items) |

The one expected skip is `src/engine/engine.smoke.test.ts`, which needs a real
`Worker`. jsdom has none, so the engine is verified in a browser instead. A
second skip is a real failure.

Plan 2 **has** now been exercised in a browser. That testing found the explainer
and the compare verdict said roughly the same thing about every move; the
2026-08-05 fix wave addressed it. [[Current State]] has the before/after table.

## Do this next

**1. Open a PR for `feat/teaching-layer`.** Nothing is outstanding on the
branch: full suite, `tsc --noEmit`, and `npm run build` are all clean, and the
browser verification that was blocking Plan 2 is done. `gh pr create` against
`master`, following [[Workflow]].

One thing worth re-checking by hand first, because no test covers it: confirm
`prefers-reduced-motion` still suppresses the compare drawer's entrance
animation (DevTools → Rendering → emulate `prefers-reduced-motion: reduce`),
and that a press still gives a visible signal.

**2. Write Plan 3 — the lesson layer.** Do not start writing `src/content/` or
`src/lesson/` directly — see [[Workflow]]. The ordering is in [[Roadmap]]: the
content pipeline (Zod schema, validating loader, v1 content) first, since the
lesson runner depends on it.

Two questions [[Roadmap]] says to settle while writing it, both design decisions
rather than patches: how wide the comparison's contrast vocabulary should be
(today two strong openings usually score identically on every feature
`summarise` measures, so the honest verdict is "choose on feel"), and whether
the compare drawer is really a modal — it claims `role="dialog"` with no
`aria-modal`, focus trap, or Escape.

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
