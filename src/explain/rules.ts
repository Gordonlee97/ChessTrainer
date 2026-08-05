import type { Color } from 'chess.js';
import { findFork, findPin } from '../chess/tactics';
import type { MoveContext, Reason, Rule } from './types';

function other(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/** Material from the mover's point of view, so a gain is always positive. */
function materialEdge(ctx: MoveContext, when: 'featuresBefore' | 'featuresAfter'): number {
  const f = ctx[when].material;
  return f[ctx.mover] - f[other(ctx.mover)];
}

const centerRule: Rule = (ctx) => {
  const gained =
    ctx.featuresAfter.centerControl[ctx.mover] - ctx.featuresBefore.centerControl[ctx.mover];
  if (gained <= 0) return null;
  return {
    tag: 'center',
    polarity: 'good',
    weight: 40 + gained * 5,
    text: 'Stakes a claim in the centre, the squares both sides need.',
  };
};

const developmentRule: Rule = (ctx) => {
  const gained =
    ctx.featuresAfter.developedMinors[ctx.mover] - ctx.featuresBefore.developedMinors[ctx.mover];
  if (gained <= 0) return null;
  return {
    tag: 'development',
    polarity: 'good',
    weight: 45,
    text: 'Brings a new piece into the game.',
  };
};

const kingSafetyRule: Rule = (ctx) => {
  if (ctx.featuresBefore.castled[ctx.mover] || !ctx.featuresAfter.castled[ctx.mover]) return null;
  return {
    tag: 'king-safety',
    polarity: 'good',
    weight: 55,
    text: 'Tucks the king away and connects the rooks.',
  };
};

const materialRule: Rule = (ctx) => {
  const gained = materialEdge(ctx, 'featuresAfter') - materialEdge(ctx, 'featuresBefore');
  if (gained <= 0) return null;
  return {
    tag: 'material',
    polarity: 'good',
    weight: Math.min(100, 70 + gained * 3),
    text: `Wins material — up ${gained} point${gained === 1 ? '' : 's'} on the exchange.`,
  };
};

const forkRule: Rule = (ctx) => {
  const fork = findFork(ctx.after, ctx.to);
  if (!fork) return null;
  return {
    tag: 'fork',
    polarity: 'good',
    weight: 85,
    text: `Forks ${fork.targets.length} pieces at once — they cannot both be saved.`,
  };
};

const pinRule: Rule = (ctx) => {
  const pin = findPin(ctx.after, ctx.to);
  if (!pin) return null;
  return {
    tag: 'pin',
    polarity: 'good',
    weight: 75,
    text: `Pins the piece on ${pin.pinned} — it cannot move without exposing the king.`,
  };
};

const hangingRule: Rule = (ctx) => {
  const before = new Set(ctx.featuresBefore.hanging[ctx.mover]);
  const nowHanging = ctx.featuresAfter.hanging[ctx.mover].filter((sq) => !before.has(sq));
  if (nowHanging.length === 0) return null;
  return {
    tag: 'hanging',
    polarity: 'bad',
    weight: 80,
    text: `Leaves the piece on ${nowHanging[0]} undefended and under attack.`,
  };
};

const pawnStructureRule: Rule = (ctx) => {
  const reasons: Reason[] = [];
  const before = ctx.featuresBefore.pawnStructure;
  const after = ctx.featuresAfter.pawnStructure;

  if (after.doubled[ctx.mover] > before.doubled[ctx.mover]) {
    reasons.push({
      tag: 'pawn-structure',
      polarity: 'bad',
      weight: 35,
      text: 'Doubles a pawn, which weakens the structure long term.',
    });
  }

  const newPassed = after.passed[ctx.mover].length - before.passed[ctx.mover].length;
  if (newPassed > 0) {
    reasons.push({
      tag: 'pawn-structure',
      polarity: 'good',
      weight: 50,
      text: 'Creates a passed pawn with a clear run at promotion.',
    });
  }

  return reasons.length > 0 ? reasons : null;
};

const tempoRule: Rule = (ctx) => {
  if (!ctx.san.includes('+') && !ctx.san.includes('#')) return null;
  return {
    tag: 'tempo',
    polarity: 'good',
    weight: 60,
    text: 'Gives check, forcing a reply and winning a tempo.',
  };
};

const mobilityRule: Rule = (ctx) => {
  const before = ctx.featuresBefore.mobility[ctx.mover];
  const after = ctx.featuresAfter.mobility[ctx.mover];
  if (before === null || after === null) return null;
  const gained = after - before;
  if (gained < 5) return null;
  return {
    tag: 'mobility',
    polarity: 'good',
    weight: 30,
    text: 'Opens lines, giving the pieces noticeably more freedom.',
  };
};

export const ALL_RULES: Rule[] = [
  forkRule,
  hangingRule,
  pinRule,
  materialRule,
  tempoRule,
  kingSafetyRule,
  pawnStructureRule,
  developmentRule,
  centerRule,
  mobilityRule,
];
