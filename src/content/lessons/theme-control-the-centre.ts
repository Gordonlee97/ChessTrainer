import { parseLesson } from '../load';

export const themeControlTheCentre = parseLesson({
  id: 'theme-control-the-centre',
  title: 'Control the Centre',
  kind: 'theme',
  side: 'white',
  summary:
    'Every square in the middle of the board is worth more than one on the edge — a piece standing there, or even just attacking it, reaches further into the position. This lesson compares two ways to fight for the centre: breaking through it with a pawn, and holding it quietly instead.',
  tags: ['center-control'],
  segments: [
    {
      startFen: null,
      intro:
        'You are White. Central squares matter because a piece standing on one, or even just attacking one, reaches further into the position than the same piece anywhere else. One way to fight for the centre is a pawn break: a pawn move that challenges an enemy central pawn head-on instead of developing around it.',
      moves: [
        { san: 'e4', note: 'Claims a central square immediately — the most direct way to start the fight for the centre.' },
        { san: 'e5', note: 'Black stakes an equal claim, and now both central pawns face each other.' },
        { san: 'Nf3', note: 'Develops a knight and attacks the e5 pawn at the same time.' },
        { san: 'Nc6', note: 'Black defends e5 with a knight, developing while doing it.' },
        {
          san: 'd4',
          note: 'A pawn break — it challenges Black\'s e5 pawn directly instead of developing around it.',
          checkpoint: {
            id: 'theme-centre-strike-d4',
            prompt: 'Challenge Black\'s central pawn directly. Which pawn move does that?',
            accept: ['d4'],
            hints: [
              'A pawn break challenges an enemy central pawn head-on, rather than developing around it.',
              'Your d-pawn can advance two squares to strike at Black\'s e5 pawn.',
              'Play d4.',
            ],
            nearMiss: {
              Bc4: 'Develops, but this lesson is about the pawn break — the direct pawn challenge, not a piece move.',
              Nc3: 'Also develops, but it leaves the centre untouched. Play the pawn move that challenges e5 directly.',
            },
          },
        },
      ],
    },
    {
      startFen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
      intro:
        'Breaking with d4 is not the only plan. Here White holds the same central pawn on e4 without ever pushing it forward, building a solid pawn structure — the pattern your own pawns make together — and waiting instead of striking.',
      moves: [
        { san: 'd3', note: 'Defends e4 quietly instead of pushing the centre forward, so the tension between the pawns stays exactly where it is.' },
        { san: 'Bc5', note: 'Black mirrors the quiet approach, developing rather than reacting to any threat.' },
        { san: 'c3', note: 'Prepares d4 for later without playing it yet — the centre stays flexible instead of being resolved immediately.' },
      ],
    },
  ],
});
