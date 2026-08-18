/**
 * Chess vocabulary a player meets on the way up, in the order they meet it.
 *
 * Not the same list as the vault's `Glossary.md`, which is *this project's*
 * internal vocabulary for people reading the code. This one is for players,
 * and includes the handful of engine terms the app itself puts on screen
 * (evaluation, line, ply) so nothing here is jargon without a home.
 *
 * Definitions are deliberately short and concrete. Every claim of fact in this
 * file is one a beginner could check on a board — this repo has shipped nine
 * confident, false statements about chess in authored prose before, and none
 * of them were catchable by a test.
 */

export type GlossaryTier = 'basics' | 'ideas' | 'deeper';

export interface GlossaryEntry {
  term: string;
  definition: string;
  tier: GlossaryTier;
}

export const GLOSSARY_TIERS: { id: GlossaryTier; heading: string; blurb: string }[] = [
  { id: 'basics', heading: 'THE BOARD AND THE RULES', blurb: 'Worth knowing before your first game.' },
  { id: 'ideas', heading: 'IDEAS AND TACTICS', blurb: 'The words players use to explain moves.' },
  { id: 'deeper', heading: 'DEEPER WATER', blurb: 'Including the terms this app puts on screen.' },
];

export const GLOSSARY: GlossaryEntry[] = [
  // ---- The board and the rules -------------------------------------------
  {
    term: 'Rank',
    definition:
      'A row of the board, running side to side. The ranks are numbered 1 to 8, with 1 nearest White.',
    tier: 'basics',
  },
  {
    term: 'File',
    definition:
      'A column of the board, running from White\'s side to Black\'s. The files are lettered a to h, left to right from White\'s point of view.',
    tier: 'basics',
  },
  {
    term: 'Diagonal',
    definition: 'A line of squares of the same colour, running corner to corner. Bishops move along them.',
    tier: 'basics',
  },
  {
    term: 'Development',
    definition:
      'Bringing your knights and bishops off their starting squares and into the game. In the opening, a move that develops a piece is usually doing more than one that does not.',
    tier: 'basics',
  },
  {
    term: 'The centre',
    definition:
      'The four squares in the middle: d4, d5, e4 and e5. Pieces placed there, or attacking there, reach more of the board than pieces on the edge.',
    tier: 'basics',
  },
  {
    term: 'Castling',
    definition:
      'A single move in which the king steps two squares towards a rook and that rook hops over to its far side. It is the only move that shifts two pieces at once, and it is how the king gets to safety. Neither piece may have moved before, the squares between them must be empty, and the king may not castle out of, through, or into check.',
    tier: 'basics',
  },
  {
    term: 'Check',
    definition:
      'Your king is attacked. You must answer it immediately — move the king, block the attack, or capture the attacker. There is no option to ignore it.',
    tier: 'basics',
  },
  {
    term: 'Checkmate',
    definition: 'The king is in check and no legal move escapes it. The game ends at once, and that side loses.',
    tier: 'basics',
  },
  {
    term: 'Stalemate',
    definition:
      'The side to move has no legal move and is not in check. The game is a draw — which makes it a lifeline for the losing side and a trap for the winning one.',
    tier: 'basics',
  },
  {
    term: 'En passant',
    definition:
      'French for "in passing". When a pawn uses its two-square first move to slip past an enemy pawn on an adjacent file, that pawn may capture it as though it had moved only one square. The chance lasts for one move only.',
    tier: 'basics',
  },
  {
    term: 'Promotion',
    definition:
      'A pawn reaching the far end of the board becomes a queen, rook, bishop or knight of its own colour — your choice, and not limited to pieces already captured. Almost always a queen.',
    tier: 'basics',
  },
  {
    term: 'Material',
    definition:
      'The pieces you have, counted roughly: a pawn 1, a knight or bishop 3, a rook 5, a queen 9. A rough guide for trades, not a law — position often matters more.',
    tier: 'basics',
  },

  // ---- Ideas and tactics --------------------------------------------------
  {
    term: 'Tempo',
    definition:
      'A move, counted as a unit of time. You "gain a tempo" when you make a threat your opponent must answer, so your next useful move comes free.',
    tier: 'ideas',
  },
  {
    term: 'Fork',
    definition:
      'One piece attacking two or more targets at once. The defender can usually save only one. Knights fork especially well, because nothing they attack can attack them back.',
    tier: 'ideas',
  },
  {
    term: 'Pin',
    definition:
      'A piece that cannot move without exposing something more valuable behind it. If the thing behind is the king the pin is absolute — moving is illegal, not merely unwise.',
    tier: 'ideas',
  },
  {
    term: 'Skewer',
    definition:
      'A pin the other way round: the valuable piece is in front and must move, letting you take the lesser one behind it.',
    tier: 'ideas',
  },
  {
    term: 'Discovered attack',
    definition:
      'Moving one piece to unveil an attack from another behind it. Two threats appear from one move, which is why it is so often decisive.',
    tier: 'ideas',
  },
  {
    term: 'Open file',
    definition:
      'A file with no pawns on it. Rooks want to stand on one, because nothing blocks them from the whole length of the board.',
    tier: 'ideas',
  },
  {
    term: 'Doubled pawns',
    definition:
      'Two of your pawns on the same file, the result of a capture. They cannot defend each other and one often becomes hard to protect.',
    tier: 'ideas',
  },
  {
    term: 'Isolated pawn',
    definition:
      'A pawn with no friendly pawn on either neighbouring file. No pawn can ever defend it, so pieces must — and the square in front of it makes a comfortable home for an enemy piece.',
    tier: 'ideas',
  },
  {
    term: 'Passed pawn',
    definition:
      'A pawn with no enemy pawn ahead of it on its own file or either neighbouring file. Nothing but pieces can stop it from promoting.',
    tier: 'ideas',
  },
  {
    term: 'Fianchetto',
    definition:
      'Developing a bishop to the long diagonal by first moving the knight\'s pawn one square — for White, b3 and Bb2, or g3 and Bg2.',
    tier: 'ideas',
  },
  {
    term: 'Outpost',
    definition:
      'A square in enemy territory that their pawns can no longer attack, usually because the pawn that would have covered it is gone. A knight sitting there is very hard to remove.',
    tier: 'ideas',
  },
  {
    term: 'Initiative',
    definition:
      'Being the one making threats, so your opponent spends their moves answering rather than improving. Not the same as being ahead on material.',
    tier: 'ideas',
  },

  // ---- Deeper water -------------------------------------------------------
  {
    term: 'Line (or variation)',
    definition:
      'A specific sequence of moves, considered together. "The main line" is the sequence most commonly played from a position.',
    tier: 'deeper',
  },
  {
    term: 'Ply',
    definition:
      'One move by one player. A "move" in chess writing usually means both sides have played, so 1.e4 e5 is one move but two plies. The word exists because "move" is ambiguous when you need to count exactly.',
    tier: 'deeper',
  },
  {
    term: 'Evaluation',
    definition:
      'An engine\'s verdict on a position, in pawns: +1.0 means White stands about a pawn better, −0.5 that Black is slightly better. It is an opinion about the whole position, not a score for a single move.',
    tier: 'deeper',
  },
  {
    term: 'Transposition',
    definition:
      'Reaching the same position by a different order of moves. Two openings that look unrelated can arrive at an identical board.',
    tier: 'deeper',
  },
  {
    term: 'Prophylaxis',
    definition:
      'Playing a move to stop your opponent\'s plan before it starts, rather than pursuing your own. Quiet, and often the hardest kind of move to find.',
    tier: 'deeper',
  },
  {
    term: 'Zugzwang',
    definition:
      'German for "compulsion to move". A position where every legal move makes things worse, and you would rather pass — which the rules do not allow. Common in endgames.',
    tier: 'deeper',
  },
];
