# CLAUDE.md — ChessTrainer

Project-specific instructions. These sit under the global working rules in
`~/.claude/CLAUDE.md`; where they conflict, the global rules win.

## What this project is

A browser-based chess trainer for new and improving players, built around a
**line explorer**: from any position, Stockfish proposes candidate moves, and
the player branches into each one, walks the resulting lines, and compares them.
Beginner lessons — basic openings, controlling the centre, forks and pins,
kingside attacks — sit on top of that explorer as a content layer.

Three goals, in the order they drive decisions:

1. **Fundamentals, then application.** Not "how does a knight move," but why
   this move beats that one in a position the player actually reached.
2. **Interactive and responsive.** Tactile buttons, sound on every meaningful
   action, feedback fast enough to feel conversational.
3. **Offload the thinking.** A real engine evaluates, in a Web Worker, so the
   UI never blocks.

Explicitly out of scope: playing against the engine, spaced repetition,
accounts, PGN import, LLM-generated explanations, phone-first layouts.

## Working memory: the Obsidian vault

`docs/obsidian/ChessTrainerVault/` is this project's working memory. It exists so
a human can open it, skim for ten minutes, and understand what the project does,
what state it is in, what is missing, and what happens next — without reading
the code or the git log.

**You are responsible for keeping it current.** It is not documentation written
once at the end; it is the running state of the project, and a stale vault is
worse than no vault because it is believed.

### Vault structure

| Note | Holds | Churn |
|---|---|---|
| `Home.md` | Map of content. Entry point, links to everything else. | Rare |
| `Project Overview.md` | What ChessTrainer is, who it's for, the goals, what's out of scope. | Rare |
| `Current State.md` | What works *today*, what is half-built, what is stubbed. The single most important note. | Every session that changes behaviour |
| `Roadmap.md` | What's next and why, in priority order. Plans that are done, in flight, and not yet written. | Whenever priorities move |
| `Architecture.md` | The layers, how data flows, and the invariants that must not break. | When structure changes |
| `Known Issues.md` | Bugs, leaks, dead code, and deferred cleanup. Each with severity and whether it blocks anything. | When found or fixed |
| `Glossary.md` | Chess and project vocabulary — PV, MultiPV, UCI, centipawn, node, line, candidate. | Rare |
| `Decisions/` | One note per architectural decision: context, the choice, alternatives rejected, what it makes harder. | One per decision |

### Conventions

Every note starts with YAML frontmatter so both humans and tools can read it:

```yaml
---
updated: 2026-08-04
status: current | stale | draft
tags: [chesstrainer, architecture]
---
```

- Link between notes with `[[wikilinks]]` — that graph is most of the vault's
  value. Link liberally; a link to a note that doesn't exist yet is a valid
  marker that it should.
- Write **absolute dates**, never "last week" or "recently."
- Reference code as `` `src/engine/engine.ts` `` — path, and a symbol name if it
  helps. Do not paste code blocks longer than a few lines; the code is the
  source of truth for code, and a pasted copy goes stale silently.
- State uncertainty as uncertainty. "Unverified" and "assumed" are useful words
  here.
- Prefer prose and tables a human will actually read over deeply nested bullets.

### When to update

Update the vault **as part of the work, before you report the work as done** —
not as a separate task the user has to ask for.

Triggers:

- **Behaviour changed** (a feature landed, was removed, or now works
  differently) → `Current State.md`, and `Architecture.md` if the structure moved.
- **A decision was made** with consequences beyond the current change → a new
  note in `Decisions/`, linked from `Architecture.md`.
- **A bug, leak, or piece of dead code was found** — including one you chose not
  to fix → `Known Issues.md`, with severity and what it blocks.
- **An issue was fixed** → remove it from `Known Issues.md`; don't leave a
  tombstone.
- **Priorities moved, or a plan was finished or written** → `Roadmap.md`.
- **A session ended having changed nothing** → change nothing. An empty update
  is noise.

Bump `updated:` on every note you touch, and only on notes you touch.

### What does not go in the vault

- Anything git already records: commit history, who changed what, when a file
  was added.
- Anything the code already states plainly. Describe *why* and *what state we're
  in*, not what a reader can see in the function.
- Full plans and specs. Those live in `docs/superpowers/`; the vault **links**
  to them.
- Secrets, tokens, or absolute paths from a local machine.

## Engineering rules for this codebase

Non-obvious constraints. Breaking any of these will pass review and fail in
production.

- **The core is React-free.** `src/chess/`, `src/engine/`, and `src/tree/` must
  not import React. `src/test/purity.test.ts` enforces this and will fail the
  build. `src/tree/store.ts` is the single exempted file.
- **The game tree is the source of truth.** Every position in a session is a
  node; navigating selects one, exploring inserts one. Do not add a parallel
  source of position state.
- **One search, three lines.** Candidates come from a single `MultiPV=3` search,
  never from three separate ones.
- **The engine serializes its own searches.** A superseded search stays
  subscribed so its stale `bestmove` is consumed rather than resolving the next
  one. This is the most delicate code in the repo — six revisions, each of the
  first three trading one bug for another. Read the comments in
  `src/engine/engine.ts` before touching it, and be suspicious of any change
  that "simplifies" the drain protocol.
- **Evaluations are White-relative** above the UCI layer. UCI reports
  side-to-move-relative; normalization happens once, at the boundary.
- **Press feedback uses `box-shadow`, never a box-model property.** Collapsing a
  border or padding on `:active` reflows the page on every click.
- **`prefers-reduced-motion` is honoured everywhere**, and it must still leave a
  visible press signal — the spec calls this out explicitly.
- **Sound is optional by construction.** No audio files are committed. A missing
  or unloadable sound must play nothing and log nothing, and never throw.
- **Stockfish is GPL-3.0** and vendored at `public/engine/`. It stays a
  devDependency and is never imported by application code. See
  `public/engine/README.md` before changing anything there.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check project references, then production build |
| `npm test` | Vitest, single run |
| `npm run typecheck` | `tsc --noEmit` |

Run `npm test` and `npm run typecheck` before reporting work complete. The suite
has one expected skip — `src/engine/engine.smoke.test.ts` needs a real `Worker`,
which jsdom lacks.

## Testing expectations

- TDD where the plan calls for it; tests verify behaviour, not mocks.
- Test output must be pristine. Warnings are findings.
- The engine and the tree are the two places where a missing test has
  historically cost the most. Anything touching search lifecycle, stale-result
  guarding, or node identity needs a test that fails without the fix.
