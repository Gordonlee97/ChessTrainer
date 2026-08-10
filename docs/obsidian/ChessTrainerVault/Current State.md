---
updated: 2026-08-10
status: current
tags: [chesstrainer, state]
---

# Current State

**As of 2026-08-10.** Plans 1 (foundation and line explorer), 2 (the explainer
and compare), 3 (the teaching layer), 4 (progress, saved lines, and controls)
and 5 (the app shell and keyboard navigation) are all complete in code. Plans
1–4 are merged to `master`. Plan 5 sits on `feat/app-shell-and-keyboard`, eight
implementation tasks plus a browser pass, **not yet merged and not yet given a
whole-branch review**.

> Picking the work up rather than reading about it? [[Start Here]] has the repo
> state and the next action. This note is what *exists*; that one is what to *do*.

Suite: **434 passing, 1 skipped**, 46 test files, **zero warnings**.
`tsc --noEmit` clean. The skip is `src/engine/engine.smoke.test.ts`, which
needs a real `Worker`; jsdom has none, so the engine is verified in a browser.

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
| Drag a piece | Legal moves land, illegal ones snap back. From/to squares stay highlighted. |
| Read the right-hand rail | Top 3 engine moves at depth 20, each with score, eval bar, a quality badge (Best/Good/Inaccuracy/Mistake/Blunder relative to the top line), the **top two** explainer sentences, and the first 6 plies of its line |
| Watch the rail mid-search | Scores and eval bars stream; **badges and ideas are withheld until the search settles**, because comparing two lines only means something at equal depth |
| Click a candidate | Plays it — identical result to dragging the same move |
| Click "Compare X and Y" | Opens a drawer with two mini-boards (each captioned with the plies actually walked, at most 8), eval bars, pros/cons, and a verdict — mate distances when either line mates, "practically equal" under a 30cp gap, otherwise "X is stronger by N pawns" |
| Click a breadcrumb chip | Jumps back to that position |
| Play a different move from an earlier position | **Branches the tree.** The original line survives and is one click away. |
| Reach checkmate or stalemate | The rail says so rather than spinning |
| Lose the engine | "Engine unavailable" card with a working Retry button |
| Revisit a transposed position | Analysis is served from a FEN-keyed cache instead of re-searched — see `src/engine/evalCache.ts` |
| Tab to the board and use the keyboard | Arrows move a cursor, Enter picks up and places, Escape puts down. Direction follows board orientation. A visually-hidden `aria-live` region announces each square with its occupant, and refuses illegal moves aloud without playing them. |
| Look at the whole app | A one-screen shell: header, breadcrumb, then three columns — lesson region, board, candidates. The board never moves between modes; only the rails change contents. Below 1100x640 it flows as a single scrolling column, board first. |
| Open a comparison | Opens as an overlay spanning the centre and right columns — real width for three mini-boards — closing on Escape and restoring focus. |
| Reach a checkpoint | The candidate rail hands its column to a checkpoint panel: the prompt, the hint ladder, and the authored comparison. Hints live here, not in the lesson rail, and stay put while an answer is graded. |
| Have unreadable stored progress | The notice appears in the **header**, survives starting a lesson, and can be dismissed. |
| Want a clean slate | "Clear progress" in the header wipes durable storage behind a two-click "Really clear?" confirmation — no blocking modal. |

The branching loop is the thing to exercise: play `e4 e5 Nf3`, click back to the
position after `e4`, play `c5` instead — two lines now exist and the breadcrumb
walks either.

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
| Start a lesson | The tree is re-seeded from the segment's `startFen`; the board orients to `segment.side` when the segment overrides it, otherwise `lesson.side`; the rail shows the segment intro |
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
| Finish a lesson | Stamped with the completion time on first finish only |
| Open the picker | Shows "N of M checkpoints" per lesson once any are solved, or "Done" once complete |
| Reload the page | Progress, saved lines, and the mute setting all survive it — read once at each store's construction |
| Play a line, click "Save this line" | Stored as its starting FEN plus PGN movetext (`src/chess/pgn.ts`); listed newest-first under "MY LINES" with Open and Delete |
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

- **Sound is wired but silent.** Every call site exists — pickup, move, capture,
  check — and `public/sounds/README.md` lists the ten filenames the app looks
  for. No audio files are committed. A missing file plays nothing and logs
  nothing, so this is a working degraded state, not a bug. Drop MP3s in and they
  light up with no code change.
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
