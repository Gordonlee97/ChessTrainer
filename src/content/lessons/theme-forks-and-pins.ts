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
        'Black\'s knight jumps to d4, attacking your knight on f3 and your c2 pawn at once — a fork, threatening two targets so you can only save one. But the jump abandons e5, and your own knight was already attacking it.',
      moves: [
        {
          san: 'Nxe5',
          note: 'Takes the undefended pawn and lands the knight on a square that attacks f7 together with your bishop — a threat of its own.',
          checkpoint: {
            id: 'theme-fork-punish-nd4',
            prompt: 'Punish the knight on d4 for abandoning e5. Which move takes a pawn and threatens f7 at the same time?',
            accept: ['Nxe5'],
            hints: [
              'Black\'s knight left e5 undefended when it jumped to d4.',
              'Your knight on f3 can capture on e5, landing on a square that also eyes f7.',
              'Play Nxe5.',
            ],
            nearMiss: {
              Nxd4: 'Natural, but it releases the tension and gives Black exactly the trade they wanted.',
              c3: 'Attacks the knight on d4 and forces it to retreat, but the free pawn on e5 gets away in the meantime.',
            },
          },
        },
      ],
    },
  ],
});
