import { parseLesson } from '../load';

export const themeForksAndPins = parseLesson({
  id: 'theme-forks-and-pins',
  title: 'Forks and Pins',
  kind: 'theme',
  side: 'white',
  summary:
    'Two of the sharpest tactics in chess: a pin freezes a piece that can\'t move without exposing something more valuable behind it, and a fork is one move that attacks two targets at once, so the defender can only save one.',
  tags: ['fork', 'pin'],
  segments: [
    {
      startFen: 'r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
      intro:
        'Once Black played d6, the d7 square emptied, and your bishop on b5, Black\'s knight on c6, and Black\'s king on e8 now all sit on one unbroken diagonal line. The knight is pinned — it cannot legally move at all, because doing so would expose its own king to check.',
      moves: [
        {
          san: 'd4',
          note: 'The pin means Black\'s knight can\'t help recapture on e5 — only the d6 pawn can — so pushing d4 adds real pressure to the square the knight is supposed to defend.',
          checkpoint: {
            id: 'theme-pin-exploit-with-d4',
            prompt: 'Black\'s knight on c6 is pinned and can\'t move. Which pawn move attacks the square it\'s supposed to be defending?',
            accept: ['d4'],
            hints: [
              'A pinned piece can\'t come to the rescue, so attack what it\'s defending.',
              'Your d-pawn can advance two squares to add pressure to e5.',
              'Play d4.',
            ],
            nearMiss: {
              'Bxc6+':
                'Trades your bishop for the knight — an even swap — but the pin was worth more than a trade; a pinned piece is already yours to press, not to cash in early.',
              'O-O': 'Safe and good, but there is a way to press the pin further before you castle.',
            },
          },
        },
      ],
    },
    {
      startFen: 'r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      intro:
        'Black\'s knight has jumped to d4, attacking your knight on f3 and your c2 pawn at once — a fork, one move hitting two things so you can only save one. It also left the e5 pawn free, and taking that pawn looks like a fork straight back, because your knight would land on e5 eyeing f7 alongside your bishop.',
      moves: [
        {
          san: 'Nxd4',
          note: 'Take the knight that is causing the trouble: after Black recaptures, the pawn that lands on d4 sits in the open with nothing defending it. A fork that hands your opponent a bigger one is not a fork worth having.',
          checkpoint: {
            id: 'theme-fork-decline-the-bait',
            prompt: 'The free pawn on e5 is bait. Which capture takes the forking knight instead?',
            accept: ['Nxd4'],
            hints: [
              'Before you grab a free pawn, ask what your opponent gets to play next.',
              'The knight on d4 is the piece causing the trouble, and your knight on f3 attacks it.',
              'Play Nxd4.',
            ],
            nearMiss: {
              Nxe5:
                'This wins the pawn and forks f7, but Black answers Qg5, hitting your knight on e5 and the g2 pawn at once — the bigger fork. Grab f7 as well and it can end fast: Nxf7 Qxg2, Rf1 Qxe4+, Be2 Nf3 is checkmate.',
              c3: 'Attacking the knight is playable, but Black replies Nxf3+ with check and trades it off anyway, keeping a healthy pawn on e5. Taking on d4 yourself gets the same trade and leaves Black\'s pawns worse.',
            },
          },
        },
        {
          san: 'exd4',
          note: 'Black recaptures, and that pawn is now stranded on d4 with no piece of Black\'s defending it.',
        },
        {
          san: 'O-O',
          note: 'Your king is safe, your rook joins in, and the stranded pawn is still there to be attacked later.',
        },
      ],
    },
  ],
});
