import type { ResultType } from '@prisma/client';

/** Immutable input representing votes cast on an action */
export interface ResolutionVotes {
  readonly votes: ReadonlyArray<{
    readonly playerId: string;
    readonly voteType: 'LIKELY_SUCCESS' | 'LIKELY_FAILURE' | 'UNCERTAIN';
    readonly successTokens: number;
    readonly failureTokens: number;
  }>;
}

/** Common result shape produced by every resolution strategy */
export interface ResolutionResult {
  readonly resultType: ResultType;
  readonly resultValue: number;
  readonly strategyData: Record<string, unknown>;
}

/** Token contributions for a given vote type */
export interface VoteTokenMapping {
  readonly successTokens: number;
  readonly failureTokens: number;
}

/**
 * Core strategy interface for action resolution.
 * Strategies are stateless — resolve() is a pure function with no side effects.
 */
export interface ResolutionStrategy {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;

  /** Map a vote type to token contributions for this strategy */
  mapVoteToTokens(
    voteType: 'LIKELY_SUCCESS' | 'LIKELY_FAILURE' | 'UNCERTAIN'
  ): VoteTokenMapping;

  /** Execute the resolution given the collected votes */
  resolve(votes: ResolutionVotes): ResolutionResult;
}
