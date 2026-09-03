---
updated: 2026-09-02
status: current
tags: [chesstrainer, state]
---

# Current State

**As of 2026-08-21.** Plans 1 through 7 are merged to `master`, plus a wave of
UI work driven by playing the app (PR #13, merged 2026-08-17) — see
[[Start Here]] for the session-by-session detail. The compare drawer's
contrast vocabulary (below) is complete in code on
`feat/compare-contrast-vocabulary`, **not yet merged, no PR opened**.

> Picking the work up rather than reading about it? [[Start Here]] has the repo
> state and the next action. This note is what *exists*; that one is what to *do*.

Suite: **591 passing, 1 skipped**, 57 test files, **zero warnings**.
`tsc --noEmit` clean. The skip is `src/engine/engine.smoke.test.ts`, which
needs a real `Worker`; jsdom has none, so the engine is verified in a browser.

## The compare drawer contrasts two lines on five fixed rows, not independent prose (2026-08-21)

The drawer used to describe each candidate line on its own — `summarise`
produced a pros/cons list per line from whichever features happened to differ
from the base position — so two strong moves routinely produced the *same*
list and the verdict fell back to "practically equal." `src/explain/contrastRows.ts`
replaces that with five fixed rows, always rendered, always in the same order:
Centre, Development, King safety, Tempo, Open or closed. Each row states both
lines' values side by side, marks disagreement on three independent channels
(a `data-differs` attribute, a visible "≠", and weight — never colour alone),
and carries a one-sentence gloss.

- **The footer now names *which* rows differ** — "One real difference:
  development." or, when nothing differs, "Practically equal — these do the
  same five things, equally well. Pick the one you would rather play." A mate
  in either line outranks the row-based footer entirely (`mateVerdict` in
  `src/explain/compare.ts` runs first).
- **The walked moves are shown**, numbered like a scoresheet
  (`formatMoveList` in `src/ui/CompareDrawer.tsx`), directly above each
  mini-board — fixing a comprehension gap the old drawer had: a board shown
  eight plies deep with no path to it. Handles a Black-to-move base position
  (`"2...Nc6"`) as well as White-to-move, regression-tested 2026-08-21.
- **Authored pros/cons now append to the five rows instead of replacing
  derived ones** — `compareLines`'s heuristic pros/cons are gone entirely;
  authored content, where a lesson supplies it, is the *only* source of
  prose now. `CandidateRail.tsx` and `CheckpointPanel.tsx`'s
  `authoredContrastFor` docstrings were corrected 2026-08-21 to stop
  describing a fallback that no longer exists.
- **Browser-verified 2026-08-21.** All five rows render once for the pair
  (measured via DOM query, not eyeballed: `.contrast-row` count is 5,
  `.contrast-rows` count is 1). A Scotch-reached trade (`1.e4 e5 2.Nf3 Nc6
  3.d4`, comparing `exd4` against `Nxd4`) moved Centre from "One central
  pawn"/"Closed" to "No central pawns"/"Opening up" on both sides, confirming
  the rows respond to the actual board rather than being static text; the two
  candidates measured identically on all five rows in that particular pair
  (both are captures), which the footer correctly called "Practically equal."
  The Italian's `Bc4` checkpoint still carries authored prose (`Bb5` vs `d4`,
  the two non-answer alternatives) alongside all five rows — see the layout
  note below.
- **Authored prose renders above the grid, not beneath it — a spec
  deviation.** §3.6 of the design spec says authored prose "stacks beneath
  the grid." What shipped instead puts each line's Pros/Cons inside its own
  `LinePanel`, which renders *before* the shared `ContrastRows` in the JSX —
  so visually and in DOM order, a lesson's prose sits above the five-row grid,
  not below it. Confirmed by DOM position query in the browser pass, not
  assumed. Functionally nothing is lost — the content is all present — but a
  reader hits two panels of authored text before reaching the shared grid the
  whole redesign is built around. See [[Known Issues]].
- **Density judgement (2026-08-21 browser pass).** The plain, no-authored-prose
  case is compact — heading, one line each of moves/score/caption per panel,
  five one-line rows, one verdict line, all inside a single 784px viewport
  with no scrolling. The authored-prose case is a different story: pros/cons
  bullets roughly double each panel's height, and reaching the verdict took
  three scroll ticks in the Italian's `Bc4` checkpoint. If this reads as a
  wall, it is the authored prose doing it, not the five-row grid. Full
  reasoning in [[Known Issues]].

## Contrast rows replace the old five-feature pros/cons list

`src/explain/contrastRows.ts` is new. `measureLine` reads a walked line's end
position into a `LineValues` (centre pawns on d4/e4/d5/e5, developed minors,
castled, development differential, and a coarse open/closed band from pawns
traded), and `buildContrastRows` turns a pair of `LineValues` into the five
`ContrastRow`s the drawer renders. `src/explain/compare.ts`'s `summarise` now
returns a `LineSummary` carrying `values` and `moves` (the walked SANs)
instead of deriving pros/cons; `buildVerdict` reads `ContrastRow.equal` rather
than a centipawn gap.

## The breadcrumb is gone; a moves table replaced it (Plan 7)

`Breadcrumb.tsx` is deleted. In its place, `src/ui/MovesTable.tsx` renders a
lichess-style numbered list — White's move and Black's in one row — derived
fresh on every render by `buildMovesTable` (`src/tree/movesTable.ts`) from the
tree's current path plus its continuation. Nothing about the line is stored
outside the tree.

- **The behaviour the breadcrumb couldn't do**: stepping back with `previous`
  no longer drops the moves ahead of you. The table walks the path to the
  selected node and then keeps walking forward through whichever child each
  node last had selected (`TreeNode.lastSelectedAt`), so the continuation stays
  listed and clickable. Playing a genuinely different move from a branch point
  replaces that continuation, in place, the next time the table renders.
- **Four controls** — first, previous, next, last — step `lineIds`, the same
  array the rows are built from, so the controls and the rows can never
  disagree about what the line is.
- **Arrow keys are resolved by focus.** `ArrowLeft`/`ArrowRight` only step the
  table when the table itself has focus (`tabIndex={0}` on the section); the
  board's own arrow-key cursor is unaffected, since Left/Right are already
  claimed there.
- **The root is reachable** via `lineIds[0]` and the `First` control, but there
  is no rendered "start" row — a row with no move has no cell for a numbered
  pair. Stated as a gap in the plan, not fixed here.
- **Numbering comes from the position, never index parity.** A segment that
  starts Black-to-move (`development-and-tempo`'s second part) renders its
  first row as `2.` with an elided White cell (`…`), matching the FEN's own
  fullmove number. Confirmed in a browser 2026-08-15.

**Browser-verified 2026-08-15** (see [[Start Here]] for the session note): the
continuation-survives-stepping-back behaviour, branching replacing the table's
continuation, the Black-to-move numbering case, and — the one that mattered
most — that the autoplay-owed-reply fix (below) survives navigating away from
and back to the tip mid-lesson. All five checks in the plan's browser pass held.

## The autoplay dead-end from Plan 6 is fixed (`bd37bb7`)

Reaching the tip of a lesson line **by navigation** (clicking an earlier moves-
table row, then `last`) now still fires the opponent's owed reply if one was
pending, matching the fix already shipped for reaching it by replaying a move.
Both paths go through the same tip-of-line guard in `useLessonAutoplay`, keyed
off `lastPlayedId` rather than "the node has no children." See
[[Decisions/Arrival By Move Versus Navigation]].

## A layout defect found and fixed on this branch

`.app-main` lacked `min-height: 0`, so `.app-shell`'s `1fr` row grew to fit
content instead of the viewport — measured at 2945px against a 1308px shell —
and `overflow: hidden` silently clipped the excess. A long moves table or a
long candidate rail simply vanished off the bottom, unscrollable. Fixed by
adding `min-height: 0` to `.app-main`, the same fix `.app-rail` already needed
for the same reason (see the CSS comment above `.app-main` in
`src/ui/theme.css`). The defect predates the moves table — it reproduced on the
left rail too — and was only surfaced by the moves table's longer rows.

## Opening lessons are a quiz now (Plan 6)

The biggest change to how the app *feels*. An opening lesson no longer narrates
with a "Play the next move" button; it asks.

- **Every player-side move is a question.** The three openings carry 24
  checkpoints between them, one per player move, each with its own prompt and
  up to three hints.
- **A wrong answer never reaches the game tree.** The piece returns to its
  square, a red mark appears, and the panel gives the authored near-miss reply
  when there is one. The tree gains no node, so the position is untouched and
  the question stands.
- **The opponent replies on its own**, 700ms after a correct answer, so the
  player only ever supplies their own side. It replies whenever the player
  *moved* to the position — including replaying a move they had already played
  after stepping back — and never when they merely navigated there. Until
  2026-08-13 this was inferred from the node being childless, which dead-ended
  the lesson on a replay; see [[Decisions/Arrival By Move Versus Navigation]].
- **Lessons live in a header dropdown**, which makes the base page the
  explorer: you arrive at a board with candidate moves and pick a lesson when
  you want one.
- **The left rail is the explanation** during a lesson - title, "Move 3 of 17",
  and the note for the move just played. The right rail is the question.

**No hint names its move**, in notation or in words, across all 72 hints. That
rule is enforced by reading, not by a test - see [[Lessons]] for why a scan
cannot catch it.

Theme lessons are deliberately untouched: occasional checkpoints, visible
candidates, and "Play the next move".

**A Black-side opening lesson opens with the opponent's move already played.**
`black-vs-e4` (`side: 'black'`, one segment, no `startFen` override) starts with
White to move at the root — the opponent's turn, not the player's — so autoplay
fires 700ms after the lesson starts and plays White's `e4` with no action from
the player. Every other opening lesson is White-side, so this is the only place
in the corpus where the tip-of-line guard fires on its own, with no
side-to-move check blocking it first. Correct per spec §2; guarded by a test in
`src/ui/useLessonAutoplay.test.tsx`, added and mutation-checked 2026-08-15.

## The board can finally be driven without a mouse

This is the headline change. Until Plan 5, `react-chessboard` only handled
drag-and-drop drops — synthetic drags never reached it and a pointer-event
sequence once froze the renderer — so **nothing that required a piece to move
could be verified without a human**. Three behaviours had never once been
observed.

Plan 5's keyboard layer is our own DOM, so it is drivable. On 2026-08-10 two of
those three were watched for the first time:

- **Answering a checkpoint** — Italian Game, `Enter ArrowUp ArrowUp Enter` from
  the starting cursor plays `e4`; the tree advances and the lesson moves on.
- **The wrong-answer path** — playing `d4` renders the authored near-miss reply,
  **keeps the Hint control on screen**, keeps the checkpoint prompt, and leaves
  zero candidate rows visible.

The third — **segment-level board orientation after "Next part"** — is still
unobserved. Lesson-level orientation was verified (`a8` first for White, `h1`
first for Black), and both go through the same derivation, but the segment-level
flip itself has not been watched. Full detail, including what could not be
checked and why, is in `docs/superpowers/plans/spike-results-shell.md`.

## What works today

Run `npm run dev`, open the local URL, and you can:

| Action | Behaviour |
|---|---|
| Open the Glossary | A scrollable header disclosure, 30 chess terms grouped simplest-first: the board and the rules, ideas and tactics, then deeper water — including the engine words the app itself displays (evaluation, line, ply). Content in `src/content/glossary.ts`; distinct from the vault's own `Glossary.md`, which is internal vocabulary for people reading the code |
| Click a piece | Its legal destinations are marked — a dot on an empty square, a tinted ring around a piece that can be taken. Clicking one plays the move; clicking the piece again puts it down; clicking another of your own movable pieces switches to it |
| Drag a piece | Legal moves land, illegal ones snap back. From/to squares stay highlighted. |
| Read the right-hand rail | Top 3 engine moves at depth 20, each with score, eval bar, a quality badge (Best/Good/Inaccuracy/Mistake/Blunder relative to the top line), the **top two** explainer sentences, and the first 6 plies of its line |
| Watch the rail mid-search | Scores and eval bars stream; **badges and ideas are withheld until the search settles**, because comparing two lines only means something at equal depth |
| Click a candidate | Plays it — identical result to dragging the same move |
| Click "Compare X and Y" | Opens a drawer with two mini-boards (each captioned with the moves actually walked, at most 8 plies, numbered like a scoresheet), eval bars, and five fixed contrast rows (Centre, Development, King safety, Tempo, Open or closed) shared between the pair, each glossed and marked when it differs. A footer names which rows differ, or "Practically equal" when none do; a mate in either line outranks that entirely. Authored pros/cons, where a lesson supplies them, render inside each line's panel |
| Click a move in the moves table | Jumps to that position; the rest of the line stays listed, even the moves ahead of where you land |
| Click first / previous / next / last below the table | Steps through the current line one position at a time |
| Play a different move from an earlier position | **Branches the tree.** The original line survives and is one click away. |
| Reach checkmate or stalemate | The rail says so rather than spinning |
| Lose the engine | "Engine unavailable" card with a working Retry button |
| Revisit a transposed position | Analysis is served from a FEN-keyed cache instead of re-searched — see `src/engine/evalCache.ts` |
| Tab to the board and use the keyboard | Arrows move a cursor, Enter picks up and places, Escape puts down. Direction follows board orientation. A visually-hidden `aria-live` region announces each square with its occupant, and refuses illegal moves aloud without playing them. |
| Look at the whole app | A one-screen shell: header, then three columns — lesson region, board, candidates. The board never moves between modes; only the rails change contents. The moves table sits in the right rail, below the candidates or the checkpoint panel. Below 1100x640 it flows as a single scrolling column, board first — **unverified this session**, same as every prior pass; the automation window cannot be resized. |
| Open a comparison | Opens as an overlay spanning the centre and right columns — real width for three mini-boards — closing on Escape and restoring focus. |
| Reach a checkpoint | The candidate rail hands its column to a checkpoint panel: the prompt, the hint ladder, and the authored comparison. Hints live here, not in the lesson rail, and stay put while an answer is graded. |
| Start an opening lesson | Every move on your side is asked. Wrong answers bounce off the board with a red mark and an authored reply; right ones play, flash a check, and the opponent answers 700ms later. Both marks are translucent discs centred on the board — measured there, not assumed. |
| Open the Lessons menu | A header dropdown listing all seven lessons with their progress. Available mid-lesson - switching reseeds the tree cleanly and credits nothing. |
| Reach a checkpoint with no engine | The question and the hints still appear — they are lesson content and no longer sit behind the rail's "Thinking…"/"Engine unavailable" returns. Only the authored comparison is lost; the Retry control comes along into the panel. |
| Have unreadable stored progress | The notice appears in the **header**, survives starting a lesson, and can be dismissed. |
| Want a clean slate | "Clear progress" in the header wipes durable storage behind a two-click "Really clear?" confirmation — no blocking modal. |

The branching loop is the thing to exercise: play `e4 e5 Nf3`, click back to the
position after `e4`, play `c5` instead — two lines now exist, and the moves
table follows whichever one was most recently selected (it cannot walk both at
once; see [[Known Issues]]).

**Verified 2026-08-04:** dev server starts in ~300 ms and serves `/`,
`/engine/stockfish.js`, `/engine/stockfish.wasm`, and the Nunito font correctly.

**The compare drawer has now been exercised in a browser (2026-08-04)**, closing
the gap Task 9 left open. It works — and the testing found that the *output
layer* said roughly the same thing about every move, which is the one failure
mode this feature cannot afford. A whole-branch review turned that into a fix
list, applied 2026-08-05:

| Was | Now |
|---|---|
| Every sensible opening move led with "Stakes a claim in the centre" — `centerControl` counts attackers, so a developing knight outscored `developmentRule` | Occupation (a pawn on a central square) and pressure are separate rules with separate text; e4 leads with the centre, Nf3 with development |
| One explainer sentence per candidate | Two, per spec §7 |
| Quality badges flickered through "Mistake"/"Blunder" mid-search | Badges and ideas are withheld while `status === 'analyzing'` |
| "Practically equal — the real difference is character… e4 develops 1 more piece; d4 develops 1 more piece" | When both lines lead with the same pro, the verdict says so instead of asserting a difference that isn't there |
| A mate comparison rendered "about 998.00 better than" | Mate is handled before the centipawn logic and names the distance; the centipawn gap now says "pawns" |
| The drawer captioned a board "after 26 plies" when it walked 8 | `LineSummary.plies` carries the real count; score and position are two separate claims |
| Mini-boards drew both armies from the black glyph set, separated by CSS `color` | Colour-keyed glyphs — survives `forced-colors` |
| The eval cache keyed on the whole FEN, so the Queen's Gambit transposition missed | Keyed on placement + side + castling + en passant |
| A search finishing just after navigation was discarded | Written to the FEN cache first, then the render is guarded |

What that fix wave deliberately did **not** do is in [[Known Issues]].

## The lesson layer (Plan 3)

Seven authored lessons — three openings (`italian-game`, `london-system`,
`black-vs-e4`) and four themes (centre control, development and tempo, forks and
pins, kingside attack) — live in `src/content/lessons/`, validated by a Zod
schema and replayed move by move through chess.js in `src/content/load.ts`. The
runner in `src/lesson/` stores no position: it derives where you are from the
tree's path (`deriveLessonState`), and the lesson store holds only the lesson id,
the segment index, and hint counts.

| Action | Behaviour |
|---|---|
| Open the app with no lesson running | The picker lists every lesson under OPENINGS and IDEAS, each with its `summary` |
| Start a lesson | The tree is re-seeded from the segment's `startFen`; the board orients to `segment.side` when the segment overrides it, otherwise `lesson.side`; the rail shows the segment intro, and keeps it until the **player** moves — not until the ply advances, so a lesson whose first move is the opponent's does not lose its intro to autoplay's timer |
| Follow the line | "Play the next move" advances it, with the move sound; the note for the move just played stays on screen |
| Reach a checkpoint | The rail asks instead of telling, and the candidate rail hides its rows, scores and ordering so the engine cannot leak the answer |
| Ask for a hint | One tier at a time, up to three, counted **per checkpoint id** |
| Answer wrongly | The authored `nearMiss` reply if there is one, otherwise a non-punishing line; the question and the Hint button stay up, and "Return to the lesson" goes back |
| Wander off the line | Not an error — the rail says the lesson waits, and the tree keeps the branch |
| Finish a segment | "Next part" appears when another segment follows; the last one says the lesson is complete |
| Compare at a checkpoint | Where the lesson authored `alternatives` (today only the Italian's `Bc4`), the rail offers a comparison of those alternatives — chosen from content, never from the engine's ordering, and never including an accepted answer |

### The 2026-08-05 fix wave (whole-branch review of Plan 3)

| Was | Now |
|---|---|
| The fork segment accepted `4.Nxe5`, which loses by force to `4...Qg5`, and listed the two correct moves as near misses | Accepts `Nxd4`; `Nxe5` is a near miss that names the refutation and the mate; the segment teaches that a fork inviting a bigger one is no fork at all |
| `segmentIndex` was never written past 0, so segment 1 of three lessons was unreachable | "Next part" advances it and re-seeds the tree through the same helper `startLesson` uses |
| One lesson-wide hint counter printed the answer tier before the second checkpoint was read | Counts are keyed by the checkpoint's authored id |
| The wrong-answer copy named a Hint button that had just been unmounted | The question and hints stay mounted while an attempt is graded |
| Notes before a checkpoint, and every lesson's last note, never rendered | The note for the move just played renders on its own condition |
| `lesson.summary` was never rendered anywhere | Rendered in the picker, outside the button so the control keeps its name |
| The one authored comparison in the corpus was unreachable in the app | Reachable at the checkpoint, engine ordering excluded |

Also fixed on this branch: `theme-development-and-tempo`'s second segment,
previously played from Black's side of a White-oriented board, now carries its
own `side: 'black'` override (Task 1) — the [[Known Issues]] entry for it is
deleted, not tombstoned.

## Progress, saved lines, and controls (Plan 4)

`src/progress/` is a versioned object (`{ version: 1, lessons, savedLines }`)
reduced by pure functions in `progress.ts`, read and written through a Zustand
store (`store.ts`) at the UI edge — nothing in `src/lesson/` or `src/tree/`
knows persistence exists. Storage itself (`storage.ts`) follows spec §10:
corrupt or unreadable JSON resets to empty progress with a `recovered` flag; a
failed write (quota or otherwise) reports `saveFailed` rather than throwing.

| Action | Behaviour |
|---|---|
| Solve a checkpoint | Recorded once per distinct attempt (deduped by `lessonId:checkpointId:nodeId`), with the hint count it took; `solved` is sticky — a later wrong answer never un-solves it |
| Clear progress mid-lesson | Stays cleared. The dedupe `Set` survives the clear on purpose, so the recording effect cannot re-derive the attempt the player just wiped; a genuinely new answer is a new tree node and still records |
| Finish a lesson | Stamped with the completion time on first finish only |
| Open the picker | Shows "N of M checkpoints" per lesson once any are solved, or "Done" once complete |
| Reload the page | Progress, saved lines, and the mute setting all survive it — read once at each store's construction |
| Play a line, click "Save" | Names it first — the player types the name, defaulting to "Line N". Stored as its starting FEN plus PGN movetext (`src/chess/pgn.ts`). The list itself lives behind "Open", a disclosure panel, so the section's resting size does not grow with the number of saves; each row carries a × that deletes that line |
| Open a saved line | Stops any running lesson first, then reseeds the tree and replays the PGN — matches what "New game" does, and for the same reason: a live lesson would otherwise misgrade the replayed moves against its own script |
| Click "New game" | Stops any running lesson, then resets the tree to the true start |
| Toggle sound | `aria-pressed` and button text ("Sound on"/"Sound off") carry the state — never colour alone; persists across reload via its own `chesstrainer.muted` key |
| Storage is corrupt or full | A `role="status"` notice appears in the picker (corrupt/unreadable) and now also in "MY LINES" (failed save) — the two places that actually write |

### The 2026-08-06 whole-branch review

Six tasks each passed their own review; this fix wave closed what only a
whole-branch view could see:

| Was | Now |
|---|---|
| 10 React `act()` warnings from bare store mutations while a component was mounted | Wrapped in `act()`, matching the idiom already used elsewhere on this branch; count confirmed at zero |
| `SavedLines.open()` reset the tree but not the lesson, so opening a saved line during a running lesson whose script it happened to match wrote a checkpoint as solved for an answer never given — durable and unrecoverable | `open()` calls `stopLesson()` first, matching `newGame()` |
| The checkpoint-recording effect hard-coded `solved: false` whenever a grade existed, ignoring `attemptedGrade.kind` — dormant only because no lesson has a multi-entry `accept` yet | `solved: attemptedGrade.kind === 'correct'`; the *display* still says "stepped off the line" for this case, tracked separately in [[Known Issues]] |
| `saveFailed` was shown only in `LessonPicker`, which is `null` while a lesson runs — so the one place a saved line actually gets written (`SavedLines`) could fail silently | A `role="status"` notice, not colour-only, added inside `SavedLines` |
| `src/progress/store.ts` re-exported `lessonProgress` for a `map`-loop consumer that used a direct import instead | Dead re-export deleted |

## What is scaffolding, not feature

- ~~Sound is wired but silent~~ — **the app makes sound as of 2026-09-02.** All
  ten are synthesised at runtime from oscillators and filtered noise
  (`src/sound/synth.ts`), so nothing is fetched and nothing is licensed.

  **The first version was rejected by ear and rebuilt the same day.** It built
  the board sounds from oscillators — a 180 Hz sine for a piece landing — and
  the author's verdict was immediate: it read as a beep, not a board. A
  sustained pitch is the one thing a wooden knock never has. `pickup`, `move`
  and `capture` are now **noise alone**, shaped by a resonant bandpass, so the
  pitch heard is the filter ringing rather than a tone. Two layers each, which
  is what an impact is: a broadband tick for the contact and a body for the
  wood. `move` is 390 Hz at Q 7 plus a 2600 Hz tick; `capture` is the same event
  with more force at 250 Hz, ringing longer and with a mid crack. The envelope
  attack also dropped from 8 ms to 1.5 ms — at 8 ms the transient the ear reads
  as *struck* was smoothed away before it arrived.

  Notifications keep a pitch, because they are not impacts: `check` and
  `correct` are two short notes rather than three long ones. `buttonPress` is a
  dry 16 ms tick with no pitch, varied by a multiplier so repeats do not sound
  mechanical.

  **Checkmate is its own sound as of 2026-09-02**, and was not before — it
  played `check`, because `classifySound` in `src/chess/resolveDrop.ts` tested
  `isCheck()` first and chess.js reports a mating move as a check too. So the
  most consequential move on a board sounded exactly like the most routine one.
  Mate is now tested ahead of both check and capture, which matters because a
  mating move is often all three at once (Scholar's mate ends `Qxf7#`). The
  sound falls rather than rises — D5–A4–D4 — and ends on a note held four times
  longer than anything else in the set, since nothing follows it. It carries its
  own impact, because checkmate is the one board event where no `move` or
  `capture` sound plays alongside it.

  Verified in a browser against the real Web Audio API rather than a stub: a
  move schedules two noise sources and **zero oscillators**, with the bandpass
  at 390 Hz / Q 7 and the tick at 2600 Hz.

  What is *still* not verified is whether the second version sounds **right**.
  That needs ears, and is the one judgement no automated check here can make —
  as the first version proved by passing every check and being wrong anyway.
- **`src/App.tsx` is a placeholder shell** — an inline-styled flex layout that
  now hosts the picker, the lesson rail, saved lines, and the app controls.
  Still not the designed layout; that is Plan 5.
- **`alternatives` exists on one move in the whole corpus.** The comparison
  feature works; the content to feed it barely exists.

## What does not exist yet

See [[Roadmap]] for ordering.

- **A real `App.tsx` layout.** Currently a placeholder flex shell hosting four
  components stacked with no design pass.
- **Keyboard board navigation.** Called for by the spec's accessibility section.
- **A way for a player to clear their own progress**, and a dismiss control for
  the recovered/save-failed notices. See [[Known Issues]].

## Engine behaviour worth knowing

- First analysis is slow — it loads a 7.3 MB WASM binary before the first
  search. Subsequent searches settle in roughly 0.7–1 s at depth 20.
- Depth 20 was chosen from measurement, not taste: ~975 ms at the start position,
  ~697 ms in a middlegame. Recorded in `docs/superpowers/plans/spike-results.md`.
- Navigating rapidly between positions is the highest-risk interaction. The rail
  must always show the current position's candidates and must never wedge on
  "Thinking…". That is [[Decisions/Engine Search Serialization]], and it took six
  revisions to get right.

## Recent history

- **2026-08-21** — The compare drawer's contrast vocabulary finished on
  `feat/compare-contrast-vocabulary`: five tasks — engine measurements against
  real principal variations, the `contrastRows.ts` module, `compare.ts`
  rewired to rows instead of independent prose, the drawer's rendering, and a
  browser pass plus this vault update. Suite 574 → 575 (one regression test
  added for a previously-untested Black-to-move branch in `formatMoveList`).
  **Not yet merged, no PR opened.**
- **2026-08-15** — Plan 7 (the moves table) finished on `feat/moves-table`: six
  tasks — the autoplay-owed-reply fix, the pure derivation
  (`buildMovesTable`), the component and its four controls, mounting it in
  place of `Breadcrumb.tsx` (plus the `.app-main` layout fix), and focus-scoped
  arrow keys. A browser pass confirmed all five checks in the plan, including
  the one unit tests cannot show: the owed-reply fix survives navigating away
  from and back to a lesson's tip. Suite 482 → 505. **Not yet merged.**
- **2026-08-06** — Plan 4 (progress, saved lines, and controls) finished on
  `feat/progress-and-controls`: six tasks — segment-level board orientation,
  the progress schema/reducers/storage, the progress store recording
  checkpoint outcomes, progress in the picker, saved lines as PGN, and the
  new-game control plus a persisted mute toggle. One whole-branch review fix
  wave followed the same day — five items, including a durable-data bug in
  checkpoint recording and a saved-line Open that could leave a lesson's
  checkpoint wrongly marked solved. Suite 343 → 410, and the ten pre-existing
  `act()` warnings the six tasks had carried without growing are now zero.
- **2026-08-05** — Plan 3 (the teaching layer) finished on
  `feat/content-and-lessons`: eight tasks, the content pipeline through the
  lesson picker and authored comparisons. One fix wave from the whole-branch
  review followed the same day — nine items, including a lesson that was
  teaching a losing move. Suite 246 → 343.
- **2026-08-05** — One fix wave from the whole-branch review of Plan 2: nine
  items across `src/explain/`, `src/ui/`, and `src/engine/evalCache.ts`. The
  table above says what changed. Suite 223 → 246.
- **2026-08-04** — Plan 2 (explainer and compare) finished: nine tasks, from
  pawn-structure feature extraction through the compare drawer. `framer-motion`
  removed as an unused dependency (Task 9); the drawer's animation is a CSS
  keyframe instead.
- **2026-08-04** — Repo pushed to GitHub (public). Added top-level `README.md`,
  `CLAUDE.md`, Stockfish GPL-3.0 attribution at `public/engine/`, and this vault.
- **2026-08-03** — Plan 1 finished after six post-review fix waves, five of them
  in the engine's search serialization.
- **2026-08-01** — Design spec approved; Plan 1 written.
