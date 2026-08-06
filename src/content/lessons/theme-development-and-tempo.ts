import { parseLesson } from '../load';

export const themeDevelopmentAndTempo = parseLesson({
  id: 'theme-development-and-tempo',
  title: 'Development and Tempo',
  kind: 'theme',
  side: 'white',
  summary:
    'Two ideas that decide who controls the game\'s early pace: development — bringing your knights and bishops, the minor pieces, off their starting squares — and tempo, the free move you gain whenever a developing move also makes a threat your opponent must answer.',
  tags: ['development', 'tempo'],
  segments: [
    {
      startFen: null,
      intro:
        'You are White. Every developing move is good, but some are better than others: a move that develops a piece and threatens something at the same time earns a tempo — free time, because your opponent has to spend their whole turn answering the threat instead of developing their own pieces.',
      moves: [
        { san: 'e4', note: 'Claims the centre and opens lines for two pieces at once.' },
        { san: 'e5', note: 'Black meets you in the centre, and the position stays balanced.' },
        {
          san: 'Nf3',
          note: 'Develops a knight and attacks e5 in the same move — that double duty is what earns the tempo.',
          checkpoint: {
            id: 'theme-tempo-knight-with-threat',
            prompt: 'Play a developing move that also makes a threat, earning a tempo.',
            accept: ['Nf3'],
            hints: [
              'A move that develops and threatens at once forces a reply, which earns you a tempo — a free move.',
              'One of your knights can develop while attacking Black\'s e5 pawn.',
              'Play Nf3.',
            ],
            nearMiss: {
              Nc3: 'Develops, but threatens nothing — compare it with the move that does both.',
              d3: 'A useful pawn move eventually, but right now it neither develops a piece nor threatens anything.',
            },
          },
        },
        { san: 'Nc6', note: 'Black defends e5 with a knight, developing while answering the threat — the tempo is spent, not lost.' },
        { san: 'Bc4', note: 'Aims at f7, the weakest square in Black\'s position.' },
        { san: 'Bc5', note: 'Black mirrors you again, aiming at the same weak square in your own camp.' },
        { san: 'c3', note: 'A quiet move that prepares d4, so your pawns can claim the whole centre next.' },
      ],
    },
    {
      startFen: 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2',
      intro:
        'White\'s second move sends the queen out early, aiming at f7 alongside the bishop that\'s coming to c4 anyway. A queen out this soon just gets chased around the board, and every tempo Black gains chasing it is a tempo White never gets back. One more term for this segment: files are the board\'s vertical columns, running from a to h, and a piece standing on one blocks anything else trying to move along it.',
      moves: [
        { san: 'Nc6', note: 'You develop a knight and defend e5 — White\'s early queen move hasn\'t changed your normal plan at all.' },
        { san: 'Bc4', note: 'White develops the bishop to its usual square — the one real developing move in this whole sequence so far.' },
        { san: 'g6', note: 'You attack the queen while preparing to develop your own bishop onto the long diagonal, so the tempo you gain here costs you nothing.' },
        {
          san: 'Qf3',
          note: 'The queen moves a second time, still eyeing f7 together with the bishop — two moves spent doing a job one minor-piece move usually does.',
        },
        {
          san: 'Nf6',
          note: 'Three jobs in one move: it develops a piece, it blocks the queen\'s own path to f7 along the f-file, and it attacks e4, tying White\'s queen down to defending it instead of doing anything else. White\'s queen has now moved twice and achieved none of that.',
        },
      ],
    },
  ],
});
