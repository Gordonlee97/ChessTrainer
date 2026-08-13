import { parseLesson } from '../load';

export const londonSystem = parseLesson({
  id: 'london-system',
  title: 'The London System',
  kind: 'opening',
  side: 'white',
  summary:
    'An opening built to be played against almost anything Black tries: the same five moves — bishop out, pawns to e3 and c3, knight to f3, and castle — work in almost any order Black allows. Learn the setup once and you rarely have to think move by move again.',
  tags: ['development', 'king-safety', 'pawn-structure'],
  segments: [
    {
      startFen: null,
      intro:
        'You are White. This setup works against almost anything Black tries, in almost any order — that is the whole appeal of the London System. There is one thing you cannot reorder: get your dark-squared bishop out before you play e3, or it ends up stuck behind your own pawn chain — a diagonal wall of pawns, each one defended by the pawn behind it, that a bishop can never cross. Everything else is just developing — bringing each piece off its starting square and into the game — until your king is safe.',
      moves: [
        {
          san: 'd4',
          note: 'A central pawn, and specifically the one your queen is already defending — a pawn pushed to e4 arrives with nothing behind it. This one is the anchor. It takes c5 and e5 away from Black\'s pieces, and it will sit on this square, propped up by pawns on e3 and c3, for the entire opening. That is the bargain the London makes: you give up the chance to punish Black\'s exact choice, and in return you get a setup you can play against almost anything without memorising a single line.',
          checkpoint: {
            id: 'london-open-in-the-centre',
            prompt: 'Open the game. Which central pawn push arrives already defended, and gives this system something permanent to build around?',
            accept: ['d4'],
            hints: [
              'Both centre pawns can take two steps. Only one of them lands on a square a piece of yours is already guarding.',
              'Your queen watches the square directly in front of her. A pawn that lands there cannot simply be taken, which is why this system starts on that side of the board.',
              'Ask which single square, once one of your pawns stands on it, takes both c5 and e5 away from Black\'s pieces at once — and note that a pawn stopping on the third rank reaches neither.',
            ],
            nearMiss: {
              e4: 'A great move and the door to half the openings in chess — but it lands undefended, and after it you have to answer whatever Black picks. This system deliberately starts with the pawn the queen already guards, so that your next five moves are the same every game.',
              d3: 'The right pawn, half the distance. On the third rank it claims no central square and leaves the middle of the board for Black to take. Nothing is stopping you from going the whole way.',
              c4: 'That is the English Opening, and a perfectly good one — but it puts no pawn in the centre, and the structure this lesson is about never gets started.',
              Nf3: 'A sound developing move, and you play it in a few moves\' time. Put a pawn in the middle first, though, or your bishops have no diagonals to come out on.',
            },
          },
        },
        {
          san: 'd5',
          note: 'Black stakes the same claim, and now the two pawns block each other head to head — neither can advance. So the argument moves to the squares beside them, c5 and e5, and to whose pieces can be brought to bear on those squares first. This is the most common reply you will meet, and the London is built so that it barely changes your plan.',
        },
        {
          san: 'Bf4',
          note: 'The move the whole system is arranged around. In a moment you will play e3, and your pawns on c3, d4 and e3 will form a chain running across dark squares — a wall this bishop could never cross from behind. So it leaves first. On f4 nothing defends it yet and nothing needs to: the e-pawn will cover it next move. From here it looks down the b8-h2 diagonal at c7 and e5 — the squares Black would most like to use — and it is already outside everything you are about to build.',
          checkpoint: {
            id: 'london-bishop-out-first',
            prompt: 'Get your dark-squared bishop outside your pawn chain before you close the door with e3.',
            accept: ['Bf4'],
            hints: [
              'In the London, one piece needs to leave home before you build your pawn chain around it.',
              'Play this before e3, or the bishop is stuck behind its own pawns for the rest of the game.',
              'Count the squares beyond the chain. One of them blocks the very pawn you need to push next; one hangs to a pawn on arrival; one gets chased about by ...h6. The one that is left looks down at c7 and e5 with nothing able to touch it.',
            ],
            nearMiss: {
              e3: 'Play this first and your bishop is stuck behind its own pawn chain for the rest of the game. Get it out before you close the door.',
              Nf3: 'A fine developing move on its own, but it does nothing about the bishop, and the pawn move you want to play next is the one that traps it. Rescue the piece with a deadline first — the knight has no deadline at all.',
              Be3: 'The right diagonal, the wrong square: it stands exactly where your e-pawn needs to go, so the chain never gets built, and the bishop ends up blocking the pawn it was supposed to escape.',
              Bg5: 'Also outside the chain, and a real opening in its own right — but ...h6 chases it at once and you spend a move retreating a piece you have only just developed. There is a square on the same diagonal where no pawn can ask it any questions.',
              c4: 'That is the Queen\'s Gambit, and one of the best openings there is — but a different one. It fights for the centre with a pawn instead of solving the problem this system is built around: the bishop that is about to be walled in.',
              Nc3: 'It develops, but it takes the square your c-pawn wants later, and the door is still closing on the bishop at home.',
            },
          },
        },
        {
          san: 'Nf6',
          note: 'Black develops towards the middle and takes aim at e4, one of the squares your pawn is fighting for. A knight on f6 is also Black\'s single most useful kingside defender, which will matter more than it looks: most of what the London eventually does is aimed at h7.',
        },
        {
          san: 'e3',
          note: 'Now the pawn comes out to build the chain, and the order matters more than the move itself. Your dark-squared bishop is already outside the pawn chain; if you had played this first, that bishop would have spent the game staring at its own pawns. This is the single idea that makes the London work, and it is why the bishop went first.',
          checkpoint: {
            id: 'london-close-the-chain',
            prompt: 'The bishop is safely outside. Which modest pawn move now supports d4 and opens a path for the other bishop?',
            accept: ['e3'],
            hints: [
              'This one is small and solid rather than ambitious — it is about support, not space.',
              'Your d4 pawn would like a neighbour defending it.',
              'One modest pawn move does two jobs at once: it gives d4 the neighbour it wants, and it opens the diagonal your last bishop is still shut in behind. Work out which single pawn is doing both of those things wrong at the moment — and remember that support, not ambition, is what this position is asking for.',
            ],
            nearMiss: {
              e4: 'Too ambitious here — it gives up the solid pawn chain the London is built on, and that square is better used supporting d4 than grabbing space.',
              c3: 'A useful London move and you will play it later, but the other side needs the support first, and this leaves your light-squared bishop shut in.',
              'Bxc7': 'Count it before you take: the queen on d8 guards that pawn, so you have given a bishop for a pawn — and not just any bishop, but the one you rearranged the whole opening to develop.',
              Nf3: 'Coming next, and nothing is wrong with it. But d4 is currently held up by your queen alone; give it a pawn for support first and Black\'s coming pressure on it never amounts to anything.',
            },
          },
        },
        {
          san: 'e6',
          note: 'Black opens a diagonal for one bishop and shuts one for the other. The pawn now standing on e6 is on a light square, directly in front of the bishop on c8, which has to find another road out. Keep an eye out for ...b6 later — that is Black solving exactly this problem.',
        },
        {
          san: 'Nf3',
          note: 'The knight takes the square it almost always takes here, and it does three things at once. It puts a third attacker on e5 — the square your d-pawn and your bishop already watch, and the one you would love to plant a knight on later. It clears one of the two pieces standing between your king and the rook. And note where it did not go: on e2 the knight would stand directly across the only diagonal your undeveloped bishop has, so one piece would be developed at the cost of burying another.',
          checkpoint: {
            id: 'london-knight-to-the-natural-square',
            prompt: 'Black has opened a diagonal for a bishop. Which knight move develops, brings you a step closer to safety, and adds a third attacker to the e5 square?',
            accept: ['Nf3'],
            hints: [
              'Two pieces still stand between your king and the rook beside it, and until both of them have moved you cannot castle at all.',
              'e5 is the square this whole opening wants to occupy one day. Your bishop already watches it; something else should watch it too.',
              'The knight on your kingside has three squares. One is on the rim, where it touches almost nothing. One stands directly across the only diagonal your last bishop has. The third covers e5 and d4 together.',
            ],
            nearMiss: {
              Ne2: 'Developed, technically — but the knight parks on the one diagonal your light-squared bishop has, so you have brought out one piece by burying another. And from there it does nothing about e5.',
              Bd3: 'The bishop does belong on that diagonal and it is coming. First move the piece that is actually in the way: until the kingside knight moves, you cannot castle at all.',
              c3: 'Solid, and you will play it — but it is a quiet pawn move at a moment when you have two pieces still at home and a king still in the centre. Develop first, patch afterwards.',
              Nc3: 'Natural in most openings, and wrong in this one: c3 is a square your own pawn wants, and from there the knight does not defend d4 or touch e5.',
              e4: 'You spent last move deliberately putting this pawn on the third rank to build a chain. Pushing it again spends a second move to undo the first, and opens the centre while your king is still standing in it.',
            },
          },
        },
        {
          san: 'Bd6',
          note: 'Black develops onto the same diagonal your bishop is using and offers a trade. This is the most testing thing Black does to a London at club level, and it is aimed at exactly the right target: if that trade happens on your terms or Black\'s, the bishop the entire setup was arranged to free comes off the board.',
        },
        {
          san: 'Bg3',
          note: 'You decline, and the reason is about recaptures rather than about losing a piece. The bishop on f4 is defended by the e3 pawn, so ...Bxf4 is only a trade — but you would have to take back with the e-pawn, and the chain you built two moves ago would be gone. Stepping back to g3 keeps the bishop on the same diagonal and changes the terms: now ...Bxg3 is answered by hxg3, which opens the h-file pointing straight at Black\'s king and leaves a pawn covering f4 and h4. A trade you would happily accept is not a trade Black wants to offer. The cost is a move, and a bishop that ...Nh5 can come after one day.',
          checkpoint: {
            id: 'london-sidestep-the-trade',
            prompt: 'Black\'s bishop has come to challenge yours on the diagonal. Nothing is hanging — but if the trade happens here, the recapture hurts you. Where can the bishop stand so a trade would suit you instead?',
            accept: ['Bg3'],
            hints: [
              'Work out what happens if you ignore it. Black takes, and you must take back with your e-pawn — the pawn holding the whole chain together.',
              'Move the bishop and a different pawn does the recapturing instead. Ask yourself which of your pawns you would actually be pleased to see arrive there.',
              'You want the square where Black taking your bishop would be answered by your h-pawn — because that pawn coming inwards opens the file pointing straight at Black\'s king. Only one square on this diagonal fits, and it is one Black\'s bishop cannot reach.',
            ],
            nearMiss: {
              'Bxd6': 'Playable, and it is the move most beginners make — but you have handed over the best piece in your position for one that was doing considerably less. That bishop, out in front of the pawn chain, is the reason the London is set up the way it is.',
              Be5: 'Meeting the bishop head on, but it invites ...Bxe5, and then you either recapture with the d-pawn and give up the chain you built, or with the knight and undevelop it. The bishop can simply step aside for free instead.',
              Bg5: 'The wrong diagonal now. It abandons the dark squares this bishop was posted to watch, and ...h6 chases it about into the bargain.',
              Bd3: 'A good move and it is coming — but leave the bishop where it is and Black takes it, and you have to answer with the e-pawn. Deal with the bishop while the choice is still yours.',
              h3: 'This does eventually give the bishop a bolt-hole, but it spends a whole move on a piece that can step aside by itself, and Black is free to take on f4 first anyway.',
              Ne5: 'The outpost is a genuine London idea and it is worth remembering — but a lone knight there is simply traded off, and meanwhile Black takes your best bishop.',
            },
          },
        },
        {
          san: 'O-O',
          note: 'Black gets the king safe before anything opens, the same discipline you are about to show. It also tells you where to aim. The king now sits behind three pawns, and the one on h7 has just two defenders: the king itself, and the knight on f6 you were told to keep an eye on. That is precisely the square your next two pieces are going to point at — and it is why every sacrifice on h7 in this system begins by removing that knight or luring it away. While it stands on f6 it can simply take on h7 itself, so the king is never forced out and the attack never gets going.',
        },
        {
          san: 'Bd3',
          note: 'The last bishop comes out, onto the diagonal that ends on h7. Together with the bishop on g3, a knight that will later jump to e5, and the queen once c2 is available, this is the London\'s standard attacking formation — four pieces all aimed at the same corner. Note the square you did not take: c4 is the great square in other openings, but here Black\'s pawn on d5 simply captures it. The cost of d3 is real too — the bishop stands on a square Black can attack with ...c5-c4, and Black starts on that plan immediately.',
          checkpoint: {
            id: 'london-bishop-at-the-king',
            prompt: 'Black has just castled. Bring out your last bishop — and pick its square carefully, because most of that diagonal is not safe.',
            accept: ['Bd3'],
            hints: [
              'Black castled a move ago. Count the defenders of the pawn in front of that king: there are only two, and one of them is the king. A corner held that thinly is the one worth aiming at.',
              'One of your bishops already sits on a diagonal running towards Black\'s king. Your other bishop has the mirror-image diagonal, ending on h7 — get it onto that one.',
              'Its route out has five squares. Two of them are captured by a pawn on arrival, one is chased straight back by a pawn the moment it lands, and one is so timid it just stares at your own knight. The square that is left is the one that joins the other bishop in pointing at Black\'s king.',
            ],
            nearMiss: {
              Bc4: 'Count it before you play it: Black\'s pawn on d5 is looking straight at that square and simply takes the bishop. It is the best square in the Italian Game and it is not available here.',
              Ba6: 'The b7 pawn takes it. Reaching for the longest diagonal is not the same as reaching for a safe one.',
              Bb5: 'It looks like a threat and it is not: Black castled a move ago, so the diagonal in front of the bishop is empty all the way to e8. Then ...c6 kicks it away, and you have spent two moves to end up worse than if you had gone straight to the right square. Moves that only look aggressive just lose time.',
              Be2: 'Safe and completely passive — from there it looks at its own knight and takes no part in what happens on the kingside. The reason your other bishop stands on the h2-b8 diagonal is that this one has a matching diagonal of its own.',
              Nbd2: 'Also coming, and nothing is wrong with it. But the knight\'s square is not going anywhere, whereas Black\'s ...c5 and ...c4 is a plan to take away the bishop\'s square — take it while it is still there.',
              Ne5: 'The outpost is the big idea, but it works as a team: two bishops, a knight and a queen all aimed at the same corner. Sent on ahead alone the knight is just exchanged.',
              e4: 'Opening the centre with your king still standing in it, against an opponent who is developed and castled. This system is built to stay solid until your own king is tucked away.',
            },
          },
        },
        {
          san: 'c5',
          note: 'Black hits the base of your centre from the side instead of head on, which is the standard way to fight a London. Do the counting rather than reacting: d4 is attacked once, by this pawn, and defended twice, by the pawn on e3 and the knight on f3. Nothing is hanging. But Black can keep adding: ...Nc6 piles straight onto the same pawn, and ...Qb6 asks a second question, because the bishop that used to guard b2 left home on move three. The cheapest way to end that conversation permanently is to add a defender now.',
        },
        {
          san: 'c3',
          note: 'A tiny pawn move doing three jobs. It gives d4 a third defender, so the queenside pressure never becomes anything. It opens c2 for your queen, where she joins the two bishops aiming at h7. And it makes the centre permanent, so you can turn to the kingside without checking on the middle every move. The price is that your last knight can no longer use c3 — which sounds like a real cost and is not, for a reason the very next move makes clear.',
          checkpoint: {
            id: 'london-prop-up-the-centre',
            prompt: 'Black has struck at your centre from the side. Count the attackers and defenders on d4 first — then find the modest move that settles the question for good and opens a road for your queen at the same time.',
            accept: ['c3'],
            hints: [
              'd4 is attacked once and defended twice, so nothing is hanging. This is not a rescue — it is about making the centre permanent before Black adds more attackers.',
              'Your queen has nowhere useful to go. She would like a square on the same diagonal as your king\'s bishop, the one aiming at h7 — but one of your own pawns is standing on it.',
              'One pawn move adds a third defender to d4 and vacates the square your queen wants. It costs your last knight its natural home; pay it, because that knight has another route.',
            ],
            nearMiss: {
              'dxc5': 'Genuinely playable — the engine even prefers it a shade. But it releases the tension you spent the whole opening building, and ...Bxc5 develops Black\'s bishop onto a better diagonal for free. While you are learning the system, hold the centre.',
              Nc3: 'It develops, and in most openings it is right. Here it stands exactly where your pawn needs to be, and it does not even defend d4 — a knight there covers d5 and e4, not the pawn under pressure.',
              'O-O': 'Never a mistake, and it is coming in two moves. But Black has just asked a question of your centre, and this does not answer it. Your king is in no danger at all yet; the pawn on d4 is the thing with a deadline.',
              Nbd2: 'Your last knight does belong there and it is the next move — but a pawn move first both shores up d4 and opens a square for the queen, and it is the move that decides which square the knight has to take.',
              'Bxh7+': 'Sacrificing on h7 is a real London idea and one day you will play it. Not yet: your rooks are not in the game, your king is still on e1, and if the attack does not land you are a whole piece down for one pawn. Count attackers against defenders before giving anything away.',
              e4: 'Breaking open the middle with your king still on e1 and Black fully developed. This is the one position the London is built never to reach.',
            },
          },
        },
        {
          san: 'Nc6',
          note: 'Black brings the knight to its best square, adding a second attacker to d4 and eyeing b4 and e5 on the way. Both sides are now doing the same quiet thing: piling more pieces onto the one pawn in the middle that cannot move. You have a defender in hand; Black has run out of easy attackers.',
        },
        {
          san: 'Nbd2',
          note: 'The last piece, and it goes to the square its opposite number in the Italian Game dreads — because there, the dark-squared bishop is still sitting at home behind it. Here that bishop left on move three, so this square blocks absolutely nothing. This is the payoff for the one move order the London insists on. From d2 the knight guards e4 and c4, the two squares Black would most like to use: ...Ne4 has no future, and ...c4 stops being free. Later it can travel on to f1 and g3, or back up an e4 break of your own.',
          checkpoint: {
            id: 'london-last-piece-out',
            prompt: 'One of your knights has still never moved, and its natural square is taken by your own pawn. Bring it out anyway — and notice how little the square it has to use costs you here.',
            accept: ['Nbd2'],
            hints: [
              'Look for the knight still standing exactly where the game began. There is only one left.',
              'Its natural central square is occupied by your own pawn, so it has to go the modest way — inwards, not to the rim, where it would guard nothing at all.',
              'There is one square that keeps an eye on both e4 and c4 — the two squares Black would most like to use — and that, because your dark-squared bishop left home on move three, blocks nothing whatsoever. That is what the opening\'s one fixed move order bought you.',
            ],
            nearMiss: {
              Na3: 'It does develop, and it even looks at b5 — but a knight on the rim guards nothing in the centre, and you built that centre precisely so it would be worth guarding.',
              Ne5: 'The outpost, and a genuine plan — but Black replies ...Nxe5, and with your last piece still at home you end up recapturing on Black\'s terms rather than your own. Finish developing, then jump.',
              'O-O': 'Coming next, and correctly so. Right now, though, nothing at all is attacking your king, and you have a piece that has taken no part in the game. Spend the free move on the piece, not the king.',
              Qc2: 'The square your last pawn move opened, and a real London move — the queen joins the aim at h7. But a queen brought out ahead of the last minor piece is a queen that gets chased around; develop first.',
              Nfd2: 'Right square, wrong knight. This one is doing real work on f3, watching e5 and d4, and sending it backwards undoes that — while the piece that has never moved is still sitting at home.',
              'dxc5': 'This wins nothing: Black recaptures happily, gets a better diagonal for a piece out of it, and you have given up the pawn your entire setup is anchored on.',
            },
          },
        },
        {
          san: 'b6',
          note: 'Black solves the problem created back on move six. The bishop on c8 was shut in by its own e-pawn, and now it comes out on the long diagonal instead. Every piece Black owns is about to be in the game, which is your cue to stop building and start playing.',
        },
        {
          san: 'O-O',
          note: 'You castle last, and in this system that is the right order rather than laziness. With a closed centre and no open files, nothing could reach your king while the setup was being built, so every free move went to a piece instead. Now it matters: the moment the centre opens, a king on e1 shares a file with everything dangerous, and Black is fully developed. Castling also brings the rook to f1, which is the file that opens if you ever play the e4 break. From here the London plays itself — Qc2, then Ne5, and two bishops, a knight and a queen are all pointing at h7.',
          checkpoint: {
            id: 'london-castle',
            prompt: 'Your setup is complete, but your king is still in the middle. Get it safe now that every other piece is in play.',
            accept: ['O-O'],
            hints: [
              'Every piece from your setup is developed; the only job left is your king\'s safety.',
              'Count what your rooks have contributed so far: nothing at all. They are still sitting in their corners, and the piece standing between them and the game is your own king.',
              'The centre will not stay closed forever, and the moment it opens, your king shares a file with everything dangerous. Look at the wing where the squares between your king and its rook are already clear.',
            ],
            nearMiss: {
              Qc2: 'A natural London move, and you will likely play it soon. But your king comes first while it still sits in the centre.',
              h3: 'Useful to have in reserve, but it doesn\'t answer the biggest problem on the board: your own king safety.',
              Ne5: 'The outpost, and the engine slightly prefers it — it is a good move. But your king is still in the centre with the position about to open, and safety costs you almost nothing here while removing the one thing that could actually go wrong.',
              'dxc5': 'Releasing the tension for no gain: Black recaptures with a pawn and gets a broad centre, while your king is still standing in the middle of the board.',
              Rf1: 'This is the very rook that castling was going to move for free, and it does not even improve — still behind a pawn, and now your king is stranded in the centre with no way out.',
            },
          },
        },
      ],
    },
  ],
});
