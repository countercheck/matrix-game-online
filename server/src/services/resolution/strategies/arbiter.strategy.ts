import { ResultType } from '@prisma/client';
import type {
  ArbiterResolutionStrategy,
  ArbiterResolutionContext,
  ResolutionResult,
} from '../resolution-strategy.js';
import { registerStrategy } from '../registry.js';
import { rollDie } from '../../../utils/random.js';

const arbiterStrategy: ArbiterResolutionStrategy = {
  id: 'arbiter',
  displayName: 'Arbiter',
  description:
    'An arbiter marks arguments as strong. A 2d6 roll modified by strong arguments determines success (> 7) or failure.',
  type: 'arbiter' as const,
  phaseAfterArgumentation: 'ARBITER_REVIEW' as const,
  maxArgumentsPerSide: 3,

  resolve({ strongProCount, strongAntiCount }: ArbiterResolutionContext): ResolutionResult {
    const diceRoll: [number, number] = [rollDie(), rollDie()];
    const base = diceRoll[0] + diceRoll[1];
    const modified = base + strongProCount - strongAntiCount;
    const resultType = modified > 7 ? ResultType.SUCCESS_BUT : ResultType.FAILURE_BUT;
    const resultValue = modified > 7 ? 1 : -1;
    return {
      resultType,
      resultValue,
      strategyData: { diceRoll, base, strongProCount, strongAntiCount, modified },
    };
  },
};

registerStrategy(arbiterStrategy);
