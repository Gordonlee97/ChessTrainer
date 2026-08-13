import { parseLesson } from '../load';

export const blackVsE4 = parseLesson({
  id: 'black-vs-e4',
  title: 'Answering 1.e4 as Black',
  kind: 'opening',
  side: 'black',
  summary:
    'The same three rules White follows in the Italian Game, seen from the other side of the board: meet White\'s claim on the centre, bring your minor pieces — knights and bishops — into the game, and get your king safe before things open up.',
  tags: ['center-control', 'development', 'king-safety'],
  segments: [
    {
      startFen: null,
      intro:
        'You are Black, facing White\'s most common first move, 1.e4. The plan mirrors White\'s from the Italian Game: meet the centre, develop — get your knights and bishops off their starting squares and into the game — and castle once your position is ready. Follow the same three rules White does and you will never fall behind.',
      moves: [
        {
          san: 'e4',
          note: 'White claims a central square immediately, the most natural first move in chess and the one this whole lesson answers. It does three jobs at once: it takes a square in the middle, it frees the bishop beside White\'s king and the queen behind it, and it quietly covers d5 and f5 so that your pieces cannot use them. That last part is what "controlling the centre" really means — not owning squares, but making them unusable for the other side.',
        },
        {
          san: 'e5',
          note: 'You stake the same claim White just did, and now the two pawns stand nose to nose where neither can advance. That matters more than it looks: with the centre locked head to head, White cannot build a wall of pawns and roll you off the board, and the argument moves to the squares just in front of them — d4 and d5 — where pieces rather than pawns decide who is doing better. It also opens a diagonal for the bishop beside your king and a line for your queen.',
          checkpoint: {
            id: 'black-e4-meet-with-e5',
            prompt: 'White\'s first move took a central square and freed two pieces. Answer it in kind: which pawn move claims a central square of your own and stops that pawn going any further?',
            accept: ['e5'],
            hints: [
              'A pawn does more than stand on its square — it also controls the two squares diagonally in front of it. White\'s pawn already covers d5 and f5, and every central square you leave uncontested is one your own pieces will never get to use.',
              'The only way to stop a pawn for good is to put one directly in its path. Blocked head to head, neither pawn can advance again, and White\'s centre stops growing on the spot.',
              'Exactly one of your pawns can get into that pawn\'s way at all, and only if the two of them end up face to face. A pawn that stops a square short blocks nothing, and shuts in your light-squared bishop into the bargain.',
            ],
            nearMiss: {
              c5: 'A real defence in its own right — that is the Sicilian, the most popular answer to 1.e4 there is. It fights for the centre from the side rather than head on, and the games turn sharp quickly. This lesson answers White\'s pawn directly instead.',
              e6: 'Also sound — that is the French Defence, solid and reliable. But it shuts in your light-squared bishop for a while and leaves White free to take more space in the middle. The direct answer claims a central square straight away.',
              d5: 'That is the Scandinavian, and it is playable — but White simply takes the pawn, and you have to fetch it back with your queen, who then gets chased around the board while White develops with a free move each time.',
              Nf6: 'That is Alekhine\'s Defence: you invite White\'s pawns to chase your knight up the board and hope to shoot at them later. A real opening, and a provocative one. This lesson takes the straightforward road.',
            },
          },
        },
        {
          san: 'Nf3',
          note: 'White develops a knight and attacks your e5 pawn in the same move. That is the most valuable kind of opening move there is: you now have to spend your turn answering the threat instead of getting on with your own plan — unless the answer happens to be a move you wanted to play anyway. The free move a threat like this buys is called a tempo, and collecting them is most of what a good opening does.',
        },
        {
          san: 'Nc6',
          note: 'White attacked your e5 pawn, so you have to deal with it — but notice you did not have to spend a move only defending. This knight guards the pawn and develops towards the centre at the same time, which is exactly what White just did to you, and it takes d4 and b4 away from White\'s pieces on the way. When a threat can be answered by a move you wanted to play anyway, it costs you nothing.',
          checkpoint: {
            id: 'black-e4-defend-and-develop',
            prompt: 'White\'s knight is attacking your e5 pawn. Which move defends it and develops a piece at the same time?',
            accept: ['Nc6'],
            hints: [
              'You do have to answer the threat — but the best answers to a threat also do something you were going to do anyway, so the threat ends up costing you nothing.',
              'Ask what each defender costs you. A pawn defends and develops nothing; the queen defends and turns into a target. A defender that also joins the game is worth more than either.',
              'Seven different moves guard e5. Two are pawn moves that develop nothing, three bring your queen out to do a pawn\'s job, and one blocks the pawn you will want to move later. The seventh is a piece arriving on the square it belonged on anyway.',
            ],
            nearMiss: {
              d6: 'This does defend the pawn, and it is a real opening — but it develops nothing and shuts in your dark-squared bishop for now. Prefer the move that does two jobs.',
              f6: 'It guards e5, but it takes the best square away from your knight and loosens the squares around your king. Defending with this pawn costs more than it saves.',
              Qe7: 'The queen defends the pawn, but she blocks your own bishop and will be chased around later. Bring out a minor piece before the queen.',
              Nf6: 'That is the Petrov, a genuinely sound defence — rather than defend e5 you counter-attack e4. Nothing is wrong with it, but it plunges straight into forcing lines, and this lesson is about the habit that always applies: answer a threat with a move that develops.',
              Bc5: 'It develops, but count before you play: e5 is left guarded by nothing at all, and White\'s knight simply takes it. A developing move that drops a pawn is not really a developing move.',
            },
          },
        },
        {
          san: 'Bc4',
          note: 'The bishop steps outside White\'s pawns and points at f7 — the one square in your camp that nothing but your king defends. It is not a threat yet, and it is not meant to be. It is a piece taking aim, so that if you ever slip, half of an attack is already built and waiting. Openings are full of moves like this: quiet now, dangerous later.',
        },
        {
          san: 'Bc5',
          note: 'Your bishop mirrors White\'s and takes aim at f2 — the same weakness on the other side of the board, guarded by White\'s king and nothing else. It also covers d4, the square White has been trying to occupy with a pawn since the game began. Copying is not lazy here: in a symmetrical position all White really owns is the extra move of going first, and that is worth far less than one mistake.',
          checkpoint: {
            id: 'black-e4-bishop-to-c5',
            prompt: 'White\'s bishop has taken aim at f7, the weakest square in your camp. Answer it: which developing move points your dark-squared bishop at the matching weakness in White\'s?',
            accept: ['Bc5'],
            hints: [
              'Every square in White\'s camp is guarded by a pawn or a piece except one — and it is the mirror image of the square White is leaning on in yours.',
              'White\'s f2 pawn is guarded by nothing but the king, just as f7 was for you. A bishop is worth what its diagonal is worth, and the diagonal you want is the one that ends there.',
              'Your dark-squared bishop has five squares. One is taken by a pawn the instant it arrives, one is chased off by the pawn move White wants to play next in any case, and one stands in front of the pawn you will need later to prop up e5. Of the two left over, both point into White\'s half — but one of them touches nothing that is actually there, while the other ends on f2, the square White\'s king is guarding by itself.',
            ],
            nearMiss: {
              Be7: 'Safe, but passive. From there the bishop takes part in nothing; the whole point of this moment is the long diagonal it is declining to take.',
              Bd6: 'It looks active, but it stands in front of the pawn you will shortly need in order to defend e5 — so you end up either blocking your own centre or moving this bishop a second time.',
              Bb4: 'A real square in other openings. Here White answers with c3, a move White wants to play in any case, and your bishop is chased away — you have handed over a free move.',
              Nf6: 'That is the Two Knights Defence, and it is every bit as respectable. It invites 4.Ng5, straight at f7, and the game turns sharp immediately. Nothing is wrong with it; this lesson keeps to the quieter, mirror-image road.',
            },
          },
        },
        {
          san: 'c3',
          note: 'A quiet move with a real point. White would like to play d4 and own the whole centre, and c3 means that when you answer d4 with ...exd4, White takes back with a pawn rather than a piece and ends up with two pawns side by side in the middle — the strongest formation there is in the opening. The cost is that White\'s queenside knight can no longer use c3 and must travel the long way round. Every quiet pawn move in an opening is buying something; the habit worth building is asking what.',
        },
        {
          san: 'Nf6',
          note: 'Your last easy minor piece comes out, and it attacks e4 on the way — the develop-with-a-threat trick played straight back at White. That pawn has no defender at all at this moment, so this is a real question and it has to be answered, which is why White\'s next move is a defensive one rather than the d4 push c3 was preparing. The knight also lands on the best defensive square in front of your king, which is where you would want it once you castle anyway.',
          checkpoint: {
            id: 'black-e4-hit-the-loose-pawn',
            prompt: 'White has just spent a move on a quiet pawn push. Count the defenders of the pawn on e4 — then find the developing move that asks it a question.',
            accept: ['Nf6'],
            hints: [
              'A move that only defends, or only develops, does one job. The moves that gain you time do two — and White has just handed you the chance by playing a pawn move that develops nothing.',
              'Look hard at e4 and count what guards it. Not the knight on f3, not the bishop, not a pawn: nothing at all. An undefended pawn in the centre is an invitation.',
              'Two of your pawns could attack that square, but one is captured on arrival by the bishop on c4 and the other rips open the squares your king is about to move behind. Only two of your pieces can attack it, and one of those is your queen, who is simply taken by the knight on f3 the moment she arrives. The other has not moved all game, and it attacks e4 from the square it wanted in any case.',
            ],
            nearMiss: {
              d6: 'Solid, and you will play it in a moment anyway — but right now White\'s e4 pawn is undefended and White has just spent a move on a pawn that develops nothing. Ask the question while it is free.',
              Qf6: 'It defends e5 a second time, but the queen is standing on the square your knight wants, and a queen out this early gets chased by every piece White develops — and each of those chases is a free move for White.',
              d5: 'The right idea in the wrong position. That square is attacked twice, by the e4 pawn and by the bishop on c4, and guarded once, by your queen — and a queen that recaptures there is taken by the bishop. You would simply be a pawn down.',
              'Bxf2+': 'Count it before you play it: the king takes the bishop and you have given a whole piece for one pawn. The checks that follow do not win it back. Sacrifices on f2 work only when more of your pieces are already pointing at it than White has defenders.',
            },
          },
        },
        {
          san: 'd3',
          note: 'White answers the threat with the cheapest defender there is: a pawn. It also opens a diagonal for the bishop on c1, which until now had no way out at all. Modest rather than ambitious, and deliberately so — d4 is still the plan, but White will play it on a move when it wins something, not on a move when it drops a pawn.',
        },
        {
          san: 'd6',
          note: 'You prop up e5 exactly the way White just propped up e4, and for the same reason: a pawn that was defended once is now defended twice, so White\'s d4 break stops being frightening before it ever arrives. It also opens the diagonal of your last undeveloped piece, the bishop on c8. Both centres are solid and locked now, which is precisely why the moves that follow are quiet ones — with no break available for either side, the game becomes a competition over who improves their pieces.',
          checkpoint: {
            id: 'black-e4-shore-up-the-centre',
            prompt: 'White has defended e4 and still has the d4 break in hand. Which quiet move gives e5 a second guard and opens a road for your last bishop?',
            accept: ['d6'],
            hints: [
              'White\'s pawn on c3 was played for one purpose: the push to d4. When it lands it hits your e5 pawn and your bishop in the same instant, and you would much rather have answered it beforehand.',
              'Count e5 as it stands: one attacker, one defender. That holds today. It stops holding the moment a second white pawn arrives beside it.',
              'Only one pawn of yours can add a guard to e5 — your knight is standing on the square the other one would have used — and that same pawn is the door your last bishop is stuck behind.',
            ],
            nearMiss: {
              'O-O': 'Never a mistake, and the engine even prefers it a shade here. But White\'s last three moves have all been building towards d4, and when it comes it hits your e5 pawn and your bishop together. Settle that first; your king is in no danger yet and castling will still be there.',
              'Nxe4': 'Count the defenders before you take. White\'s last move put a pawn behind that square, so the pawn simply recaptures and you have given a knight for a pawn.',
              Ng4: 'The knight lunges at f2, but nothing supports it there. A pawn to h3 sends it home, and you have spent two moves to end up where you started while White gets on with the centre.',
              d5: 'Breaking in the centre is a real plan and one day it is the right one — but this opens lines while your king is still standing among them. Make the centre solid first.',
            },
          },
        },
        {
          san: 'O-O',
          note: 'White tucks the king behind three untouched pawns and brings a rook towards the middle. Castling is the only move in chess that develops two pieces at once, and leaving it too late is the most common way beginners lose games: the moment the centre opens, a king still standing on its starting square shares a file with everything dangerous.',
        },
        {
          san: 'O-O',
          note: 'You do the same, and the opening is over. Both kings are safe, every minor piece is out, and you have matched White move for move without ever falling behind — which is exactly what a defence is for. From here the moves change character: instead of bringing out new pieces you improve the ones you already have, and the player who finds a job for their worst-placed piece is the one making progress.',
          checkpoint: {
            id: 'black-e4-castle',
            prompt: 'Your pieces are out and the centre is stable. Do the last thing the opening asks of you.',
            accept: ['O-O'],
            hints: [
              'A locked centre does not stay locked. Every trade in the middle brings closer the moment when files open — and a king standing on an open file is the last thing you want.',
              'Look at what has taken no part in the game at all. Both rooks are still sitting in their corners, and the piece standing between them and the board is your own king.',
              'Two rooks, two directions. On one side your queen and your light-squared bishop are still in the way; on the other, the road has been clear since your knight and bishop came out. Only one of those roads is open to your king.',
            ],
            nearMiss: {
              h6: 'A useful little move to keep in reserve — it takes g5 away from a bishop or a knight. But nothing is heading there yet, and it does not do the one job still left undone.',
              Bg4: 'A real developing move, and it even puts a question to the knight guarding White\'s centre. Your king is the priority, though: get it out of the middle and this bishop move is still available afterwards.',
              'Bxf2+': 'Count the defenders first. White has castled, so the rook on f1 guards f2 alongside the king — the bishop is taken and you have given a piece for a pawn.',
              d5: 'The central break, and it will be the right idea at some point. Not with your king still standing in the middle of the board: opening lines helps whichever side is readier for them, and right now that is White.',
            },
          },
        },
      ],
    },
  ],
});
