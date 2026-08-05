import type { Color, Square } from 'chess.js';
import type { PositionFeatures } from '../chess/features';

export type ReasonTag =
  | 'center'
  | 'development'
  | 'king-safety'
  | 'material'
  | 'fork'
  | 'pin'
  | 'hanging'
  | 'tempo'
  | 'pawn-structure'
  | 'mobility'
  | 'space';

export interface Reason {
  tag: ReasonTag;
  polarity: 'good' | 'bad';
  /** Higher wins the ranking. Rules use 0-100 so they stay comparable. */
  weight: number;
  /** A complete sentence, ready to render. */
  text: string;
}

export interface MoveContext {
  /** FEN before the move was played. */
  before: string;
  /** FEN after the move was played. */
  after: string;
  san: string;
  from: Square;
  to: Square;
  /** The side that played the move. */
  mover: Color;
  featuresBefore: PositionFeatures;
  featuresAfter: PositionFeatures;
  /** Centipawns given up against the engine's best move; null when unknown. */
  loss: number | null;
}

export type Rule = (ctx: MoveContext) => Reason | Reason[] | null;
