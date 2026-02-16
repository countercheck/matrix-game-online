import { randomBytes } from 'crypto';
import { ResultType } from '@prisma/client';
import type {
  ResolutionStrategy,
  ResolutionVotes,
  ResolutionResult,
  VoteTokenMapping,
} from '../resolution-strategy.js';
import { registerStrategy } from '../registry.js';

const VOTE_TOKEN_MAP: Record<string, VoteTokenMapping> = {
  LIKELY_SUCCESS: { successTokens: 2, failureTokens: 0 },
  LIKELY_FAILURE: { successTokens: 0, failureTokens: 2 },
  UNCERTAIN: { successTokens: 1, failureTokens: 1 },
};

function getSecureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8) || 1;
  const maxValid = Math.floor(256 ** bytesNeeded / range) * range - 1;

  let randomInt;
  do {
    const bytes = randomBytes(bytesNeeded);
    randomInt = bytes.readUIntBE(0, bytesNeeded);
  } while (randomInt > maxValid);

  return min + (randomInt % range);
}

function getResultType(successCount: number): ResultType {
  switch (successCount) {
    case 3:
      return ResultType.TRIUMPH;
    case 2:
      return ResultType.SUCCESS_BUT;
    case 1:
      return ResultType.FAILURE_BUT;
    default:
      return ResultType.DISASTER;
  }
}

const tokenDrawStrategy: ResolutionStrategy = {
  id: 'token_draw',
  displayName: 'Token Draw',
  description:
    'Draw 3 tokens from a pool. Votes shift the pool toward success or failure.',

  mapVoteToTokens(voteType): VoteTokenMapping {
    return VOTE_TOKEN_MAP[voteType]!;
  },

  resolve(votes: ResolutionVotes): ResolutionResult {
    const totalSuccess =
      1 + votes.votes.reduce((sum, v) => sum + v.successTokens, 0);
    const totalFailure =
      1 + votes.votes.reduce((sum, v) => sum + v.failureTokens, 0);

    const seed = randomBytes(32).toString('hex');

    const tokens: ('SUCCESS' | 'FAILURE')[] = [
      ...Array<'SUCCESS'>(totalSuccess).fill('SUCCESS'),
      ...Array<'FAILURE'>(totalFailure).fill('FAILURE'),
    ];

    // Fisher-Yates shuffle with crypto randomness
    for (let i = tokens.length - 1; i > 0; i--) {
      const j = getSecureRandomInt(0, i);
      [tokens[i], tokens[j]] = [tokens[j]!, tokens[i]!];
    }

    const drawn = tokens.slice(0, 3) as ('SUCCESS' | 'FAILURE')[];
    const drawnSuccess = drawn.filter((t) => t === 'SUCCESS').length;
    const drawnFailure = 3 - drawnSuccess;
    const resultValue = drawnSuccess * 2 - 3;
    const resultType = getResultType(drawnSuccess);

    return {
      resultType,
      resultValue,
      strategyData: {
        seed,
        totalSuccessTokens: totalSuccess,
        totalFailureTokens: totalFailure,
        drawnSuccess,
        drawnFailure,
        drawnTokens: drawn.map((type, index) => ({
          drawSequence: index + 1,
          tokenType: type,
        })),
      },
    };
  },
};

registerStrategy(tokenDrawStrategy);
