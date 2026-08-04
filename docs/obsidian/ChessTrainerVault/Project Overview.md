---
updated: 2026-08-04
status: current
tags: [chesstrainer, overview]
---

# Project Overview

A browser-based chess trainer for **players who already know how the pieces
move** but don't yet know why one move beats another. Not absolute beginners, not
advanced players — no "the knight moves in an L", and no deep theory or endgame
tablebases.

## The core idea

It is a **line explorer** first. From any position, Stockfish proposes its top
three candidate moves; the player branches into any of them, walks the resulting
line, and comes back to try a different one without losing the first. Lessons are
a **content layer over that same explorer** — a lesson is a curated path through
the same move tree with notes and checkpoints attached to its nodes.

That framing is the whole architectural bet: branching off a lesson to explore is
not an escape from the lesson. Same screen, same tree, same explanation
machinery. See [[Decisions/Game Tree As Source Of Truth]].

## Design goals, in priority order

1. **Fundamentals, then application.** Not rules in the abstract — why *this*
   move beats *that* one, in a position the player actually reached.
2. **Interactive and responsive.** Tactile buttons, sound on every meaningful
   action, feedback fast enough to feel like a conversation.
3. **Offload the thinking.** A real engine evaluates, in a Web Worker, so the UI
   never blocks.

## Success criteria

From the design spec, unchanged:

- A player steps through an opening, is asked to find a move, gets it wrong,
  receives a **specific** reply, and understands why the right move is right.
- A player takes any position, sees the top three moves, branches into two, and
  gets a comparison phrased in **ideas rather than centipawns**.
- Interacting with the app is physically satisfying.

The second one is the load-bearing one, and it is the part not yet built — see
[[Roadmap]].

## Guiding principles

- **Degrade, never blank.** Engine dead → annotations still work, with a banner
  and a retry. Sound files missing → silence, no errors. Corrupt localStorage →
  reset with a notice, never a white screen.
- **The engine supplies the magnitude, the rules supply the vocabulary.**
  Centipawn loss picks the severity band; authored or generated prose explains it
  in words. See [[Decisions/Hybrid Explanations]].
- **Don't teach false precision.** When two moves are within ~0.3, the verdict
  says *"practically equal — the real difference is character"*. Telling a
  beginner +0.31 beats +0.28 would teach them something untrue.

## Explicitly out of scope for v1

Each is a reasonable v2 with its own spec. None are "not yet got to" — they were
ruled out deliberately.

- Playing a full game against the engine
- Spaced repetition / mastery scoring
- Accounts, cloud sync, multi-device
- PGN repertoire import
- LLM-written explanations
- Phone-first layout

**Platform:** local web app, desktop-first, responsive to tablet. Phone is
best-effort.

## v1 content plan

Three openings, 8–10 full moves deep, plus four theme lessons anchored in
positions drawn from those same openings so the ideas reinforce each other.

| Openings | Theme lessons |
|---|---|
| Italian Game (White), with Scotch and Ruy Lopez as annotated alternatives | Control the centre |
| Black against 1.e4 — the 1…e5 defence, mirroring the Italian from the other side | Piece development and tempo |
| London System (White) — low-theory, playable against almost anything | Forks and pins |
| | Attacking the kingside |

None of this content exists yet. See [[Roadmap]].
