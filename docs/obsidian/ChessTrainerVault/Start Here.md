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
| Branch | `feat/teaching-layer` |
| Base | `master` (PR #1 merged 2026-08-04) |
| PR | Not yet opened for this branch |
| Working tree | Clean |
| Suite | 223 passing, 1 skipped (expected — see below) |
| Last plan finished | Plan 2, the explainer and compare, 2026-08-04 (nine tasks) |

The one expected skip is `src/engine/engine.smoke.test.ts`, which needs a real
`Worker`. jsdom has none, so the engine is verified in a browser instead. A
second skip is a real failure.

## Do this next

**1. Manually verify the compare drawer, then open a PR for `feat/teaching-layer`.**
Task 9 (the compare drawer) finished with the full suite, `tsc --noEmit`, and
`npm run build` all clean, but the agent that built it had no browser-automation
tool available and could not drive `npm run dev` by hand. Before calling Plan 2
done:

- Run `npm run dev`, open a position with 3 candidates, confirm the "Compare X
  and Y" button appears, the drawer opens with two mini-boards and a verdict,
  and two near-equal candidates show "practically equal."
- Confirm `prefers-reduced-motion` suppresses the drawer's entrance animation
  (DevTools → Rendering → emulate `prefers-reduced-motion: reduce`).
- Then `gh pr create` against `master`, following [[Workflow]].

**2. Consider fixing the mate-verdict formatting bug before Plan 3 touches the
same code.** `buildVerdict` in `src/explain/compare.ts` renders a decisive gap
as `(gap / 100).toFixed(2)` pawns; a mate-vs-non-mate comparison produces a
number like "998.00 better than" instead of naming the mate. It's cosmetic, not
a crash, and now user-visible via the compare drawer. Full detail in
[[Known Issues]].

**3. Write Plan 3 — the lesson layer.** Do not start writing `src/content/` or
`src/lesson/` directly — see [[Workflow]]. The ordering is in [[Roadmap]]: the
content pipeline (Zod schema, validating loader, v1 content) first, since the
lesson runner depends on it.

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
