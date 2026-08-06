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
          note: 'White claims a central square immediately, the most natural first move in chess and the one this whole lesson answers.',
        },
        {
          san: 'e5',
          note: 'You stake an equal claim in the centre, the same way White just did, so the position stays balanced instead of tilting White\'s way.',
          checkpoint: {
            id: 'black-e4-meet-with-e5',
            prompt: 'White has just claimed the centre. Play the move that stakes an equal claim of your own.',
            accept: ['e5'],
            hints: [
              'When White grabs a central square, matching it keeps the fight balanced.',
              'The pawn in front of your king can go two squares forward, just like White\'s first move.',
              'Play e5.',
            ],
            nearMiss: {
              c5: 'A real defence in its own right — that\'s the Sicilian, sharp and unbalancing. But e5 answers White\'s centre move directly, which is the plan for this lesson.',
              e6: 'Also sound — that\'s the French Defence, solid but a little slow to open lines. e5 claims the centre immediately instead.',
            },
          },
        },
        { san: 'Nf3', note: 'White develops a knight and attacks your e5 pawn at the same time, so you need to defend it or lose it.' },
        { san: 'Nc6', note: 'You defend e5 with a knight, developing a piece while you\'re at it, exactly what White just did.' },
        { san: 'Bc4', note: 'The bishop aims at f7, the one square in your camp defended only by your king.' },
        {
          san: 'Bc5',
          note: 'Your bishop mirrors White\'s, aiming at f2, the equivalent weak square in White\'s camp.',
          checkpoint: {
            id: 'black-e4-bishop-to-c5',
            prompt: 'Develop your bishop to its most active square, the same square White just used.',
            accept: ['Bc5'],
            hints: [
              'Aim your bishop at the same weak square White is aiming at in your camp.',
              'White\'s f2 pawn is guarded by nothing but the king, just like f7 was for you.',
              'The bishop belongs on c5.',
            ],
            nearMiss: {
              Be7: 'Safe, but passive. The bishop does far more from c5, where it eyes White\'s weak f2 pawn.',
              Bd6: 'Blocks your own d-pawn for no reason. c5 reaches an active diagonal without getting in the way.',
            },
          },
        },
        { san: 'c3', note: 'A quiet move that prepares d4, so White\'s pawns can claim the whole centre next.' },
        { san: 'Nf6', note: 'You bring out your last easy minor piece and attack White\'s e4 pawn in return.' },
        { san: 'd3', note: 'White defends e4 and opens a path for the other bishop, solid rather than sharp.' },
        { san: 'd6', note: 'You defend e5 the same way White just defended e4.' },
        { san: 'O-O', note: 'White tucks the king behind a wall of untouched pawns and brings a rook into the game.' },
        {
          san: 'O-O',
          note: 'You do the same. Both kings are safe, and you\'ve followed White\'s plan step for step without losing any ground.',
          checkpoint: {
            id: 'black-e4-castle',
            prompt: 'Your pieces are out and the centre is stable. Get your king safe, the way White just did.',
            accept: ['O-O'],
            hints: [
              'Once your pieces are out, a king still stuck in the centre is the biggest risk left on the board.',
              'You have a move that gets the king to safety and brings a rook into play at once.',
              'Castle kingside.',
            ],
            nearMiss: {
              h6: 'A useful little move to keep in reserve, but it doesn\'t do the one job left undone. Get your king safe first.',
              Bg4: 'A real developing move, and it even puts a question to White\'s knight. But your king is still the priority right now.',
            },
          },
        },
      ],
    },
  ],
});
