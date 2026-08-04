---
updated: 2026-08-04
status: current
tags: [chesstrainer, decision, engine]
---

# Decision: the engine serializes its own searches

**Date:** 2026-08-02 → 2026-08-03 (six revisions)
**Where:** `src/engine/engine.ts`

## Context

Stockfish over UCI is a single stateful stream. Ask it to search, and it streams
`info` lines until it emits exactly one `bestmove`. Tell it to `stop`, and it
*still* emits a `bestmove` — for the search you just cancelled.

The app navigates constantly. Every breadcrumb click, every candidate click,
every drag supersedes an in-flight search. So the cancelled-search `bestmove`
arrives in the middle of the next search's lifetime, and something has to account
for it.

The original plan said "callers are expected to abort the previous search" and
enforced nothing.

## Decision

**`Engine` serializes internally.** A new `analyze()` aborts the previous search
and waits for its `bestmove` to drain before issuing its own. Callers do not need
to sequence anything.

A superseded search **stays subscribed** so its stale `bestmove` is consumed
rather than resolving the next search. The next search queues behind a `drain`
promise. An `owedBestmoves` swallow counter tracks results still expected, with a
bounded lifetime so an unreconciled increment expires rather than poisoning the
instance. A grace timer escalates a search that never settles to `onError`, which
surfaces in the UI as "Engine unavailable" with a Retry button.

## Why it took six revisions

Each of the first three fixes traded one bug for another. This is recorded
because the failure modes are non-obvious and a future "simplification" will
reintroduce them.

| Revision | What broke |
|---|---|
| 1 | Original. A stopped search's stale `bestmove` resolved the **next** search with an empty result — an intermittently blank candidate rail. |
| 2 | Drain protocol added. Worked. |
| 3 | Timeout added; `fail()` nulled the drain, bypassing it and re-opening the race. |
| 4 | Timeouts routed through the stay-subscribed path — but a timed-out search then held the drain open with no timer, so queued searches never armed one. **Permanent wedge.** |
| 5 | Grace timer + `onError` escalation. Still open via the **abort/supersede** path — which is the path taken on *every node change*. Failed silently to "Thinking…" forever, with no Retry. |
| 6 | Swallow counter, letting the grace timer arm on every started settle safely. Closes the deadlock, the late-`bestmove`-after-grace race, and stale-timer clobbering with one mechanism. |

Revision 5 is the instructive one: the bug lived on the *most common* code path
and still survived four rounds of review, because it presented as the UI simply
being slow.

## Alternatives rejected

- **Caller-side sequencing** (the original plan). Every call site would have to
  get it right, and one that didn't would produce a bug indistinguishable from
  engine slowness.
- **One worker per search.** Spawning a Stockfish instance per analysis avoids
  the protocol entirely, but each carries a 7.3 MB WASM load. Not viable at
  navigation speed.
- **Ignoring unexpected `bestmove` lines.** Cannot distinguish "stale result" from
  "the result I am waiting for" without the bookkeeping this decision adds.

## What this makes harder

- **The engine is now stateful and its states are not obvious.** Reading
  `analyze()` alone will not tell you what happens on supersede; the drain,
  the counter, and the timer have to be understood together.
- Any change to the transport must preserve the guarantee that a stopped search
  still emits exactly one `bestmove`.
- Testing requires a fake transport that can be told to answer late, or never.

## Rule

**Read the comments in `src/engine/engine.ts` before touching it, and be
suspicious of any change that simplifies the drain protocol.** Every mechanism
in there is load-bearing and has a specific bug behind it.

Related: [[Architecture]], [[Known Issues]].
