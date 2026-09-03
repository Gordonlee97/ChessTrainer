# CLAUDE.md — ChessTrainer

Project-specific instructions. These sit under the global working rules in
`~/.claude/CLAUDE.md`; where they conflict, the global rules win.

## Read this before doing anything

**Open `docs/obsidian/ChessTrainerVault/Start Here.md` at the beginning of every
session, before you plan, explore the codebase, or answer questions about the
project's state.**

It is the handoff note: the current repo state, the next action, and what to
update before you finish. This file tells you the project's *rules*; that note
tells you where the project actually *is*, and it is the one thing that cannot be
reconstructed by reading the code.

From there, `Workflow.md` covers how work gets done here — the process, the
review bar, and the branch and commit conventions. Follow it rather than
improvising a process.

**Before writing a plan, read `Lessons.md`.** It is the ledger of mistakes this
project has already made more than once, and the countermeasures now in force.
Most of them were introduced *by a plan*, not by an implementer — so reading it
at planning time is where it pays.

Then update the vault as you go, per the rules below.

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
| `Start Here.md` | **The handoff note.** Repo state, the next action, what to update before finishing. Read first, update last. | Every session |
| `Home.md` | Map of content. Entry point, links to everything else. | Rare |
| `Project Overview.md` | What ChessTrainer is, who it's for, the goals, what's out of scope. | Rare |
| `Workflow.md` | The process: brainstorm → spec → plan → implement → review → finish. Branch and commit conventions. | Rare |
| `Current State.md` | What works *today*, what is half-built, what is stubbed. The single most important note. | Every session that changes behaviour |
| `Roadmap.md` | What's next and why, in priority order. Plans that are done, in flight, and not yet written. | Whenever priorities move |
| `Architecture.md` | The layers, how data flows, and the invariants that must not break. | When structure changes |
| `Known Issues.md` | Bugs, leaks, dead code, and deferred cleanup. Each with severity and whether it blocks anything. | When found or fixed |
| `Lessons.md` | **The learning loop.** Mistakes made more than once, with counts and the countermeasure now in force. Read before writing a plan. | When something recurs |
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
- **The same kind of mistake happened twice** → `Lessons.md`, with the count and
  a countermeasure written somewhere binding. Once is bad luck; twice is a
  process gap, and a lesson recorded only in prose gets re-learned. If you find
  yourself writing "as happened before" anywhere, that is the trigger.
- **A session ended having changed nothing** → change nothing. An empty update
  is noise.

**Always, before you report a session's work complete:** update `Start Here.md`.
Its repo-state table and its "Do this next" section must describe reality as you
are leaving it, not as you found it. A stale handoff note is worse than none,
because the next session will believe it.

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
- **Sound is synthesised, not loaded.** No audio files are committed and none
  ever will be — `src/sound/synth.ts` builds every sound from oscillators and
  noise at runtime, which is why there is nothing to license and nothing to
  fetch. Tune a sound by editing numbers in `RECIPES`.
- **Sound is optional by construction.** No Web Audio, a context the browser
  refuses to open, a scheduling failure — each one must leave the app fully
  usable and silent. It must play nothing, log nothing, and never throw.
- **Stockfish is GPL-3.0** and vendored at `public/engine/`. It stays a
  devDependency and is never imported by application code. See
  `public/engine/README.md` before changing anything there.

## Commands

The scripts are in `package.json`; they are the standard Vite and Vitest
invocations and nothing here overrides them.

Run `npm test` and `npm run typecheck` before reporting work complete. The suite
has one expected skip — `src/engine/engine.smoke.test.ts` needs a real `Worker`,
which jsdom lacks.

## Testing expectations

- TDD where the plan calls for it; tests verify behaviour, not mocks.
- **Mutation-check any test written to guard a named defect.** Break the
  implementation deliberately, confirm the test fails *for the right reason*,
  restore, confirm it passes, and report what you saw. Six tests here have
  passed against a broken implementation — including one that locked the defect
  in. A test whose failure you have not witnessed is a guess.
- **Test output must be pristine, and the warning count is a number you report.**
  Ten `act()` warnings survived six tasks because each one only checked that the
  count had not *grown*. Zero is the target; a non-zero count is a finding with
  an owner.
- The engine and the tree are the two places where a missing test has
  historically cost the most. Anything touching search lifecycle, stale-result
  guarding, or node identity needs a test that fails without the fix.

## Rules paid for in blood

Each of these exists because it went wrong more than once. `Lessons.md` has the
evidence and the counts.

- **Never hand-write a FEN.** Derive it by replaying moves through chess.js in a
  scratch script and paste the result.
- **Legality is not correctness.** `validateLessonChess` proves a move is legal,
  never that it is good. For any position where a move is taught as *the answer*,
  run the vendored engine at `public/engine/` and confirm it. A lesson once
  shipped teaching the losing side of a known trap, and it passed both the
  validator and a task review.
- **Grep, don't recall.** Before writing prose or a plan step that depends on how
  a library or a repo mechanism behaves, read it or run it. Assumed shapes have
  produced an inert function parameter and a purity guard that would have
  rejected the next store.
- **Plans describe changes to existing files; they paste full code only for new
  ones.** Five snippets have been written against file shapes that had moved,
  one of which would have broken the rules of hooks if followed literally.
- **Drag-and-drop cannot be automated; the rest of the board can.**
  `react-chessboard` only handles drops, and synthetic drags do not reach it —
  so dragging a piece is verified by hand or not at all. Everything else is
  drivable: the keyboard layer in `Board.tsx` (focus the `role="application"`
  wrapper, arrow keys, Enter to pick up and place) plays real moves, and so does
  clicking a piece and then a destination.
