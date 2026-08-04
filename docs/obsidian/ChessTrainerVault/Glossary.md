---
updated: 2026-08-04
status: current
tags: [chesstrainer, reference]
---

# Glossary

Chess and engine vocabulary as this project uses it. Where a term is ambiguous in
general use, the definition here is the one the code assumes.

## Engine terms

**UCI** — Universal Chess Interface. The plain-text protocol the app speaks to
Stockfish: send `position`, `go depth 20`; receive streaming `info` lines and a
final `bestmove`. Parsed in `src/engine/parseInfo.ts`.

**PV (principal variation)** — the sequence of moves the engine believes both
sides will play from a position. The candidate rail shows the first six plies of
each.

**MultiPV** — an engine setting asking for the top *N* variations from a single
search instead of just the best one. Set to 3 here. See
[[Decisions/Single MultiPV Search]].

**Centipawn (cp)** — one hundredth of a pawn, the standard unit of evaluation.
`+100` means "up a pawn's worth". Displayed to the player as pawns (`+1.0`),
never as raw centipawns.

**Mate score** — an evaluation expressed as "mate in N" rather than a centipawn
value. `mate: 3` means mate in three moves; a **negative** value means the side
being evaluated is getting mated. `mate: 0` is a real, distinct value and was
once a formatting bug.

**Depth** — how many plies ahead the engine searched. This project targets
**depth 20**, chosen by measurement (~975 ms at the start position).

**Ply** — a single move by one side. A "full move" is two plies. The spec's
openings are "8–10 full moves deep", meaning 16–20 plies.

**Side-to-move-relative vs White-relative** — UCI reports scores from the
perspective of whoever is to move, so `+50` means "good for Black" when it is
Black's turn. This app normalizes to **White-relative** at the UCI boundary. See
[[Decisions/White-Relative Evaluations]].

**`bestmove`** — the line Stockfish emits when a search ends, including when the
search was stopped early. Consuming these correctly is the whole difficulty of
[[Decisions/Engine Search Serialization]].

## Position terms

**FEN** — Forsyth–Edwards Notation. A one-line string encoding a complete
position. The tree stores one per node.

**SAN** — Standard Algebraic Notation: `Nf3`, `Bxc4`, `O-O`. Human-readable move
notation. Node ids are built from SAN paths.

**PGN** — Portable Game Notation, a full game or line with its moves. Saved lines
are stored as PGN rather than node paths, so they survive changes to the tree's
addressing scheme.

**Hanging** — a piece that is attacked and not defended. One of the extracted
position features. Note that the current implementation counts a **pinned
defender as a valid defender**, which is standard control semantics.

**Tempo** — a unit of time in the opening. A move that develops a piece *and*
makes a threat gains a tempo, because the opponent must respond.

**Transposition** — reaching the same position by a different move order.
Currently **not** deduplicated — see [[Known Issues]].

**Fork** — one piece attacking two or more enemy pieces at once.
**Pin** — a piece that cannot move without exposing a more valuable piece behind
it. Both are planned `ReasonTag` values for the explainer.

## Project terms

**Node** — one position in the game tree. Has a FEN, a parent, children, an
optional cached evaluation, and an origin of `authored` or `explored`.

**Line** — a path through the tree from the start position to some node. What the
player explores and what the breadcrumb displays.

**Candidate** — one of the three moves the engine proposes for the current
position, rendered as a row in the candidate rail.

**Checkpoint** — a point in a lesson where the player is asked to find the move
rather than watch it. Keyed by a stable authored `id`, never by position index.

**`nearMiss`** — a wrong-but-reasonable move at a checkpoint that has its own
authored reply, rather than a generic "wrong". Playing `Bb5` when the lesson
wants `Bc4` should say "that's the Ruy Lopez", not "incorrect".

**Authored vs explored** — a node's `origin`. Authored nodes come from lesson
content and are never evicted; explored nodes are the player's own branches and
are subject to the ~1000-node eval cap.

**Annotations-only mode** — the degraded state when the engine is unavailable.
Authored lesson content still works; live evaluation and off-book explanation do
not.
