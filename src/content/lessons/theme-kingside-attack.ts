import { parseLesson } from '../load';

export const themeKingsideAttack = parseLesson({
  id: 'theme-kingside-attack',
  title: 'Attacking the Kingside',
  kind: 'theme',
  side: 'white',
  summary:
    'A plan for turning a quiet, safe position into an attack: reroute a piece that isn\'t doing much toward the kingside — the side of the board your king castled to — because a real attack needs more of your pieces aimed at the enemy king than the defender has pieces to stop them.',
  tags: ['king-safety', 'space'],
  segments: [
    {
      startFen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7',
      intro:
        'This is the position from the Italian Game lesson — you\'ve already been here. Now the plan: walk the knight on b1 — still sitting on its own starting square, on the queenside, the half of the board behind your queen — all the way to d2, then f1, then g3, toward the kingside. That side of the board is quiet and has nothing left for the knight to do, so it heads instead toward more space — more squares your pieces control — where Black\'s king lives.',
      moves: [
        { san: 'Re1', note: 'The rook steps onto the file it was castled next to, ready for whenever the centre opens.' },
        { san: 'a6', note: 'Black takes the b5 square away from your pieces before you can use it.' },
        { san: 'Nbd2', note: 'The knight begins its journey — the first stop on the way to the kingside.' },
        { san: 'Ba7', note: 'Black tucks the bishop safely out of the way for the same reason as before.' },
        {
          san: 'Nf1',
          note: 'The knight keeps walking instead of settling anywhere else, continuing on toward g3.',
          checkpoint: {
            id: 'theme-attack-knight-rerouting',
            prompt: 'Continue the knight\'s journey toward the enemy king. Which move starts walking it toward the kingside?',
            accept: ['Nf1'],
            hints: [
              'The knight is partway through a three-stop walk toward the kingside.',
              'From d2, one square keeps the knight heading toward g3.',
              'Play Nf1.',
            ],
            nearMiss: {
              Nb3: 'Retreats toward the queenside — the far side of the board from your king — while the attack you\'re building needs pieces headed the other way.',
              h3: 'Useful to have in reserve, but it doesn\'t move you any closer to the plan: getting a piece toward Black\'s king.',
            },
          },
        },
        { san: 'Ne7', note: 'Black\'s other knight repositions too, from c6 to e7, opening a path toward g6 or d5 later.' },
        { san: 'Ng3', note: 'The knight completes its walk, landing on the kingside where it can support an attack.' },
      ],
    },
  ],
});
