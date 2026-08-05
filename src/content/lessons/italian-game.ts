import { parseLesson } from '../load';

export const italianGame = parseLesson({
  id: 'italian-game',
  title: 'The Italian Game',
  kind: 'opening',
  side: 'white',
  summary:
    'The most natural opening in chess: put a pawn in the middle, bring out both minor pieces, and castle. Every move has one clear job.',
  tags: ['center-control', 'development', 'king-safety'],
  segments: [
    {
      startFen: null,
      intro:
        'You are White. The plan is simple and you can hold it in your head: claim the centre, develop the knight and bishop, and get the king safe. Nothing clever is required.',
      moves: [
        {
          san: 'e4',
          note: 'Claims a central square and frees two pieces at once — the bishop on f1 and the queen. Almost no other first move does two jobs.',
          checkpoint: {
            id: 'italian-open-with-e4',
            prompt: 'Open the game. Which pawn move claims the centre and frees two pieces?',
            accept: ['e4'],
            hints: [
              'Central pawn moves are the ones that open lines for your pieces.',
              'The pawn in front of your king can go two squares.',
              'Play e4.',
            ],
            nearMiss: {
              d4: 'Also a real opening move — that is the Queen\'s Gambit family. But e4 frees your bishop toward f7, which is where this lesson goes.',
              Nf3: 'A good developing move, but play a central pawn first so your pieces have lines to come out on.',
            },
          },
        },
        { san: 'e5', note: 'Black mirrors you. Now both sides have a pawn in the centre and the fight is over d4 and d5.' },
        {
          san: 'Nf3',
          note: 'Develops a piece and attacks the e5 pawn at the same time. A developing move that also makes a threat is a free tempo.',
        },
        { san: 'Nc6', note: 'Black defends e5 with a knight, which also develops. Notice both sides are following the same rules.' },
        {
          san: 'Bc4',
          note: 'The bishop points at f7 — the one square in Black\'s camp defended by nothing but the king.',
          checkpoint: {
            id: 'italian-bishop-to-c4',
            prompt: 'Develop your light-squared bishop to its most aggressive square.',
            accept: ['Bc4'],
            hints: [
              'Aim at the weakest point in Black\'s position.',
              'f7 is defended only by the king.',
              'The bishop belongs on c4.',
            ],
            nearMiss: {
              Bb5: 'Also strong — that is the Ruy Lopez, and a fine opening. But we are learning the Italian, where c4 hits f7 directly.',
              Be2: 'Safe but passive. The bishop does nothing from e2; on c4 it eyes Black\'s weakest square.',
              d4: 'Sharp, and a real opening called the Scotch. Compare it with the Compare button — but for now, develop.',
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
                'The most respected opening in chess at every level',
              ],
              cons: [
                'Far more theory than the Italian',
                'The point of the pressure is slow and hard to feel as a beginner',
              ],
            },
          ],
        },
        { san: 'Bc5', note: 'Black copies you, aiming a bishop at your own weak square on f2. Symmetry is fine here.' },
        {
          san: 'c3',
          note: 'A quiet move with a real point: it prepares d4, so your pawns can take the whole centre next.',
        },
        { san: 'Nf6', note: 'Black develops the last minor piece that can come out easily, and attacks your e4 pawn.' },
        {
          san: 'd3',
          note: 'Defends e4 and opens a path for the dark-squared bishop. Solid rather than ambitious, which is what you want while learning.',
        },
        { san: 'd6', note: 'Black defends e5 the same way, for the same reason.' },
        {
          san: 'O-O',
          note: 'The king goes behind a wall of untouched pawns and the rook joins the game. Castle early and you avoid most disasters.',
          checkpoint: {
            id: 'italian-castle-kingside',
            prompt: 'Your pieces are out and the centre is stable. Make your king safe.',
            accept: ['O-O'],
            hints: [
              'Kings do not belong in the centre once lines start opening.',
              'You have a move that relocates the king and develops a rook at once.',
              'Castle kingside.',
            ],
            nearMiss: {
              Bg5: 'Developing, but your king is still in the middle. Get it safe first — this bishop move will still be there.',
              b4: 'Too loose. Pawn moves on the side while your king sits in the centre is how beginners lose games.',
            },
          },
        },
        { san: 'O-O', note: 'Black does the same. Both kings are safe and the real game starts now.' },
        { san: 'Re1', note: 'The rook steps onto the central file it was castled next to. Rooks belong on open or soon-to-open files.' },
        { san: 'a6', note: 'A useful little move, taking b5 away from your pieces before you can use it.' },
        { san: 'Bb3', note: 'Stepping back before Black can chase the bishop with d5 or Na5, keeping the aim at f7.' },
        { san: 'Ba7', note: 'Black tucks the bishop away for the same reason.' },
        {
          san: 'Nbd2',
          note: 'The last minor piece comes out, heading for f1 and then g3 or e3. Every piece is now doing something.',
        },
      ],
    },
  ],
});
