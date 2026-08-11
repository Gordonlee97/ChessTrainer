# Lesson Loop and Moves Table — Design

**Status:** approved 2026-08-11
**Extends:** `2026-08-01-chesstrainer-design.md` and
`2026-08-06-app-shell-and-keyboard-design.md`, both of which remain
authoritative for anything not restated here.

## 1. What this is

Two changes that together shift the app's centre of gravity.

**The base page becomes the explorer.** Lessons move out of the left rail and
into a dropdown in the header. You arrive at a board with candidate moves and
pick a lesson when you want one, rather than choosing from a list before
anything happens.

**Opening lessons become a move-by-move quiz.** Today a lesson narrates and
asks occasionally — the Italian Game has two checkpoints across seven moves,
and everything else advances by pressing "Play the next move". After this, the
player is asked for *every* move on their side, the opponent replies
automatically, and a wrong answer is rejected rather than played.

Alongside both, a **persistent moves table** replaces the breadcrumb — a
numbered list of the game so far that you can click into and step through. It
is app furniture, present in the explorer and in lessons alike, not a lesson
feature.

The work splits into two plans (§8). The lesson loop comes first.

## 2. The lesson loop

### Every player move is a quiz, and that needs no schema change

A quiz is already an optional `checkpoint` on a move
(`src/content/schema.ts`), and `deriveLessonState` already surfaces one when
the lesson's next move carries it. So "quiz every player move" is **content**:
every player-side move in the three opening lessons gains a checkpoint with a
prompt and hints.

That yields a clean rule for the opponent: **the opponent's moves are exactly
the ones with no checkpoint.**

### Auto-play

When the lesson's next move carries no checkpoint, the app plays it itself
after **700ms**, with the same move sound a drag makes. "Play the next move"
therefore disappears from opening lessons entirely.

The delay exists so the player sees their own move land before the reply
arrives. It is not an animation and is unaffected by `prefers-reduced-motion`.

**Auto-play fires only when the selected node is the tip of the line.** This is
load-bearing — see §5.

### A validation rule, so a missing checkpoint cannot pass silently

The auto-play rule means a forgotten checkpoint would make the app play *the
player's* move for them. The content loader gains a rule for lessons with
`kind: 'opening'`:

> Every move made by the player's side must carry a checkpoint.

**Whose turn it is comes from the position, not from index parity.** A segment
may declare a `startFen` where it is Black to move, and a segment may override
the lesson's `side`, so counting moves would be wrong in exactly the cases that
matter. Derive the side to move by replaying through chess.js, which the loader
already does.

### Answering

**A wrong move never reaches the game tree.** `resolveDrop` already returns a
boolean to `react-chessboard`, where `false` returns the piece to its square,
so the drag path needs no new mechanism; the keyboard path simply does not call
`playMove`. The tree stays the single source of truth for position and gains no
node for a rejected guess.

| Outcome | What happens |
|---|---|
| Correct | `correct` sound, a brief check mark over the board, then the opponent's reply after the auto-play delay |
| Near miss (authored `nearMiss` entry) | `incorrect` sound, the authored reply, "Try again", piece returns |
| Wrong | `incorrect` sound, "Try again", piece returns |
| Hint requested | `hint` sound, the next tier revealed |
| Segment finished | "Next part" as today |
| Lesson finished | `lessonComplete` sound and the completion message |

Under `prefers-reduced-motion` the check mark appears without animating and
stays until the next question replaces it, rather than fading. The project's
rule is that reduced motion still leaves a visible signal.

**These sounds are already declared** in `src/sound/sounds.ts` — `correct`,
`incorrect`, `hint`, `lessonComplete` all exist as names wired to the sound
manager. **No audio files are committed to this repo by design**, so they will
play nothing until files are added at `public/sounds/`. That is not a defect:
a missing sound must play nothing, log nothing, and never throw.

### Hints must not give the move away

Every checkpoint carries its own hints, revealed one tier at a time, and **no
hint names the move**. Hints point at the idea — what to look for, which square
matters, what the position needs — and stop short of the answer.

This conflicts with all eight checkpoints that exist today, each of which ends
by naming the move: `"Play e4."`, `"The bishop belongs on c4."`,
`"Castle kingside."`, `"Play Bf4."`, `"Play e5."`,
`"The bishop belongs on c5."`. Every final-tier hint in the three openings gets
rewritten, on top of authoring hints for the newly-quizzed moves.

### Notes get deeper

The left rail's explanation is the note attached to the move just played. Those
notes are currently one or two sentences; they become fuller prose explaining
*why* the move is right, since that panel is now the lesson's main reading
surface rather than a caption.

## 3. Layout

The shell from `2026-08-06-app-shell-and-keyboard-design.md` is unchanged in
structure: header, three columns, board column never moves.

| | Left rail | Centre | Right rail |
|---|---|---|---|
| Explorer | Saved lines | Board | Candidates, then the moves table |
| Lesson | Explanation: title, progress, the note for the move just played | Board | Quiz: prompt, hints, feedback — then the moves table |

- **Lessons move to a dropdown in the header**, beside the existing controls.
  `LessonPicker`'s progress display (`"1 of 3 checkpoints"`, `"Done"`) travels
  with it.
- **"Leave lesson" sits below the explanation box, not inside it.**
- The **candidate rail stays hidden for the whole lesson** — with every player
  move a quiz, engine suggestions would hand over every answer.
- **Progress** reads as the move number within the segment, e.g. "Move 3 of 7",
  counting the player's moves and the opponent's together.

## 4. The moves table

A numbered two-column table — move number, White's move, Black's move — built
by deriving from the game tree. It replaces `Breadcrumb.tsx`, which is deleted
rather than left duplicating the same information.

### What it lists

The path from the start to the selected move, **plus the continuation forward**
through moves already played. Stepping back does not hide what comes after;
that is what makes the arrows worth having.

The starting position is itself selectable — "first" reaches it, and it is a
row in the table, so a line can always be replayed from the beginning.

**It is linear. It never renders a branch.** When a node has more than one
child, the continuation follows **the child with the greatest
`lastSelectedAt`** — the one most recently visited. `TreeNode.lastSelectedAt`
already exists and is maintained by `select`, so this needs no new state, and
it behaves as expected: play a different move from an earlier position and the
table follows the new line.

The consequence, stated plainly: **the line you leave disappears from the
table.** That is the existing behaviour, not a regression — nothing in the UI
reads `childIds` today, so a branch is already unreachable once you navigate
away. This design does not fix that; showing variations was considered and
rejected as a much larger piece of work. It stays in `Known Issues.md`.

### Controls

First, previous, next, last — the top row of controls in a lichess panel.
Clicking any move in the list selects that node and the board rebuilds, which
is `selectNode`, already working today via the breadcrumb.

**Arrow keys are resolved by focus.** Left and Right move the board cursor when
the board has focus, and walk the move list when the table has focus. Left and
Right cannot be taken globally without breaking the keyboard board navigation
added in the previous plan. The on-screen controls are the primary affordance.

## 5. The interaction that will break if nobody states it

Lesson state is derived from the path to the *selected* node. So selecting an
earlier move makes the lesson believe the player is at an earlier ply — and
with auto-play running, looking back would drag the player forward again
immediately.

**Auto-play fires only when the selected node is the tip of the line.** Step
back to review and nothing moves. Move forward again, or click the last move,
and the lesson resumes.

**This belongs to plan 1, not plan 2.** The moves table is not what introduces
backward navigation — `Breadcrumb` already does it, and it survives until plan
2 deletes it. Auto-play and backward navigation therefore coexist from the
moment plan 1 lands, and without this rule the lesson would fight the player
the first time they clicked a breadcrumb chip.

This is the single most likely defect in the whole design, and it spans two
components that each look correct alone — the shape of failure this project has
recorded six times. It gets its own tests, and the plan names it as a shared
surface.

## 6. What stays as it is

**Theme lessons are unchanged.** The four theme lessons keep occasional
checkpoints and keep "Play the next move". They draw positions from different
games and several of their moves exist to *show* an idea rather than to be
guessed, so quizzing every move would mean asking questions the lesson has not
taught the answer to. The button therefore disappears from openings and
survives in themes.

Saved lines keep their existing guard: opening one stops a running lesson, and
they remain absent from the left rail while a lesson runs.

## 7. Testing

- `deriveLessonState` and grading are pure and already covered; the new
  validation rule (every player-side move in an opening carries a checkpoint)
  is a loader test with a deliberately-invalid fixture.
- The **moves table is derived state** — pairing a path into numbered rows,
  choosing the continuation child — and is unit-testable without rendering.
- Auto-play, snap-back, and the tip-of-line rule get component tests. Snap-back
  asserts the tree is **unchanged**, not merely that a message appeared.
- **Mutation-check the tip-of-line test and the snap-back test.** Both guard
  named defects. Confirm each fails with a clean assertion mismatch rather than
  an exception; a failure caused by a throw is not evidence.
- Test output stays pristine; the warning count is reported as a number and is
  currently zero.
- A browser pass covers the feel: the auto-play delay, the check mark, and
  whether stepping back mid-lesson behaves. None of that is visible to jsdom.

## 8. Plans

Two plans, built in this order.

1. **The lesson loop.** The dropdown, quiz-every-move, snap-back, feedback,
   auto-play, **the tip-of-line rule** (§5), the validation rule, and the
   content rewrite. The content is the long pole and nothing else blocks on it.
2. **The moves table.** The table, its controls, breadcrumb removal, and the
   focus-based arrow-key split.

Plan 1 keeps auto-play in one place rather than spreading the decision across
components, so plan 2 inherits the tip-of-line rule instead of re-deriving it.

## 9. Out of scope

- Variations in the moves table. Branches remain unreachable once left.
- Reworking the four theme lessons.
- Committing audio files. The sounds are named and wired; the files are not
  this project's to ship.
- Any change to `src/engine/`.
- Spaced repetition, scoring, streaks, or any other Duolingo mechanic beyond
  the immediate right/wrong feedback described in §2.

## 10. Open risk

The content rewrite is the largest part of this work and the least verifiable
by tests. `validateLessonChess` proves a move is legal, never that a hint is
useful or that a note explains anything. Two rules from `Lessons.md` apply
directly: never hand-write a FEN, and for any position where a move is taught
as *the answer*, confirm it with the vendored engine rather than reasoning
about it. A lesson has already shipped teaching the losing side of a known
trap.
