import { parseLesson } from '../load';

export const italianGame = parseLesson({
  id: 'italian-game',
  title: 'The Italian Game',
  kind: 'opening',
  side: 'white',
  summary:
    'The most natural opening in chess: put a pawn in the middle, bring out both minor pieces — your knights and bishops — and castle. Every move has one clear job.',
  tags: ['center-control', 'development', 'king-safety'],
  segments: [
    {
      startFen: null,
      intro:
        'You are White. The plan is simple and you can hold it in your head: claim the centre, develop your knight and bishop — get them off their starting squares and into the game — and get the king safe. Nothing clever is required. One more term for later: the board\'s vertical columns are called files, and a rook wants to stand on one with no pawns blocking it.',
      moves: [
        {
          san: 'e4',
          note: 'Claims a central square and frees two pieces at once — the bishop beside your king, and the queen. It does a third job you cannot see: a pawn here also covers d5 and f5, so Black\'s pieces cannot use them. That is what "controlling the centre" really means — not owning squares, but making them unusable for the other side.',
          checkpoint: {
            id: 'italian-open-with-e4',
            prompt: 'Open the game. Which pawn move claims the centre and frees two pieces?',
            accept: ['e4'],
            hints: [
              'A pawn in the middle does two things at once: it takes space, and it unblocks whatever is standing behind it.',
              'One of your bishops can reach a diagonal that runs all the way to f7 — the only square in Black\'s camp that nothing but the king defends. It just needs the pawn in front of it to get out of the way.',
              'That is the bishop standing beside your king, and its pawn should not stop half-way: a pawn on the third rank never actually stands in the centre.',
            ],
            nearMiss: {
              d4: 'Also a real opening move — that is the Queen\'s Gambit family, and nothing is wrong with it. But it frees the other bishop, the one that points away from f7, and f7 is where this lesson is going.',
              Nf3: 'A good developing move, and you will play it in a moment. Push a central pawn first, though, or your bishops have no lines to come out on.',
              e3: 'The right pawn, but timid. On the third rank it lets the bishop out and claims no central square at all — and nothing is stopping you taking the whole step.',
            },
          },
        },
        {
          san: 'e5',
          note: 'Black mirrors you, for exactly the same reasons. Now both centre pawns are blocked head to head, so neither can advance, and the argument moves to the squares just in front of them — d4 and d5. Whoever can point more pieces at those squares gets to decide when the centre finally opens.',
        },
        {
          san: 'Nf3',
          note: 'A knight comes out, and it attacks the e5 pawn on the way. Moves that develop and threaten at the same time are the ones that gain you time: Black now has to spend a move answering the threat instead of getting on with their own plan. That extra move is called a tempo, and collecting them is most of what a good opening does.',
          checkpoint: {
            id: 'italian-develop-with-tempo',
            prompt: 'Black has matched you in the centre. Which developing move also asks a question of the e5 pawn?',
            accept: ['Nf3'],
            hints: [
              'The best developing moves do a second job at the same time.',
              'One of Black\'s central pawns is defended by nothing at all.',
              'A knight on the kingside can reach a square that attacks it.',
            ],
            nearMiss: {
              Nc3: 'A perfectly good developing move, and in other openings it is the right one — but it does not touch e5, so Black is free to carry on with their own plan.',
              Bc4: 'The bishop belongs there and you will play it next, but developing with a threat first makes Black answer you rather than the other way round.',
              d4: 'Striking at once is a real opening — the Centre Game — but after ...exd4 you have to win the pawn back with your queen, and she gets chased around while Black develops.',
            },
          },
        },
        {
          san: 'Nc6',
          note: 'Black defends e5 and develops in one move — the same trick you just used, played straight back at you. Note the square: in front of the c-pawn rather than out on the edge. A knight on the rim touches half as many squares as one in the middle.',
        },
        {
          san: 'Bc4',
          note: 'The bishop points at f7 — the one square in Black\'s camp defended by nothing but the king. It is not a threat yet, and it is not supposed to be: it is a piece taking aim, so that the moment Black slips, half of the attack is already built. It also steps outside your own pawn chain, which is the other half of a good bishop move.',
          checkpoint: {
            id: 'italian-bishop-to-c4',
            prompt: 'Develop your light-squared bishop to its most aggressive square.',
            accept: ['Bc4'],
            hints: [
              'Every square in Black\'s camp is guarded by a pawn or a piece — except one.',
              'f7 is defended by the king and nothing else. That is where pressure goes.',
              'Only one of your pieces can attack f7 from a distance right now: the bishop your first move set free. Follow its diagonal out to the square that looks straight at f7.',
            ],
            nearMiss: {
              Bb5: 'Also strong — that is the Ruy Lopez, and a fine opening. It leans on the knight defending e5 instead. We are learning the Italian, where the bishop takes aim at f7 directly.',
              Be2: 'Safe, and completely passive. From there the bishop stares at its own knight and does nothing; the whole point of this opening is the diagonal it is refusing to take.',
              d4: 'Sharp, and a real opening called the Scotch — it resolves the centre at once instead of developing a piece. For this lesson, get the bishop out first and leave the central pawns facing each other.',
            },
          },
          alternatives: [
            {
              san: 'd4',
              name: 'Scotch Game',
              note: 'Strikes in the centre immediately instead of developing quietly.',
              pros: [
                'Opens lines for your pieces straight away',
                'Far less theory to remember than the quiet lines',
                'You get an open game where tactics decide things',
              ],
              cons: [
                'Trades off your strong e-pawn, releasing the central tension',
                'Punishes slow development much harder if you drift',
              ],
            },
            {
              san: 'Bb5',
              name: 'Ruy Lopez',
              note: 'Pressures the knight that defends e5, rather than aiming at f7.',
              pros: [
                'Applies long-term pressure to Black\'s centre',
                'Can leave Black with weaker pawns if the bishop trades on c6',
              ],
              cons: [
                'Far more theory than the Italian',
                'The point of the pressure is slow and hard to feel as a beginner',
              ],
            },
          ],
        },
        {
          san: 'Bc5',
          note: 'Black copies you, aiming a bishop at f2 — the mirror image of your target, and Black\'s square that only the king defends. Symmetry is fine here. It is still your move, and being one move ahead in an otherwise identical position is exactly what going first is worth.',
        },
        {
          san: 'c3',
          note: 'A quiet move with a real point. You would like to play d4 and own the whole centre, but a pawn landing on d4 is met by ...exd4 — and you would much rather answer that with cxd4, taking back with a pawn and ending up with two pawns side by side on d4 and e4. That pair is the strongest formation in the opening. The cost is real too: your queen\'s knight can no longer use c3 and will have to travel a longer road.',
          checkpoint: {
            id: 'italian-prepare-d4',
            prompt: 'You have mirrored each other move for move. You would love to take the whole centre with d4 — but played now, Black just trades it off. Which move makes d4 work?',
            accept: ['c3'],
            hints: [
              'A pawn arriving on d4 is attacked twice, by the e5 pawn and the knight on c6. Attacked pawns need somebody behind them.',
              'You want to answer ...exd4 by taking back with a pawn, so that two of yours end up side by side in the middle.',
              'Only one of your pawns could ever recapture on d4, and it has not moved at all yet. Bring it up to the square from which it covers d4 — and accept that your queen\'s knight loses its best square as the price.',
            ],
            nearMiss: {
              d4: 'Straight in, but a move too early: Black replies ...exd4 and you have to win the pawn back with a piece rather than a pawn, which lets the centre dissolve. Prepare it and the same push becomes permanent.',
              'O-O': 'Castling is never a mistake and it is coming in two moves. But Black cannot punish the small delay here, and this is the moment to build the centre — once Black develops further, the chance is gone.',
              b4: 'That is the Evans Gambit, a genuinely dangerous attacking line: you give a pawn to gain time and build the centre with tempo. A fine choice one day. This lesson takes the quiet road.',
              Ng5: 'Both your knight and bishop would hit f7, and it even threatens something — but Black defends with one move and then chases the knight back, and you have spent two moves on a piece that ends up where it started. Attacks come after development, not instead of it.',
              Nc3: 'A natural developing square, and in most openings it is right. Here it is the square your c-pawn needs, and the pawn is doing more for you than the knight would.',
            },
          },
        },
        {
          san: 'Nf6',
          note: 'Black brings out the last piece that can develop easily, and attacks e4 on the way — develop-with-a-threat, played straight back at you again. Your e4 pawn has no defender at all at this moment, so this is a real question and it needs a real answer.',
        },
        {
          san: 'd3',
          note: 'Answers the threat with the cheapest defender there is: a pawn. It also unlocks the bishop on c1, which until now was the one piece with no way out at all. Modest rather than ambitious, and that is deliberate — d4 is still the plan, but you play it on a move when it wins something, not on a move when it drops a pawn.',
          checkpoint: {
            id: 'italian-defend-e4',
            prompt: 'Black\'s knight came out with a threat. Answer it — and pick the answer that also frees your last undeveloped bishop.',
            accept: ['d3'],
            hints: [
              'Black\'s last move attacked something. Work out what, and then count its defenders.',
              'e4 has none. A piece could defend it, but the cheapest defender in chess is always a pawn — and one of your pawns is also the door your dark-squared bishop is stuck behind.',
              'Only one pawn can step up to a square from which it covers e4. Pushing it any further would defend e4 with nothing at all.',
            ],
            nearMiss: {
              d4: 'The push you prepared, but not yet — it walks past e4 instead of defending it, and Black can simply take the pawn there. Defend first; d4 will still be available.',
              Qe2: 'It does defend e4, but you are using your most valuable piece as a pawn-guard, and she sits on the file you will want a rook on. Save the queen for when she has something better to do.',
              Ng5: 'Tempting, since the knight and bishop both hit f7 — but Black defends it in one move, and your knight has to trudge home while e4 is still hanging behind you.',
              'Bxf7+': 'Count it before you play it: the king takes the bishop and you have given a whole piece for one pawn. Sacrifices on f7 only work when you have more attackers arriving than the defender has defenders.',
            },
          },
        },
        {
          san: 'd6',
          note: 'Black defends e5 the same way and for the same reason, and frees the c8 bishop while doing it. Both centres are now solid and locked, which is exactly why the next few moves are slow ones — with no pawn breaks available, the game becomes about improving pieces.',
        },
        {
          san: 'O-O',
          note: 'The king steps behind three untouched pawns, and the rook that was buried in the corner joins the game. Castling is the only move in chess that develops two pieces at once, and putting it off is the single most common way beginners lose: the moment the centre opens, a king still standing on e1 is on the same file as everything dangerous.',
          checkpoint: {
            id: 'italian-castle-kingside',
            prompt: 'Your pieces are out and the centre is stable. Make your king safe.',
            accept: ['O-O'],
            hints: [
              'A king in the middle is a target the moment lines start opening, and every pawn trade brings that closer.',
              'Look at what you have not used yet: both rooks are still in their corners, with no way into the game.',
              'Your king is still standing where the game began, and one of your rooks has never moved. There is a single move that fixes both of those at once.',
            ],
            nearMiss: {
              Bg5: 'Developing, and it is even a pin — but your king is still in the middle. Get it safe first; this bishop move will still be there afterwards.',
              b4: 'Too loose. Pushing pawns on the side while your king sits in the centre is how beginners lose games, and it hands Black a target on the queenside for free.',
              d4: 'The break you have been building towards, but opening the centre while your king is still in it is precisely the wrong order. Tuck the king away and the same push becomes safe.',
              Rf1: 'The rook shuffles one square and achieves nothing — it is still behind a pawn, and you have given up the right to bring it out together with the king in a single move.',
            },
          },
        },
        {
          san: 'O-O',
          note: 'Black does the same. Both kings are safe, every minor piece is out on both sides, and the opening is essentially over. From here the moves change character: instead of bringing out new pieces, you improve the ones you already have.',
        },
        {
          san: 'Re1',
          note: 'Castling brought this rook to f1, where it stares at its own pawn and does nothing. On e1 it stands behind the e-pawn, on the file where the pawns are most likely to be traded off — and a rook wants to be on a file before it opens, because once it is open everyone wants it. It also puts a second defender behind e4, which is quietly what makes d4 possible later.',
          checkpoint: {
            id: 'italian-rook-to-the-open-file',
            prompt: 'Both kings are safe, so the real game starts. Every piece is on a sensible square except your rooks — and one of them is doing nothing at all behind a pawn. Which file will open first, and get a rook onto it now.',
            accept: ['Re1'],
            hints: [
              'A rook on a file blocked by its own pawn is worth almost nothing. Ask which file is likeliest to open up.',
              'The two e-pawns are staring at each other. Sooner or later one of them gets traded, and that file is the one that opens.',
              'Only one of your rooks can reach that file in a single move — the one castling just brought towards the centre. Put it there before the pawns come off, not after.',
            ],
            nearMiss: {
              d4: 'A real try, and the move c3 and d3 were building towards. It is playable — but you get the most out of opening lines when your rooks are already sitting on them. One quiet move first and this push gets better.',
              Bg5: 'A genuine pin on the f6 knight, and not a bad move at all. But Black shrugs it off with ...h6, and meanwhile a rook of yours is still asleep behind a pawn.',
              Nbd2: 'Also right, and you will play it very soon. The difference is certainty: the rook has exactly one good square and it is not going to change, while this knight may yet prefer a different route.',
              h3: 'A useful little move once everything else is done — it takes g4 away from a bishop or knight. But nothing is heading for g4 yet, and you still have a piece doing nothing.',
            },
          },
        },
        {
          san: 'a6',
          note: 'A quiet little move with a hidden point: it prepares ...b5, which would hit your bishop and gain a free move. Get in the habit of asking what a small pawn move is aimed at — most of them are aimed at a piece.',
        },
        {
          san: 'Bb3',
          note: 'Stepping back before being pushed. If you wait for ...b5, you end up moving the bishop anyway and Black gets that move for free; going now costs nothing, keeps the aim at f7, and puts the bishop out of reach of a later ...d5 as well. Moving the same piece twice feels wasteful — moving it twice under attack is worse.',
          checkpoint: {
            id: 'italian-retreat-before-the-kick',
            prompt: '...a6 was not a random pawn move: it prepares ...b5. Something of yours is about to be attacked. Move it first, on your own terms.',
            accept: ['Bb3'],
            hints: [
              'Black\'s last move and the one it prepares are both pawn moves aimed at a piece. Work out which piece.',
              'Your best-placed bishop is standing on a square a pawn can attack. If you wait until it is hit, you move it anyway — and Black gets that move for free.',
              'Step it back before the kick, keeping it on the diagonal that watches f7, and go far enough that neither ...b5 nor a later ...d5 can reach it.',
            ],
            nearMiss: {
              Bd5: 'Forward instead of back — but the knight on f6 guards that square, so the bishop is simply captured.',
              a4: 'This does stop ...b5, which is a real idea. But it spends a move on a pawn to rescue a bishop that could just step aside, and the pawn on a4 becomes something you have to watch.',
              'Bxf7+': 'Count the defenders again: Black has castled, so the rook on f8 guards f7 alongside the king. The bishop is simply lost.',
              d4: 'Opening the centre is right at some point, but not with a bishop one pawn move away from being chased — you would be opening lines and then moving that bishop under fire.',
              Nbd2: 'Carrying on developing is usually right, but it ignores the question Black just asked. After ...b5 you move the bishop anyway — with Black a move to the good.',
            },
          },
        },
        {
          san: 'Ba7',
          note: 'Black tucks the bishop away for the same reason you did: better to retreat now than to be hit by d4 later. From a7 it still stares down the long diagonal at g1, so it has lost nothing.',
        },
        {
          san: 'Nbd2',
          note: 'The last piece comes out. c3 is taken by your own pawn, so this knight takes the quiet route: here now, then f1, then g3 or e3 where it joins the kingside. It also keeps a second eye on e4. There is a cost — it shuts the c1 bishop in for a couple of moves — which is exactly why the knight does not stay. Once it moves on, every piece you own is doing a job, and that is what an opening is actually for.',
          checkpoint: {
            id: 'italian-last-piece-into-play',
            prompt: 'One piece has still never moved, and its natural square is occupied by your own pawn. Find the modest route that brings it into the game anyway.',
            accept: ['Nbd2'],
            hints: [
              'Count your pieces. One of them is sitting exactly where it started the game.',
              'The square it would normally take is occupied by your own pawn, so it has to go the long way round — a quiet square first, then across towards the king.',
              'There is one square that keeps a second guard on e4 and leaves the knight a path to f1 and on to g3. It shuts your dark-squared bishop in for a move or two, and that is the price you pay.',
            ],
            nearMiss: {
              Na3: 'It does develop, and c4 is empty now, so it is not silly. But from the edge the knight guards nothing in the centre, and there is a route through the middle that reaches the kingside faster.',
              d4: 'The break, and it is coming — but play it with a piece still at home and you open lines against the half of your army that is ready to fight. Bring the last one out first.',
              Bg5: 'A real pin on the f6 knight, and playable. It develops a piece that has options later, though, while the one with almost no options is still on its starting square.',
              h3: 'Nothing is heading for g4, so this is a waiting move — and waiting moves are for when everything is already developed. You still have a piece that has never moved.',
              Nfd2: 'Right square, wrong knight. Sending this one there undoes the work it did on f3, where it guards the centre and keeps an eye on e5 — and the piece that has never moved is still sitting at home.',
            },
          },
        },
      ],
    },
  ],
});
