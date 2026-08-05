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
        { san: 'd4', note: 'You open with a central pawn, and unlike many openings, you are about to play almost the same five moves no matter how Black replies.' },
        { san: 'd5', note: 'Black meets you in the centre, the most natural reply and exactly what the London is built to handle.' },
        {
          san: 'Bf4',
          note: 'Your dark-squared bishop gets out before your own pawns can trap it, the move that makes this whole setup work.',
          checkpoint: {
            id: 'london-bishop-out-first',
            prompt: 'Get your dark-squared bishop outside your pawn chain before you close the door with e3.',
            accept: ['Bf4'],
            hints: [
              'In the London, one piece needs to leave home before you build your pawn chain around it.',
              'Play this before e3, or the bishop is stuck behind its own pawns for the rest of the game.',
              'Play Bf4.',
            ],
            nearMiss: {
              e3: 'Play this first and your bishop is stuck behind its own pawn chain for the rest of the game. Get it out before you close the door.',
              Nf3: 'A fine developing move on its own, but it doesn\'t rescue the bishop. Play Bf4 first, then this knight can come out right after.',
            },
          },
        },
        { san: 'Nf6', note: 'Black develops a knight toward the centre, the same idea behind your own coming moves.' },
        { san: 'e3', note: 'Now that the bishop is out, you can safely close the pawn chain behind it and support your centre.' },
        { san: 'e6', note: 'Black opens a diagonal for the other bishop, mirroring your own setup.' },
        { san: 'Nf3', note: 'A natural developing move — this knight almost always belongs on f3 in the London.' },
        { san: 'Bd6', note: 'Black develops actively, eyeing your bishop on f4 along the same diagonal.' },
        { san: 'Bg3', note: 'Rather than trade, you tuck the bishop onto g3, still on the same diagonal and safely out of Black\'s reach.' },
        { san: 'O-O', note: 'Black gets the king safe early, the same job you will do once your own setup is finished.' },
        { san: 'Bd3', note: 'Your other bishop comes out too, aiming toward Black\'s kingside.' },
        { san: 'c5', note: 'Black strikes at your centre from the side, a common try against the London.' },
        { san: 'c3', note: 'A solid pawn that supports your centre without weakening anything.' },
        { san: 'Nc6', note: 'Black finishes developing the knights, the same as you are about to.' },
        { san: 'Nbd2', note: 'Your last knight comes out, completing development without blocking any of your other pieces.' },
        { san: 'b6', note: 'Black prepares to develop the other bishop, getting every piece into the game.' },
        {
          san: 'O-O',
          note: 'You castle last, once every other piece from the setup is already in play.',
          checkpoint: {
            id: 'london-castle',
            prompt: 'Your setup is complete, but your king is still in the middle. Get it safe now that every other piece is in play.',
            accept: ['O-O'],
            hints: [
              'Every piece from your setup is developed; the only job left is your king\'s safety.',
              'You have a move that tucks the king behind its pawns and brings a rook into play at once.',
              'Castle kingside.',
            ],
            nearMiss: {
              Qc2: 'A natural London move, and you will likely play it soon. But your king comes first while it still sits in the centre.',
              h3: 'Useful to have in reserve, but it doesn\'t answer the biggest problem on the board: your own king safety.',
            },
          },
        },
      ],
    },
  ],
});
